#!/bin/bash
set -euo pipefail

# Quick IDP Pod Test Runner
# This script runs immediate tests on the IDP pods in AKS

# Configuration
NAMESPACE="idp-platform"
DOMAIN="idp.davidmarkgardiner.co.uk"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

function print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

function print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

function print_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

print_section "Quick IDP Pod Health Check"

# 1. Verify cluster connection
print_info "Checking cluster connection..."
if kubectl cluster-info &>/dev/null; then
    CONTEXT=$(kubectl config current-context)
    print_status 0 "Connected to cluster: $CONTEXT"
else
    print_status 1 "Failed to connect to cluster"
    exit 1
fi

# 2. Check namespace
print_info "Checking namespace..."
if kubectl get namespace $NAMESPACE &>/dev/null; then
    print_status 0 "Namespace $NAMESPACE exists"
else
    print_status 1 "Namespace $NAMESPACE not found"
    exit 1
fi

# 3. Check pod status
print_section "Pod Status Check"

print_info "Checking backend pods..."
BACKEND_PODS=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=idp-backend --no-headers 2>/dev/null || echo "")
if [ -n "$BACKEND_PODS" ]; then
    echo "$BACKEND_PODS" | while read line; do
        POD_NAME=$(echo $line | awk '{print $1}')
        POD_STATUS=$(echo $line | awk '{print $3}')
        READY=$(echo $line | awk '{print $2}')
        
        if [ "$POD_STATUS" = "Running" ] && [ "$READY" = "1/1" ]; then
            print_status 0 "Backend pod $POD_NAME is healthy"
        else
            print_status 1 "Backend pod $POD_NAME has issues (Status: $POD_STATUS, Ready: $READY)"
        fi
    done
else
    print_status 1 "No backend pods found"
fi

print_info "Checking frontend pods..."
FRONTEND_PODS=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=idp-frontend --no-headers 2>/dev/null || echo "")
if [ -n "$FRONTEND_PODS" ]; then
    echo "$FRONTEND_PODS" | while read line; do
        POD_NAME=$(echo $line | awk '{print $1}')
        POD_STATUS=$(echo $line | awk '{print $3}')
        READY=$(echo $line | awk '{print $2}')
        
        if [ "$POD_STATUS" = "Running" ] && [ "$READY" = "1/1" ]; then
            print_status 0 "Frontend pod $POD_NAME is healthy"
        else
            print_status 1 "Frontend pod $POD_NAME has issues (Status: $POD_STATUS, Ready: $READY)"
        fi
    done
else
    print_status 1 "No frontend pods found"
fi

# 4. Quick connectivity tests
print_section "Quick Connectivity Tests"

print_info "Testing internal backend connectivity..."
if kubectl run quick-test-backend --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
   curl -f -s --connect-timeout 5 http://idp-backend-service.$NAMESPACE.svc.cluster.local:3001/health &>/dev/null; then
    print_status 0 "Backend internal connectivity working"
else
    print_status 1 "Backend internal connectivity failed"
fi

print_info "Testing internal frontend connectivity..."
if kubectl run quick-test-frontend --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- \
   curl -f -s --connect-timeout 5 http://idp-frontend-service.$NAMESPACE.svc.cluster.local:80/ &>/dev/null; then
    print_status 0 "Frontend internal connectivity working"
else
    print_status 1 "Frontend internal connectivity failed"
fi

# 5. External access test
print_section "External Access Test"

print_info "Testing external HTTPS access..."
if curl -f -s --connect-timeout 10 https://$DOMAIN/ &>/dev/null; then
    print_status 0 "External HTTPS access working"
else
    print_status 1 "External HTTPS access failed"
fi

print_info "Testing API endpoint..."
if curl -f -s --connect-timeout 10 https://$DOMAIN/health &>/dev/null; then
    print_status 0 "API health endpoint accessible"
else
    print_status 1 "API health endpoint not accessible"
fi

# 6. Summary
print_section "Quick Test Summary"

BACKEND_COUNT=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=idp-backend --no-headers 2>/dev/null | grep "Running" | wc -l || echo "0")
FRONTEND_COUNT=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=idp-frontend --no-headers 2>/dev/null | grep "Running" | wc -l || echo "0")

echo "Backend pods running: $BACKEND_COUNT"
echo "Frontend pods running: $FRONTEND_COUNT"

if [ "$BACKEND_COUNT" -ge 2 ] && [ "$FRONTEND_COUNT" -ge 2 ]; then
    echo -e "\n${GREEN}✓ IDP Platform appears to be healthy!${NC}"
    exit 0
else
    echo -e "\n${RED}✗ IDP Platform has issues that need attention${NC}"
    exit 1
fi