#!/bin/bash
# Build Docker images for IDP Platform

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-davidgardiner}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

main() {
    log_info "Building IDP Platform Docker images..."
    cd "$PROJECT_ROOT"
    
    # Build backend
    log_info "Building backend image: ${DOCKER_REGISTRY}/idp-backend:${IMAGE_TAG}"
    docker build -f Dockerfile.backend -t "${DOCKER_REGISTRY}/idp-backend:${IMAGE_TAG}" .
    
    # Build frontend
    log_info "Building frontend image: ${DOCKER_REGISTRY}/idp-frontend:${IMAGE_TAG}"
    docker build -f Dockerfile.frontend -t "${DOCKER_REGISTRY}/idp-frontend:${IMAGE_TAG}" .
    
    log_info "Images built successfully!"
    log_info ""
    log_info "To push to Docker Hub:"
    log_info "docker push ${DOCKER_REGISTRY}/idp-backend:${IMAGE_TAG}"
    log_info "docker push ${DOCKER_REGISTRY}/idp-frontend:${IMAGE_TAG}"
}

main "$@"