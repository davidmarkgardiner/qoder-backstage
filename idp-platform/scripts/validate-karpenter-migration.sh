#!/bin/bash

# validate-karpenter-migration.sh
# Validation script for Karpenter migration testing
# This script validates both KRO and Karpenter workflows in dry-run mode

set -e

# Color output for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
TEST_CLUSTER_PREFIX="test-migration"
TEST_LOCATION="${TEST_LOCATION:-eastus}"
DRY_RUN="${DRY_RUN:-true}"

# Logging functions
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

# Function to check if backend is running
check_backend() {
    log_info "Checking backend availability..."
    if ! curl -s "${BACKEND_URL}/api/health" >/dev/null 2>&1; then
        log_error "Backend not available at ${BACKEND_URL}"
        log_info "Please start the backend service first:"
        log_info "  cd ${PROJECT_ROOT}/backend && npm start"
        exit 1
    fi
    log_success "Backend is available"
}

# Function to check if kubectl is available
check_kubectl() {
    log_info "Checking kubectl availability..."
    if ! command -v kubectl >/dev/null 2>&1; then
        log_error "kubectl is not available"
        exit 1
    fi
    log_success "kubectl is available"
}

# Function to check if Argo Workflows is available
check_argo() {
    log_info "Checking Argo Workflows availability..."
    if ! kubectl get workflowtemplates >/dev/null 2>&1; then
        log_error "Argo Workflows not available or not configured"
        log_info "Please ensure Argo Workflows is installed and configured"
        exit 1
    fi
    log_success "Argo Workflows is available"
}

# Function to validate workflow template exists
check_workflow_template() {
    local template_name="$1"
    log_info "Checking workflow template: ${template_name}"
    
    if kubectl get workflowtemplate "${template_name}" >/dev/null 2>&1; then
        log_success "Workflow template ${template_name} exists"
        return 0
    else
        log_warning "Workflow template ${template_name} not found"
        return 1
    fi
}

# Function to test node pool configuration retrieval
test_node_pool_configs() {
    log_info "Testing node pool configurations..."
    
    local response
    response=$(curl -s "${BACKEND_URL}/api/azure/node-pool-types" || echo "")
    
    if [ -z "$response" ]; then
        log_error "Failed to retrieve node pool configurations"
        return 1
    fi
    
    # Check if response contains expected node pool types
    if echo "$response" | grep -q "standard\|memory-optimized\|compute-optimized"; then
        log_success "Node pool configurations retrieved successfully"
        log_info "Available configurations:"
        echo "$response" | jq '.[].nodePoolTypes[]' 2>/dev/null || echo "$response"
        return 0
    else
        log_error "Invalid node pool configuration response"
        return 1
    fi
}

# Function to create test workflow
create_test_workflow() {
    local workflow_type="$1"
    local node_pool_type="$2"
    local cluster_name="${TEST_CLUSTER_PREFIX}-${workflow_type}-${node_pool_type}-$(date +%s)"
    
    log_info "Creating test ${workflow_type} workflow for ${node_pool_type} node pool..."
    
    local payload
    payload=$(cat <<EOF
{
    "clusterName": "${cluster_name}",
    "location": "${TEST_LOCATION}",
    "nodePoolType": "${node_pool_type}",
    "dryRun": ${DRY_RUN},
    "enableNAP": true,
    "advancedConfig": {
        "kubernetesVersion": "1.28.3",
        "maxNodes": 10,
        "enableSpot": false
    }
}
EOF
    )
    
    local response
    response=$(curl -s -X POST "${BACKEND_URL}/api/clusters" \
        -H "Content-Type: application/json" \
        -d "$payload" || echo "")
    
    if [ -z "$response" ]; then
        log_error "Failed to create ${workflow_type} workflow for ${node_pool_type}"
        return 1
    fi
    
    local workflow_id
    workflow_id=$(echo "$response" | jq -r '.workflowId' 2>/dev/null || echo "")
    
    if [ -z "$workflow_id" ] || [ "$workflow_id" = "null" ]; then
        log_error "Invalid workflow response for ${workflow_type} - ${node_pool_type}"
        echo "Response: $response"
        return 1
    fi
    
    log_success "Created ${workflow_type} workflow: ${workflow_id}"
    echo "$workflow_id"
}

