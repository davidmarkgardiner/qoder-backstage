#!/bin/bash
# Validation script for IDP Platform deployment

set -euo pipefail

NAMESPACE="idp-platform"
DOMAIN="idp.davidmarkgardiner.co.uk"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_check() {
    echo -e "${BLUE}[CHECK]${NC} $1"
}

check_passed() {
    ((TOTAL_CHECKS++))
    ((PASSED_CHECKS++))
    echo -e "${GREEN}✓${NC} $1"
}

check_failed() {
    ((TOTAL_CHECKS++))
    ((FAILED_CHECKS++))
    echo -e "${RED}✗${NC} $1"
}

check_prerequisite() {
    local cmd="$1"
    local name="$2"
    
    if command -v "$cmd" &> /dev/null; then
        check_passed "$name is installed"
    else
        check_failed "$name is not installed"
    fi
}

check_k8s_resource() {
    local resource="$1"
    local namespace="${2:-}"
    local name="${3:-}"
    
    local ns_flag=""
    if [ -n "$namespace" ]; then
        ns_flag="-n $namespace"
    fi
    
    local resource_name="$resource"
    if [ -n "$name" ]; then
        resource_name="$resource/$name"
    fi
    
    if kubectl get $resource_name $ns_flag &> /dev/null; then
        check_passed "$resource_name exists"
        return 0
    else
        check_failed "$resource_name not found"
        return 1
    fi
}

