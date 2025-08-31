#!/bin/bash
set -euo pipefail

# IDP Deployment Validation Orchestration Script
# Comprehensive testing and validation of IDP pods in AKS cluster
# This script orchestrates all validation tests and provides a complete health assessment

# Configuration
NAMESPACE="idp-platform"
DOMAIN="idp.davidmarkgardiner.co.uk"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CYPRESS_DIR="$PROJECT_ROOT/idp-platform/frontend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

# Logging functions
function print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}✗${NC} $2"
        ((FAILED_TESTS++))
    fi
    ((TOTAL_TESTS++))
}

function print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

function print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

function print_section() {
    echo -e "\n${BLUE}${BOLD}=== $1 ===${NC}"
}

function print_header() {
    echo -e "${BOLD}$1${NC}"
}

# Configuration validation
function validate_prerequisites() {
    print_section "Prerequisites Validation"
    
    # Check kubectl connectivity
    if kubectl cluster-info &>/dev/null; then
        CONTEXT=$(kubectl config current-context)
        print_status 0 "Connected to Kubernetes cluster: $CONTEXT"
        
        # Verify AKS cluster
        if [[ "$CONTEXT" == *"aks"* ]] || kubectl get nodes -o jsonpath='{.items[0].metadata.labels.kubernetes\.azure\.com/cluster}' &>/dev/null; then
            print_status 0 "Confirmed AKS cluster connection"
        else
            print_warning "May not be connected to AKS cluster"
        fi
    else
        print_status 1 "Failed to connect to Kubernetes cluster"
        echo "Please ensure KUBECONFIG is set correctly and cluster is accessible"
        exit 1
    fi
    
    # Check required tools
    local required_tools=("kubectl" "curl" "nslookup" "openssl")
    for tool in "${required_tools[@]}"; do
        if command -v $tool &>/dev/null; then
            print_status 0 "Tool available: $tool"
        else
            print_status 1 "Required tool missing: $tool"
        fi
    done
    
    # Check if namespace exists
    if kubectl get namespace $NAMESPACE &>/dev/null; then
        print_status 0 "Target namespace exists: $NAMESPACE"
    else
        print_status 1 "Target namespace missing: $NAMESPACE"
    fi
}

# Run pod health validation
function run_pod_health_validation() {
    print_section "Pod Health Validation"
    
    local script_path="$SCRIPT_DIR/validate-idp-pods.sh"
    if [ -x "$script_path" ]; then
        print_info "Running pod health validation..."
        if "$script_path"; then
            print_status 0 "Pod health validation completed successfully"
        else
            print_status 1 "Pod health validation failed"
        fi
    else
        print_status 1 "Pod health validation script not found or not executable: $script_path"
    fi
}

# Run service connectivity tests
function run_service_connectivity_tests() {
    print_section "Service Connectivity Testing"
    
    local script_path="$SCRIPT_DIR/test-service-connectivity.sh"
    if [ -x "$script_path" ]; then
        print_info "Running service connectivity tests..."
        if "$script_path"; then
            print_status 0 "Service connectivity tests completed successfully"
        else
            print_status 1 "Service connectivity tests failed"
        fi
    else
        print_status 1 "Service connectivity test script not found or not executable: $script_path"
    fi
}

# Run external access validation
function run_external_access_validation() {
    print_section "External Access Validation"
    
    local script_path="$SCRIPT_DIR/validate-external-access.sh"
    if [ -x "$script_path" ]; then
        print_info "Running external access validation..."
        if "$script_path"; then
            print_status 0 "External access validation completed successfully"
        else
            print_status 1 "External access validation failed"
        fi
    else
        print_status 1 "External access validation script not found or not executable: $script_path"
    fi
}

