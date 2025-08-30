#!/bin/bash

# =============================================================================
# AKS IDP Platform - Prerequisites Setup Script
# =============================================================================
# This script installs and configures all required prerequisites for the
# AKS Internal Developer Platform including KRO, Argo Workflows, and dependencies.
#
# Usage: ./setup-prerequisites.sh [--dry-run] [--verbose]
# =============================================================================

# Configuration Variables (modify as needed)
KUBE_CONTEXT="${KUBE_CONTEXT:-minikube}"
NAMESPACE_DEFAULT="${NAMESPACE_DEFAULT:-default}"
NAMESPACE_AZURE="${NAMESPACE_AZURE:-azure-system}"
NAMESPACE_ARGO="${NAMESPACE_ARGO:-argo}"
KRO_VERSION="${KRO_VERSION:-v0.0.1-alpha.2}"
ARGO_WORKFLOWS_VERSION="${ARGO_WORKFLOWS_VERSION:-v3.5.2}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Global variables
DRY_RUN=false
VERBOSE=false
ERRORS_FOUND=false

# =============================================================================
# Utility Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ERRORS_FOUND=true
}

log_verbose() {
    if [[ "$VERBOSE" == true ]]; then
        echo -e "${BLUE}[VERBOSE]${NC} $1"
    fi
}

check_command() {
    local cmd="$1"
    local install_msg="$2"
    
    if ! command -v "$cmd" &> /dev/null; then
        log_error "$cmd is not installed. $install_msg"
        return 1
    else
        log_verbose "$cmd is available"
        return 0
    fi
}

execute_command() {
    local cmd="$1"
    local description="$2"
    
    log_info "$description"
    log_verbose "Executing: $cmd"
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "[DRY RUN] Would execute: $cmd"
        return 0
    fi
    
    if eval "$cmd"; then
        log_success "$description completed"
        return 0
    else
        log_error "$description failed"
        return 1
    fi
}

# =============================================================================
# Validation Functions
# =============================================================================

validate_prerequisites() {
    log_info "Validating prerequisites..."
    
    local all_good=true
    
    # Check required commands
    check_command "kubectl" "Please install kubectl: https://kubernetes.io/docs/tasks/tools/" || all_good=false
    check_command "curl" "Please install curl" || all_good=false
    check_command "jq" "Please install jq: https://stedolan.github.io/jq/download/" || all_good=false
    
    # Check Kubernetes connectivity
    if ! kubectl cluster-info --context="$KUBE_CONTEXT" &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster with context: $KUBE_CONTEXT"
        all_good=false
    else
        log_success "Kubernetes cluster connectivity verified"
    fi
    
    # Check if ASO is installed
    if ! kubectl get crd managedclusters.containerservice.azure.com --context="$KUBE_CONTEXT" &> /dev/null; then
        log_error "Azure Service Operator not found. Please install ASO first."
        all_good=false
    else
        log_success "Azure Service Operator detected"
    fi
    
    if [[ "$all_good" != true ]]; then
        log_error "Prerequisites validation failed. Please fix the issues above."
        exit 1
    fi
    
    log_success "All prerequisites validated successfully"
}

validate_namespaces() {
    log_info "Validating required namespaces..."
    
    local namespaces=("$NAMESPACE_DEFAULT" "$NAMESPACE_AZURE" "$NAMESPACE_ARGO")
    
    for ns in "${namespaces[@]}"; do
        if ! kubectl get namespace "$ns" --context="$KUBE_CONTEXT" &> /dev/null; then
            execute_command "kubectl create namespace '$ns' --context='$KUBE_CONTEXT'" "Creating namespace $ns"
        else
            log_verbose "Namespace $ns already exists"
        fi
    done
}

# =============================================================================
# Installation Functions
# =============================================================================

install_kro() {
    log_info "Installing KRO (Kubernetes Resource Orchestrator)..."
    
    # Check if KRO is already installed
    if kubectl get crd resourcegroups.kro.run --context="$KUBE_CONTEXT" &> /dev/null; then
        log_warning "KRO already installed, skipping installation"
        return 0
    fi
    
    # Install KRO using the official installation method
    local kro_install_url="https://raw.githubusercontent.com/Azure/kro/main/config/install.yaml"
    
    execute_command "kubectl apply -f '$kro_install_url' --context='$KUBE_CONTEXT'" "Installing KRO CRDs and controller"
    
    # Wait for KRO controller to be ready
    execute_command "kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=kro-controller-manager -n kro-system --timeout=300s --context='$KUBE_CONTEXT'" "Waiting for KRO controller to be ready"
    
    # Verify installation
    if kubectl get crd resourcegroups.kro.run --context="$KUBE_CONTEXT" &> /dev/null; then
        log_success "KRO installed successfully"
    else
        log_error "KRO installation verification failed"
        return 1
    fi
}

