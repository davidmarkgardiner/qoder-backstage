#!/bin/bash

# monitor-karpenter.sh
# Monitoring script for Karpenter performance and metrics
# This script provides real-time monitoring of Karpenter node provisioning and management

set -e

# Color output for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
KARPENTER_NAMESPACE="${KARPENTER_NAMESPACE:-karpenter}"
REFRESH_INTERVAL="${REFRESH_INTERVAL:-10}"
WATCH_MODE="${WATCH_MODE:-false}"

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

log_header() {
    echo -e "${CYAN}=== $1 ===${NC}"
}

# Function to check if kubectl is available
check_kubectl() {
    if ! command -v kubectl >/dev/null 2>&1; then
        log_error "kubectl is not available"
        exit 1
    fi
}

# Function to check if Karpenter is installed
check_karpenter() {
    log_info "Checking Karpenter installation..."
    
    if ! kubectl get namespace "$KARPENTER_NAMESPACE" >/dev/null 2>&1; then
        log_error "Karpenter namespace '${KARPENTER_NAMESPACE}' not found"
        exit 1
    fi
    
    if ! kubectl get deployment karpenter -n "$KARPENTER_NAMESPACE" >/dev/null 2>&1; then
        log_error "Karpenter deployment not found in namespace '${KARPENTER_NAMESPACE}'"
        exit 1
    fi
    
    log_success "Karpenter is installed"
}

# Function to display Karpenter deployment status
show_karpenter_status() {
    log_header "Karpenter Deployment Status"
    
    kubectl get deployment karpenter -n "$KARPENTER_NAMESPACE" -o wide
    echo
    
    # Show pod status
    log_info "Karpenter Pods:"
    kubectl get pods -n "$KARPENTER_NAMESPACE" -l app.kubernetes.io/name=karpenter
    echo
}

