#!/bin/bash
# IDP Platform Deployment Script for AKS
# This script builds and deploys the IDP platform to your AKS cluster

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_REGISTRY="davidgardiner"  # Docker Hub username
IMAGE_TAG="${IMAGE_TAG:-latest}"
NAMESPACE="idp-platform"
DOMAIN="idp.davidmarkgardiner.co.uk"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."
    
    # Check required tools
    local tools=("kubectl" "docker" "helm")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is not installed or not in PATH"
            exit 1
        fi
    done
    
    # Check kubectl context
    if ! kubectl config current-context &> /dev/null; then
        log_error "No kubectl context set. Please configure your AKS cluster connection."
        exit 1
    fi
    
    local current_context=$(kubectl config current-context)
    log_info "Using kubectl context: $current_context"
    
    # Check if we can connect to the cluster
    if ! kubectl get nodes &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster. Please check your credentials."
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running or accessible"
        exit 1
    fi
    
    log_info "Prerequisites check passed ✓"
}

# Function to build and push Docker images
build_and_push_images() {
    log_step "Building and pushing Docker images..."
    
    cd "$SCRIPT_DIR"
    
    # Build backend image
    log_info "Building backend image..."
    docker build -f Dockerfile.backend -t "${DOCKER_REGISTRY}/idp-backend:${IMAGE_TAG}" .
    
    # Build frontend image
    log_info "Building frontend image..."
    docker build -f Dockerfile.frontend -t "${DOCKER_REGISTRY}/idp-frontend:${IMAGE_TAG}" .
    
    # Push images to Docker Hub
    log_info "Pushing images to Docker Hub..."
    docker push "${DOCKER_REGISTRY}/idp-backend:${IMAGE_TAG}"
    docker push "${DOCKER_REGISTRY}/idp-frontend:${IMAGE_TAG}"
    
    log_info "Images built and pushed successfully ✓"
}

# Function to check required operators
check_operators() {
    log_step "Checking required operators..."
    
    # Check Azure Service Operator
    if ! kubectl get crd managedclusters.resources.azure.com &> /dev/null; then
        log_warn "Azure Service Operator (ASO) not found. Please install ASO first."
        log_info "Run: kubectl apply -f https://github.com/Azure/azure-service-operator/releases/latest/download/azureserviceoperator_v2.5.0_linux_amd64.yaml"
    else
        log_info "Azure Service Operator found ✓"
    fi
    
    # Check Argo Workflows
    if ! kubectl get namespace argo &> /dev/null; then
        log_warn "Argo Workflows namespace not found. Please install Argo Workflows first."
        log_info "Run: kubectl create namespace argo && kubectl apply -n argo -f https://github.com/argoproj/argo-workflows/releases/latest/download/install.yaml"
    else
        log_info "Argo Workflows found ✓"
    fi
    
    # Check cert-manager
    if ! kubectl get crd certificates.cert-manager.io &> /dev/null; then
        log_warn "cert-manager not found. Please install cert-manager first."
    else
        log_info "cert-manager found ✓"
    fi
    
    # Check Istio
    if ! kubectl get namespace aks-istio-system &> /dev/null; then
        log_warn "Istio not found. Make sure Istio is installed in your AKS cluster."
    else
        log_info "Istio found ✓"
    fi
}

# Function to update image references in manifests
update_image_references() {
    log_step "Updating image references in manifests..."
    
    local manifests_dir="$SCRIPT_DIR/k8s-manifests"
    
    # Update backend image
    sed -i.bak "s|davidgardiner/idp-backend:latest|${DOCKER_REGISTRY}/idp-backend:${IMAGE_TAG}|g" \
        "$manifests_dir/03-deployments.yaml"
    
    # Update frontend image
    sed -i.bak "s|davidgardiner/idp-frontend:latest|${DOCKER_REGISTRY}/idp-frontend:${IMAGE_TAG}|g" \
        "$manifests_dir/03-deployments.yaml"
    
    log_info "Image references updated ✓"
}

# Function to deploy to Kubernetes
deploy_to_kubernetes() {
    log_step "Deploying to Kubernetes..."
    
    local manifests_dir="$SCRIPT_DIR/k8s-manifests"
    
    # Apply manifests in order
    local manifests=(
        "01-namespace-rbac.yaml"
        "02-configmaps.yaml"
        "03-deployments.yaml"
        "04-services.yaml"
        "05-istio-gateway.yaml"
        "06-certificates.yaml"
    )
    
    for manifest in "${manifests[@]}"; do
        log_info "Applying $manifest..."
        kubectl apply -f "$manifests_dir/$manifest"
    done
    
    log_info "Kubernetes manifests applied ✓"
}

# Function to wait for deployment
wait_for_deployment() {
    log_step "Waiting for deployments to be ready..."
    
    # Wait for namespace to be active
    kubectl wait --for=condition=Active namespace/$NAMESPACE --timeout=60s
    
    # Wait for deployments
    log_info "Waiting for backend deployment..."
    kubectl rollout status deployment/idp-backend -n $NAMESPACE --timeout=300s
    
    log_info "Waiting for frontend deployment..."
    kubectl rollout status deployment/idp-frontend -n $NAMESPACE --timeout=300s
    
    # Wait for certificate to be ready
    log_info "Waiting for TLS certificate..."
    timeout 300 bash -c 'until kubectl get certificate idp-wildcard-tls-cert -n idp-platform -o jsonpath="{.status.conditions[?(@.type==\"Ready\")].status}" | grep -q "True"; do sleep 10; done' || log_warn "Certificate may still be provisioning"
    
    log_info "Deployments are ready ✓"
}

