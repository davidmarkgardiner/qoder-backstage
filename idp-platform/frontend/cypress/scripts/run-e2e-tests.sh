#!/bin/bash

# E2E Test Runner Script
# Orchestrates the complete E2E testing process for AKS cluster provisioning

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT"
BACKEND_DIR="$(cd "$PROJECT_ROOT/../backend" && pwd)"

# Default values
TEST_TYPE="smoke"
HEADLESS=true
CLEANUP=true
VERBOSE=false
AZURE_VALIDATION=true
BROWSER="chrome"
TIMEOUT_MINUTES=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Help function
show_help() {
    cat << EOF
E2E Test Runner for AKS Cluster Provisioning Platform

Usage: $0 [OPTIONS]

Options:
    -t, --type <type>           Test type: smoke, dry-run, production (default: smoke)
    -b, --browser <browser>     Browser: chrome, firefox, edge (default: chrome)
    -h, --headless              Run in headless mode (default: true)
    -i, --interactive           Run in interactive mode
    -v, --verbose               Enable verbose output
    -n, --no-cleanup            Skip cleanup after tests
    -s, --skip-azure            Skip Azure resource validation
    -c, --cluster <name>        Test specific cluster name pattern
    -p, --parallel <count>      Run tests in parallel (default: 1)
    -T, --timeout <minutes>     Test timeout in minutes (default: 30)
    --dry-run                   Show what would be executed without running tests
    --help                      Show this help message

Test Types:
    smoke       Quick validation of basic functionality (5-10 minutes)
    dry-run     Full UI workflow with simulated Azure resources (10-15 minutes)
    production  Complete end-to-end with real Azure resources (20-60 minutes)

Examples:
    $0 --type smoke --headless
    $0 --type dry-run --interactive --verbose
    $0 --type production --no-cleanup --cluster my-test
    $0 --type smoke --parallel 3 --browser firefox

Environment Variables:
    AZURE_SUBSCRIPTION_ID       Azure subscription for testing
    AZURE_RESOURCE_GROUP        Resource group for test resources
    SKIP_AZURE_VALIDATION       Skip Azure resource validation (true/false)
    CLEANUP_AFTER_TESTS         Cleanup resources after tests (true/false)
    CYPRESS_RECORD_KEY          Cypress Dashboard recording key
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            TEST_TYPE="$2"
            shift 2
            ;;
        -b|--browser)
            BROWSER="$2"
            shift 2
            ;;
        -h|--headless)
            HEADLESS=true
            shift
            ;;
        -i|--interactive)
            HEADLESS=false
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -n|--no-cleanup)
            CLEANUP=false
            shift
            ;;
        -s|--skip-azure)
            AZURE_VALIDATION=false
            shift
            ;;
        -c|--cluster)
            CLUSTER_PATTERN="$2"
            shift 2
            ;;
        -p|--parallel)
            PARALLEL_COUNT="$2"
            shift 2
            ;;
        -T|--timeout)
            TIMEOUT_MINUTES="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate test type
case $TEST_TYPE in
    smoke|dry-run|production)
        ;;
    *)
        log_error "Invalid test type: $TEST_TYPE. Must be: smoke, dry-run, or production"
        exit 1
        ;;
esac

# Set environment variables
export CYPRESS_BROWSER="$BROWSER"
export CYPRESS_HEADLESS="$HEADLESS"
export CYPRESS_RECORD_VIDEO=$([ "$TEST_TYPE" = "production" ] && echo "true" || echo "false")
export SKIP_AZURE_VALIDATION=$([ "$AZURE_VALIDATION" = "false" ] && echo "true" || echo "false")
export CLEANUP_AFTER_TESTS=$([ "$CLEANUP" = "true" ] && echo "true" || echo "false")

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is required but not installed"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is required but not installed"
        exit 1
    fi
    
    # Check Azure CLI (for production tests)
    if [ "$TEST_TYPE" = "production" ] && ! command -v az &> /dev/null; then
        log_error "Azure CLI is required for production tests but not installed"
        exit 1
    fi
    
    # Check kubectl (for cluster validation)
    if [ "$AZURE_VALIDATION" = "true" ] && ! command -v kubectl &> /dev/null; then
        log_warning "kubectl not found - cluster validation will be limited"
    fi
    
    # Check Docker (for minikube testing)
    if ! command -v docker &> /dev/null; then
        log_warning "Docker not found - some tests may fail"
    fi
    
    log_success "Prerequisites check completed"
}

# Setup test environment
setup_environment() {
    log_info "Setting up test environment..."
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY RUN] Would setup test environment"
        return 0
    fi
    
    # Install dependencies
    log_info "Installing frontend dependencies..."
    cd "$FRONTEND_DIR"
    npm ci
    
    log_info "Installing backend dependencies..."
    cd "$BACKEND_DIR"
    npm ci
    
    # Verify Cypress installation
    cd "$FRONTEND_DIR"
    if [ ! -d "node_modules/cypress" ]; then
        log_error "Cypress not installed. Please run 'npm install' first."
        exit 1
    fi
    
    log_success "Test environment setup completed"
}

