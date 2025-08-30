#!/bin/bash
set -euo pipefail

# IDP Pod Health Validation Script for AKS
# This script validates the health and connectivity of IDP backend and frontend pods

# Configuration
NAMESPACE="idp-platform"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
function print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

function print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

function print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

function print_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Validation functions
function validate_cluster_connection() {
    print_section "Cluster Connectivity Validation"
    
    if kubectl cluster-info &>/dev/null; then
        print_status 0 "Connected to AKS cluster"
        CONTEXT=$(kubectl config current-context)
        echo "   Context: $CONTEXT"
        
        # Verify we're connected to AKS
        if [[ "$CONTEXT" == *"aks"* ]] || kubectl get nodes -o jsonpath='{.items[0].metadata.labels.kubernetes\.azure\.com/cluster}' &>/dev/null; then
            print_status 0 "Confirmed AKS cluster connection"
        else
            print_warning "May not be connected to AKS cluster"
        fi
    else
        print_status 1 "Failed to connect to cluster"
        exit 1
    fi
}

function validate_namespace() {
    print_section "Namespace Validation"
    
    if kubectl get namespace $NAMESPACE &>/dev/null; then
        print_status 0 "Namespace $NAMESPACE exists"
    else
        print_status 1 "Namespace $NAMESPACE not found"
        echo "Creating namespace $NAMESPACE..."
        kubectl create namespace $NAMESPACE
    fi
}

function validate_pod_status() {
    print_section "IDP Pod Status Validation"
    
    # Get pod counts
    BACKEND_PODS=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=idp-backend --no-headers 2>/dev/null | wc -l || echo "0")
    FRONTEND_PODS=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=idp-frontend --no-headers 2>/dev/null | wc -l || echo "0")
    
    print_info "Found $BACKEND_PODS backend pods and $FRONTEND_PODS frontend pods"
    
    if [ "$BACKEND_PODS" -eq 0 ]; then
        print_status 1 "No backend pods found"
        return 1
    fi
    
    if [ "$FRONTEND_PODS" -eq 0 ]; then
        print_status 1 "No frontend pods found"
        return 1
    fi
    
    # Validate backend pods
    print_info "Validating backend pods..."
    BACKEND_HEALTHY=0
    kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=idp-backend --no-headers | while read line; do
        POD_NAME=$(echo $line | awk '{print $1}')
        POD_STATUS=$(echo $line | awk '{print $3}')
        READY=$(echo $line | awk '{print $2}')
        
        echo "  Pod: $POD_NAME"
        echo "    Status: $POD_STATUS, Ready: $READY"
        
        if [ "$POD_STATUS" = "Running" ] && [ "$READY" = "1/1" ]; then
            print_status 0 "Backend pod $POD_NAME is healthy"
            
            # Test pod health endpoint
            if kubectl exec $POD_NAME -n $NAMESPACE -- curl -f -s http://localhost:3001/health &>/dev/null; then
                print_status 0 "Health endpoint responding for $POD_NAME"
            else
                print_status 1 "Health endpoint not responding for $POD_NAME"
                echo "  Checking pod logs:"
                kubectl logs $POD_NAME -n $NAMESPACE --tail=10 | sed 's/^/    /'
            fi
        else
            print_status 1 "Backend pod $POD_NAME has issues"
            echo "  Pod description:"
            kubectl describe pod $POD_NAME -n $NAMESPACE | grep -A 10 "Events:" | sed 's/^/    /'
        fi
    done
    
    # Validate frontend pods
    print_info "Validating frontend pods..."
    kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=idp-frontend --no-headers | while read line; do
        POD_NAME=$(echo $line | awk '{print $1}')
        POD_STATUS=$(echo $line | awk '{print $3}')
        READY=$(echo $line | awk '{print $2}')
        
        echo "  Pod: $POD_NAME"
        echo "    Status: $POD_STATUS, Ready: $READY"
        
        if [ "$POD_STATUS" = "Running" ] && [ "$READY" = "1/1" ]; then
            print_status 0 "Frontend pod $POD_NAME is healthy"
            
            # Test nginx health
            if kubectl exec $POD_NAME -n $NAMESPACE -- curl -f -s http://localhost:80/ &>/dev/null; then
                print_status 0 "Nginx serving content for $POD_NAME"
            else
                print_status 1 "Nginx not responding for $POD_NAME"
                echo "  Checking pod logs:"
                kubectl logs $POD_NAME -n $NAMESPACE --tail=10 | sed 's/^/    /'
            fi
        else
            print_status 1 "Frontend pod $POD_NAME has issues"
            echo "  Pod description:"
            kubectl describe pod $POD_NAME -n $NAMESPACE | grep -A 10 "Events:" | sed 's/^/    /'
        fi
    done
}

function validate_services() {
    print_section "Service Configuration Validation"
    
    # Check backend service
    if kubectl get service idp-backend-service -n $NAMESPACE &>/dev/null; then
        BACKEND_ENDPOINTS=$(kubectl get endpoints idp-backend-service -n $NAMESPACE -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null | wc -w || echo "0")
        print_status 0 "Backend service exists with $BACKEND_ENDPOINTS endpoints"
        
        # Show service details
        echo "  Service details:"
        kubectl get service idp-backend-service -n $NAMESPACE -o wide | sed 's/^/    /'
    else
        print_status 1 "Backend service not found"
    fi
    
    # Check frontend service
    if kubectl get service idp-frontend-service -n $NAMESPACE &>/dev/null; then
        FRONTEND_ENDPOINTS=$(kubectl get endpoints idp-frontend-service -n $NAMESPACE -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null | wc -w || echo "0")
        print_status 0 "Frontend service exists with $FRONTEND_ENDPOINTS endpoints"
        
        # Show service details
        echo "  Service details:"
        kubectl get service idp-frontend-service -n $NAMESPACE -o wide | sed 's/^/    /'
    else
        print_status 1 "Frontend service not found"
    fi
}

function validate_internal_connectivity() {
    print_section "Internal Service Connectivity Testing"
    
    print_info "Testing backend internal connectivity..."
    if kubectl run test-backend-connectivity --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
       curl -f -s --connect-timeout 10 http://idp-backend-service.$NAMESPACE.svc.cluster.local:3001/health &>/dev/null; then
        print_status 0 "Backend internal service connectivity working"
    else
        print_status 1 "Backend internal service connectivity failed"
        
        # Try to diagnose the issue
        print_info "Diagnosing backend connectivity issue..."
        kubectl run debug-backend --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
            sh -c "nslookup idp-backend-service.$NAMESPACE.svc.cluster.local && curl -v http://idp-backend-service.$NAMESPACE.svc.cluster.local:3001/health" 2>&1 | sed 's/^/    /' || true
    fi
    
    print_info "Testing frontend internal connectivity..."
    if kubectl run test-frontend-connectivity --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
       curl -f -s --connect-timeout 10 http://idp-frontend-service.$NAMESPACE.svc.cluster.local:80/ &>/dev/null; then
        print_status 0 "Frontend internal service connectivity working"
    else
        print_status 1 "Frontend internal service connectivity failed"
        
        # Try to diagnose the issue
        print_info "Diagnosing frontend connectivity issue..."
        kubectl run debug-frontend --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
            sh -c "nslookup idp-frontend-service.$NAMESPACE.svc.cluster.local && curl -v http://idp-frontend-service.$NAMESPACE.svc.cluster.local:80/" 2>&1 | sed 's/^/    /' || true
    fi
}

function validate_resource_utilization() {
    print_section "Resource Utilization Check"
    
    print_info "Current pod resource usage:"
    if kubectl top pods -n $NAMESPACE --no-headers 2>/dev/null; then
        kubectl top pods -n $NAMESPACE --no-headers 2>/dev/null | while read line; do
            POD_NAME=$(echo $line | awk '{print $1}')
            CPU=$(echo $line | awk '{print $2}')
            MEMORY=$(echo $line | awk '{print $3}')
            echo "  $POD_NAME: CPU=$CPU, Memory=$MEMORY"
        done
    else
        print_warning "Metrics server not available or pods not consuming resources yet"
    fi
    
    print_info "Pod resource requests and limits:"
    kubectl get pods -n $NAMESPACE -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[0].resources}{"\n"}{end}' | \
    while IFS=$'\t' read name resources; do
        echo "  $name: $resources"
    done
}

function validate_network_policies() {
    print_section "Network Policy Validation"
    
    NETWORK_POLICIES=$(kubectl get networkpolicies -n $NAMESPACE --no-headers 2>/dev/null | wc -l || echo "0")
    if [ "$NETWORK_POLICIES" -gt 0 ]; then
        print_info "Found $NETWORK_POLICIES network policies:"
        kubectl get networkpolicies -n $NAMESPACE --no-headers | sed 's/^/  /'
    else
        print_info "No network policies found (this may be expected)"
    fi
}

function validate_istio_integration() {
    print_section "Istio Integration Validation"
    
    # Check if Istio is installed
    if kubectl get namespace istio-system &>/dev/null; then
        print_status 0 "Istio system namespace found"
        
        # Check for Istio sidecar injection
        BACKEND_SIDECARS=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=idp-backend -o jsonpath='{.items[*].spec.containers[*].name}' | grep -c istio-proxy || echo "0")
        FRONTEND_SIDECARS=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=idp-frontend -o jsonpath='{.items[*].spec.containers[*].name}' | grep -c istio-proxy || echo "0")
        
        if [ "$BACKEND_SIDECARS" -gt 0 ]; then
            print_status 0 "Backend pods have Istio sidecars"
        else
            print_warning "Backend pods do not have Istio sidecars"
        fi
        
        if [ "$FRONTEND_SIDECARS" -gt 0 ]; then
            print_status 0 "Frontend pods have Istio sidecars"
        else
            print_warning "Frontend pods do not have Istio sidecars"
        fi
        
        # Check for VirtualServices and DestinationRules
        if kubectl get virtualservice -n $NAMESPACE &>/dev/null; then
            VS_COUNT=$(kubectl get virtualservice -n $NAMESPACE --no-headers | wc -l)
            print_info "Found $VS_COUNT VirtualService(s) in namespace"
        fi
        
        if kubectl get destinationrule -n $NAMESPACE &>/dev/null; then
            DR_COUNT=$(kubectl get destinationrule -n $NAMESPACE --no-headers | wc -l)
            print_info "Found $DR_COUNT DestinationRule(s) in namespace"
        fi
        
    else
        print_info "Istio not detected (may not be required)"
    fi
}

function generate_summary_report() {
    print_section "Validation Summary Report"
    
    # Count running pods
    TOTAL_BACKEND_PODS=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=idp-backend --no-headers 2>/dev/null | wc -l || echo "0")
    RUNNING_BACKEND_PODS=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=idp-backend --no-headers 2>/dev/null | grep "Running" | wc -l || echo "0")
    
    TOTAL_FRONTEND_PODS=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=idp-frontend --no-headers 2>/dev/null | wc -l || echo "0")
    RUNNING_FRONTEND_PODS=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=idp-frontend --no-headers 2>/dev/null | grep "Running" | wc -l || echo "0")
    
    echo "Backend Pods: $RUNNING_BACKEND_PODS/$TOTAL_BACKEND_PODS running"
    echo "Frontend Pods: $RUNNING_FRONTEND_PODS/$TOTAL_FRONTEND_PODS running"
    
    # Service status
    if kubectl get service idp-backend -n $NAMESPACE &>/dev/null; then
        echo "Backend Service: Available"
    else
        echo "Backend Service: Missing"
    fi
    
    if kubectl get service idp-frontend -n $NAMESPACE &>/dev/null; then
        echo "Frontend Service: Available"
    else
        echo "Frontend Service: Missing"
    fi
    
    # Overall health assessment
    if [ "$RUNNING_BACKEND_PODS" -gt 0 ] && [ "$RUNNING_FRONTEND_PODS" -gt 0 ]; then
        print_status 0 "IDP Platform appears to be healthy"
    else
        print_status 1 "IDP Platform has issues that need attention"
    fi
}

# Main execution
function main() {
    echo "IDP Pod Health Validation Script"
    echo "================================"
    echo "Validating IDP pods in AKS cluster..."
    echo "Namespace: $NAMESPACE"
    echo "Timestamp: $(date)"
    
    validate_cluster_connection
    validate_namespace
    validate_pod_status
    validate_services
    validate_internal_connectivity
    validate_resource_utilization
    validate_network_policies
    validate_istio_integration
    generate_summary_report
    
    echo -e "\n${GREEN}Validation completed!${NC}"
}

# Execute main function
main "$@"