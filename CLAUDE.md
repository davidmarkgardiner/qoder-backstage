# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This repository contains a multi-component AKS (Azure Kubernetes Service) Internal Developer Platform similar to Backstage. The platform provides self-service cluster onboarding using cloud-native orchestration tools.

## Common Development Commands

### Frontend (React Application)
Navigate to `idp-platform/frontend/` for all frontend work:

```bash
cd idp-platform/frontend
npm install          # Install dependencies
npm start            # Start development server (http://localhost:3000)
npm run build        # Build production bundle
npm test             # Run Jest unit tests
```

### Backend (Node.js/Express API)
Navigate to `idp-platform/backend/` for all backend work:

```bash
cd idp-platform/backend
npm install          # Install dependencies
npm start            # Start server (http://localhost:3001)
npm run dev          # Start with nodemon for development
npm test             # Run Jest tests
```

### End-to-End Testing (Cypress)
From `idp-platform/frontend/`:

```bash
npm run cypress:open               # Open Cypress UI
npm run test:e2e:smoke            # Run smoke tests headless
npm run test:e2e:dry-run          # Test dry-run functionality
npm run test:e2e:production       # Test production scenarios
npm run test:e2e:full             # Run smoke + dry-run tests
npm run test:setup                # Start both frontend and backend concurrently
```

### Infrastructure and Deployment

```bash
# Prerequisites setup (from idp-platform/)
./scripts/setup-prerequisites.sh --verbose

# Quick deployment
./quick-deploy.sh

# Validate deployment
./validate-deployment.sh

# Apply ASO stack (from aso-stack/)
kubectl apply -k .
```

## Architecture Overview

### Core Components

**Frontend (`idp-platform/frontend/src/`)**
- React 18 with Material-UI components
- Redux Toolkit for state management
- Three main pages: Cluster Onboarding, Workflow Dashboard, Cluster Management
- Real-time updates via WebSocket connection to backend
- Proxies API calls to backend on localhost:3001

**Backend (`idp-platform/backend/src/`)**
- Node.js/Express API server
- Kubernetes client integration for cluster operations
- WebSocket support for real-time workflow updates
- MVC structure: controllers, routes, services, models, middleware

**Infrastructure (`aso-stack/`)**
- Azure Service Operator manifests for AKS cluster provisioning
- Flux GitOps configuration for continuous deployment
- Kustomize-based resource ordering and management

### Data Flow Architecture

1. **User Input** → React frontend captures cluster configuration
2. **API Processing** → Backend validates and processes requests via Express routes
3. **Workflow Creation** → Argo Workflows created with user parameters
4. **Resource Composition** → KRO (Kubernetes Resource Orchestrator) generates Azure resources
5. **Azure Provisioning** → ASO creates actual Azure infrastructure
6. **Status Updates** → Real-time updates via WebSocket to frontend

### Key Integration Points

- **Argo Workflows**: Orchestrates cluster provisioning workflows
- **Azure Service Operator (ASO)**: Manages Azure resources from Kubernetes
- **KRO**: Provides resource composition and templating
- **Flux**: Handles GitOps-based application deployment
- **Istio**: Service mesh integration with ingress gateway
- **Workload Identity**: Secure pod-to-Azure authentication

## Project Structure

```
qoder-backstage/
├── idp-platform/                 # Main IDP application
│   ├── frontend/src/
│   │   ├── components/           # Reusable React components  
│   │   ├── pages/               # Main application pages
│   │   ├── services/            # API clients and external services
│   │   ├── store/               # Redux store configuration
│   │   └── utils/               # Utility functions
│   ├── backend/src/
│   │   ├── controllers/         # Request handlers
│   │   ├── routes/              # API route definitions
│   │   ├── services/            # Business logic and external integrations
│   │   ├── models/              # Data models and schemas
│   │   └── middleware/          # Express middleware
│   ├── k8s-manifests/           # Kubernetes deployment manifests
│   └── scripts/                 # Setup and utility scripts
├── aso-stack/                   # Azure Service Operator manifests
│   ├── *.yaml                   # Infrastructure as Code definitions
│   └── kustomization.yaml      # Resource ordering configuration
└── .qoder/                      # Development quests and documentation
```

## Critical Configuration Notes

### API Endpoint Configuration
The frontend is configured to proxy API calls to `http://localhost:3001`. For production deployments, ensure the API base URL is properly configured via environment variables or build-time configuration.

### Environment Variables
- **Backend**: `PORT=3001`, `NODE_ENV=development`
- **Kubernetes**: `KUBE_CONTEXT=minikube`, namespace configurations for Azure, Argo
- **Azure**: Region, Kubernetes version, monitoring settings in ASO manifests

### Security Considerations
- RBAC permissions required for Argo Workflows and ASO
- Workload Identity integration for pod-to-Azure authentication
- Private AKS cluster configuration with controlled access

## Code Quality Requirements

**CRITICAL**: Before completing any code-related task, ALWAYS run:
```bash
mcp__ide__getDiagnostics  # Check for linting and type errors
```
Fix any diagnostics issues before considering the task complete.

## Development Workflow

1. **Local Development**: Start both frontend (`npm start`) and backend (`npm start`) servers
2. **Testing**: Use Cypress for E2E tests, Jest for unit tests
3. **Infrastructure**: Use dry-run mode to test configurations without creating Azure resources
4. **Deployment**: Apply ASO manifests via kubectl, monitor via Argo Workflows UI

## Troubleshooting Common Issues

- **RBAC Errors**: Apply `k8s-manifests/argo-workflows/rbac-fix.yaml`
- **Backend Connection**: Verify backend is running on port 3001
- **Workflow Failures**: Check logs via `kubectl logs <workflow-pod> -c main`
- **Image Pull Issues**: Verify image availability in configured registry

The platform emphasizes self-service capabilities, real-time monitoring, and GitOps-based deployment patterns for enterprise AKS cluster management.