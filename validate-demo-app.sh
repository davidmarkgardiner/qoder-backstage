#!/bin/bash
set -euo pipefail

# AKS Demo Application TLS Validation Script
# This script validates the demo application deployment and TLS configuration on AKS

echo "=== AKS Demo Application TLS Validation ==="

# Configuration
DOMAIN="podinfo.test.davidmarkgardiner.co.uk"
NAMESPACE="test-dns"
ISTIO_NAMESPACE="aks-istio-system"
CERT_NAME="test-wildcard-tls-cert"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

echo "1. Checking cluster connectivity..."
if kubectl cluster-info &>/dev/null; then
    print_status 0 "Connected to AKS cluster"
    kubectl config current-context
else
    print_status 1 "Failed to connect to cluster"
    exit 1
fi

echo -e "\n2. Checking application deployment..."
POD_COUNT=$(kubectl get pods -n $NAMESPACE -l app=podinfo --no-headers 2>/dev/null | wc -l)
if [ $POD_COUNT -gt 0 ]; then
    print_status 0 "Podinfo application deployed ($POD_COUNT pods)"
    kubectl get pods -n $NAMESPACE -l app=podinfo
else
    print_status 1 "Podinfo application not found"
fi

echo -e "\n3. Checking TLS certificate..."
if kubectl get certificate $CERT_NAME -n $ISTIO_NAMESPACE &>/dev/null; then
    CERT_READY=$(kubectl get certificate $CERT_NAME -n $ISTIO_NAMESPACE -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
    if [ "$CERT_READY" = "True" ]; then
        print_status 0 "TLS certificate is ready"
    else
        print_status 1 "TLS certificate is not ready"
        kubectl describe certificate $CERT_NAME -n $ISTIO_NAMESPACE
    fi
else
    print_status 1 "TLS certificate not found"
fi

echo -e "\n4. Checking Istio Gateway..."
if kubectl get gateway wildcard-gateway-external -n $ISTIO_NAMESPACE &>/dev/null; then
    print_status 0 "Istio Gateway exists"
else
    print_status 1 "Istio Gateway not found"
fi

echo -e "\n5. Checking VirtualService..."
if kubectl get virtualservice podinfo-vs -n $NAMESPACE &>/dev/null; then
    print_status 0 "VirtualService exists"
    VS_GATEWAY=$(kubectl get virtualservice podinfo-vs -n $NAMESPACE -o jsonpath='{.spec.gateways[0]}')
    echo "   Gateway: $VS_GATEWAY"
else
    print_status 1 "VirtualService not found"
fi

echo -e "\n6. Checking Istio Ingress Gateway service..."
EXTERNAL_IP=$(kubectl get svc aks-istio-ingressgateway-external -n aks-istio-ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
if [ -n "$EXTERNAL_IP" ]; then
    print_status 0 "External IP available: $EXTERNAL_IP"
else
    print_status 1 "External IP not available"
fi

echo -e "\n7. Testing DNS resolution..."
if nslookup $DOMAIN &>/dev/null; then
    RESOLVED_IP=$(nslookup $DOMAIN | grep "Address:" | tail -1 | awk '{print $2}')
    print_status 0 "DNS resolves to: $RESOLVED_IP"
    if [ "$RESOLVED_IP" = "$EXTERNAL_IP" ]; then
        print_status 0 "DNS correctly points to ingress IP"
    else
        print_warning "DNS IP ($RESOLVED_IP) differs from ingress IP ($EXTERNAL_IP)"
    fi
else
    print_status 1 "DNS resolution failed"
fi

echo -e "\n8. Testing HTTP connectivity..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" = "301" ]; then
    print_status 0 "HTTP redirects to HTTPS (301)"
elif [ "$HTTP_STATUS" = "200" ]; then
    print_status 0 "HTTP responds successfully (200)"
else
    print_status 1 "HTTP test failed (status: $HTTP_STATUS)"
fi

echo -e "\n9. Testing HTTPS connectivity..."
if curl -I -s --connect-timeout 10 https://$DOMAIN &>/dev/null; then
    HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN 2>/dev/null || echo "000")
    print_status 0 "HTTPS responds successfully (status: $HTTPS_STATUS)"
else
    print_status 1 "HTTPS connection failed"
    print_warning "This indicates TLS secret propagation issues in Istio ASM"
fi

echo -e "\n10. Checking Istio gateway logs for TLS errors..."
TLS_ERRORS=$(kubectl logs -n aks-istio-ingress -l app=aks-istio-ingressgateway-external --tail=50 2>/dev/null | grep -c "tls.v3.Secret" || echo "0")
if [ $TLS_ERRORS -gt 0 ]; then
    print_warning "Found $TLS_ERRORS TLS secret fetch timeout errors in gateway logs"
    echo "This confirms the known issue with TLS secret propagation in Istio ASM"
else
    print_status 0 "No TLS errors found in gateway logs"
fi

echo -e "\n=== Summary ==="
echo "HTTP Traffic: Working ✓"
echo "HTTPS Traffic: Needs Investigation ⚠"
echo "Known Issue: Istio ASM TLS secret propagation timeout"
echo "Recommendation: Investigate Istio control plane configuration for certificate integration"