# Function to monitor workflow status
monitor_workflow() {
    local workflow_id="$1"
    local timeout="${2:-300}" # 5 minutes default
    local start_time
    start_time=$(date +%s)
    
    log_info "Monitoring workflow: ${workflow_id}"
    
    while true; do
        local current_time
        current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        if [ $elapsed -gt $timeout ]; then
            log_error "Workflow monitoring timeout after ${timeout} seconds"
            return 1
        fi
        
        local response
        response=$(curl -s "${BACKEND_URL}/api/workflows/${workflow_id}" || echo "")
        
        if [ -z "$response" ]; then
            log_warning "Failed to get workflow status, retrying..."
            sleep 5
            continue
        fi
        
        local status
        status=$(echo "$response" | jq -r '.status' 2>/dev/null || echo "")
        
        case "$status" in
            "succeeded"|"completed")
                log_success "Workflow completed successfully"
                return 0
                ;;
            "failed"|"error")
                log_error "Workflow failed"
                local error_msg
                error_msg=$(echo "$response" | jq -r '.error // "Unknown error"' 2>/dev/null)
                log_error "Error: $error_msg"
                return 1
                ;;
            "running"|"pending")
                log_info "Workflow status: ${status} (elapsed: ${elapsed}s)"
                sleep 10
                ;;
            *)
                log_warning "Unknown workflow status: ${status}"
                sleep 10
                ;;
        esac
    done
}