# Start backend services
start_backend() {
    log_info "Starting backend services..."
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY RUN] Would start backend services"
        return 0
    fi
    
    cd "$BACKEND_DIR"
    
    # Check if backend is already running
    if curl -s http://localhost:3001/health &> /dev/null; then
        log_info "Backend already running"
        return 0
    fi
    
    # Start backend in background
    npm start &
    BACKEND_PID=$!
    
    # Wait for backend to be ready
    log_info "Waiting for backend to be ready..."
    for i in {1..30}; do
        if curl -s http://localhost:3001/health &> /dev/null; then
            log_success "Backend is ready"
            return 0
        fi
        sleep 2
    done
    
    log_error "Backend failed to start within 60 seconds"
    return 1
}

# Start frontend
start_frontend() {
    log_info "Starting frontend..."
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY RUN] Would start frontend"
        return 0
    fi
    
    cd "$FRONTEND_DIR"
    
    # Check if frontend is already running
    if curl -s http://localhost:3000 &> /dev/null; then
        log_info "Frontend already running"
        return 0
    fi
    
    # Start frontend in background
    npm start &
    FRONTEND_PID=$!
    
    # Wait for frontend to be ready
    log_info "Waiting for frontend to be ready..."
    for i in {1..60}; do
        if curl -s http://localhost:3000 &> /dev/null; then
            log_success "Frontend is ready"
            return 0
        fi
        sleep 2
    done
    
    log_error "Frontend failed to start within 120 seconds"
    return 1
}

# Run tests
run_tests() {
    log_info "Running $TEST_TYPE tests..."
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY RUN] Would run $TEST_TYPE tests"
        return 0
    fi
    
    cd "$FRONTEND_DIR"
    
    # Build Cypress command
    CYPRESS_CMD="npx cypress run"
    
    if [ "$HEADLESS" = "false" ]; then
        CYPRESS_CMD="npx cypress open"
    fi
    
    # Add browser specification
    CYPRESS_CMD="$CYPRESS_CMD --browser $BROWSER"
    
    # Add spec pattern based on test type
    case $TEST_TYPE in
        smoke)
            CYPRESS_CMD="$CYPRESS_CMD --spec 'cypress/e2e/smoke/**/*.cy.js'"
            ;;
        dry-run)
            CYPRESS_CMD="$CYPRESS_CMD --spec 'cypress/e2e/dry-run/**/*.cy.js'"
            ;;
        production)
            CYPRESS_CMD="$CYPRESS_CMD --spec 'cypress/e2e/production/**/*.cy.js'"
            ;;
    esac
    
    # Add parallel execution if specified
    if [ -n "$PARALLEL_COUNT" ] && [ "$PARALLEL_COUNT" -gt 1 ]; then
        CYPRESS_CMD="$CYPRESS_CMD --parallel --record --ci-build-id \$(date +%s)"
    fi
    
    # Set timeout
    export CYPRESS_defaultCommandTimeout=$((TIMEOUT_MINUTES * 60000))
    
    log_info "Executing: $CYPRESS_CMD"
    
    # Run the tests
    if eval $CYPRESS_CMD; then
        log_success "$TEST_TYPE tests completed successfully"
        return 0
    else
        log_error "$TEST_TYPE tests failed"
        return 1
    fi
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    
    if [ "$CLEANUP" = "false" ]; then
        log_info "Cleanup skipped (--no-cleanup specified)"
        return 0
    fi
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "[DRY RUN] Would cleanup test resources"
        return 0
    fi
    
    # Stop frontend and backend if we started them
    if [ -n "$FRONTEND_PID" ]; then
        log_info "Stopping frontend (PID: $FRONTEND_PID)"
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    if [ -n "$BACKEND_PID" ]; then
        log_info "Stopping backend (PID: $BACKEND_PID)"
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    # Cleanup Azure resources if this was a production test
    if [ "$TEST_TYPE" = "production" ] && command -v node &> /dev/null; then
        log_info "Cleaning up Azure test resources..."
        cd "$FRONTEND_DIR"
        
        if [ -n "$CLUSTER_PATTERN" ]; then
            node cypress/scripts/cleanup-azure-resources.js --pattern "$CLUSTER_PATTERN" --force
        else
            node cypress/scripts/cleanup-azure-resources.js --force
        fi
    fi
    
    log_success "Cleanup completed"
}

# Trap cleanup on exit
trap cleanup EXIT

# Main execution flow
main() {
    log_info "Starting E2E test execution..."
    log_info "Test type: $TEST_TYPE"
    log_info "Browser: $BROWSER"
    log_info "Headless: $HEADLESS"
    log_info "Azure validation: $AZURE_VALIDATION"
    log_info "Cleanup after tests: $CLEANUP"
    
    if [ "$DRY_RUN" = "true" ]; then
        log_warning "DRY RUN MODE - No actual operations will be performed"
    fi
    
    # Execute test pipeline
    check_prerequisites
    setup_environment
    start_backend
    start_frontend
    
    # Wait a bit for services to stabilize
    if [ "$DRY_RUN" != "true" ]; then
        sleep 5
    fi
    
    # Run the tests
    if run_tests; then
        log_success "E2E test execution completed successfully!"
        exit 0
    else
        log_error "E2E test execution failed!"
        exit 1
    fi
}

# Execute main function
main "$@"