install_argo_workflows() {
    log_info "Installing Argo Workflows..."
    
    # Check if Argo Workflows is already installed
    if kubectl get crd workflows.argoproj.io --context="$KUBE_CONTEXT" &> /dev/null; then
        log_warning "Argo Workflows already installed, skipping installation"
        return 0
    fi
    
    # Install Argo Workflows
    local argo_install_url="https://github.com/argoproj/argo-workflows/releases/download/$ARGO_WORKFLOWS_VERSION/install.yaml"
    
    execute_command "kubectl apply -n '$NAMESPACE_ARGO' -f '$argo_install_url' --context='$KUBE_CONTEXT'" "Installing Argo Workflows"
    
    # Wait for Argo Workflows to be ready
    execute_command "kubectl wait --for=condition=Ready pod -l app=workflow-controller -n '$NAMESPACE_ARGO' --timeout=300s --context='$KUBE_CONTEXT'" "Waiting for Argo Workflows controller to be ready"
    
    # Create RBAC for workflows
    execute_command "kubectl create rolebinding default-admin --clusterrole=admin --serviceaccount='$NAMESPACE_ARGO':default -n '$NAMESPACE_ARGO' --context='$KUBE_CONTEXT'" "Creating RBAC for Argo Workflows" || true
    
    # Verify installation
    if kubectl get crd workflows.argoproj.io --context="$KUBE_CONTEXT" &> /dev/null; then
        log_success "Argo Workflows installed successfully"
    else
        log_error "Argo Workflows installation verification failed"
        return 1
    fi
}

install_argo_cli() {
    log_info "Installing Argo CLI..."
    
    # Check if argo CLI is already installed
    if command -v argo &> /dev/null; then
        log_warning "Argo CLI already installed, skipping installation"
        return 0
    fi
    
    local install_dir="/usr/local/bin"
    local temp_dir="/tmp/argo-install"
    
    # Create temporary directory
    execute_command "mkdir -p '$temp_dir'" "Creating temporary directory"
    
    # Download and install Argo CLI
    local argo_cli_url="https://github.com/argoproj/argo-workflows/releases/download/$ARGO_WORKFLOWS_VERSION/argo-linux-amd64.gz"
    
    execute_command "curl -sLo '$temp_dir/argo.gz' '$argo_cli_url'" "Downloading Argo CLI"
    execute_command "gunzip '$temp_dir/argo.gz'" "Extracting Argo CLI"
    execute_command "chmod +x '$temp_dir/argo'" "Making Argo CLI executable"
    
    # Try to install to /usr/local/bin, fallback to user directory if no permissions
    if [[ "$DRY_RUN" != true ]]; then
        if sudo mv "$temp_dir/argo" "$install_dir/argo" 2>/dev/null; then
            log_success "Argo CLI installed to $install_dir/argo"
        else
            local user_bin="$HOME/.local/bin"
            mkdir -p "$user_bin"
            mv "$temp_dir/argo" "$user_bin/argo"
            log_success "Argo CLI installed to $user_bin/argo"
            log_warning "Please ensure $user_bin is in your PATH"
            export PATH="$user_bin:$PATH"
        fi
    fi
    
    # Cleanup
    execute_command "rm -rf '$temp_dir'" "Cleaning up temporary files"
}

deploy_idp_manifests() {
    log_info "Deploying IDP Kubernetes manifests..."
    
    local manifests_dir="$PROJECT_ROOT/k8s-manifests"
    
    # Apply configurations
    execute_command "kubectl apply -f '$manifests_dir/aso-resources/config.yaml' --context='$KUBE_CONTEXT'" "Applying configuration manifests"
    execute_command "kubectl apply -f '$manifests_dir/aso-resources/rbac.yaml' --context='$KUBE_CONTEXT'" "Applying RBAC manifests"
    
    # Apply KRO ResourceGroup definition
    execute_command "kubectl apply -f '$manifests_dir/kro-resources/aks-cluster-composition.yaml' --context='$KUBE_CONTEXT'" "Applying KRO ResourceGroup definition"
    
    # Apply Argo Workflow templates
    execute_command "kubectl apply -f '$manifests_dir/argo-workflows/' --context='$KUBE_CONTEXT'" "Applying Argo Workflow templates"
    
    log_success "IDP manifests deployed successfully"
}

# =============================================================================
# Testing Functions
# =============================================================================

