#!/bin/bash
set -euo pipefail

# IDP Network Issues Fix Script
# This script diagnoses and fixes network connectivity issues for IDP pods

# Configuration
NAMESPACE="idp-platform"
DOMAIN="idp.davidmarkgardiner.co.uk"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
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
    echo -e "\n${BLUE}${BOLD}=== $1 ===${NC}"
}

function print_success() {
    echo -e "${GREEN}${BOLD}$1${NC}"
}

print_section "IDP Network Issues Diagnosis and Fix"

echo "Domain: $DOMAIN"
echo "Namespace: $NAMESPACE"
echo "Timestamp: $(date)"

# 1. Check cluster connectivity
print_section "1. Cluster Connectivity"
if kubectl get pods -n $NAMESPACE &>/dev/null; then
    print_status 0 "Connected to cluster and namespace accessible"
    CONTEXT=$(kubectl config current-context)
    echo "   Context: $CONTEXT"
else
    print_status 1 "Cannot access cluster or namespace"
    exit 1
fi

# 2. Pod health check
print_section "2. Pod Health Status"
BACKEND_PODS=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=idp-backend --no-headers | grep "Running" | wc -l)
FRONTEND_PODS=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=idp-frontend --no-headers | grep "Running" | wc -l)

print_info "Backend pods running: $BACKEND_PODS"
print_info "Frontend pods running: $FRONTEND_PODS"

if [ "$BACKEND_PODS" -ge 2 ] && [ "$FRONTEND_PODS" -ge 2 ]; then
    print_status 0 "All expected pods are running"
else
    print_status 1 "Some pods are missing or not running"
    kubectl get pods -n $NAMESPACE
fi

# 3. Service connectivity test
print_section "3. Internal Service Connectivity"

print_info "Testing backend service connectivity..."
if kubectl run network-test-backend --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
   curl -f -s http://idp-backend-service.$NAMESPACE.svc.cluster.local:3001/health &>/dev/null; then
    print_status 0 "Backend service accessible internally"
else
    print_status 1 "Backend service not accessible internally"
fi

print_info "Testing frontend service connectivity..."
if kubectl run network-test-frontend --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
   curl -f -s http://idp-frontend-service.$NAMESPACE.svc.cluster.local:80/ &>/dev/null; then
    print_status 0 "Frontend service accessible internally"
else
    print_status 1 "Frontend service not accessible internally"
fi

# 4. API proxy test through frontend
print_section "4. API Proxy Through Frontend"

print_info "Testing API proxy through frontend nginx..."
API_RESPONSE=$(kubectl run api-proxy-test --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
   curl -s http://idp-frontend-service.$NAMESPACE.svc.cluster.local:80/api/clusters 2>/dev/null || echo "failed")

if [[ "$API_RESPONSE" == *"failed"* ]]; then
    print_status 1 "API proxy not working through frontend"
else
    print_status 0 "API proxy working through frontend"
    echo "   Response: $API_RESPONSE"
fi

# 5. External access validation
print_section "5. External Access Validation"

print_info "Testing external frontend access..."
if curl -f -s --connect-timeout 10 https://$DOMAIN/ &>/dev/null; then
    print_status 0 "External frontend access working"
else
    print_status 1 "External frontend access failing"
fi

print_info "Testing external API access via frontend proxy..."
API_EXTERNAL=$(curl -s https://$DOMAIN/api/clusters 2>/dev/null || echo "failed")
if [[ "$API_EXTERNAL" == *"failed"* ]]; then
    print_status 1 "External API access not working"
else
    print_status 0 "External API access working"
    echo "   Response: $API_EXTERNAL"
fi

print_info "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s https://$DOMAIN/health 2>/dev/null || echo "failed")
if [[ "$HEALTH_RESPONSE" == *"healthy"* ]]; then
    print_status 0 "Health endpoint working"
else
    print_status 1 "Health endpoint not working"
fi

# 6. Service discovery and DNS
print_section "6. Service Discovery and DNS"

print_info "Testing DNS resolution for services..."
kubectl run dns-test --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
    sh -c "
    nslookup idp-backend-service.$NAMESPACE.svc.cluster.local && 
    nslookup idp-frontend-service.$NAMESPACE.svc.cluster.local &&
    echo 'DNS resolution successful'
    " &>/dev/null

if [ $? -eq 0 ]; then
    print_status 0 "DNS resolution working"
else
    print_status 1 "DNS resolution issues detected"
fi

# 7. Network policy check
print_section "7. Network Policy Validation"

NETWORK_POLICIES=$(kubectl get networkpolicy -n $NAMESPACE --no-headers 2>/dev/null | wc -l)
if [ "$NETWORK_POLICIES" -gt 0 ]; then
    print_warning "Found $NETWORK_POLICIES network policies - may restrict connectivity"
    kubectl get networkpolicy -n $NAMESPACE
else
    print_info "No network policies found (open communication)"
fi

# 8. Istio configuration check
print_section "8. Istio Configuration"

if kubectl get virtualservice idp-virtualservice -n $NAMESPACE &>/dev/null; then
    print_status 0 "Istio VirtualService found"
    
    # Check routing configuration
    BACKEND_ROUTES=$(kubectl get virtualservice idp-virtualservice -n $NAMESPACE -o jsonpath='{.spec.http[*].match[*].uri.prefix}' | grep -c "/api/" || echo "0")
    if [ "$BACKEND_ROUTES" -gt 0 ]; then
        print_status 0 "API routing configured in VirtualService"
    else
        print_status 1 "API routing not found in VirtualService"
    fi
else
    print_status 1 "Istio VirtualService not found"
fi

# 9. Suggestions for fixes
print_section "9. Issue Analysis and Fixes"

print_info "Common network issues and solutions:"

echo "1. Service Selector Mismatch:"
echo "   - Verify service selectors match pod labels"
echo "   - Backend: app.kubernetes.io/name=idp-backend"
echo "   - Frontend: app.kubernetes.io/name=idp-frontend"

echo ""
echo "2. API Proxy Configuration:"
echo "   - Frontend nginx should proxy /api to backend service"
echo "   - Check nginx config in frontend container"

echo ""
echo "3. Istio Routing:"
echo "   - VirtualService should route /api/ to backend"
echo "   - VirtualService should route / to frontend"

echo ""
echo "4. Frontend Environment Variables:"
echo "   - REACT_APP_API_BASE_URL should be set correctly"
echo "   - Can use relative paths with nginx proxy"

# 10. Quick fixes
print_section "10. Quick Fix Attempts"

print_info "Attempting automatic fixes..."

# Restart pods if they're unhealthy
UNHEALTHY_PODS=$(kubectl get pods -n $NAMESPACE --field-selector=status.phase!=Running --no-headers | wc -l)
if [ "$UNHEALTHY_PODS" -gt 0 ]; then
    print_warning "Found $UNHEALTHY_PODS unhealthy pods, restarting..."
    kubectl delete pods -n $NAMESPACE --field-selector=status.phase!=Running
    print_info "Unhealthy pods deleted, they will be recreated"
fi

# Check if services have endpoints
NO_ENDPOINT_SERVICES=$(kubectl get endpoints -n $NAMESPACE --no-headers | awk '$2 == "<none>" {print $1}' | wc -l)
if [ "$NO_ENDPOINT_SERVICES" -gt 0 ]; then
    print_warning "Found services without endpoints"
    kubectl get endpoints -n $NAMESPACE
    print_info "This may indicate service selector issues"
fi

print_section "11. Final Validation"

# Wait a moment for any restarts to take effect
sleep 5

# Test end-to-end connectivity
print_info "Testing end-to-end connectivity..."
if curl -f -s --connect-timeout 10 "https://$DOMAIN/" | grep -q "AKS Internal Developer Platform"; then
    print_success "✓ Frontend UI is accessible and loading correctly"
else
    print_status 1 "Frontend UI not loading correctly"
fi

if curl -f -s --connect-timeout 10 "https://$DOMAIN/api/clusters" &>/dev/null; then
    print_success "✓ Backend API is accessible through frontend proxy"
else
    print_status 1 "Backend API not accessible through frontend proxy"
fi

print_section "Summary"
echo "Network diagnosis completed!"
echo ""
echo "Key findings:"
echo "- Internal pod connectivity: $(kubectl run quick-test --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- curl -f -s http://idp-backend-service.$NAMESPACE.svc.cluster.local:3001/health &>/dev/null && echo "✓ Working" || echo "✗ Failed")"
echo "- External frontend access: $(curl -f -s --connect-timeout 5 https://$DOMAIN/ &>/dev/null && echo "✓ Working" || echo "✗ Failed")"
echo "- External API access: $(curl -f -s --connect-timeout 5 https://$DOMAIN/api/clusters &>/dev/null && echo "✓ Working" || echo "✗ Failed")"
echo ""
echo "If issues persist, check:"
echo "1. Pod logs: kubectl logs -n $NAMESPACE -l app.kubernetes.io/name=idp-backend"
echo "2. Service configuration: kubectl describe service -n $NAMESPACE"
echo "3. Istio configuration: kubectl get virtualservice,gateway -n $NAMESPACE"