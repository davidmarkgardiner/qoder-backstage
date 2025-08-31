# Namespace Onboarding Implementation

This document provides a comprehensive overview of the namespace onboarding feature implemented for the IDP platform, following the same architectural patterns as the existing cluster onboarding functionality.

## 🎯 Overview

The namespace onboarding feature enables self-service provisioning of Kubernetes namespaces with:
- **Resource quotas** for CPU/memory requests and limits
- **Network policies** for namespace isolation (ingress locked to same namespace only)
- **Azure RBAC integration** (leveraging AKS built-in Azure AD integration)
- **Workflow orchestration** using Argo Workflows
- **Real-time monitoring** and status updates

## 🏗️ Architecture

### Data Flow
1. **User Input** → React frontend captures namespace configuration
2. **API Processing** → Backend validates and processes requests via Express routes
3. **Workflow Creation** → Argo Workflows created with namespace parameters
4. **Resource Provisioning** → Kubernetes resources created (Namespace, LimitRange, NetworkPolicy)
5. **Status Updates** → Real-time updates via WebSocket to frontend

### Key Components
- **Frontend**: React 18 with Material-UI components and Redux Toolkit
- **Backend**: Node.js/Express API with Kubernetes client integration
- **Workflows**: Argo Workflows for orchestrated provisioning
- **Templates**: Parameterized Kubernetes manifests with Kustomize

## 📁 File Structure

```
idp-platform/
├── backend/src/
│   ├── services/
│   │   ├── namespaceService.js          # Core namespace lifecycle management
│   │   └── workflowService.js           # Updated with namespace workflows
│   ├── routes/
│   │   └── namespaces.js                # REST API endpoints
│   └── index.js                         # Updated with namespace routes
├── frontend/src/
│   ├── pages/
│   │   └── NamespaceOnboarding.js       # Main namespace onboarding page
│   ├── store/
│   │   ├── namespacesSlice.js           # Redux state management
│   │   └── store.js                     # Updated with namespace reducer
│   ├── components/
│   │   └── Navigation.js                # Updated with namespace tab
│   └── App.js                           # Updated with namespace route
└── k8s-manifests/
    ├── namespace-templates/             # Kubernetes manifest templates
    │   ├── namespace.yaml               # Namespace resource template
    │   ├── limit-range.yaml             # Resource quota template
    │   ├── network-policy.yaml          # Network isolation template
    │   └── kustomization.yaml           # Kustomize configuration
    └── argo-workflows/
        └── namespace-provisioning-workflow.yaml  # Argo Workflow template
```

## 🔧 Implementation Details

### Backend Services

#### NamespaceService (`backend/src/services/namespaceService.js`)
Core service providing:
- **CRUD operations** for namespace management
- **Manifest generation** for Kubernetes resources
- **Validation** for namespace names and resource limits
- **Integration** with Kubernetes API client

Key methods:
```javascript
// Get all namespaces with filtering
async getNamespaces()

// Create namespace with manifests
async createNamespace(namespaceData)

// Generate Kubernetes manifests
generateNamespaceManifest(name, description)
generateLimitRangeManifest(namespaceName, resourceLimits)
generateNetworkPolicyManifest(namespaceName)

// Validation utilities
isValidNamespaceName(name)
validateResourceLimits(resourceLimits)
```

#### API Routes (`backend/src/routes/namespaces.js`)
REST API endpoints with comprehensive validation:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/namespaces` | List all namespaces |
| `GET` | `/api/namespaces/:name` | Get specific namespace |
| `POST` | `/api/namespaces` | Create new namespace |
| `PATCH` | `/api/namespaces/:name` | Update namespace |
| `DELETE` | `/api/namespaces/:name` | Delete namespace |
| `GET` | `/api/namespaces/:name/manifests` | Get generated manifests |
| `GET` | `/api/namespaces/:name/status` | Get namespace health status |

#### Workflow Integration
Extended `WorkflowService` with namespace-specific workflows:
- **Provisioning workflow**: `startNamespaceProvisioningWorkflow()`
- **Update workflow**: `startNamespaceUpdateWorkflow()`
- **Deletion workflow**: `startNamespaceDeletionWorkflow()`

### Frontend Components

#### Main Page (`frontend/src/pages/NamespaceOnboarding.js`)
Comprehensive React component featuring:
- **Tabbed interface** for creation and management
- **Form validation** with real-time feedback
- **Resource sliders** for intuitive limit configuration
- **Manifest preview** with dry-run mode
- **Namespace list** with status indicators
- **Delete confirmation** with safety checks

Key features:
```javascript
// Form validation with regex pattern matching
const isFormValid = () => {
  return formData.name && 
         /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(formData.name) &&
         // ... other validations
}

