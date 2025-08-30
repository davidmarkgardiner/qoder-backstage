#!/bin/bash

# Environment Setup Script for E2E Testing
# Sets up local development environment for AKS cluster provisioning testing

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install Node.js dependencies
install_dependencies() {
    log_info "Installing project dependencies..."
    
    # Frontend dependencies
    log_info "Installing frontend dependencies..."
    cd "$PROJECT_ROOT/frontend"
    npm ci
    
    # Backend dependencies  
    log_info "Installing backend dependencies..."
    cd "$PROJECT_ROOT/backend"
    npm ci
    
    log_info "Dependencies installed successfully"
}

# Setup Azure CLI
setup_azure_cli() {
    if command_exists az; then
        log_info "Azure CLI is already installed"
        
        # Check if authenticated
        if az account show >/dev/null 2>&1; then
            log_info "Azure CLI is authenticated"
        else
            log_warning "Azure CLI is not authenticated. Please run 'az login'"
        fi
    else
        log_warning "Azure CLI is not installed. Please install it for production testing"
        log_info "Installation instructions: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    fi
}

# Setup kubectl
setup_kubectl() {
    if command_exists kubectl; then
        log_info "kubectl is already installed"
        
        # Check if can connect to cluster
        if kubectl cluster-info >/dev/null 2>&1; then
            log_info "kubectl can connect to a cluster"
        else
            log_warning "kubectl cannot connect to a cluster"
        fi
    else
        log_warning "kubectl is not installed. Installing..."
        
        # Install kubectl based on OS
        case "$(uname -s)" in
            Darwin*)
                if command_exists brew; then
                    brew install kubectl
                else
                    log_error "Homebrew not found. Please install kubectl manually"
                fi
                ;;
            Linux*)
                curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
                chmod +x kubectl
                sudo mv kubectl /usr/local/bin/
                ;;
            *)
                log_warning "Unsupported OS. Please install kubectl manually"
                ;;
        esac
    fi
}

# Setup Docker
setup_docker() {
    if command_exists docker; then
        log_info "Docker is already installed"
        
        # Check if Docker daemon is running
        if docker info >/dev/null 2>&1; then
            log_info "Docker daemon is running"
        else
            log_warning "Docker daemon is not running. Please start Docker"
        fi
    else
        log_warning "Docker is not installed. Please install Docker Desktop"
        log_info "Download from: https://www.docker.com/products/docker-desktop"
    fi
}

# Setup Minikube (for local testing)
setup_minikube() {
    if command_exists minikube; then
        log_info "Minikube is already installed"
        
        # Check if running
        if minikube status >/dev/null 2>&1; then
            log_info "Minikube is running"
        else
            log_info "Starting Minikube..."
            minikube start --driver=docker --cpus=4 --memory=8192
        fi
    else
        log_info "Installing Minikube..."
        
        case "$(uname -s)" in
            Darwin*)
                if command_exists brew; then
                    brew install minikube
                else
                    curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-darwin-amd64
                    sudo install minikube-darwin-amd64 /usr/local/bin/minikube
                fi
                ;;
            Linux*)
                curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
                sudo install minikube-linux-amd64 /usr/local/bin/minikube
                ;;
            *)
                log_warning "Unsupported OS for automatic Minikube installation"
                ;;
        esac
        
        # Start Minikube
        log_info "Starting Minikube..."
        minikube start --driver=docker --cpus=4 --memory=8192
    fi
}

# Setup test environment variables
setup_environment_variables() {
    log_info "Setting up environment variables..."
    
    ENV_FILE="$PROJECT_ROOT/.env.test"
    
    if [ ! -f "$ENV_FILE" ]; then
        log_info "Creating test environment file..."
        cat > "$ENV_FILE" << EOF
# Test Environment Configuration
AZURE_SUBSCRIPTION_ID=
AZURE_RESOURCE_GROUP=rg-e2e-testing
AZURE_LOCATION=uksouth
SKIP_AZURE_VALIDATION=false
CLEANUP_AFTER_TESTS=true
CYPRESS_RECORD_KEY=
TEST_CLUSTER_PREFIX=e2e-test
MAX_WAIT_TIME_MINUTES=20
EOF
        log_warning "Please update $ENV_FILE with your Azure subscription details"
    else
        log_info "Test environment file already exists: $ENV_FILE"
    fi
}

