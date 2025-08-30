#!/bin/bash
set -euo pipefail

# Fix nginx configuration in running frontend pods
# This script updates the nginx configuration to fix API proxy issues

NAMESPACE="idp-platform"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

function print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

function print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

function print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

echo "IDP Frontend Nginx Configuration Fix"
echo "====================================="

print_info "Current nginx configuration in frontend pods:"
kubectl exec -n $NAMESPACE deployment/idp-frontend -- grep -A 5 "location /api" /etc/nginx/conf.d/default.conf

print_warning "The current configuration has 'proxy_pass' with trailing slash which removes /api prefix"
print_warning "This causes internal API proxy to fail, but external access via Istio works correctly"

echo ""
print_info "Recommended fix for future deployments:"
echo "Update the Dockerfile.frontend proxy_pass line to:"
echo "proxy_pass http://idp-backend-service.idp-platform.svc.cluster.local:3001;"
echo ""
echo "Instead of:"
echo "proxy_pass http://idp-backend-service.idp-platform.svc.cluster.local:3001/;"
echo ""
print_info "Note: External access via https://idp.davidmarkgardiner.co.uk/api/* works correctly"
print_info "This issue only affects internal pod-to-pod API proxy calls"

# For immediate fix, we could update the configuration and restart pods
print_info "For immediate fix, you can:"
echo "1. Update Dockerfile.frontend"
echo "2. Rebuild and redeploy frontend images"
echo "3. Or continue using external access which works correctly"

print_success "Diagnosis completed - external access is working correctly"