// Resource limit sliders with unit conversion
const handleResourceLimitChange = (resource, type) => (event, newValue) => {
  const value = `${newValue}${getResourceUnit(resource, type)}`;
  // Update Redux state
}
```

#### Redux State Management (`frontend/src/store/namespacesSlice.js`)
Complete state management with async thunks:
- **API integration** with createAsyncThunk
- **Form state** management
- **Loading states** and error handling
- **Real-time updates** from WebSocket
- **Optimistic updates** for better UX

State structure:
```javascript
{
  namespaces: [],           // List of namespaces
  currentNamespace: null,   // Selected namespace details
  formData: {              // Creation form state
    name: '',
    description: '',
    resourceLimits: { ... },
    networkIsolated: true
  },
  loading: false,          // Loading states
  manifests: {},           // Cached manifests
  status: {}              // Health status cache
}
```

### Kubernetes Resources

#### Namespace Template (`k8s-manifests/namespace-templates/namespace.yaml`)
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ${NAMESPACE_NAME}
  labels:
    app.kubernetes.io/managed-by: "idp-platform"
    idp-platform/created-by: "namespace-onboarding"
    idp-platform/network-isolated: "${NETWORK_ISOLATED}"
  annotations:
    idp-platform/description: "${DESCRIPTION}"
    idp-platform/created-at: "${CREATED_AT}"
```

#### Resource Limits Template (`k8s-manifests/namespace-templates/limit-range.yaml`)
```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: resource-limits
  namespace: ${NAMESPACE_NAME}
spec:
  limits:
  - type: Container
    default:
      cpu: "${CPU_LIMIT}"
      memory: "${MEMORY_LIMIT}"
    defaultRequest:
      cpu: "${CPU_REQUEST}"
      memory: "${MEMORY_REQUEST}"
    max:
      cpu: "${CPU_MAX_LIMIT}"      # 2x default limit
      memory: "${MEMORY_MAX_LIMIT}" # 2x default limit
```

#### Network Policy Template (`k8s-manifests/namespace-templates/network-policy.yaml`)
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: namespace-isolation
  namespace: ${NAMESPACE_NAME}
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
  ingress:
  - from:
    - podSelector: {}  # Same namespace only
  egress:
  - to:
    - podSelector: {}  # Same namespace
  - to:              # DNS resolution
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports: [53/UDP, 53/TCP]
```

### Argo Workflow

#### Namespace Provisioning Workflow (`k8s-manifests/argo-workflows/namespace-provisioning-workflow.yaml`)

Multi-step workflow with the following stages:

1. **Validation** - Verify namespace name and check for conflicts
2. **Namespace Creation** - Apply namespace manifest with labels/annotations
3. **Resource Limits** - Apply LimitRange with calculated max limits
4. **Network Policy** - Apply network isolation (if enabled)
5. **Verification** - Confirm all resources are active and healthy

Workflow parameters:
```yaml
parameters:
- name: namespace-name     # Target namespace name
- name: description        # Namespace description
- name: cpu-request       # Default CPU request (e.g., "100m")
- name: cpu-limit         # Default CPU limit (e.g., "1000m")
- name: memory-request    # Default memory request (e.g., "128Mi")
- name: memory-limit      # Default memory limit (e.g., "1Gi")
- name: network-isolated  # Enable network policy (true/false)
- name: dry-run          # Preview mode without actual creation
```

## 🚀 Usage Guide

### Creating a Namespace

1. **Navigate** to "Namespace Onboarding" tab
2. **Fill out form**:
   - Namespace name (3-63 chars, lowercase alphanumeric with hyphens)
   - Description (optional)
   - Resource limits using sliders or direct input
   - Network isolation toggle (recommended: enabled)
3. **Preview** manifests with "Preview Manifests" button
4. **Create** namespace with "Create Namespace" button
5. **Monitor** progress in workflow dashboard

### Managing Namespaces

1. **Switch** to "Manage Namespaces" tab
2. **View** list of existing namespaces with status indicators
3. **Monitor** resource utilization and health status
4. **Delete** namespaces with confirmation dialog

### Resource Limit Configuration

**CPU Limits:**
- **Request**: 100m - 2000m (guaranteed resources)
- **Limit**: 500m - 4000m (maximum allowed)

**Memory Limits:**
- **Request**: 128Mi - 2Gi (guaranteed resources)  
- **Limit**: 512Mi - 8Gi (maximum allowed)

**Automatic Scaling:**
- Max limits automatically set to 2x the configured limits
- Pod limits match container limits for consistency

### Network Policy Behavior

When network isolation is **enabled** (recommended):
- ✅ **Allow**: Pod-to-pod communication within same namespace
- ✅ **Allow**: DNS resolution (kube-system access)
- ❌ **Deny**: All other ingress traffic
- ❌ **Deny**: All other egress traffic

When network isolation is **disabled**:
- ✅ **Allow**: All traffic (cluster default behavior)

## 🔍 API Reference

### Create Namespace
```bash
POST /api/namespaces
Content-Type: application/json