# Function to verify deployment
verify_deployment() {
    log_step "Verifying deployment..."
    
    # Check pod status
    log_info "Checking pod status..."
    kubectl get pods -n $NAMESPACE
    
    # Check if all pods are running
    local not_running=$(kubectl get pods -n $NAMESPACE --field-selector=status.phase!=Running --no-headers 2>/dev/null | wc -l)
    if [ "$not_running" -gt 0 ]; then
        log_warn "Some pods are not in Running state"
        kubectl get pods -n $NAMESPACE
    else
        log_info "All pods are running ✓"
    fi
    
    # Check services
    log_info "Checking services..."
    kubectl get services -n $NAMESPACE
    
    # Check certificates
    log_info "Checking certificates..."
    kubectl get certificates -n $NAMESPACE
    kubectl get certificates -n aks-istio-system | grep idp || log_warn "Certificate in aks-istio-system not found"
    
    # Test backend health endpoint
    log_info "Testing backend health..."
    if kubectl exec -n $NAMESPACE deployment/idp-backend -- wget -q --spider http://localhost:3001/health 2>/dev/null; then
        log_info "Backend health check passed ✓"
    else
        log_warn "Backend health check failed - this may be normal during startup"
    fi
    
    # Test frontend health endpoint
    log_info "Testing frontend health..."
    if kubectl exec -n $NAMESPACE deployment/idp-frontend -- wget -q --spider http://localhost:80/health 2>/dev/null; then
        log_info "Frontend health check passed ✓"
    else
        log_warn "Frontend health check failed - this may be normal during startup"
    fi
}

# Function to get access information
get_access_info() {
    log_step "Getting access information..."
    
    log_info "Application will be accessible at: https://$DOMAIN"
    log_info ""
    log_info "DNS Configuration:"
    log_info "- The external-dns should automatically create DNS records"
    log_info "- Domain: $DOMAIN"
    log_info "- Certificate: Let's Encrypt via cert-manager"
    log_info ""
    log_info "Useful commands:"
    log_info "- View pods: kubectl get pods -n $NAMESPACE"
    log_info "- View logs (backend): kubectl logs -f deployment/idp-backend -n $NAMESPACE"
    log_info "- View logs (frontend): kubectl logs -f deployment/idp-frontend -n $NAMESPACE"
    log_info "- Check certificate: kubectl describe certificate idp-wildcard-tls-cert -n $NAMESPACE"
    log_info "- Check Istio gateway: kubectl get gateway -n $NAMESPACE"
    log_info ""
    
    # Check if DNS record exists
    log_info "Checking DNS resolution (this may take a few minutes)..."
    if nslookup "$DOMAIN" &> /dev/null; then
        local dns_ip=$(nslookup "$DOMAIN" | awk '/Address:/ && !/127.0.0.1/ {print $2; exit}')
        log_info "DNS record found: $DOMAIN -> $dns_ip"
    else
        log_warn "DNS record not yet available. External-DNS may still be creating it."
        log_info "You can check DNS propagation manually: nslookup $DOMAIN"
    fi
}

# Function to cleanup backup files
cleanup() {
    log_step "Cleaning up..."
    find "$PROJECT_ROOT/k8s-manifests" -name "*.bak" -delete 2>/dev/null || true
    log_info "Cleanup completed ✓"
}

# Function to show help
show_help() {
    cat << EOF
IDP Platform Deployment Script

Usage: $0 [OPTIONS]

Options:
    -h, --help              Show this help message
    -t, --tag TAG          Docker image tag (default: latest)
    -r, --registry NAME    Docker registry (default: davidgardiner)
    --skip-build           Skip building and pushing images
    --skip-deploy          Skip Kubernetes deployment
    --dry-run              Show what would be done without executing

Environment Variables:
    IMAGE_TAG              Docker image tag
    DOCKER_REGISTRY        Docker registry name

Examples:
    $0                     # Deploy with default settings
    $0 -t v1.0.0          # Deploy with specific tag
    $0 --skip-build       # Deploy without building images
    $0 --dry-run          # Show deployment plan

EOF
}

# Main function
main() {
    local skip_build=false
    local skip_deploy=false
    local dry_run=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -t|--tag)
                IMAGE_TAG="$2"
                shift 2
                ;;
            -r|--registry)
                DOCKER_REGISTRY="$2"
                shift 2
                ;;
            --skip-build)
                skip_build=true
                shift
                ;;
            --skip-deploy)
                skip_deploy=true
                shift
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    log_info "🚀 Starting IDP Platform deployment..."
    log_info "Registry: $DOCKER_REGISTRY"
    log_info "Image Tag: $IMAGE_TAG"
    log_info "Namespace: $NAMESPACE"
    log_info "Domain: $DOMAIN"
    log_info ""
    
    if [ "$dry_run" = true ]; then
        log_info "DRY RUN MODE - No actual changes will be made"
        log_info ""
    fi
    
    # Run deployment steps
    check_prerequisites
    check_operators
    
    if [ "$skip_build" = false ] && [ "$dry_run" = false ]; then
        build_and_push_images
    else
        log_info "Skipping image build step"
    fi
    
    if [ "$skip_deploy" = false ] && [ "$dry_run" = false ]; then
        update_image_references
        deploy_to_kubernetes
        wait_for_deployment
        verify_deployment
        get_access_info
    else
        log_info "Skipping deployment step"
    fi
    
    if [ "$dry_run" = false ]; then
        cleanup
        log_info ""
        log_info "🎉 IDP Platform deployment completed successfully!"
        log_info "Access your platform at: https://$DOMAIN"
    else
        log_info "Dry run completed. Use without --dry-run to perform actual deployment."
    fi
}

# Error handling
trap 'log_error "Deployment failed at line $LINENO. Exit code: $?"' ERR

# Run main function if script is executed directly
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi