#!/bin/bash
set -euo pipefail

# IDP Service Connectivity Testing Script
# Tests internal service connectivity, load balancing, and API endpoints

# Configuration
NAMESPACE="idp-platform"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

# Test functions
function test_dns_resolution() {
    print_section "DNS Resolution Testing"
    
    print_info "Testing backend DNS resolution..."
    if kubectl run dns-test-backend --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
       nslookup idp-backend-service.$NAMESPACE.svc.cluster.local &>/dev/null; then
        print_status 0 "Backend DNS resolution working"
    else
        print_status 1 "Backend DNS resolution failed"
    fi
    
    print_info "Testing frontend DNS resolution..."
    if kubectl run dns-test-frontend --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
       nslookup idp-frontend-service.$NAMESPACE.svc.cluster.local &>/dev/null; then
        print_status 0 "Frontend DNS resolution working"
    else
        print_status 1 "Frontend DNS resolution failed"
    fi
}

function test_service_endpoints() {
    print_section "Service Endpoint Testing"
    
    # Test backend service endpoints
    print_info "Testing backend service endpoints..."
    BACKEND_IPS=$(kubectl get endpoints idp-backend-service -n $NAMESPACE -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null || echo "")
    
    if [ -n "$BACKEND_IPS" ]; then
        for ip in $BACKEND_IPS; do
            print_info "Testing backend endpoint: $ip:3001"
            if kubectl run endpoint-test-$RANDOM --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
               curl -f -s --connect-timeout 5 http://$ip:3001/health &>/dev/null; then
                print_status 0 "Backend endpoint $ip:3001 responding"
            else
                print_status 1 "Backend endpoint $ip:3001 not responding"
            fi
        done
    else
        print_status 1 "No backend endpoints found"
    fi
    
    # Test frontend service endpoints
    print_info "Testing frontend service endpoints..."
    FRONTEND_IPS=$(kubectl get endpoints idp-frontend-service -n $NAMESPACE -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null || echo "")
    
    if [ -n "$FRONTEND_IPS" ]; then
        for ip in $FRONTEND_IPS; do
            print_info "Testing frontend endpoint: $ip:80"
            if kubectl run endpoint-test-$RANDOM --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
               curl -f -s --connect-timeout 5 http://$ip:80/ &>/dev/null; then
                print_status 0 "Frontend endpoint $ip:80 responding"
            else
                print_status 1 "Frontend endpoint $ip:80 not responding"
            fi
        done
    else
        print_status 1 "No frontend endpoints found"
    fi
}