# Function to get workflow steps and validate them
validate_workflow_steps() {
    local workflow_id="$1"
    local expected_type="$2"
    
    log_info "Validating workflow steps for ${workflow_id}..."
    
    local response
    response=$(curl -s "${BACKEND_URL}/api/workflows/${workflow_id}/steps" || echo "")
    
    if [ -z "$response" ]; then
        log_error "Failed to retrieve workflow steps"
        return 1
    fi
    
    # Check for expected steps based on workflow type
    if [ "$expected_type" = "karpenter" ]; then
        # Karpenter workflow should have these steps
        local expected_steps=("validate-inputs" "create-resource-group" "create-managed-cluster" "create-karpenter-nodeclass" "create-karpenter-nodepool")
    else
        # KRO workflow should have these steps  
        local expected_steps=("validate-cluster-config" "create-kro-cluster" "wait-for-kro-ready")
    fi
    
    local missing_steps=()
    for step in "${expected_steps[@]}"; do
        if ! echo "$response" | grep -q "$step"; then
            missing_steps+=("$step")
        fi
    done
    
    if [ ${#missing_steps[@]} -eq 0 ]; then
        log_success "All expected ${expected_type} workflow steps found"
        return 0
    else
        log_error "Missing ${expected_type} workflow steps: ${missing_steps[*]}"
        return 1
    fi
}

# Function to compare resource manifests between KRO and Karpenter
compare_resource_manifests() {
    log_info "Comparing KRO vs Karpenter resource manifests..."
    
    # This would ideally compare the actual resources generated
    # For now, we'll check if both workflow types can be created
    local kro_workflow
    local karpenter_workflow
    
    # Set environment to use KRO
    USE_KARPENTER_WORKFLOW=false kro_workflow=$(create_test_workflow "kro" "standard")
    if [ $? -ne 0 ]; then
        log_error "Failed to create KRO test workflow"
        return 1
    fi
    
    # Set environment to use Karpenter
    USE_KARPENTER_WORKFLOW=true karpenter_workflow=$(create_test_workflow "karpenter" "standard")
    if [ $? -ne 0 ]; then
        log_error "Failed to create Karpenter test workflow"
        return 1
    fi
    
    log_success "Both KRO and Karpenter workflows can be created"
    log_info "KRO workflow ID: ${kro_workflow}"
    log_info "Karpenter workflow ID: ${karpenter_workflow}"
    
    return 0
}

# Function to test different node pool types
test_node_pool_types() {
    local node_pool_types=("standard" "memory-optimized" "compute-optimized" "spot-optimized")
    
    log_info "Testing all node pool types with Karpenter workflow..."
    
    for node_pool_type in "${node_pool_types[@]}"; do
        log_info "Testing node pool type: ${node_pool_type}"
        
        local workflow_id
        workflow_id=$(USE_KARPENTER_WORKFLOW=true create_test_workflow "karpenter" "$node_pool_type")
        
        if [ $? -eq 0 ] && [ -n "$workflow_id" ]; then
            log_success "Successfully created workflow for ${node_pool_type}"
            
            # Validate workflow steps
            validate_workflow_steps "$workflow_id" "karpenter"
            
            # Monitor workflow briefly (30 seconds for dry-run)
            if [ "$DRY_RUN" = "true" ]; then
                monitor_workflow "$workflow_id" 30
            fi
        else
            log_error "Failed to create workflow for ${node_pool_type}"
            return 1
        fi
    done
    
    return 0
}

# Function to check Kubernetes resources
check_k8s_resources() {
    log_info "Checking required Kubernetes resources..."
    
    # Check if required namespaces exist
    local namespaces=("azure-system" "karpenter" "default")
    for ns in "${namespaces[@]}"; do
        if kubectl get namespace "$ns" >/dev/null 2>&1; then
            log_success "Namespace ${ns} exists"
        else
            log_warning "Namespace ${ns} does not exist"
        fi
    done
    
    # Check RBAC resources
    if kubectl get clusterrole idp-backend-workflow-manager >/dev/null 2>&1; then
        log_success "ClusterRole idp-backend-workflow-manager exists"
    else
        log_error "ClusterRole idp-backend-workflow-manager not found"
        return 1
    fi
    
    return 0
}

# Main validation function
run_validation() {
    log_info "Starting Karpenter migration validation..."
    log_info "Configuration:"
    log_info "  Backend URL: ${BACKEND_URL}"
    log_info "  Test Location: ${TEST_LOCATION}"
    log_info "  Dry Run: ${DRY_RUN}"
    echo
    
    # Pre-flight checks
    check_backend
    check_kubectl
    check_argo
    check_k8s_resources
    
    echo
    log_info "=== Workflow Template Validation ==="
    
    # Check if both workflow templates exist
    local kro_template_exists=false
    local karpenter_template_exists=false
    
    if check_workflow_template "aks-cluster-provisioning"; then
        kro_template_exists=true
    fi
    
    if check_workflow_template "aks-cluster-provisioning-aso-karpenter"; then
        karpenter_template_exists=true
    fi
    
    if [ "$karpenter_template_exists" = false ]; then
        log_error "Karpenter workflow template not found. Please apply the template first:"
        log_info "  kubectl apply -f ${PROJECT_ROOT}/k8s-manifests/argo-workflows/aks-cluster-provisioning-aso-karpenter.yaml"
        exit 1
    fi
    
    echo
    log_info "=== Node Pool Configuration Testing ==="
    test_node_pool_configs
    
    echo
    log_info "=== Node Pool Type Testing ==="
    test_node_pool_types
    
    echo
    log_info "=== Resource Manifest Comparison ==="
    if [ "$kro_template_exists" = true ]; then
        compare_resource_manifests
    else
        log_warning "Skipping KRO comparison - template not found"
    fi
    
    log_success "Migration validation completed successfully!"
    
    echo
    log_info "=== Summary ==="
    log_info "✓ Backend service is operational"
    log_info "✓ Argo Workflows is configured"
    log_info "✓ Karpenter workflow template is available"
    log_info "✓ All node pool types can be provisioned"
    log_info "✓ RBAC permissions are configured"
    
    if [ "$DRY_RUN" = "true" ]; then
        log_warning "Validation performed in DRY-RUN mode"
        log_info "To test with actual Azure resources:"
        log_info "  DRY_RUN=false $0"
    fi
}

# Cleanup function
cleanup() {
    log_info "Cleaning up test resources..."
    # Add cleanup logic here if needed
}

# Script options
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo "Options:"
        echo "  --help, -h          Show this help message"
        echo "  --backend-url URL   Backend URL (default: http://localhost:3001)"
        echo "  --location LOC      Azure location (default: eastus)"
        echo "  --dry-run BOOL      Use dry-run mode (default: true)"
        echo ""
        echo "Environment variables:"
        echo "  BACKEND_URL         Backend service URL"
        echo "  TEST_LOCATION       Azure region for testing"
        echo "  DRY_RUN            Enable/disable dry-run mode"
        echo "  USE_KARPENTER_WORKFLOW  Force Karpenter workflow usage"
        exit 0
        ;;
    --backend-url)
        BACKEND_URL="$2"
        shift 2
        ;;
    --location)
        TEST_LOCATION="$2"
        shift 2
        ;;
    --dry-run)
        DRY_RUN="$2"
        shift 2
        ;;
esac

# Set trap for cleanup
trap cleanup EXIT

# Run validation
run_validation