# Function to display NodePools
show_nodepools() {
    log_header "Karpenter NodePools"
    
    if kubectl get nodepools -n "$KARPENTER_NAMESPACE" >/dev/null 2>&1; then
        kubectl get nodepools -n "$KARPENTER_NAMESPACE" -o wide
        echo
        
        # Show detailed information for each NodePool
        local nodepools
        nodepools=$(kubectl get nodepools -n "$KARPENTER_NAMESPACE" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
        
        if [ -n "$nodepools" ]; then
            for nodepool in $nodepools; do
                log_info "NodePool Details: $nodepool"
                kubectl get nodepool "$nodepool" -n "$KARPENTER_NAMESPACE" -o yaml | grep -A 20 "spec:" | head -20
                echo
            done
        fi
    else
        log_warning "No NodePools found or NodePool CRD not installed"
    fi
}

# Function to display AKSNodeClasses
show_node_classes() {
    log_header "Karpenter AKSNodeClasses"
    
    if kubectl get aksnodeclasses -n "$KARPENTER_NAMESPACE" >/dev/null 2>&1; then
        kubectl get aksnodeclasses -n "$KARPENTER_NAMESPACE" -o wide
        echo
        
        # Show detailed information for each AKSNodeClass
        local nodeclasses
        nodeclasses=$(kubectl get aksnodeclasses -n "$KARPENTER_NAMESPACE" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
        
        if [ -n "$nodeclasses" ]; then
            for nodeclass in $nodeclasses; do
                log_info "AKSNodeClass Details: $nodeclass"
                kubectl get aksnodeclass "$nodeclass" -n "$KARPENTER_NAMESPACE" -o yaml | grep -A 15 "spec:" | head -15
                echo
            done
        fi
    else
        log_warning "No AKSNodeClasses found or AKSNodeClass CRD not installed"
    fi
}

# Function to display NodeClaims
show_node_claims() {
    log_header "Karpenter NodeClaims"
    
    if kubectl get nodeclaims >/dev/null 2>&1; then
        kubectl get nodeclaims -o wide
        echo
        
        # Show node claim status summary
        local total_claims
        local ready_claims
        local pending_claims
        
        total_claims=$(kubectl get nodeclaims --no-headers 2>/dev/null | wc -l || echo "0")
        ready_claims=$(kubectl get nodeclaims --no-headers 2>/dev/null | grep -c "Ready" || echo "0")
        pending_claims=$(kubectl get nodeclaims --no-headers 2>/dev/null | grep -c -v "Ready" || echo "0")
        
        log_info "NodeClaim Summary:"
        echo "  Total: $total_claims"
        echo "  Ready: $ready_claims"
        echo "  Pending: $pending_claims"
        echo
    else
        log_warning "No NodeClaims found or NodeClaim CRD not installed"
    fi
}

# Function to display node information with Karpenter labels
show_nodes() {
    log_header "Cluster Nodes (Karpenter Managed)"
    
    # Show all nodes with Karpenter labels
    if kubectl get nodes -l karpenter.sh/nodepool >/dev/null 2>&1; then
        echo "Karpenter-managed nodes:"
        kubectl get nodes -l karpenter.sh/nodepool -o wide
        echo
        
        # Node summary
        local total_nodes
        local ready_nodes
        local karpenter_nodes
        
        total_nodes=$(kubectl get nodes --no-headers 2>/dev/null | wc -l || echo "0")
        ready_nodes=$(kubectl get nodes --no-headers 2>/dev/null | grep -c " Ready " || echo "0")
        karpenter_nodes=$(kubectl get nodes -l karpenter.sh/nodepool --no-headers 2>/dev/null | wc -l || echo "0")
        
        log_info "Node Summary:"
        echo "  Total nodes: $total_nodes"
        echo "  Ready nodes: $ready_nodes"
        echo "  Karpenter-managed: $karpenter_nodes"
        echo
    else
        log_warning "No Karpenter-managed nodes found"
    fi
    
    # Show system nodes (non-Karpenter)
    local system_nodes
    system_nodes=$(kubectl get nodes -l '!karpenter.sh/nodepool' --no-headers 2>/dev/null | wc -l || echo "0")
    if [ "$system_nodes" -gt 0 ]; then
        echo "System nodes (non-Karpenter):"
        kubectl get nodes -l '!karpenter.sh/nodepool' -o wide
        echo
    fi
}

# Function to display resource utilization
show_resource_utilization() {
    log_header "Resource Utilization"
    
    if command -v kubectl-top >/dev/null 2>&1 || kubectl top nodes >/dev/null 2>&1; then
        log_info "Node resource usage:"
        kubectl top nodes 2>/dev/null || log_warning "Metrics server not available"
        echo
        
        log_info "Pod resource usage (top 10):"
        kubectl top pods --all-namespaces 2>/dev/null | head -11 || log_warning "Metrics server not available"
        echo
    else
        log_warning "kubectl top not available - install metrics server for resource monitoring"
    fi
}

# Function to show Karpenter events
show_karpenter_events() {
    log_header "Recent Karpenter Events"
    
    # Show events from the last hour
    kubectl get events --all-namespaces --field-selector reason=ProvisioningSucceeded,reason=ProvisioningFailed,reason=Deprovisioning --sort-by='.lastTimestamp' | tail -20
    echo
    
    # Show Karpenter controller events
    log_info "Karpenter Controller Events:"
    kubectl get events -n "$KARPENTER_NAMESPACE" --sort-by='.lastTimestamp' | tail -10
    echo
}

# Function to display metrics (if Prometheus is available)
show_metrics() {
    log_header "Karpenter Metrics"
    
    # Check if we can access Karpenter metrics endpoint
    local karpenter_pod
    karpenter_pod=$(kubectl get pods -n "$KARPENTER_NAMESPACE" -l app.kubernetes.io/name=karpenter -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -n "$karpenter_pod" ]; then
        log_info "Attempting to retrieve metrics from Karpenter pod..."
        
        # Try to get metrics via port-forward (this would need to be running separately)
        # For now, just show available metrics endpoints
        kubectl describe pod "$karpenter_pod" -n "$KARPENTER_NAMESPACE" | grep -A 5 "Ports:" || true
        echo
        
        log_info "To access Karpenter metrics, use:"
        echo "  kubectl port-forward -n $KARPENTER_NAMESPACE deployment/karpenter 8000:8080"
        echo "  curl http://localhost:8000/metrics"
        echo
    else
        log_warning "Karpenter pod not found for metrics collection"
    fi
}

# Function to show troubleshooting information
show_troubleshooting() {
    log_header "Troubleshooting Information"
    
    # Check for common issues
    log_info "Checking common Karpenter issues..."
    
    # 1. Check if AWS Load Balancer Controller is installed (if in AWS)
    if kubectl get deployment aws-load-balancer-controller -n kube-system >/dev/null 2>&1; then
        log_success "AWS Load Balancer Controller found"
    else
        log_info "AWS Load Balancer Controller not found (OK for non-AWS clusters)"
    fi
    
    # 2. Check RBAC permissions
    if kubectl auth can-i create nodeclaims --as=system:serviceaccount:$KARPENTER_NAMESPACE:karpenter >/dev/null 2>&1; then
        log_success "Karpenter has NodeClaim creation permissions"
    else
        log_warning "Karpenter may lack proper RBAC permissions"
    fi
    
    # 3. Check for pending pods that can't be scheduled
    local pending_pods
    pending_pods=$(kubectl get pods --all-namespaces --field-selector=status.phase=Pending --no-headers 2>/dev/null | wc -l || echo "0")
    
    if [ "$pending_pods" -gt 0 ]; then
        log_warning "Found $pending_pods pending pods"
        log_info "Pending pods (may need node provisioning):"
        kubectl get pods --all-namespaces --field-selector=status.phase=Pending -o wide | head -10
        echo
    else
        log_success "No pending pods found"
    fi
    
    # 4. Show Karpenter logs (last 20 lines)
    log_info "Recent Karpenter logs:"
    kubectl logs -n "$KARPENTER_NAMESPACE" deployment/karpenter --tail=20 2>/dev/null || log_warning "Cannot access Karpenter logs"
    echo
}

# Function to display a comprehensive dashboard
show_dashboard() {
    clear
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                             KARPENTER MONITORING DASHBOARD                            ║${NC}"
    echo -e "${CYAN}║                                $(date)                                 ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    show_karpenter_status
    show_nodepools
    show_node_claims
    show_nodes
    show_resource_utilization
    show_karpenter_events
    
    if [ "$WATCH_MODE" = "true" ]; then
        echo -e "${YELLOW}Refreshing in ${REFRESH_INTERVAL} seconds... (Press Ctrl+C to exit)${NC}"
        sleep "$REFRESH_INTERVAL"
        show_dashboard
    fi
}

# Function to display help
show_help() {
    echo "Usage: $0 [command] [options]"
    echo
    echo "Commands:"
    echo "  dashboard       Show comprehensive monitoring dashboard"
    echo "  status          Show Karpenter deployment status"
    echo "  nodepools       Show NodePool information"
    echo "  nodeclasses     Show AKSNodeClass information"
    echo "  nodeclaims      Show NodeClaim information"
    echo "  nodes           Show node information"
    echo "  resources       Show resource utilization"
    echo "  events          Show recent Karpenter events"
    echo "  metrics         Show metrics information"
    echo "  troubleshoot    Show troubleshooting information"
    echo "  watch           Start dashboard in watch mode"
    echo "  help            Show this help message"
    echo
    echo "Options:"
    echo "  --namespace NS      Karpenter namespace (default: karpenter)"
    echo "  --interval SEC      Refresh interval for watch mode (default: 10)"
    echo
    echo "Environment variables:"
    echo "  KARPENTER_NAMESPACE     Karpenter namespace"
    echo "  REFRESH_INTERVAL        Watch mode refresh interval"
}

# Parse command line arguments
COMMAND="${1:-dashboard}"

while [[ $# -gt 0 ]]; do
    case $1 in
        --namespace)
            KARPENTER_NAMESPACE="$2"
            shift 2
            ;;
        --interval)
            REFRESH_INTERVAL="$2"
            shift 2
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            if [ -z "$COMMAND" ]; then
                COMMAND="$1"
            fi
            shift
            ;;
    esac
done

# Pre-flight checks
check_kubectl
check_karpenter

# Execute command
case "$COMMAND" in
    dashboard|dash)
        show_dashboard
        ;;
    status)
        show_karpenter_status
        ;;
    nodepools|pools)
        show_nodepools
        ;;
    nodeclasses|classes)
        show_node_classes
        ;;
    nodeclaims|claims)
        show_node_claims
        ;;
    nodes)
        show_nodes
        ;;
    resources|res)
        show_resource_utilization
        ;;
    events)
        show_karpenter_events
        ;;
    metrics)
        show_metrics
        ;;
    troubleshoot|debug)
        show_troubleshooting
        ;;
    watch)
        WATCH_MODE="true"
        show_dashboard
        ;;
    help)
        show_help
        ;;
    *)
        log_error "Unknown command: $COMMAND"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac