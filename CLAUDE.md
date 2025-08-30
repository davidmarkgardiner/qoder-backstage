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

### Karpenter Workflow Commands

```bash
# Enable Karpenter workflow (feature flag)
export USE_KARPENTER_WORKFLOW=true

# Validate Karpenter migration
./idp-platform/scripts/validate-karpenter-migration.sh

# Monitor Karpenter performance
./idp-platform/scripts/monitor-karpenter.sh

# Validate on minikube (simulation mode)
./validate-minikube-karpenter.sh

# Apply Karpenter workflow templates
kubectl apply -f idp-platform/k8s-manifests/argo-workflows/aks-cluster-provisioning-aso-karpenter.yaml

# Apply Karpenter resource templates
kubectl apply -f idp-platform/k8s-manifests/karpenter/
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

**Current (Karpenter-enabled) - Default for new clusters:**
1. **User Input** → React frontend captures cluster configuration
2. **API Processing** → Backend validates and processes requests via Express routes
3. **Workflow Creation** → Argo Workflows created with user parameters
4. **Direct Provisioning** → ASO creates AKS cluster + Karpenter manages nodes
5. **Azure Provisioning** → ASO creates actual Azure infrastructure
6. **Status Updates** → Real-time updates via WebSocket to frontend

**Legacy (KRO-based) - Maintained for compatibility:**
1. **User Input** → React frontend captures cluster configuration
2. **API Processing** → Backend validates and processes requests via Express routes  
3. **Workflow Creation** → Argo Workflows created with user parameters
4. **Resource Composition** → KRO (Kubernetes Resource Orchestrator) generates Azure resources
5. **Azure Provisioning** → ASO creates actual Azure infrastructure
6. **Status Updates** → Real-time updates via WebSocket to frontend

> **Migration Status**: Use `USE_KARPENTER_WORKFLOW=true` to enable the new direct ASO + Karpenter integration

### Key Integration Points

- **Argo Workflows**: Orchestrates cluster provisioning workflows
- **Azure Service Operator (ASO)**: Manages Azure resources from Kubernetes
- **Karpenter**: Advanced node autoscaling and provisioning (default for new clusters)
- **KRO**: Legacy resource composition and templating (maintained for compatibility)
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
│   │   ├── argo-workflows/      # Argo Workflow templates
│   │   └── karpenter/           # Karpenter resource templates
│   └── scripts/                 # Setup and utility scripts
├── aso-stack/                   # Azure Service Operator manifests
│   ├── *.yaml                   # Infrastructure as Code definitions
│   └── kustomization.yaml      # Resource ordering configuration
├── validate-minikube-karpenter.sh  # Minikube validation script
├── IDP-WORKFLOW-MIGRATION-COMPLETE.md  # Migration summary
└── .qoder/                      # Development quests and documentation
```

## Karpenter Integration

### Overview
The IDP platform has been migrated from KRO (Kubernetes Resource Orchestrator) to direct ASO + Karpenter integration for improved node autoscaling and cost optimization.

### Node Pool Types
The platform supports 4 optimized node pool configurations:

1. **Standard** (General Purpose)
   - VMs: `Standard_DS2_v2`, `Standard_DS3_v2`
   - CPU Limit: 1000 cores, Memory: 1000Gi
   - Use Cases: Web apps, microservices, general workloads

2. **Memory-Optimized** (High Memory)  
   - VMs: `Standard_E4s_v3`, `Standard_E8s_v3`
   - CPU Limit: 2000 cores, Memory: 4000Gi
   - Use Cases: Databases, caching, in-memory processing

3. **Compute-Optimized** (High CPU)
   - VMs: `Standard_F4s_v2`, `Standard_F8s_v2` 
   - CPU Limit: 4000 cores, Memory: 2000Gi
   - Use Cases: CPU-intensive applications, compute workloads

4. **Spot-Optimized** (Cost-Effective)
   - Mixed VM types with spot instances
   - CPU Limit: 1000 cores, Memory: 1000Gi
   - Use Cases: Batch processing, fault-tolerant workloads

### Key Components

