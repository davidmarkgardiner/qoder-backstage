---
mode: agent
---

# AKS Feature Verification and Evidence Gathering

## Context

Generate comprehensive verification scripts and commands to validate that specific features are enabled and functioning correctly on Azure Kubernetes Service (AKS) clusters. This prompt helps create evidence-gathering procedures for compliance, troubleshooting, and validation purposes.

## Task

Create a systematic approach to verify AKS cluster features using `az aks show`, `kubectl` commands, and other Azure CLI tools to gather concrete evidence of feature enablement and operational status.

## Requirements

- Use `az aks show` to inspect cluster configuration
- Leverage `kubectl` commands for runtime verification
- Generate structured output for documentation
- Include both enabled/disabled status and functional testing
- Provide clear evidence for audit trails
- Cover common AKS features and add-ons

## Verification Framework

### Cluster Information Gathering

```bash
# Get cluster basic information
az aks show --resource-group <rg-name> --name <cluster-name> --output table

# Get detailed cluster configuration
az aks show --resource-group <rg-name> --name <cluster-name> --output json > cluster-config.json

# Extract specific feature settings
az aks show --resource-group <rg-name> --name <cluster-name> --query '{
  name: name,
  kubernetesVersion: kubernetesVersion,
  nodeResourceGroup: nodeResourceGroup,
  enableRBAC: enableRbac,
  networkProfile: networkProfile.networkPlugin,
  addonProfiles: addonProfiles
}' --output table
```

### Feature-Specific Verification

#### RBAC (Role-Based Access Control)

```bash
# Check RBAC enablement in cluster config
az aks show --resource-group <rg-name> --name <cluster-name> --query 'enableRbac' --output tsv

# Verify RBAC is functional
kubectl auth can-i create pods --as=system:serviceaccount:default:default
kubectl get clusterroles | head -10
kubectl get rolebindings --all-namespaces | wc -l
```

#### Azure AD Integration

```bash
# Check Azure AD configuration
az aks show --resource-group <rg-name> --name <cluster-name> --query 'aadProfile' --output json

# Verify Azure AD authentication
kubectl get pods --as=<azure-ad-user>@<domain>.com
az aks get-credentials --resource-group <rg-name> --name <cluster-name> --admin
```

#### Network Policy

```bash
# Check network policy enablement
az aks show --resource-group <rg-name> --name <cluster-name> --query 'networkProfile.networkPolicy' --output tsv

# Verify network policies are working
kubectl get networkpolicies --all-namespaces
kubectl describe networkpolicy <policy-name> -n <namespace>

# Test network policy functionality
kubectl run test-pod --image=busybox --rm -it -- nslookup kubernetes.default
```

#### Container Insights (Monitoring)

```bash
# Check if Container Insights is enabled
az aks show --resource-group <rg-name> --name <cluster-name> --query 'addonProfiles.omsagent.enabled' --output tsv

# Verify monitoring components
kubectl get pods -n kube-system | grep omsagent
kubectl get daemonset omsagent -n kube-system
kubectl logs -l component=oms-agent -n kube-system --tail=50
```

#### Azure Key Vault Provider for Secrets Store CSI Driver

```bash
# Check CSI driver enablement
az aks show --resource-group <rg-name> --name <cluster-name> --query 'addonProfiles.azureKeyvaultSecretsProvider.enabled' --output tsv

# Verify CSI driver components
kubectl get pods -n kube-system | grep csi
kubectl get csidriver secrets-store.csi.k8s.io
kubectl get secretproviderclasses --all-namespaces
```

#### Autoscaling Features

```bash
# Check cluster autoscaler
az aks show --resource-group <rg-name> --name <cluster-name> --query 'agentPoolProfiles[].enableAutoScaling' --output tsv

# Verify autoscaler components
kubectl get deployment cluster-autoscaler -n kube-system
kubectl logs deployment/cluster-autoscaler -n kube-system --tail=20

# Check Horizontal Pod Autoscaler
kubectl get hpa --all-namespaces
kubectl top nodes
kubectl top pods --all-namespaces
```

#### Open Service Mesh (OSM)

```bash
# Check OSM addon status
az aks show --resource-group <rg-name> --name <cluster-name> --query 'addonProfiles.openServiceMesh.enabled' --output tsv

# Verify OSM installation
kubectl get pods -n arc-osm-system
kubectl get meshconfig osm-mesh-config -n arc-osm-system -o yaml
osm version
```

## Comprehensive Verification Script Template

