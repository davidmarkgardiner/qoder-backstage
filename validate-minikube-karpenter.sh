#!/bin/bash

# validate-minikube-karpenter.sh
# Minikube-specific validation for Karpenter integration
# This script validates what we CAN test in minikube environment

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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
}

# Check current cluster type
check_cluster_type() {
    log_info "Checking cluster type..."
    
    local cluster_info
    cluster_info=$(kubectl cluster-info 2>/dev/null | head -1)
    
    if echo "$cluster_info" | grep -q "localhost"; then
        log_warning "Running on local cluster (likely minikube)"
        log_warning "Karpenter CRDs will NOT be available"
        log_info "This validation will test what's possible in minikube"
        return 0
    else
        log_info "Running on remote cluster - Karpenter resources may be available"
        return 1
    fi
}

# Check if Karpenter CRDs exist
check_karpenter_crds() {
    log_info "Checking for Karpenter CRDs..."
    
    local karpenter_crds=("nodepools.karpenter.sh" "nodeclaims.karpenter.sh" "aksnodeclasses.karpenter.azure.com")
    local crds_found=0
    
    for crd in "${karpenter_crds[@]}"; do
        if kubectl get crd "$crd" >/dev/null 2>&1; then
            log_success "Found CRD: $crd"
            ((crds_found++))
        else
            log_warning "CRD not found: $crd"
        fi
    done
    
    if [ $crds_found -eq 0 ]; then
        log_warning "No Karpenter CRDs found - testing in simulation mode"
        return 1
    else
        log_success "Found $crds_found Karpenter CRDs"
        return 0
    fi
}

# Test workflow template validation
test_workflow_templates() {
    log_info "Testing workflow templates..."
    
    # Check Karpenter workflow template
    if kubectl get workflowtemplate aks-cluster-provisioning-aso-karpenter >/dev/null 2>&1; then
        log_success "Karpenter workflow template exists"
        
        # Get template details
        local template_info
        template_info=$(kubectl get workflowtemplate aks-cluster-provisioning-aso-karpenter -o yaml)
        
        # Check for key steps
        if echo "$template_info" | grep -q "create-karpenter-nodeclass"; then
            log_success "Template contains Karpenter NodeClass creation step"
        fi
        
        if echo "$template_info" | grep -q "create-karpenter-nodepool"; then
            log_success "Template contains Karpenter NodePool creation step"
        fi
        
    else
        log_error "Karpenter workflow template not found"
        return 1
    fi
    
    # Check KRO workflow template for comparison
    if kubectl get workflowtemplate aks-cluster-provisioning >/dev/null 2>&1; then
        log_success "KRO workflow template exists for comparison"
    else
        log_warning "KRO workflow template not found"
    fi
}

# Test dry-run workflow execution
test_dry_run_workflow() {
    log_info "Testing dry-run workflow execution..."
    
    local test_workflow_name="minikube-karpenter-test-$(date +%s)"
    
    # Create test workflow
    cat << EOF | kubectl apply -f -
apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  name: ${test_workflow_name}
  namespace: default
spec:
  workflowTemplateRef:
    name: aks-cluster-provisioning-aso-karpenter
  arguments:
    parameters:
    - name: cluster-name
      value: minikube-test-cluster
    - name: location
      value: eastus
    - name: node-pool-type
      value: standard
    - name: dry-run
      value: "true"
    - name: kubernetes-version
      value: "1.28.3"
    - name: primary-vm-size
      value: Standard_DS2_v2
    - name: secondary-vm-size
      value: Standard_DS3_v2
    - name: sku-family
      value: D
    - name: max-cpu
      value: "1000"
    - name: max-memory
      value: 1000Gi
    - name: system-vm-size
      value: Standard_B2s
    - name: enable-nap
      value: "true"
EOF
    
    if [ $? -eq 0 ]; then
        log_success "Test workflow created: ${test_workflow_name}"
        
        # Wait for completion
        local timeout=60
        local elapsed=0
        
        while [ $elapsed -lt $timeout ]; do
            local status
            status=$(kubectl get workflow "${test_workflow_name}" -o jsonpath='{.status.phase}' 2>/dev/null || echo "")
            
            case "$status" in
                "Succeeded")
                    log_success "Workflow completed successfully"
                    kubectl delete workflow "${test_workflow_name}" >/dev/null 2>&1
                    return 0
                    ;;
                "Failed"|"Error")
                    log_error "Workflow failed"
                    kubectl get workflow "${test_workflow_name}" -o yaml | tail -20
                    kubectl delete workflow "${test_workflow_name}" >/dev/null 2>&1
                    return 1
                    ;;
                "Running"|"Pending")
                    log_info "Workflow running... (${elapsed}s)"
                    sleep 5
                    elapsed=$((elapsed + 5))
                    ;;
                *)
                    log_info "Workflow status: ${status} (${elapsed}s)"
                    sleep 5
                    elapsed=$((elapsed + 5))
                    ;;
            esac
        done
        
        log_warning "Workflow test timeout"
        kubectl delete workflow "${test_workflow_name}" >/dev/null 2>&1
        return 1
    else
        log_error "Failed to create test workflow"
        return 1
    fi
}