function test_load_balancing() {
    print_section "Load Balancing Testing"
    
    print_info "Testing backend load balancing (10 requests)..."
    BACKEND_RESPONSES=""
    for i in {1..10}; do
        RESPONSE=$(kubectl run lb-test-$i --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
                  curl -s http://idp-backend-service.$NAMESPACE.svc.cluster.local:3001/health 2>/dev/null || echo "failed")
        if [[ "$RESPONSE" == *"healthy"* ]]; then
            BACKEND_RESPONSES="${BACKEND_RESPONSES}success "
        else
            BACKEND_RESPONSES="${BACKEND_RESPONSES}failed "
        fi
    done
    
    SUCCESS_COUNT=$(echo $BACKEND_RESPONSES | grep -o "success" | wc -l)
    print_info "Backend load balancing: $SUCCESS_COUNT/10 requests successful"
    
    if [ "$SUCCESS_COUNT" -ge 8 ]; then
        print_status 0 "Backend load balancing working well"
    elif [ "$SUCCESS_COUNT" -ge 5 ]; then
        print_warning "Backend load balancing partially working"
    else
        print_status 1 "Backend load balancing failing"
    fi
}

function test_api_endpoints() {
    print_section "API Endpoint Testing"
    
    print_info "Testing backend API endpoints..."
    
    # Test health endpoint
    if kubectl run api-health-test --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
       curl -f -s http://idp-backend-service.$NAMESPACE.svc.cluster.local:3001/health &>/dev/null; then
        print_status 0 "Health endpoint (/health) responding"
    else
        print_status 1 "Health endpoint (/health) not responding"
    fi
    
    # Test clusters API endpoint
    if kubectl run api-clusters-test --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
       curl -f -s http://idp-backend-service.$NAMESPACE.svc.cluster.local:3001/api/clusters &>/dev/null; then
        print_status 0 "Clusters API endpoint (/api/clusters) responding"
    else
        print_status 1 "Clusters API endpoint (/api/clusters) not responding"
    fi
    
    # Test workflows API endpoint
    if kubectl run api-workflows-test --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
       curl -f -s http://idp-backend-service.$NAMESPACE.svc.cluster.local:3001/api/workflows &>/dev/null; then
        print_status 0 "Workflows API endpoint (/api/workflows) responding"
    else
        print_status 1 "Workflows API endpoint (/api/workflows) not responding"
    fi
    
    # Test Azure API endpoint
    if kubectl run api-azure-test --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
       curl -f -s http://idp-backend-service.$NAMESPACE.svc.cluster.local:3001/api/azure/locations &>/dev/null; then
        print_status 0 "Azure API endpoint (/api/azure/locations) responding"
    else
        print_status 1 "Azure API endpoint (/api/azure/locations) not responding"
    fi
}

function test_frontend_routes() {
    print_section "Frontend Route Testing"
    
    print_info "Testing frontend routes..."
    
    # Test root route
    if kubectl run frontend-root-test --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
       curl -f -s http://idp-frontend-service.$NAMESPACE.svc.cluster.local:80/ &>/dev/null; then
        print_status 0 "Frontend root route (/) responding"
    else
        print_status 1 "Frontend root route (/) not responding"
    fi
    
    # Test static assets (if nginx is serving them)
    if kubectl run frontend-assets-test --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
       curl -f -s -I http://idp-frontend-service.$NAMESPACE.svc.cluster.local:80/static/ &>/dev/null; then
        print_status 0 "Frontend static assets accessible"
    else
        print_warning "Frontend static assets may not be accessible (could be normal)"
    fi
}

function test_cross_service_communication() {
    print_section "Cross-Service Communication Testing"
    
    print_info "Testing frontend to backend communication..."
    
    # Create a test pod that simulates frontend calling backend
    kubectl run comm-test --rm -i --restart=Never --image=curlimages/curl:latest --timeout=60s -- \
        sh -c "
        echo 'Testing frontend accessing backend API...'
        curl -f -s --connect-timeout 10 http://idp-backend-service.$NAMESPACE.svc.cluster.local:3001/api/clusters > /tmp/clusters.json
        if [ \$? -eq 0 ]; then
            echo 'SUCCESS: Frontend can access backend API'
            exit 0
        else
            echo 'FAILED: Frontend cannot access backend API'
            exit 1
        fi
        " &>/dev/null
    
    if [ $? -eq 0 ]; then
        print_status 0 "Cross-service communication working"
    else
        print_status 1 "Cross-service communication failing"
    fi
}

function test_service_discovery() {
    print_section "Service Discovery Testing"
    
    print_info "Testing Kubernetes service discovery..."
    
    # Test service discovery from within cluster
    kubectl run discovery-test --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
        sh -c "
        echo 'Testing service discovery...'
        
        # Test short name resolution
        nslookup idp-backend-service.$NAMESPACE
        nslookup idp-frontend-service.$NAMESPACE
        
        # Test FQDN resolution
        nslookup idp-backend-service.$NAMESPACE.svc.cluster.local
        nslookup idp-frontend-service.$NAMESPACE.svc.cluster.local
        
        echo 'Service discovery test completed'
        " 2>&1 | grep -q "Address"
    
    if [ $? -eq 0 ]; then
        print_status 0 "Service discovery working"
    else
        print_status 1 "Service discovery issues detected"
    fi
}

function test_port_connectivity() {
    print_section "Port Connectivity Testing"
    
    print_info "Testing port connectivity..."
    
    # Test backend port 3001
    if kubectl run port-test-backend --rm -i --restart=Never --image=nicolaka/netshoot:latest --timeout=30s -- \
       nc -zv idp-backend-service.$NAMESPACE.svc.cluster.local 3001 &>/dev/null; then
        print_status 0 "Backend port 3001 accessible"
    else
        print_status 1 "Backend port 3001 not accessible"
    fi
    
    # Test frontend port 80
    if kubectl run port-test-frontend --rm -i --restart=Never --image=nicolaka/netshoot:latest --timeout=30s -- \
       nc -zv idp-frontend-service.$NAMESPACE.svc.cluster.local 80 &>/dev/null; then
        print_status 0 "Frontend port 80 accessible"
    else
        print_status 1 "Frontend port 80 not accessible"
    fi
}

function generate_connectivity_report() {
    print_section "Connectivity Test Summary"
    
    echo "Service Status:"
    kubectl get services -n $NAMESPACE -o wide | grep -E "(idp-backend-service|idp-frontend-service)" | sed 's/^/  /'
    
    echo -e "\nEndpoint Status:"
    kubectl get endpoints -n $NAMESPACE | grep -E "(idp-backend-service|idp-frontend-service)" | sed 's/^/  /'
    
    echo -e "\nPod Network Status:"
    kubectl get pods -n $NAMESPACE -l app.kubernetes.io/part-of=idp-platform -o wide | sed 's/^/  /'
}

# Main execution
function main() {
    echo "IDP Service Connectivity Testing Script"
    echo "======================================="
    echo "Testing service connectivity for IDP platform..."
    echo "Namespace: $NAMESPACE"
    echo "Timestamp: $(date)"
    
    test_dns_resolution
    test_service_endpoints
    test_load_balancing
    test_api_endpoints
    test_frontend_routes
    test_cross_service_communication
    test_service_discovery
    test_port_connectivity
    generate_connectivity_report
    
    echo -e "\n${GREEN}Connectivity testing completed!${NC}"
}

# Execute main function
main "$@"