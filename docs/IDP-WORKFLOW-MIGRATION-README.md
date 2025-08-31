# IDP Workflow Migration - From KRO to Direct ASO + Karpenter

## Current State

The IDP platform workflow pipeline is functional through:
**API → Argo Workflows → ASO → Azure** ✅

ManagedCluster resources are successfully created via direct ASO integration.

## Migration Task

**Objective**: Update the workflow to use Karpenter for node management instead of KRO composition.

## Available CRDs

The following CRDs are already deployed and ready for use:

### Azure Service Operator (ASO)
```bash
managedclusters.containerservice.azure.com                   2025-08-30T17:22:17Z
```

### Karpenter for Azure
```bash
aksnodeclasses.karpenter.azure.com                           2025-08-30T16:46:21Z
nodeclaims.karpenter.sh                                      2025-08-30T16:46:21Z
nodepools.karpenter.sh                                       2025-08-30T16:46:21Z
```

## Current Working Components

### 1. Backend Workflow Service
- **File**: `idp-platform/backend/src/services/workflowService.js`
- **Status**: ✅ Working - Creates real Argo Workflow resources
- **Key Method**: `createArgoWorkflow()` - Successfully generates Argo Workflow CRs

### 2. Argo Workflow Templates
- **File**: `idp-platform/k8s-manifests/argo-workflows/aks-cluster-provisioning.yaml`
- **Status**: ✅ Working - Orchestrates cluster provisioning
- **Current Flow**: Creates AKSCluster CRDs → KRO processes → ASO creates resources

### 3. RBAC Configuration
- **File**: `idp-platform/k8s-manifests/argo-workflows/backend-rbac.yaml`
- **Status**: ✅ Working - Proper permissions for Argo, ASO, and KRO resources

### 4. Direct ASO Integration
- **Test File**: `idp-platform/k8s-manifests/aso-resources/direct-managedcluster-test.yaml`
- **Status**: ✅ Proven Working - ManagedCluster resources successfully created

## Migration Requirements

### Phase 1: Update Workflow Templates
Replace the KRO-based workflow with direct ASO + Karpenter approach:

1. **Update**: `aks-cluster-provisioning.yaml`
   - Remove KRO AKSCluster creation step
   - Add direct ASO ManagedCluster creation
   - Add Karpenter NodePool creation for node management

2. **Create**: New workflow steps for Karpenter integration
   - `AKSNodeClass` configuration for Azure-specific settings
   - `NodePool` configuration for autoscaling behavior

### Phase 2: Backend Service Updates
Update `workflowService.js` to generate workflow parameters for:
- ASO ManagedCluster specs
- Karpenter NodePool configurations
- AKSNodeClass parameters

### Phase 3: Remove KRO Dependencies
- Remove KRO ResourceGraphDefinition files from `k8s-manifests/kro-resources/`
- Update RBAC to remove KRO permissions (keep ASO permissions)
- Clean up KRO-specific workflow steps

## Key Files to Modify

### High Priority
1. `idp-platform/k8s-manifests/argo-workflows/aks-cluster-provisioning.yaml`
2. `idp-platform/backend/src/services/workflowService.js`
3. `idp-platform/k8s-manifests/argo-workflows/backend-rbac.yaml`

### Reference Files
- `idp-platform/k8s-manifests/aso-resources/direct-managedcluster-test.yaml` - Working ASO example
- Current KRO files in `k8s-manifests/kro-resources/` - Reference for field mappings

## Expected Benefits

1. **Simplified Architecture**: Remove KRO complexity layer
2. **Better Node Management**: Leverage Karpenter's advanced autoscaling
3. **Direct Control**: Direct ASO resource management without abstraction
4. **Proven Stability**: Use battle-tested ASO + Karpenter combination

## Authentication Notes

- ASO workload identity needs proper configuration for production
- Current test shows resources created but blocked on authentication
- Karpenter requires similar workload identity setup for Azure integration

## Validation Steps

After migration:
1. Verify ManagedCluster creation: `kubectl get managedcluster -A`
2. Verify NodePool creation: `kubectl get nodepools -A`
3. Verify AKSNodeClass creation: `kubectl get aksnodeclasses -A`
4. Test end-to-end workflow through IDP frontend

---

**Migration Owner**: Next Engineer  
**Status**: Ready to Begin  
**Estimated Effort**: 2-3 days  
**Risk Level**: Low (ASO integration already proven working)