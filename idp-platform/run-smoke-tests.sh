#!/bin/bash

# Comprehensive E2E Test Runner for AKS IDP Platform
# This script starts services, runs smoke tests, and provides debugging info

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_PORT=3001
FRONTEND_PORT=3000
BACKEND_DIR="backend"
FRONTEND_DIR="frontend"
TEST_TIMEOUT=300  # 5 minutes

echo -e "${BLUE}🚀 Starting E2E Test Environment for AKS IDP Platform${NC}"
echo "============================================================"

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    echo -e "${YELLOW}🔧 Killing existing process on port $port...${NC}"
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
    sleep 2
}

# Function to start backend
start_backend() {
    echo -e "${BLUE}📡 Starting Backend Server...${NC}"
    
    if check_port $BACKEND_PORT; then
        kill_port $BACKEND_PORT
    fi
    
    cd $BACKEND_DIR
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
        npm install
    fi
    
    # Start backend in background
    echo -e "${GREEN}🎯 Starting backend on port $BACKEND_PORT...${NC}"
    npm start > backend.log 2>&1 &
    BACKEND_PID=$!
    
    # Wait for backend to be ready
    echo -e "${YELLOW}⏳ Waiting for backend to be ready...${NC}"
    for i in {1..30}; do
        if curl -s http://localhost:$BACKEND_PORT/health >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Backend is ready!${NC}"
            break
        fi
        sleep 1
        if [ $i -eq 30 ]; then
            echo -e "${RED}❌ Backend failed to start within 30 seconds${NC}"
            cat backend.log
            exit 1
        fi
    done
    
    cd ..
}

# Function to start frontend
start_frontend() {
    echo -e "${BLUE}🌐 Starting Frontend Application...${NC}"
    
    if check_port $FRONTEND_PORT; then
        kill_port $FRONTEND_PORT
    fi
    
    cd $FRONTEND_DIR
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
        npm install
    fi
    
    # Start frontend in background
    echo -e "${GREEN}🎯 Starting frontend on port $FRONTEND_PORT...${NC}"
    BROWSER=none npm start > frontend.log 2>&1 &
    FRONTEND_PID=$!
    
    # Wait for frontend to be ready
    echo -e "${YELLOW}⏳ Waiting for frontend to be ready...${NC}"
    for i in {1..60}; do
        if curl -s http://localhost:$FRONTEND_PORT >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Frontend is ready!${NC}"
            break
        fi
        sleep 1
        if [ $i -eq 60 ]; then
            echo -e "${RED}❌ Frontend failed to start within 60 seconds${NC}"
            cat frontend.log
            exit 1
        fi
    done
    
    cd ..
}

# Function to validate API endpoints
validate_api() {
    echo -e "${BLUE}🔍 Validating API Endpoints...${NC}"
    
    # Health check
    echo -e "${YELLOW}🏥 Testing health endpoint...${NC}"
    HEALTH_RESPONSE=$(curl -s http://localhost:$BACKEND_PORT/health)
    echo "Health Response: $HEALTH_RESPONSE"
    
    # Azure locations
    echo -e "${YELLOW}🌍 Testing Azure locations endpoint...${NC}"
    LOCATIONS_RESPONSE=$(curl -s http://localhost:$BACKEND_PORT/api/azure/locations)
    echo "Locations Response: $LOCATIONS_RESPONSE"
    
    # Node pool types
    echo -e "${YELLOW}⚙️ Testing node pool types endpoint...${NC}"
    NODEPOOL_RESPONSE=$(curl -s http://localhost:$BACKEND_PORT/api/azure/node-pool-types)
    echo "Node Pool Types Response: $NODEPOOL_RESPONSE"
    
    # Clusters
    echo -e "${YELLOW}☸️ Testing clusters endpoint...${NC}"
    CLUSTERS_RESPONSE=$(curl -s http://localhost:$BACKEND_PORT/api/clusters)
    echo "Clusters Response: $CLUSTERS_RESPONSE"
}

# Function to run Cypress smoke tests
run_smoke_tests() {
    echo -e "${BLUE}🧪 Running Cypress Smoke Tests...${NC}"
    
    cd $FRONTEND_DIR
    
    # Ensure Cypress is installed
    if [ ! -d "node_modules/cypress" ]; then
        echo -e "${YELLOW}📦 Installing Cypress...${NC}"
        npm install cypress --save-dev
    fi
    
    # Run smoke tests with detailed output
    echo -e "${GREEN}🎯 Starting smoke tests...${NC}"
    npx cypress run \
        --spec "cypress/e2e/smoke/**/*.cy.js" \
        --browser chrome \
        --config video=true,screenshotOnRunFailure=true \
        --env apiUrl=http://localhost:$BACKEND_PORT
    
    CYPRESS_EXIT_CODE=$?
    
    cd ..
    
    return $CYPRESS_EXIT_CODE
}

# Function to cleanup processes
cleanup() {
    echo -e "${YELLOW}🧹 Cleaning up processes...${NC}"
    
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    
    # Kill any remaining processes on the ports
    kill_port $BACKEND_PORT
    kill_port $FRONTEND_PORT
    
    echo -e "${GREEN}✅ Cleanup completed${NC}"
}

# Function to show logs on failure
show_logs() {
    echo -e "${RED}📋 Showing application logs for debugging:${NC}"
    
    if [ -f "$BACKEND_DIR/backend.log" ]; then
        echo -e "${YELLOW}Backend Logs:${NC}"
        tail -n 50 $BACKEND_DIR/backend.log
    fi
    
    if [ -f "$FRONTEND_DIR/frontend.log" ]; then
        echo -e "${YELLOW}Frontend Logs:${NC}"
        tail -n 50 $FRONTEND_DIR/frontend.log
    fi
}

# Set up trap for cleanup
trap cleanup EXIT

# Main execution flow
main() {
    echo -e "${GREEN}🎬 Starting test execution...${NC}"
    
    # Start services
    start_backend
    start_frontend
    
    # Validate API
    validate_api
    
    # Run tests
    if run_smoke_tests; then
        echo -e "${GREEN}🎉 All smoke tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}❌ Some smoke tests failed${NC}"
        show_logs
        exit 1
    fi
}

# Execute main function
main "$@"