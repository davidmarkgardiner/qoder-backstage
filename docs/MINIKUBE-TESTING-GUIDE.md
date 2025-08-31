# 🧪 Minikube Testing Guide for IDP Platform

**Purpose**: Test IDP platform workflows in minikube without Azure/Karpenter dependencies

## 🎯 What This Tests

### ✅ What Works in Minikube
- **Workflow Structure**: Template syntax and DAG validation
- **Parameter Validation**: Cluster names, node pool types, configurations
- **RBAC Integration**: Service account and permissions
- **Logic Flow**: All workflow steps execute in correct order
- **Node Pool Types**: All 4 configurations (standard, memory-optimized, compute-optimized, spot-optimized)
- **Backend Integration**: API endpoints and parameter mapping (if running)

### ⚠️ What's Simulated
- **Azure Resources**: ResourceGroup, ManagedCluster creation
- **Karpenter Resources**: AKSNodeClass, NodePool (CRDs don't exist in minikube)
- **ASO Integration**: Azure Service Operator resources
- **Network Configuration**: Azure networking and policies

## 🚀 Quick Start

### 1. Prerequisites
```bash
# Ensure minikube is running
minikube status

# Install Argo Workflows (if not already installed)
kubectl create namespace argo
kubectl apply -n argo -f https://github.com/argoproj/argo-workflows/releases/latest/download/install.yaml

# Wait for Argo to be ready
kubectl wait --for=condition=available --timeout=300s deployment/workflow-controller -n argo
```

### 2. Run Complete Test Suite
```bash
# Make script executable and run
chmod +x test-minikube-workflow.sh
./test-minikube-workflow.sh
```

## 🔧 Manual Testing Steps

### Step 1: Apply Minikube Workflow Template
```bash
kubectl apply -f idp-platform/k8s-manifests/argo-workflows/aks-cluster-provisioning-minikube-test.yaml
```

### Step 2: Apply RBAC Configuration
```bash
kubectl apply -f idp-platform/k8s-manifests/argo-workflows/backend-rbac.yaml
```

### Step 3: Test Individual Node Pool Type
```bash
# Test standard node pool
cat << EOF | kubectl apply -f -
apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  generateName: minikube-test-standard-
  namespace: default
spec:
  workflowTemplateRef:
    name: aks-cluster-provisioning-minikube-test
  arguments:
    parameters:
    - name: cluster-name
      value: test-standard-cluster
    - name: node-pool-type
      value: standard
    - name: location
      value: eastus
EOF
```

### Step 4: Monitor Workflow
```bash
# Watch workflow progress
kubectl get workflows -w

# Check workflow logs
kubectl logs -l workflows.argoproj.io/workflow=<workflow-name>

# Get detailed workflow info
kubectl describe workflow <workflow-name>
```

## 📋 Test Scenarios

### Test All Node Pool Types
The test script automatically validates:

1. **Standard Node Pool**
   - General purpose configuration
   - Standard_DS2_v2, Standard_DS3_v2 VMs
   - 1000 CPU cores, 1000Gi memory limits

2. **Memory-Optimized Node Pool**  
   - High memory workload configuration
   - Standard_E4s_v3, Standard_E8s_v3 VMs
   - 2000 CPU cores, 4000Gi memory limits

3. **Compute-Optimized Node Pool**
   - High CPU workload configuration  
   - Standard_F4s_v2, Standard_F8s_v2 VMs
   - 4000 CPU cores, 2000Gi memory limits

4. **Spot-Optimized Node Pool**
   - Cost-effective configuration
   - Mixed VM types with spot pricing
   - 1000 CPU cores, 1000Gi memory limits

### Backend Integration Testing
If you have the backend running:

```bash
# Start backend (in another terminal)
cd idp-platform/backend
npm install
npm start

# The test script will automatically detect and test:
# - Health endpoint: http://localhost:3001/api/health  
# - Node pool configs: http://localhost:3001/api/azure/node-pool-types
# - Parameter validation and mapping
```

### Frontend Integration Testing  
If you have the frontend running:

```bash
# Start frontend (in another terminal)
cd idp-platform/frontend  
npm install
npm start

# Test frontend at: http://localhost:3000
# - Cluster onboarding page should load
# - Node pool configurations should display
# - API calls should proxy to backend
```

## 🐛 Troubleshooting

### Workflow Issues
```bash
# Workflow stuck in pending
kubectl describe workflow <name>
kubectl get events --sort-by='.metadata.creationTimestamp'

# RBAC permission errors  
kubectl get serviceaccount idp-backend-sa
kubectl get clusterrole idp-backend-workflow-manager
kubectl get clusterrolebinding idp-backend-workflow-manager-binding

# Template not found
kubectl get workflowtemplates
kubectl apply -f idp-platform/k8s-manifests/argo-workflows/aks-cluster-provisioning-minikube-test.yaml
```

### Argo Workflows Issues
```bash
# Check Argo installation
kubectl get pods -n argo
kubectl logs deployment/workflow-controller -n argo

# Reinstall if needed
kubectl delete namespace argo
kubectl create namespace argo
kubectl apply -n argo -f https://github.com/argoproj/argo-workflows/releases/latest/download/install.yaml
```

## 📊 Expected Results

### Successful Test Output
```
=== 📋 MINIKUBE TEST REPORT ===

✅ Minikube workflow template deployed
✅ RBAC configuration present  
✅ Service account configured

🎯 TEST RESULTS SUMMARY:
✅ Workflow structure validated
✅ All node pool types tested
✅ Parameter validation working  
✅ Service account integration functional

🎉 Minikube testing completed successfully!
```

### What Each Test Validates
- **Structure**: YAML syntax, DAG dependencies, parameter passing
- **Logic**: Conditional steps, parameter validation, error handling
- **Integration**: RBAC, service accounts, namespace configuration
- **Completeness**: All node pool types, all workflow phases

## 🚀 Next Steps After Minikube Testing

### 1. Switch to AKS for Real Testing
```bash
# Switch context to AKS cluster
kubectl config use-context <your-aks-context>

# Verify Karpenter CRDs are available
kubectl api-resources | grep karpenter

# Apply production workflow template
kubectl apply -f idp-platform/k8s-manifests/argo-workflows/aks-cluster-provisioning-aso-karpenter.yaml
```

### 2. Enable Production Features
```bash
# Enable Karpenter workflow
export USE_KARPENTER_WORKFLOW=true

# Test with dry-run first
export DRY_RUN=true

# Then test with real resources
export DRY_RUN=false
```

### 3. Full End-to-End Testing
```bash
# Run comprehensive validation
./idp-platform/scripts/validate-karpenter-migration.sh

# Monitor real Karpenter resources
./idp-platform/scripts/monitor-karpenter.sh
```

## 📝 Files Created for Minikube Testing

```
test-minikube-workflow.sh                           # Complete test script
idp-platform/k8s-manifests/argo-workflows/
└── aks-cluster-provisioning-minikube-test.yaml   # Minikube-specific workflow template
```

## 🎯 Key Benefits of Minikube Testing

1. **Fast Iteration**: Test workflow changes quickly without Azure costs
2. **Structure Validation**: Catch YAML syntax and logic errors early  
3. **RBAC Testing**: Verify service account and permission configuration
4. **Parameter Validation**: Test all node pool types and configurations
5. **CI/CD Integration**: Can be automated in pipelines for PR validation

---

**Summary**: This minikube testing approach lets you validate the complete IDP platform workflow structure and logic without requiring Azure resources or Karpenter installations. Perfect for development, debugging, and CI/CD validation! 🚀