# Run Cypress E2E tests
function run_cypress_tests() {
    print_section "Cypress E2E Testing"
    
    if [ -d "$CYPRESS_DIR" ]; then
        print_info "Running Cypress E2E tests for IDP pod validation..."
        
        cd "$CYPRESS_DIR"
        
        # Check if node_modules exists
        if [ ! -d "node_modules" ]; then
            print_info "Installing Cypress dependencies..."
            npm install || {
                print_status 1 "Failed to install Cypress dependencies"
                return 1
            }
        fi
        
        # Set environment variables for AKS testing
        export CYPRESS_apiUrl="https://$DOMAIN/api"
        export CYPRESS_frontendUrl="https://$DOMAIN"
        export CYPRESS_baseUrl="https://$DOMAIN"
        
        # Run the IDP pod health tests
        if npx cypress run --spec "cypress/e2e/smoke/idp-pod-health.cy.js" --env grepTags="@idp-health"; then
            print_status 0 "Cypress E2E tests completed successfully"
        else
            print_status 1 "Cypress E2E tests failed"
        fi
        
        cd - &>/dev/null
    else
        print_status 1 "Cypress directory not found: $CYPRESS_DIR"
    fi
}

# Run smoke tests
function run_smoke_tests() {
    print_section "Smoke Testing"
    
    print_info "Running comprehensive smoke tests..."
    
    # Quick health check
    if curl -f -s --connect-timeout 5 "https://$DOMAIN/health" &>/dev/null; then
        print_status 0 "Application health endpoint responding"
    else
        print_status 1 "Application health endpoint not responding"
    fi
    
    # Quick UI check
    if curl -f -s --connect-timeout 5 "https://$DOMAIN/" | grep -q "AKS Internal Developer Platform"; then
        print_status 0 "Application UI loading correctly"
    else
        print_status 1 "Application UI not loading correctly"
    fi
    
    # Pod count verification
    BACKEND_PODS=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=idp-backend --no-headers 2>/dev/null | grep "Running" | wc -l || echo "0")
    FRONTEND_PODS=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=idp-frontend --no-headers 2>/dev/null | grep "Running" | wc -l || echo "0")
    
    if [ "$BACKEND_PODS" -ge 2 ]; then
        print_status 0 "Backend pods running: $BACKEND_PODS/2"
    else
        print_status 1 "Insufficient backend pods running: $BACKEND_PODS/2"
    fi
    
    if [ "$FRONTEND_PODS" -ge 2 ]; then
        print_status 0 "Frontend pods running: $FRONTEND_PODS/2"
    else
        print_status 1 "Insufficient frontend pods running: $FRONTEND_PODS/2"
    fi
}

# Performance testing
function run_performance_tests() {
    print_section "Performance Testing"
    
    print_info "Testing application performance..."
    
    # Response time test
    START_TIME=$(date +%s%N)
    if curl -f -s --connect-timeout 10 "https://$DOMAIN/" &>/dev/null; then
        END_TIME=$(date +%s%N)
        RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 )) # Convert to milliseconds
        
        if [ "$RESPONSE_TIME" -lt 3000 ]; then
            print_status 0 "Response time acceptable: ${RESPONSE_TIME}ms"
        elif [ "$RESPONSE_TIME" -lt 5000 ]; then
            print_warning "Response time slow: ${RESPONSE_TIME}ms"
        else
            print_status 1 "Response time too slow: ${RESPONSE_TIME}ms"
        fi
    else
        print_status 1 "Performance test failed - application not responding"
    fi
    
    # Load test (basic)
    print_info "Running basic load test (5 concurrent requests)..."
    LOAD_TEST_PASSED=0
    for i in {1..5}; do
        if curl -f -s --connect-timeout 5 "https://$DOMAIN/health" &>/dev/null & then
            ((LOAD_TEST_PASSED++))
        fi
    done
    wait
    
    if [ "$LOAD_TEST_PASSED" -ge 4 ]; then
        print_status 0 "Load test passed: $LOAD_TEST_PASSED/5 requests successful"
    else
        print_status 1 "Load test failed: $LOAD_TEST_PASSED/5 requests successful"
    fi
}