check_pod_status() {
    local deployment="$1"
    local namespace="$2"
    
    local ready_pods=$(kubectl get deployment "$deployment" -n "$namespace" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    local desired_pods=$(kubectl get deployment "$deployment" -n "$namespace" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
    
    if [ "$ready_pods" = "$desired_pods" ] && [ "$ready_pods" != "0" ]; then
        check_passed "$deployment has $ready_pods/$desired_pods pods ready"
    else
        check_failed "$deployment has $ready_pods/$desired_pods pods ready"
    fi
}

check_service_endpoints() {
    local service="$1"
    local namespace="$2"
    
    local endpoints=$(kubectl get endpoints "$service" -n "$namespace" -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null || echo "")
    
    if [ -n "$endpoints" ]; then
        local count=$(echo "$endpoints" | wc -w)
        check_passed "$service has $count endpoint(s)"
    else
        check_failed "$service has no endpoints"
    fi
}

check_certificate_status() {
    local cert="$1"
    local namespace="$2"
    
    local ready=$(kubectl get certificate "$cert" -n "$namespace" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "")
    
    if [ "$ready" = "True" ]; then
        check_passed "Certificate $cert is ready"
    else
        check_failed "Certificate $cert is not ready"
        # Show more details
        kubectl describe certificate "$cert" -n "$namespace" 2>/dev/null | grep -A5 "Conditions:" || true
    fi
}

check_dns_resolution() {
    local domain="$1"
    
    if nslookup "$domain" &> /dev/null; then
        local ip=$(nslookup "$domain" | awk '/Address:/ && !/127.0.0.1/ {print $2; exit}')
        check_passed "DNS resolution for $domain -> $ip"
    else
        check_failed "DNS resolution failed for $domain"
    fi
}

check_http_endpoint() {
    local url="$1"
    local expected_status="${2:-200}"
    
    local status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$status" = "$expected_status" ]; then
        check_passed "HTTP endpoint $url returned $status"
    else
        check_failed "HTTP endpoint $url returned $status (expected $expected_status)"
    fi
}

check_istio_gateway() {
    local gateway="$1"
    local namespace="$2"
    
    if check_k8s_resource "gateway" "$namespace" "$gateway"; then
        # Check if gateway has valid configuration
        local hosts=$(kubectl get gateway "$gateway" -n "$namespace" -o jsonpath='{.spec.servers[*].hosts[*]}' 2>/dev/null || echo "")
        if [ -n "$hosts" ]; then
            check_passed "Gateway $gateway has hosts configured: $hosts"
        else
            check_failed "Gateway $gateway has no hosts configured"
        fi
    fi
}

main() {
    log_info "🔍 Starting IDP Platform validation..."
    echo ""
    
    # Check prerequisites
    log_check "Checking prerequisites..."
    check_prerequisite "kubectl" "kubectl"
    check_prerequisite "curl" "curl"
    check_prerequisite "nslookup" "nslookup"
    echo ""
    
    # Check kubectl context
    log_check "Checking Kubernetes context..."
    if kubectl config current-context &> /dev/null; then
        local context=$(kubectl config current-context)
        check_passed "Kubectl context: $context"
    else
        check_failed "No kubectl context configured"
        exit 1
    fi
    echo ""
    
    # Check namespace
    log_check "Checking namespace..."
    check_k8s_resource "namespace" "" "$NAMESPACE"
    echo ""
    
    # Check RBAC
    log_check "Checking RBAC resources..."
    check_k8s_resource "serviceaccount" "$NAMESPACE" "idp-backend-sa"
    check_k8s_resource "clusterrole" "" "idp-backend-role"
    check_k8s_resource "clusterrolebinding" "" "idp-backend-binding"
    echo ""
    
    # Check ConfigMaps
    log_check "Checking ConfigMaps..."
    check_k8s_resource "configmap" "$NAMESPACE" "idp-config"
    check_k8s_resource "configmap" "$NAMESPACE" "idp-frontend-config"
    echo ""
    
    # Check deployments
    log_check "Checking deployments..."
    check_k8s_resource "deployment" "$NAMESPACE" "idp-backend"
    check_k8s_resource "deployment" "$NAMESPACE" "idp-frontend"
    
    # Check pod status
    check_pod_status "idp-backend" "$NAMESPACE"
    check_pod_status "idp-frontend" "$NAMESPACE"
    echo ""
    
    # Check services
    log_check "Checking services..."
    check_k8s_resource "service" "$NAMESPACE" "idp-backend-service"
    check_k8s_resource "service" "$NAMESPACE" "idp-frontend-service"
    
    # Check service endpoints
    check_service_endpoints "idp-backend-service" "$NAMESPACE"
    check_service_endpoints "idp-frontend-service" "$NAMESPACE"
    echo ""
    
    # Check Istio resources (if available)
    log_check "Checking Istio resources..."
    if kubectl get crd gateways.networking.istio.io &> /dev/null; then
        check_istio_gateway "idp-gateway" "$NAMESPACE"
        check_k8s_resource "virtualservice" "$NAMESPACE" "idp-virtualservice"
    else
        log_warn "Istio CRDs not found - skipping Istio checks"
    fi
    echo ""
    
    # Check certificates
    log_check "Checking certificates..."
    if kubectl get crd certificates.cert-manager.io &> /dev/null; then
        check_certificate_status "idp-wildcard-tls-cert" "$NAMESPACE"
        # Check certificate in istio namespace too
        if kubectl get namespace aks-istio-system &> /dev/null; then
            check_certificate_status "idp-wildcard-tls-cert" "aks-istio-system"
        fi
    else
        log_warn "cert-manager CRDs not found - skipping certificate checks"
    fi
    echo ""
    
    # Check external dependencies
    log_check "Checking external dependencies..."
    
    # Check DNS resolution
    check_dns_resolution "$DOMAIN"
    
    # Check HTTP endpoints (if DNS is working)
    if nslookup "$DOMAIN" &> /dev/null; then
        check_http_endpoint "https://$DOMAIN/health" "200"
        check_http_endpoint "https://$DOMAIN" "200"
    else
        log_warn "Skipping HTTP checks due to DNS resolution failure"
    fi
    echo ""
    
    # Check operator dependencies
    log_check "Checking operator dependencies..."
    
    # Azure Service Operator
    if kubectl get namespace azure-system &> /dev/null; then
        check_passed "Azure Service Operator namespace found"
    else
        check_failed "Azure Service Operator namespace not found"
    fi
    
    # Argo Workflows
    if kubectl get namespace argo &> /dev/null; then
        check_passed "Argo Workflows namespace found"
    else
        check_failed "Argo Workflows namespace not found"
    fi
    
    # External DNS
    if kubectl get namespace external-dns &> /dev/null; then
        check_passed "External-DNS namespace found"
    else
        check_failed "External-DNS namespace not found"
    fi
    echo ""
    
    # Summary
    log_info "📊 Validation Summary:"
    log_info "Total checks: $TOTAL_CHECKS"
    log_info "Passed: $PASSED_CHECKS"
    log_info "Failed: $FAILED_CHECKS"
    
    if [ $FAILED_CHECKS -eq 0 ]; then
        log_info "🎉 All checks passed! IDP Platform is ready."
        echo ""
        log_info "Access your platform at: https://$DOMAIN"
        exit 0
    else
        log_error "❌ $FAILED_CHECKS checks failed. Please review the issues above."
        echo ""
        log_info "Troubleshooting commands:"
        log_info "- kubectl get pods -n $NAMESPACE"
        log_info "- kubectl logs -f deployment/idp-backend -n $NAMESPACE"
        log_info "- kubectl describe certificate idp-wildcard-tls-cert -n $NAMESPACE"
        log_info "- kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp'"
        exit 1
    fi
}

# Show help
if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    cat << EOF
IDP Platform Validation Script

Usage: $0 [OPTIONS]

This script validates the IDP Platform deployment on AKS.

Options:
    -h, --help    Show this help message

The script checks:
- Prerequisites (kubectl, curl, nslookup)
- Kubernetes resources (deployments, services, etc.)
- Certificate status
- DNS resolution
- HTTP endpoints
- External dependencies

Exit codes:
    0 - All checks passed
    1 - One or more checks failed

EOF
    exit 0
fi

main "$@"