{
  "name": "my-app-prod",
  "description": "Production environment for my-app",
  "resourceLimits": {
    "cpu": {
      "request": "200m",
      "limit": "1000m"
    },
    "memory": {
      "request": "256Mi",
      "limit": "2Gi"
    }
  },
  "networkIsolated": true,
  "dryRun": false
}
```

### Response (Success)
```json
{
  "namespace": {
    "id": "uuid",
    "name": "my-app-prod",
    "status": "creating",
    "resourceLimits": { ... },
    "networkIsolated": true,
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "workflow": {
    "id": "workflow-uuid",
    "name": "namespace-provisioning-my-app-prod",
    "status": "running"
  },
  "message": "Namespace provisioning started"
}
```

### List Namespaces
```bash
GET /api/namespaces

# Response
{
  "namespaces": [
    {
      "name": "my-app-prod",
      "status": "Active",
      "resourceLimits": { ... },
      "networkIsolated": true,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1
}
```

## 🧪 Testing

### Validation Tests
The implementation includes comprehensive validation for:
- **Namespace names**: Kubernetes naming conventions (RFC 1123)
- **Resource formats**: CPU (millicores), Memory (bytes with units)
- **Limit relationships**: Requests ≤ Limits
- **Network policy**: Valid CIDR and port specifications

### Manual Testing Checklist
- [ ] Create namespace with valid configuration
- [ ] Test form validation with invalid inputs
- [ ] Verify manifest preview in dry-run mode
- [ ] Check resource limits are properly applied
- [ ] Confirm network policy blocks external traffic
- [ ] Test namespace deletion with confirmation
- [ ] Verify WebSocket updates during workflow execution

## 🚨 Troubleshooting

### Common Issues

**Backend fails to start with kubeconfig error:**
```
Error: ENOENT: no such file or directory, open './aks-admin'
```
**Solution**: Ensure proper kubeconfig is available or mock the Kubernetes client for development.

**Namespace creation fails with validation error:**
```
"Invalid namespace name format"
```
**Solution**: Use lowercase alphanumeric names with hyphens, 3-63 characters.

**Network policy not working:**
```
Pods can still communicate across namespaces
```
**Solution**: Verify NetworkPolicy CRD is installed and CNI supports network policies.

**Resource limits not enforced:**
```
Pods exceed configured limits
```
**Solution**: Check LimitRange is applied and admission controllers are enabled.

### Debugging Commands

```bash
# Check namespace resources
kubectl get namespace my-app-prod -o yaml

# Verify resource limits
kubectl get limitrange -n my-app-prod

# Check network policy
kubectl get networkpolicy -n my-app-prod

# Debug workflow execution
kubectl logs -n argo workflow-name -c main

# Test network connectivity
kubectl exec -n my-app-prod pod-name -- ping other-namespace-pod
```

## 🔄 Future Enhancements

### Planned Features
- [ ] **Resource monitoring** integration with Prometheus/Grafana
- [ ] **Cost tracking** per namespace with Azure Cost Management
- [ ] **Backup policies** automatic configuration
- [ ] **Security scanning** integration with Azure Defender
- [ ] **Template library** for common application patterns
- [ ] **Multi-cluster** namespace provisioning
- [ ] **GitOps integration** for namespace configuration as code

### Enhancement Ideas
- [ ] **Slack notifications** for namespace lifecycle events
- [ ] **Auto-cleanup** for unused namespaces
- [ ] **Resource recommendations** based on usage patterns
- [ ] **Compliance policies** integration
- [ ] **Service mesh** automatic enrollment

## 📚 References

- [Kubernetes Namespace Documentation](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/)
- [Resource Quotas](https://kubernetes.io/docs/concepts/policy/resource-quotas/)
- [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [Argo Workflows](https://argoproj.github.io/argo-workflows/)
- [Azure AKS Documentation](https://docs.microsoft.com/en-us/azure/aks/)
- [Azure RBAC for AKS](https://docs.microsoft.com/en-us/azure/aks/azure-ad-rbac)

## 📞 Support

For issues or questions regarding the namespace onboarding implementation:
1. Check this README for common solutions
2. Review the troubleshooting section
3. Examine workflow logs in Argo UI
4. Contact the IDP Platform Team

---
**Generated**: 2024-08-30  
**Version**: 1.0  
**Maintainer**: IDP Platform Team