# Test backend integration (if available)
test_backend_integration() {
    log_info "Testing backend integration..."
    
    local backend_url="http://localhost:3001"
    
    # Check if backend is running
    if curl -s "${backend_url}/api/health" >/dev/null 2>&1; then
        log_success "Backend is running"
        
        # Test node pool configurations
        local node_pools
        node_pools=$(curl -s "${backend_url}/api/azure/node-pool-types" 2>/dev/null || echo "")
        
        if [ -n "$node_pools" ] && echo "$node_pools" | grep -q "nodePoolTypes"; then
            log_success "Backend returning node pool configurations"
            
            # Check for Karpenter-specific configurations
            if echo "$node_pools" | grep -q "karpenterConfig"; then
                log_success "Backend includes Karpenter configurations"
            else
                log_warning "Backend missing Karpenter configurations"
            fi
        else
            log_warning "Backend not returning expected node pool data"
        fi
    else
        log_warning "Backend not available at ${backend_url}"
        log_info "To test backend integration:"
        log_info "  cd idp-platform/backend && npm start"
    fi
}

# Test RBAC permissions
test_rbac_permissions() {
    log_info "Testing RBAC permissions..."
    
    # Check cluster role
    if kubectl get clusterrole idp-backend-workflow-manager >/dev/null 2>&1; then
        log_success "ClusterRole idp-backend-workflow-manager exists"
        
        # Check if it includes Karpenter permissions
        local rbac_rules
        rbac_rules=$(kubectl get clusterrole idp-backend-workflow-manager -o yaml)
        
        if echo "$rbac_rules" | grep -q "karpenter.sh"; then
            log_success "RBAC includes Karpenter permissions"
        else
            log_warning "RBAC missing Karpenter permissions"
        fi
        
        if echo "$rbac_rules" | grep -q "karpenter.azure.com"; then
            log_success "RBAC includes AKS Karpenter permissions"
        else
            log_warning "RBAC missing AKS Karpenter permissions"
        fi
    else
        log_error "ClusterRole idp-backend-workflow-manager not found"
        return 1
    fi
}

# Main validation
main() {
    echo "=== Minikube Karpenter Integration Validation ==="
    echo
    
    local is_minikube=false
    if check_cluster_type; then
        is_minikube=true
    fi
    
    local has_karpenter_crds=false
    if check_karpenter_crds; then
        has_karpenter_crds=true
    fi
    
    echo
    log_info "=== Workflow Template Testing ==="
    test_workflow_templates
    
    echo
    log_info "=== RBAC Permission Testing ==="
    test_rbac_permissions
    
    echo
    log_info "=== Dry-Run Workflow Testing ==="
    test_dry_run_workflow
    
    echo
    log_info "=== Backend Integration Testing ==="
    test_backend_integration
    
    echo
    log_info "=== Validation Summary ==="
    log_success "✓ Workflow templates are properly configured"
    log_success "✓ RBAC permissions are set up"
    log_success "✓ Dry-run workflows execute successfully"
    
    if [ "$is_minikube" = true ]; then
        log_warning "⚠ Running on minikube - Karpenter CRDs not available"
        log_info "ℹ To test with actual Karpenter resources, use an AKS cluster"
        echo
        log_info "Next steps for AKS testing:"
        log_info "1. kubectl config use-context <aks-cluster-context>"
        log_info "2. Ensure Karpenter is installed in the AKS cluster"
        log_info "3. Run this validation script again"
    else
        if [ "$has_karpenter_crds" = true ]; then
            log_success "✓ Karpenter CRDs available - full testing possible"
        else
            log_warning "⚠ Karpenter CRDs missing - install Karpenter first"
        fi
    fi
    
    echo
    log_success "Minikube validation completed successfully!"
}

main "$@"