# Verify prerequisites
verify_prerequisites() {
    log_info "Verifying prerequisites..."
    
    local missing_tools=()
    
    # Required tools
    if ! command_exists node; then
        missing_tools+=("Node.js")
    fi
    
    if ! command_exists npm; then
        missing_tools+=("npm")
    fi
    
    # Optional but recommended tools
    local warnings=()
    if ! command_exists az; then
        warnings+=("Azure CLI (required for production tests)")
    fi
    
    if ! command_exists kubectl; then
        warnings+=("kubectl (required for cluster validation)")
    fi
    
    if ! command_exists docker; then
        warnings+=("Docker (required for local testing)")
    fi
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        return 1
    fi
    
    if [ ${#warnings[@]} -gt 0 ]; then
        log_warning "Missing optional tools: ${warnings[*]}"
    fi
    
    log_info "Prerequisites verification completed"
    return 0
}

# Install required CRDs in Minikube
install_crds() {
    log_info "Installing required CRDs in Minikube..."
    
    # Switch to minikube context
    kubectl config use-context minikube
    
    # Install ASO CRDs
    log_info "Installing Azure Service Operator CRDs..."
    kubectl apply -f https://raw.githubusercontent.com/Azure/azure-service-operator/main/v2/config/crd/bases/resources.azure.com_resourcegroups.yaml || true
    kubectl apply -f https://raw.githubusercontent.com/Azure/azure-service-operator/main/v2/config/crd/bases/containerservice.azure.com_managedclusters.yaml || true
    
    # Install KRO CRDs
    log_info "Installing KRO CRDs..."
    kubectl apply -f https://raw.githubusercontent.com/Azure/kro/main/config/install.yaml || true
    
    # Install Argo Workflows CRDs
    log_info "Installing Argo Workflows CRDs..."
    kubectl create namespace argo || true
    kubectl apply -n argo -f https://github.com/argoproj/argo-workflows/releases/download/v3.5.0/quick-start-minimal.yaml || true
    
    log_info "CRDs installation completed"
}

# Create test namespaces
create_test_namespaces() {
    log_info "Creating test namespaces..."
    
    kubectl create namespace azure-system --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace default --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace argo --dry-run=client -o yaml | kubectl apply -f -
    
    log_info "Test namespaces created"
}

# Setup complete test environment
setup_test_environment() {
    log_info "Setting up complete test environment..."
    
    verify_prerequisites || exit 1
    install_dependencies
    setup_azure_cli
    setup_kubectl
    setup_docker
    setup_minikube
    setup_environment_variables
    install_crds
    create_test_namespaces
    
    log_info "Test environment setup completed successfully!"
    log_info ""
    log_info "Next steps:"
    log_info "1. Update .env.test with your Azure subscription details"
    log_info "2. Run 'az login' to authenticate with Azure"
    log_info "3. Run 'npm run test:e2e:smoke' to verify setup"
}

# Print usage information
show_help() {
    cat << EOF
E2E Test Environment Setup Script

Usage: $0 [COMMAND]

Commands:
    setup           Complete test environment setup (default)
    deps            Install Node.js dependencies only
    azure           Setup Azure CLI
    kubectl         Setup kubectl
    docker          Setup Docker
    minikube        Setup Minikube
    crds            Install required CRDs
    verify          Verify prerequisites
    help            Show this help message

Examples:
    $0                  # Complete setup
    $0 setup            # Complete setup
    $0 deps             # Install dependencies only
    $0 verify           # Check prerequisites
EOF
}

# Main execution
main() {
    local command="${1:-setup}"
    
    case $command in
        setup)
            setup_test_environment
            ;;
        deps)
            install_dependencies
            ;;
        azure)
            setup_azure_cli
            ;;
        kubectl)
            setup_kubectl
            ;;
        docker)
            setup_docker
            ;;
        minikube)
            setup_minikube
            ;;
        crds)
            install_crds
            ;;
        verify)
            verify_prerequisites
            ;;
        help)
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"