#!/bin/bash
# Quick deploy script for Kubernetes manifests

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NAMESPACE="idp-platform"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

main() {
    local action="${1:-apply}"
    local manifests_dir="$PROJECT_ROOT/k8s-manifests"
    
    if [ "$action" = "delete" ]; then
        log_warn "Deleting IDP Platform from Kubernetes..."
        kubectl delete -f "$manifests_dir/" --ignore-not-found=true
        log_info "IDP Platform deleted"
        return
    fi
    
    log_info "Deploying IDP Platform to Kubernetes..."
    
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
    
    log_info "Waiting for deployments..."
    kubectl rollout status deployment/idp-backend -n $NAMESPACE --timeout=300s || true
    kubectl rollout status deployment/idp-frontend -n $NAMESPACE --timeout=300s || true
    
    log_info "Deployment completed!"
    log_info ""
    log_info "Check status with:"
    log_info "kubectl get pods -n $NAMESPACE"
    log_info "kubectl get services -n $NAMESPACE"
    log_info "kubectl get certificates -n $NAMESPACE"
}

if [ $# -gt 0 ] && [ "$1" = "--help" ]; then
    echo "Usage: $0 [apply|delete]"
    echo "  apply   - Deploy the application (default)"
    echo "  delete  - Remove the application"
    exit 0
fi

main "$@"