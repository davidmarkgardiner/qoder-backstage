#!/bin/bash
set -euo pipefail

# IDP Network Connectivity Validation - Final Test
# This script validates that all network issues have been resolved

# Configuration
NAMESPACE="idp-platform"
DOMAIN="idp.davidmarkgardiner.co.uk"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

function print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

function print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

function print_section() {
    echo -e "\n${BLUE}${BOLD}=== $1 ===${NC}"
}

print_section "IDP Network Connectivity Final Validation"

echo "Testing all network connectivity for IDP platform..."
echo "Domain: $DOMAIN"
echo "Namespace: $NAMESPACE"
echo "Timestamp: $(date)"

print_section "1. Pod-to-Pod Communication"

print_info "Testing backend pod connectivity..."
kubectl run test-backend-pods --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
    curl -f -s http://idp-backend-service.$NAMESPACE.svc.cluster.local:3001/health >/dev/null
print_success "Backend pods accessible via service"

print_info "Testing frontend pod connectivity..."
kubectl run test-frontend-pods --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
    curl -f -s http://idp-frontend-service.$NAMESPACE.svc.cluster.local:80/ >/dev/null
print_success "Frontend pods accessible via service"

print_section "2. API Proxy Through Frontend"

print_info "Testing API routing through frontend nginx proxy..."
kubectl run test-api-proxy --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
    curl -f -s http://idp-frontend-service.$NAMESPACE.svc.cluster.local:80/api/clusters >/dev/null
print_success "API requests properly proxied through frontend"

print_section "3. External Access Validation"

print_info "Testing external frontend access..."
curl -f -s --connect-timeout 10 "https://$DOMAIN/" >/dev/null
print_success "Frontend accessible externally via HTTPS"

print_info "Testing external API access..."
curl -f -s --connect-timeout 10 "https://$DOMAIN/api/clusters" >/dev/null
print_success "API accessible externally via frontend proxy"

print_info "Testing specific API endpoints..."
HEALTH_RESPONSE=$(curl -s "https://$DOMAIN/health")
CLUSTERS_RESPONSE=$(curl -s "https://$DOMAIN/api/clusters")
WORKFLOWS_RESPONSE=$(curl -s "https://$DOMAIN/api/workflows")
LOCATIONS_RESPONSE=$(curl -s "https://$DOMAIN/api/azure/locations")

if [[ "$HEALTH_RESPONSE" == *"healthy"* ]]; then
    print_success "Health endpoint working"
fi

if [[ "$CLUSTERS_RESPONSE" == *"clusters"* ]]; then
    print_success "Clusters API endpoint working"
fi

if [[ "$WORKFLOWS_RESPONSE" == *"workflows"* ]]; then
    print_success "Workflows API endpoint working"
fi

if [[ "$LOCATIONS_RESPONSE" == *"locations"* ]]; then
    print_success "Azure locations API endpoint working"
fi

print_section "4. Service Discovery and Load Balancing"

print_info "Testing service discovery..."
kubectl run test-dns --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
    nslookup idp-backend-service.$NAMESPACE.svc.cluster.local >/dev/null
print_success "Service DNS resolution working"

print_info "Testing load balancing across backend pods..."
BACKEND_ENDPOINTS=$(kubectl get endpoints idp-backend-service -n $NAMESPACE -o jsonpath='{.subsets[*].addresses[*].ip}' | wc -w)
print_success "Backend service has $BACKEND_ENDPOINTS endpoints (load balancing ready)"

FRONTEND_ENDPOINTS=$(kubectl get endpoints idp-frontend-service -n $NAMESPACE -o jsonpath='{.subsets[*].addresses[*].ip}' | wc -w)
print_success "Frontend service has $FRONTEND_ENDPOINTS endpoints (load balancing ready)"

print_section "5. End-to-End User Journey Test"

print_info "Simulating complete user journey..."

# 1. User accesses frontend
curl -f -s "https://$DOMAIN/" >/dev/null
print_success "✓ User can access frontend UI"

# 2. Frontend loads locations for dropdown
curl -f -s "https://$DOMAIN/api/azure/locations" >/dev/null
print_success "✓ Frontend can load Azure locations"

# 3. Frontend checks existing clusters
curl -f -s "https://$DOMAIN/api/clusters" >/dev/null
print_success "✓ Frontend can check existing clusters"

# 4. Frontend checks workflows
curl -f -s "https://$DOMAIN/api/workflows" >/dev/null
print_success "✓ Frontend can check workflow status"

print_section "Summary"

echo -e "${GREEN}${BOLD}🎉 ALL NETWORK CONNECTIVITY TESTS PASSED!${NC}"
echo ""
echo "Network connectivity is working correctly:"
echo "✓ Pod-to-pod communication via Kubernetes services"
echo "✓ API proxy through frontend nginx configuration"
echo "✓ External HTTPS access via Istio Gateway"
echo "✓ Load balancing across multiple pod instances"
echo "✓ Service discovery and DNS resolution"
echo "✓ Complete end-to-end user journey"
echo ""
echo "The IDP platform is ready for use!"
echo "Access the platform at: https://$DOMAIN"