test_dry_run_workflow() {
    log_info "Testing dry-run workflow..."
    
    # Create a test workflow
    local test_cluster_name="test-cluster-$(date +%s)"
    
    local workflow_yaml="apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  generateName: test-aks-provisioning-
  namespace: $NAMESPACE_DEFAULT
spec:
  workflowTemplateRef:
    name: aks-cluster-provisioning
  arguments:
    parameters:
    - name: cluster-name
      value: '$test_cluster_name'
    - name: location
      value: 'eastus'
    - name: node-pool-type
      value: 'standard'
    - name: enable-nap
      value: 'true'
    - name: dry-run
      value: 'true'
  serviceAccountName: aks-provisioning-workflow"

    # Submit test workflow
    if [[ "$DRY_RUN" != true ]]; then
        echo "$workflow_yaml" | kubectl apply -f - --context="$KUBE_CONTEXT"
        
        # Get the workflow name
        local workflow_name=$(kubectl get workflows -n "$NAMESPACE_DEFAULT" --context="$KUBE_CONTEXT" -o jsonpath='{.items[-1:].metadata.name}')
        
        log_info "Test workflow submitted: $workflow_name"
        log_info "Monitor with: kubectl get workflow $workflow_name -n $NAMESPACE_DEFAULT --context=$KUBE_CONTEXT -w"
        
        # Wait for workflow to complete (with timeout)
        local timeout=600
        local elapsed=0
        while [[ $elapsed -lt $timeout ]]; do
            local status=$(kubectl get workflow "$workflow_name" -n "$NAMESPACE_DEFAULT" --context="$KUBE_CONTEXT" -o jsonpath='{.status.phase}' 2>/dev/null || echo "")
            
            if [[ "$status" == "Succeeded" ]]; then
                log_success "Test workflow completed successfully"
                return 0
            elif [[ "$status" == "Failed" || "$status" == "Error" ]]; then
                log_error "Test workflow failed"
                kubectl get workflow "$workflow_name" -n "$NAMESPACE_DEFAULT" --context="$KUBE_CONTEXT" -o yaml
                return 1
            fi
            
            sleep 10
            elapsed=$((elapsed + 10))
            log_verbose "Waiting for workflow completion... ($elapsed/$timeout seconds)"
        done
        
        log_warning "Test workflow timed out after $timeout seconds"
        return 1
    else
        log_info "[DRY RUN] Would submit test workflow for cluster: $test_cluster_name"
    fi
}

# =============================================================================
# Main Functions
# =============================================================================

show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --dry-run     Show what would be done without executing"
    echo "  --verbose     Enable verbose output"
    echo "  --help        Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  KUBE_CONTEXT          Kubernetes context to use (default: minikube)"
    echo "  NAMESPACE_DEFAULT     Default namespace (default: default)"
    echo "  NAMESPACE_AZURE       Azure namespace (default: azure-system)"
    echo "  NAMESPACE_ARGO        Argo namespace (default: argo)"
    echo "  KRO_VERSION          KRO version to install (default: v0.0.1-alpha.2)"
    echo "  ARGO_WORKFLOWS_VERSION Argo Workflows version (default: v3.5.2)"
}

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    log_info "Starting AKS IDP Platform setup..."
    log_info "Configuration:"
    log_info "  Kubernetes Context: $KUBE_CONTEXT"
    log_info "  Default Namespace: $NAMESPACE_DEFAULT"
    log_info "  Azure Namespace: $NAMESPACE_AZURE"
    log_info "  Argo Namespace: $NAMESPACE_ARGO"
    log_info "  Dry Run: $DRY_RUN"
    log_info "  Verbose: $VERBOSE"
    
    # Execute setup steps
    validate_prerequisites
    validate_namespaces
    install_kro
    install_argo_workflows
    install_argo_cli
    deploy_idp_manifests
    test_dry_run_workflow
    
    if [[ "$ERRORS_FOUND" == true ]]; then
        log_error "Setup completed with errors. Please review the output above."
        exit 1
    else
        log_success "AKS IDP Platform setup completed successfully!"
        log_info ""
        log_info "Next steps:"
        log_info "1. Start the backend server: cd idp-platform/backend && npm start"
        log_info "2. Start the frontend: cd idp-platform/frontend && npm start"
        log_info "3. Access the IDP at: http://localhost:3000"
        log_info ""
        log_info "Useful commands:"
        log_info "  kubectl get workflows -n $NAMESPACE_DEFAULT --context=$KUBE_CONTEXT"
        log_info "  kubectl get aksclusters.kro.run -n $NAMESPACE_DEFAULT --context=$KUBE_CONTEXT"
        log_info "  kubectl get managedclusters.containerservice.azure.com -n $NAMESPACE_AZURE --context=$KUBE_CONTEXT"
    fi
}

# =============================================================================
# Script Entry Point
# =============================================================================

# Trap to handle script interruption
trap 'log_error "Script interrupted"; exit 1' INT TERM

# Run main function
main "$@"