# Generate comprehensive report
function generate_comprehensive_report() {
    print_section "Comprehensive Validation Report"
    
    local report_file="/tmp/idp-validation-report-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "IDP Platform Validation Report"
        echo "=============================="
        echo "Generated: $(date)"
        echo "Domain: $DOMAIN"
        echo "Namespace: $NAMESPACE"
        echo "Cluster Context: $(kubectl config current-context)"
        echo ""
        
        echo "Test Summary:"
        echo "- Total Tests: $TOTAL_TESTS"
        echo "- Passed: $PASSED_TESTS"
        echo "- Failed: $FAILED_TESTS"
        echo "- Warnings: $WARNINGS"
        echo "- Success Rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"
        echo ""
        
        echo "Pod Status:"
        kubectl get pods -n $NAMESPACE -o wide 2>/dev/null || echo "Failed to get pod status"
        echo ""
        
        echo "Service Status:"
        kubectl get services -n $NAMESPACE -o wide 2>/dev/null || echo "Failed to get service status"
        echo ""
        
        echo "Ingress/Gateway Status:"
        kubectl get gateway -n $NAMESPACE 2>/dev/null || echo "No gateways found"
        kubectl get ingress -n $NAMESPACE 2>/dev/null || echo "No ingress found"
        echo ""
        
        echo "Certificate Status:"
        kubectl get certificate -n $NAMESPACE 2>/dev/null || echo "No certificates found"
        echo ""
        
        echo "External Connectivity:"
        echo "- DNS Resolution: $(nslookup $DOMAIN &>/dev/null && echo "✓ Working" || echo "✗ Failed")"
        echo "- HTTP Status: $(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN 2>/dev/null || echo "Failed")"
        echo "- HTTPS Status: $(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN 2>/dev/null || echo "Failed")"
        
    } > "$report_file"
    
    print_info "Comprehensive report saved to: $report_file"
    
    # Display summary
    echo -e "\n${BOLD}VALIDATION SUMMARY${NC}"
    echo "=================="
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo "Warnings: $WARNINGS"
    
    if [ "$FAILED_TESTS" -eq 0 ]; then
        echo -e "\n${GREEN}${BOLD}🎉 ALL TESTS PASSED! IDP Platform is healthy.${NC}"
    elif [ "$FAILED_TESTS" -le 2 ]; then
        echo -e "\n${YELLOW}${BOLD}⚠️  Minor issues detected. Platform mostly functional.${NC}"
    else
        echo -e "\n${RED}${BOLD}❌ Significant issues detected. Platform needs attention.${NC}"
    fi
    
    echo -e "\nSuccess Rate: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"
    echo "Report: $report_file"
}

# Cleanup function
function cleanup() {
    print_info "Cleaning up test resources..."
    
    # Clean up any test pods that might be stuck
    kubectl delete pods -n $NAMESPACE -l app=test --ignore-not-found=true &>/dev/null || true
    kubectl delete pods -l test=connectivity --ignore-not-found=true &>/dev/null || true
}

# Help function
function show_help() {
    echo "IDP Deployment Validation Script"
    echo "================================"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --skip-cypress    Skip Cypress E2E tests"
    echo "  --skip-performance Skip performance tests"
    echo "  --quick           Run only basic health checks"
    echo "  --report-only     Generate report without running tests"
    echo "  --help           Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  NAMESPACE         Target Kubernetes namespace (default: idp-platform)"
    echo "  DOMAIN           Application domain (default: idp.davidmarkgardiner.co.uk)"
    echo ""
}

# Main execution
function main() {
    local skip_cypress=false
    local skip_performance=false
    local quick_mode=false
    local report_only=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-cypress)
                skip_cypress=true
                shift
                ;;
            --skip-performance)
                skip_performance=true
                shift
                ;;
            --quick)
                quick_mode=true
                shift
                ;;
            --report-only)
                report_only=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Script header
    echo -e "${BOLD}IDP Platform Deployment Validation${NC}"
    echo "==================================="
    echo "Domain: $DOMAIN"
    echo "Namespace: $NAMESPACE"
    echo "Mode: $([ "$quick_mode" = true ] && echo "Quick" || echo "Comprehensive")"
    echo "Timestamp: $(date)"
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    if [ "$report_only" = false ]; then
        validate_prerequisites
        
        if [ "$quick_mode" = true ]; then
            run_smoke_tests
        else
            run_pod_health_validation
            run_service_connectivity_tests
            run_external_access_validation
            
            if [ "$skip_cypress" = false ]; then
                run_cypress_tests
            fi
            
            run_smoke_tests
            
            if [ "$skip_performance" = false ]; then
                run_performance_tests
            fi
        fi
    fi
    
    generate_comprehensive_report
    
    # Exit with appropriate code
    if [ "$FAILED_TESTS" -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Execute main function
main "$@"