```bash
#!/bin/bash

# AKS Feature Verification Script
RESOURCE_GROUP="<resource-group-name>"
CLUSTER_NAME="<cluster-name>"
OUTPUT_FILE="aks-verification-$(date +%Y%m%d-%H%M%S).txt"

echo "AKS Feature Verification Report - $(date)" > $OUTPUT_FILE
echo "=========================================" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Basic cluster info
echo "## Cluster Information" >> $OUTPUT_FILE
az aks show --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME --query '{
  name: name,
  location: location,
  kubernetesVersion: kubernetesVersion,
  provisioningState: provisioningState,
  enableRBAC: enableRbac,
  nodeResourceGroup: nodeResourceGroup
}' --output table >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Network configuration
echo "## Network Configuration" >> $OUTPUT_FILE
az aks show --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME --query 'networkProfile' --output json >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Add-on profiles
echo "## Add-on Profiles" >> $OUTPUT_FILE
az aks show --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME --query 'addonProfiles' --output json >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Node pools
echo "## Node Pools" >> $OUTPUT_FILE
az aks nodepool list --resource-group $RESOURCE_GROUP --cluster-name $CLUSTER_NAME --output table >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Kubernetes cluster state
echo "## Kubernetes Cluster State" >> $OUTPUT_FILE
kubectl get nodes -o wide >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
kubectl get pods --all-namespaces | grep -E "(kube-system|arc-|azure-)" >> $OUTPUT_FILE

echo "Verification complete. Results saved to: $OUTPUT_FILE"
```

## Evidence Documentation Template

````markdown
# AKS Feature Verification Evidence

**Cluster**: `<cluster-name>`  
**Resource Group**: `<resource-group>`  
**Verification Date**: `<date>`  
**Verified By**: `<name/email>`

## Feature Status Summary

| Feature            | Status      | Evidence Command                                              | Result                |
| ------------------ | ----------- | ------------------------------------------------------------- | --------------------- |
| RBAC               | ✅ Enabled  | `az aks show --query 'enableRbac'`                            | `true`                |
| Azure AD           | ✅ Enabled  | `az aks show --query 'aadProfile'`                            | Configuration present |
| Network Policy     | ❌ Disabled | `az aks show --query 'networkProfile.networkPolicy'`          | `null`                |
| Container Insights | ✅ Enabled  | `kubectl get pods -n kube-system \| grep omsagent`            | Pods running          |
| Autoscaler         | ✅ Enabled  | `az aks show --query 'agentPoolProfiles[].enableAutoScaling'` | `[true]`              |

## Detailed Evidence

### RBAC Verification

```bash
$ az aks show --resource-group myRG --name myCluster --query 'enableRbac'
true

$ kubectl auth can-i create pods --as=system:serviceaccount:default:default
no

$ kubectl get clusterroles | wc -l
89
```
````

### Container Insights Verification

```bash
$ kubectl get pods -n kube-system | grep omsagent
omsagent-fdf58                                    1/1     Running   0          2d
omsagent-rs-5b7b4f8d6c-x8h2q                    1/1     Running   0          2d
```

## Recommendations

Based on verification results:

- ✅ Critical security features (RBAC, Azure AD) are properly configured
- ⚠️ Consider enabling Network Policy for enhanced security
- ✅ Monitoring is operational with Container Insights
- ✅ Cluster scaling features are active

````

## Output Formats

### JSON Evidence Export
```bash
# Export cluster configuration as evidence
az aks show --resource-group $RG --name $CLUSTER --output json > evidence-cluster-config.json

# Export addon status
az aks show --resource-group $RG --name $CLUSTER --query 'addonProfiles' --output json > evidence-addons.json

# Export kubectl cluster info
kubectl cluster-info dump --output-directory=./cluster-evidence/
````

### Automated Evidence Collection

```bash
# Create comprehensive evidence package
mkdir aks-evidence-$(date +%Y%m%d)
cd aks-evidence-$(date +%Y%m%d)

# Collect Azure CLI evidence
az aks show --resource-group $RG --name $CLUSTER --output json > cluster-config.json
az aks nodepool list --resource-group $RG --cluster-name $CLUSTER --output json > nodepools.json

# Collect kubectl evidence
kubectl get nodes -o json > nodes.json
kubectl get pods --all-namespaces -o json > all-pods.json
kubectl get services --all-namespaces -o json > all-services.json

# Create summary report
echo "Evidence collection completed: $(date)" > evidence-summary.txt
```

## Additional Context

- Always run verification commands with appropriate permissions
- Consider automating evidence collection for compliance reporting
- Store evidence securely with proper retention policies
- Include version information for both Azure CLI and kubectl
- Document any custom configurations or non-standard deployments