**AKSNodeClass** (`idp-platform/k8s-manifests/karpenter/aksnode-class-template.yaml`):
- Azure-specific node configuration
- VM instance types and OS disk settings
- Custom userData for node initialization
- Resource group and subnet configuration

**NodePool** (`idp-platform/k8s-manifests/karpenter/nodepool-template.yaml`):
- Node pool scaling policies and limits
- Disruption settings (consolidation, expiration)
- Taints and requirements for workload placement
- Cost optimization through spot instances

**Workflow Template** (`aks-cluster-provisioning-aso-karpenter.yaml`):
- 8-phase DAG for cluster provisioning
- Direct ASO ManagedCluster creation
- Karpenter resource deployment
- Dry-run support for testing

### Backend Configuration
In `workflowService.js`, the `NODE_POOL_CONFIGURATIONS` object centralizes all node pool settings:
- VM size mappings and SKU families
- Resource limits and recommendations  
- Karpenter-specific parameters

### Feature Flag Migration
Use `USE_KARPENTER_WORKFLOW=true` to enable:
- New direct ASO + Karpenter workflows
- Advanced node autoscaling capabilities
- Simplified architecture (no KRO layer)

Legacy KRO workflows remain functional when flag is `false` for gradual migration.

## Critical Configuration Notes

### API Endpoint Configuration
The frontend is configured to proxy API calls to `http://localhost:3001`. For production deployments, ensure the API base URL is properly configured via environment variables or build-time configuration.

### Environment Variables
- **Backend**: `PORT=3001`, `NODE_ENV=development`
- **Kubernetes**: `KUBE_CONTEXT=minikube`, namespace configurations for Azure, Argo
- **Azure**: Region, Kubernetes version, monitoring settings in ASO manifests
- **Karpenter Migration**: `USE_KARPENTER_WORKFLOW=true` (enables new workflow, default: false)
- **Testing**: `DRY_RUN=true` (for testing without creating Azure resources)

### Security Considerations
- RBAC permissions required for Argo Workflows, ASO, and Karpenter
- Service account `idp-backend-sa` required for workflow execution
- Workload Identity integration for pod-to-Azure authentication
- Private AKS cluster configuration with controlled access
- Karpenter requires proper Azure RBAC for node provisioning

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

### General Issues
- **Backend Connection**: Verify backend is running on port 3001
- **Image Pull Issues**: Verify image availability in configured registry

### RBAC Issues  
- **Workflow Permission Errors**: Check service account `idp-backend-sa` exists and has proper ClusterRole binding
- **Karpenter RBAC**: Ensure ClusterRole includes `karpenter.sh` and `karpenter.azure.com` permissions
- **Service Account**: Workflows must use `serviceAccountName: idp-backend-sa`

### Karpenter-Specific Issues
- **Karpenter CRDs Missing**: Check if running on minikube (CRDs only available in AKS)
  ```bash
  kubectl api-resources | grep karpenter
  ```
- **Node Pool Creation Fails**: Verify Karpenter is installed in target cluster
- **Workflow Template Not Found**: Apply Karpenter workflow template:
  ```bash
  kubectl apply -f idp-platform/k8s-manifests/argo-workflows/aks-cluster-provisioning-aso-karpenter.yaml
  ```

### Environment Detection
- **Cluster Type**: Use `validate-minikube-karpenter.sh` for minikube testing
- **Feature Flag**: Set `USE_KARPENTER_WORKFLOW=true` to enable new workflows
- **Dry Run Mode**: Use `DRY_RUN=true` for testing without Azure resource creation

### Workflow Debugging
- **Check Workflow Status**: `kubectl get workflows -n <namespace>`
- **View Workflow Logs**: `kubectl logs -l workflows.argoproj.io/workflow=<workflow-name>`
- **Monitor Resources**: Use `./idp-platform/scripts/monitor-karpenter.sh`
- **Validate Migration**: Run `./idp-platform/scripts/validate-karpenter-migration.sh`

The platform emphasizes self-service capabilities, real-time monitoring, and GitOps-based deployment patterns for enterprise AKS cluster management.