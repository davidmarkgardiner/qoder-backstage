# Platform Apps Deployment Guide

This guide provides a comprehensive, step-by-step approach to deploying platform applications to AKS cluster in the correct order with mandatory validation between each layer.

## 🎯 Overview

The platform uses a **5-layer GitOps architecture** with strict deployment dependencies and **specialist agent coordination**:

```
Layer 0: Configuration (Identity ConfigMaps) → 
Layer 1: Infrastructure (Base Operators) → 
Layer 2: Configuration (Infrastructure Config) → 
Layer 3: Platform (Platform Services) → 
Layer 4: Applications (User Workloads)
```

**⚠️ CRITICAL**: Each layer must be validated before proceeding to the next layer to prevent cascading failures.

## 🤖 Specialist Agent Architecture

As the **platform apps team lead engineer**, you coordinate **11 specialist agents** for each component:

**Core Infrastructure Specialists:**
- **cert-manager-specialist**: TLS certificate management and Let's Encrypt automation
- **external-dns-specialist**: DNS record management with Azure DNS zones and Workload Identity  
- **external-secrets-specialist**: Azure Key Vault integration and secret synchronization

**Platform Application Specialists:**
- **gitops-apps-specialist**: GitOps management for apps/ directory with Flux configurations
- **k8s-jobs-specialist**: Kubernetes Jobs and CronJobs for batch workloads
- **argo-workflow-specialist**: Kubernetes-native workflow engine for namespace provisioning
- **platform-api-specialist**: Node.js/TypeScript backend for namespace-as-a-service
- **platform-ui-specialist**: React-based developer portal for self-service capabilities

**Platform Engineering Specialists:**
- **platform-network-specialist**: Network policies, service mesh configuration, and traffic management
- **platform-rbac-specialist**: Role-based access control, security policies, and compliance  
- **platform-build-specialist**: CI/CD pipelines, container builds, and deployment automation

**💡 GitOps Workflow**: Specialist agents update `/apps` folder configurations, then deployment proceeds with validation.

## 📋 Prerequisites

### Required Tools

```bash
# Verify required tools are installed
kubectl version --client
helm version
flux version
az version

# Optional but recommended
yq --version
jq --version
```

### AKS Cluster Access

```bash
# Connect to AKS cluster
az login
az account set --subscription <your-subscription-id>
az aks get-credentials --resource-group <rg-name> --name <cluster-name>

# Verify cluster access
kubectl cluster-info
kubectl get nodes
```

### Azure Resources Verification

```bash
# Verify Azure Key Vault exists
export KEYVAULT_NAME="azwi-kv-e5d0"
export KEYVAULT_RG="azwi-quickstart-f2ac"
az keyvault show --name $KEYVAULT_NAME --resource-group $KEYVAULT_RG

# Verify DNS zone exists
export DNS_ZONE="davidmarkgardiner.co.uk"
export DNS_RG="dns-rg"
az network dns zone show --name $DNS_ZONE --resource-group $DNS_RG

# Check Azure Service Operator (ASO) if required
kubectl get crd | grep resources.azure.com
```

## 🚀 Quick Deployment (Automated)

For experienced users, use the automated deployment script:

```bash
#!/bin/bash
# deploy-all-layers.sh

set -e

echo "🚀 Starting Platform Apps Deployment"
echo "====================================="

# Function to deploy and validate a layer
deploy_layer() {
    local layer_num=$1
    local layer_name=$2
    local layer_path=$3
    local validation_script=$4
    local specialist_agents=$5
    
    echo ""
    echo "🔄 Deploying Layer ${layer_num}: ${layer_name}"
    echo "================================"
    echo "🤖 Required Specialist Agents: ${specialist_agents}"
    echo ""
    
    # Deploy the layer
    echo "📦 Applying resources..."
    kubectl apply -k "apps/${layer_path}/"
    
    # Wait for initial resources to be created
    echo "⏳ Waiting for resources to be created..."
    sleep 30
    
    # Run validation
    echo "🔍 Running validation..."
    if ! "./apps/scripts/${validation_script}"; then
        echo "❌ Layer ${layer_num} validation failed!"
        echo "🔧 Troubleshooting commands:"
        echo "  kubectl get pods -A --field-selector=status.phase!=Running"
        echo "  kubectl get events --sort-by='.firstTimestamp' -A"
        echo "  kubectl logs -n <namespace> deployment/<deployment-name>"
        echo ""
        echo "🤖 Coordinate with these specialists to fix issues:"
        echo "   ${specialist_agents}"
        exit 1
    fi
    
    echo "✅ Layer ${layer_num} deployed and validated successfully!"
}

# Deploy each layer in order with required specialist agents
deploy_layer "0" "Configuration" "00-configuration" "validate-layer-00-configuration.sh" \
    "gitops-apps-specialist"

deploy_layer "1" "Infrastructure" "01-infrastructure" "validate-layer-01-infrastructure.sh" \
    "external-secrets-specialist, cert-manager-specialist, external-dns-specialist"

deploy_layer "2" "Configuration" "02-config" "validate-layer-02-config.sh" \
    "cert-manager-specialist, external-secrets-specialist"

deploy_layer "3" "Platform" "03-platform" "validate-layer-03-platform.sh" \
    "argo-workflow-specialist, platform-api-specialist, platform-ui-specialist, platform-rbac-specialist"

deploy_layer "4" "Applications" "04-applications" "validate-layer-04-applications.sh" \
    "k8s-jobs-specialist, platform-network-specialist, gitops-apps-specialist, platform-build-specialist"

echo ""
echo "🎉 All layers deployed successfully!"
echo "✅ Platform is ready for workloads"

# Run final comprehensive validation
echo ""
echo "🔍 Running comprehensive validation..."
./apps/scripts/validate-all-layers.sh

echo ""
echo "🤖 Platform Apps Team Coordination Summary:"
echo "============================================="
echo "✅ gitops-apps-specialist: Managed GitOps configurations"
echo "✅ external-secrets-specialist: Configured Azure Key Vault integration"  
echo "✅ cert-manager-specialist: Setup TLS certificate automation"
echo "✅ external-dns-specialist: Configured DNS record management"
echo "✅ argo-workflow-specialist: Deployed workflow engine"
echo "✅ platform-api-specialist: Deployed namespace-as-a-service API"
echo "✅ platform-ui-specialist: Deployed developer portal"
echo "✅ platform-rbac-specialist: Implemented security controls"
echo "✅ k8s-jobs-specialist: Configured batch workloads"
echo "✅ platform-network-specialist: Setup network policies"
echo "✅ platform-build-specialist: Coordinated CI/CD automation"

echo ""
echo "📋 Next Steps:"
echo "  1. Test DNS resolution: nslookup test.davidmarkgardiner.co.uk"
echo "  2. Check certificate issuance: kubectl get certificates -A"
echo "  3. Verify platform API: kubectl port-forward -n platform-system svc/platform-api 8080:80"
echo "  4. Access platform UI: kubectl port-forward -n platform-system svc/platform-ui 3000:80"
echo "  5. Coordinate with specialist agents for ongoing maintenance and updates"
```

## 📖 Manual Deployment (Step-by-Step)

### Layer 0: Configuration (Identity ConfigMaps)

**Purpose**: Deploy identity ConfigMaps required for Azure Workload Identity authentication.

## 🤖 Specialist Agent Coordination

**Use gitops-apps-specialist for configuration management:**

```markdown
🔧 **gitops-apps-specialist should:**
- Manage overall apps/ directory structure and GitOps patterns  
- Ensure proper Azure Workload Identity integrations across all components
- Validate identity ConfigMap configurations in /apps/00-configuration/
- Maintain configuration map organization and naming conventions
```

## 📦 Deployment Steps

```bash
echo "🚀 Layer 0: Configuration (Identity ConfigMaps)"
echo "==============================================="

echo "🤖 STEP 1: Use gitops-apps-specialist to verify configuration"
echo "   - Review /apps/00-configuration/ structure"
echo "   - Validate identity ConfigMap configurations"
echo "   - Ensure proper Azure Workload Identity setup"

# 1. Deploy identity ConfigMaps
kubectl apply -k apps/00-configuration/

# 2. Wait for resources
echo "⏳ Waiting for ConfigMaps to be created..."
sleep 10

# 3. Verify deployment
kubectl get configmaps -n azure-system
kubectl get configmap external-dns-identity-cm -n azure-system -o yaml
kubectl get configmap platform-api-identity-cm -n azure-system -o yaml

# 4. Run validation
echo "🔍 Running Layer 0 validation..."
./apps/scripts/validate-layer-00-configuration.sh

echo "✅ Layer 0 completed successfully!"
```

**Wait Condition**: All identity ConfigMaps must exist before proceeding.

**Troubleshooting**:
```bash
# Check ConfigMap contents
kubectl describe configmap external-dns-identity-cm -n azure-system
kubectl describe configmap platform-api-identity-cm -n azure-system

# Check namespace
kubectl describe namespace azure-system
```

### Layer 1: Infrastructure (Base Operators)

**Purpose**: Deploy base infrastructure operators (External Secrets, cert-manager, External DNS).

## 🤖 Specialist Agent Coordination

**Use Core Infrastructure Specialists for each component:**

```markdown
🔐 **external-secrets-specialist should:**
- Update /apps/01-infrastructure/external-secrets/ for operator deployment
- Configure Azure Key Vault integration with Workload Identity
- Run validation: ./apps/external-secrets/scripts/validate-external-secrets.sh
- Ensure comprehensive testing and memory-backed troubleshooting

🔒 **cert-manager-specialist should:**  
- Update /apps/01-infrastructure/cert-manager/ for base installation
- Configure Azure Workload Identity for certificate management
- Integrate with Azure Key Vault for certificate storage
- Run validation: ./apps/cert-manager/validate-cert-manager.py

🌐 **external-dns-specialist should:**
- Update /apps/01-infrastructure/external-dns/ for deployment manifests
- Configure Azure DNS zones with Workload Identity authentication
- Test DNS record creation after deployment
- Run validation: ./apps/external-dns/external-dns-virtualservice-validation.sh
```

## 📦 Deployment Steps

```bash
echo "🚀 Layer 1: Infrastructure (Base Operators)"
echo "==========================================="

echo "🤖 STEP 1: Coordinate with Core Infrastructure Specialists"
echo "   external-secrets-specialist: Configure Azure Key Vault integration"
echo "   cert-manager-specialist: Setup TLS certificate automation"  
echo "   external-dns-specialist: Configure DNS record management"

# 1. Deploy infrastructure operators
kubectl apply -k apps/01-infrastructure/

# 2. Wait for Helm releases to be created
echo "⏳ Waiting for Helm releases to be created..."
sleep 60

# 3. Monitor deployment progress
echo "📊 Monitoring deployment progress..."

# Check Flux HelmReleases
kubectl get helmreleases -A
flux get helmreleases -A

# Wait for External Secrets to be ready
echo "🔐 Waiting for External Secrets Operator..."
kubectl wait --for=condition=available deployment/external-secrets \
  -n external-secrets-system --timeout=300s

kubectl wait --for=condition=available deployment/external-secrets-webhook \
  -n external-secrets-system --timeout=300s

kubectl wait --for=condition=available deployment/external-secrets-cert-controller \
  -n external-secrets-system --timeout=300s

# Wait for cert-manager to be ready
echo "🔒 Waiting for cert-manager..."
kubectl wait --for=condition=available deployment/cert-manager \
  -n cert-manager --timeout=300s

kubectl wait --for=condition=available deployment/cert-manager-webhook \
  -n cert-manager --timeout=300s

kubectl wait --for=condition=available deployment/cert-manager-cainjector \
  -n cert-manager --timeout=300s

# Wait for External DNS to be ready
echo "🌐 Waiting for external-dns..."
kubectl wait --for=condition=available deployment/external-dns \
  -n external-dns --timeout=300s

# 4. Verify CRDs are installed
echo "📋 Verifying CRDs..."
kubectl get crd | grep -E "(external-secrets|cert-manager)"

# 5. Run validation
echo "🔍 Running Layer 1 validation..."
./apps/scripts/validate-layer-01-infrastructure.sh

echo "✅ Layer 1 completed successfully!"
```

**Wait Conditions**: 
- All deployments must be ready (available replicas = desired replicas)
- All CRDs must be installed
- All HelmReleases must show Ready=True

**Troubleshooting**:
```bash
# Check HelmRelease status
kubectl describe helmrelease external-secrets -n external-secrets-system
kubectl describe helmrelease cert-manager -n cert-manager
kubectl describe helmrelease external-dns -n external-dns

# Check pod logs
kubectl logs -n external-secrets-system deployment/external-secrets
kubectl logs -n cert-manager deployment/cert-manager
kubectl logs -n external-dns deployment/external-dns

# Check events
kubectl get events --sort-by='.firstTimestamp' -A | grep -E "(external-secrets|cert-manager|external-dns)"

# Manual Helm installation if Flux fails
helm repo add external-secrets https://charts.external-secrets.io
helm repo add jetstack https://charts.jetstack.io
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Install manually if needed
helm install external-secrets external-secrets/external-secrets \
  -n external-secrets-system --create-namespace

helm install cert-manager jetstack/cert-manager \
  -n cert-manager --create-namespace --set installCRDs=true

helm install external-dns bitnami/external-dns \
  -n external-dns --create-namespace
```

### Layer 2: Configuration (Infrastructure Configuration)

**Purpose**: Configure ClusterIssuers for cert-manager and ClusterSecretStore for External Secrets.

## 🤖 Specialist Agent Coordination

**Use Core Infrastructure Specialists for configuration:**

```markdown  
🔒 **cert-manager-specialist should:**
- Update /apps/02-config/cert-manager-issuers/ for ClusterIssuer configuration
- Configure Let's Encrypt issuers with DNS-01 challenge
- Test certificate issuance with staging issuer first
- Ensure proper Azure DNS integration for ACME challenges

🔐 **external-secrets-specialist should:**
- Update /apps/02-config/cluster-secret-store/ for Azure Key Vault configuration  
- Configure ClusterSecretStore with proper Azure Workload Identity
- Test secret synchronization from Azure Key Vault
- Validate secret store connectivity and authentication
```

## 📦 Deployment Steps

```bash
echo "🚀 Layer 2: Configuration (Infrastructure Configuration)"
echo "====================================================="

echo "🤖 STEP 1: Coordinate with Infrastructure Configuration Specialists"
echo "   cert-manager-specialist: Configure ClusterIssuers for Let's Encrypt"
echo "   external-secrets-specialist: Setup ClusterSecretStore for Azure Key Vault"

# 1. Deploy infrastructure configuration
kubectl apply -k apps/02-config/

# 2. Wait for resources to be created
echo "⏳ Waiting for configuration resources..."
sleep 30

# 3. Monitor ClusterIssuer readiness
echo "🔐 Waiting for ClusterIssuers to be ready..."
kubectl wait --for=condition=ready clusterissuer/letsencrypt-prod-dns01 --timeout=300s
kubectl wait --for=condition=ready clusterissuer/letsencrypt-staging-dns01 --timeout=300s

# 4. Monitor ClusterSecretStore readiness
echo "🗝️ Waiting for ClusterSecretStore to be ready..."
kubectl wait --for=condition=ready clustersecretstore/azure-keyvault --timeout=300s

# 5. Verify configuration
echo "📊 Verifying configuration..."
kubectl get clusterissuers -o wide
kubectl get clustersecretstores -o wide

# Test certificate issuance (staging)
echo "🧪 Testing certificate issuance..."
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: test-cert-$(date +%s)
  namespace: default
spec:
  secretName: test-cert-tls
  dnsNames:
  - test-$(date +%s).davidmarkgardiner.co.uk
  issuerRef:
    name: letsencrypt-staging-dns01
    kind: ClusterIssuer
EOF

# Wait for certificate to be ready (or timeout)
sleep 60

# 6. Run validation
echo "🔍 Running Layer 2 validation..."
./apps/scripts/validate-layer-02-config.sh

echo "✅ Layer 2 completed successfully!"
```

**Wait Conditions**:
- ClusterIssuers must show Ready=True
- ClusterSecretStore must show Ready=True
- Test certificate must be issued successfully

**Troubleshooting**:
```bash
# Check ClusterIssuer status
kubectl describe clusterissuer letsencrypt-prod-dns01
kubectl describe clusterissuer letsencrypt-staging-dns01

# Check ClusterSecretStore status
kubectl describe clustersecretstore azure-keyvault

# Check cert-manager logs for ACME challenges
kubectl logs -n cert-manager deployment/cert-manager | grep -i challenge

# Check external-secrets logs for Azure Key Vault connectivity
kubectl logs -n external-secrets-system deployment/external-secrets | grep -i azure

# Test DNS-01 challenge manually
kubectl get challenges -A
kubectl describe challenge <challenge-name> -n <namespace>

# Verify Azure permissions
az keyvault show --name $KEYVAULT_NAME --resource-group $KEYVAULT_RG
az role assignment list --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$KEYVAULT_RG/providers/Microsoft.KeyVault/vaults/$KEYVAULT_NAME"
```

### Layer 3: Platform (Platform Services)

**Purpose**: Deploy platform services (Argo Workflows, Platform API, Platform UI).

## 🤖 Specialist Agent Coordination

**Use Platform Application Specialists for each service:**

```markdown
⚡ **argo-workflow-specialist should:**
- Update /apps/03-platform/argo/ for workflow engine configuration  
- Design namespace provisioning workflows and templates
- Integrate with Platform API for workflow orchestration
- Run validation: ./apps/03-platform/argo/validate-deployment.sh

🔧 **platform-api-specialist should:**
- Update /apps/03-platform/platform-api/ for backend service deployment
- Ensure proper integration with Argo Workflows and External Secrets
- Implement namespace-as-a-service API endpoints  
- Run validation: ./apps/03-platform/platform-api/validate-deployment.sh

🎨 **platform-ui-specialist should:**
- Update /apps/03-platform/platform-ui/ for frontend service deployment
- Ensure proper integration with Platform API and Azure AD authentication
- Implement self-service developer portal features
- Run validation: ./apps/03-platform/platform-ui/validate-deployment.sh

🔒 **platform-rbac-specialist should:**
- Implement role-based access control across all platform components
- Ensure proper security policies and compliance
- Design multi-tenant security patterns for namespace isolation
```

## 📦 Deployment Steps

```bash
echo "🚀 Layer 3: Platform (Platform Services)"
echo "========================================"

echo "🤖 STEP 1: Coordinate with Platform Application Specialists"
echo "   argo-workflow-specialist: Deploy workflow engine for namespace provisioning"
echo "   platform-api-specialist: Deploy namespace-as-a-service backend API"
echo "   platform-ui-specialist: Deploy self-service developer portal"
echo "   platform-rbac-specialist: Implement security and access controls"

# 1. Deploy platform services
kubectl apply -k apps/03-platform/

# 2. Wait for Helm releases and deployments
echo "⏳ Waiting for platform services..."
sleep 60

# 3. Monitor Argo Workflows
echo "⚡ Waiting for Argo Workflows..."
kubectl wait --for=condition=available deployment/argo-server \
  -n argo --timeout=300s

kubectl wait --for=condition=available deployment/workflow-controller \
  -n argo --timeout=300s

# 4. Monitor Platform API
echo "🔧 Waiting for Platform API..."
kubectl wait --for=condition=available deployment/platform-api \
  -n platform-system --timeout=300s

# 5. Monitor Platform UI (if deployed)
echo "🎨 Waiting for Platform UI..."
if kubectl get deployment platform-ui -n platform-system &>/dev/null; then
    kubectl wait --for=condition=available deployment/platform-ui \
      -n platform-system --timeout=300s
fi

# 6. Check External Secrets synchronization
echo "🔐 Checking secret synchronization..."
kubectl get externalsecrets -A
kubectl describe externalsecret platform-api-secrets -n platform-system
kubectl describe externalsecret argo-secrets -n argo

# 7. Verify services have endpoints
echo "🌐 Verifying service endpoints..."
kubectl get endpoints -n argo
kubectl get endpoints -n platform-system

# 8. Test platform API health (port-forward)
echo "🩺 Testing Platform API health..."
kubectl port-forward -n platform-system svc/platform-api 8080:80 &
PORT_FORWARD_PID=$!
sleep 5

if curl -s http://localhost:8080/health | grep -q "healthy"; then
    echo "✅ Platform API is healthy"
else
    echo "⚠️ Platform API health check failed"
fi

kill $PORT_FORWARD_PID 2>/dev/null || true

# 9. Run validation
echo "🔍 Running Layer 3 validation..."
./apps/scripts/validate-layer-03-platform.sh

echo "✅ Layer 3 completed successfully!"
```

**Wait Conditions**:
- All deployments must be ready
- All External Secrets must be synchronized
- Services must have endpoints
- Platform API health endpoint must respond

**Troubleshooting**:
```bash
# Check platform deployments
kubectl get deployments -n argo
kubectl get deployments -n platform-system

# Check pod logs
kubectl logs -n argo deployment/argo-server
kubectl logs -n argo deployment/workflow-controller
kubectl logs -n platform-system deployment/platform-api
kubectl logs -n platform-system deployment/platform-ui

# Check External Secrets synchronization
kubectl describe externalsecret platform-api-secrets -n platform-system
kubectl logs -n external-secrets-system deployment/external-secrets

# Check service discovery
kubectl get svc -n argo
kubectl get svc -n platform-system
kubectl get endpoints -n argo
kubectl get endpoints -n platform-system

# Check ingress/gateway configuration (if using Istio)
kubectl get virtualservices -A
kubectl get gateways -A

# Test API connectivity directly
kubectl exec -n platform-system deployment/platform-api -- curl localhost:3000/health

# Check Argo Workflows functionality
kubectl create -n argo -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  generateName: hello-world-
spec:
  entrypoint: hello
  templates:
  - name: hello
    container:
      image: busybox:latest
      command: [echo, "Hello World"]
EOF
```

### Layer 4: Applications (User Workloads)

**Purpose**: Deploy test applications and user workloads.

## 🤖 Specialist Agent Coordination

**Use Application and Engineering Specialists:**

```markdown
🧪 **k8s-jobs-specialist should:**
- Create and manage Kubernetes Jobs and CronJobs for batch workloads
- Implement proper resource management and security contexts  
- Design jobs for data processing, system maintenance, and scheduled tasks
- Update /apps/04-applications/ with job configurations

🌐 **platform-network-specialist should:**
- Implement network policies and service mesh configurations
- Design traffic management patterns with Istio for applications
- Update network security configurations for test workloads
- Ensure proper ingress and egress policies

🔧 **gitops-apps-specialist should:**
- Manage test application deployments in /apps/04-applications/
- Ensure proper GitOps patterns for application lifecycle
- Validate application configurations and dependencies
- Coordinate with other specialists for complete application stack

🏗️ **platform-build-specialist should:**
- Manage CI/CD pipelines for application deployments
- Implement container build and deployment automation  
- Ensure proper security scanning and compliance in application builds
- Coordinate application deployment pipelines with GitOps patterns
```

## 📦 Deployment Steps

```bash
echo "🚀 Layer 4: Applications (User Workloads)"
echo "========================================"

echo "🤖 STEP 1: Coordinate with Application & Engineering Specialists"
echo "   k8s-jobs-specialist: Deploy batch workloads and scheduled tasks"
echo "   platform-network-specialist: Configure network policies and service mesh"
echo "   gitops-apps-specialist: Manage application GitOps lifecycle"
echo "   platform-build-specialist: Coordinate CI/CD and build automation"

# 1. Deploy test applications
kubectl apply -k apps/04-applications/

# 2. Wait for test applications
echo "⏳ Waiting for test applications..."
sleep 30

# 3. Check test DNS namespace
if kubectl get namespace test-dns &>/dev/null; then
    echo "🧪 Monitoring test applications..."
    kubectl get pods -n test-dns
    
    # Wait for httpbin if deployed
    if kubectl get deployment httpbin -n test-dns &>/dev/null; then
        kubectl wait --for=condition=available deployment/httpbin \
          -n test-dns --timeout=300s
    fi
fi

# 4. Check DNS records
echo "🌐 Verifying DNS records..."
test_domains=("httpbin.davidmarkgardiner.co.uk" "api.davidmarkgardiner.co.uk")

for domain in "${test_domains[@]}"; do
    echo "Testing DNS for ${domain}..."
    if nslookup "${domain}" &>/dev/null; then
        echo "✅ DNS record exists for ${domain}"
    else
        echo "⚠️ DNS record not found for ${domain}"
    fi
done

# 5. Check certificates
echo "📜 Checking certificates..."
kubectl get certificates -A

# 6. Test ingress/gateway access
echo "🌍 Testing ingress access..."
if kubectl get virtualservice httpbin-vs -n test-dns &>/dev/null; then
    echo "✅ VirtualService found"
    kubectl describe virtualservice httpbin-vs -n test-dns
fi

# 7. Run validation
echo "🔍 Running Layer 4 validation..."
./apps/scripts/validate-layer-04-applications.sh

echo "✅ Layer 4 completed successfully!"
```

**Wait Conditions**:
- Test applications must be running
- DNS records must resolve
- Certificates must be issued
- Ingress/Gateway must be accessible

**Troubleshooting**:
```bash
# Check test application status
kubectl get pods -n test-dns
kubectl describe deployment httpbin -n test-dns

# Check DNS resolution
nslookup httpbin.davidmarkgardiner.co.uk
dig httpbin.davidmarkgardiner.co.uk

# Check external-dns logs
kubectl logs -n external-dns deployment/external-dns | grep httpbin

# Check certificate status
kubectl describe certificate httpbin-tls -n test-dns
kubectl get certificaterequests -n test-dns
kubectl get challenges -n test-dns

# Test ingress manually
kubectl port-forward -n test-dns svc/httpbin 8080:80 &
curl http://localhost:8080/get
```

## 🔍 Comprehensive Validation

After all layers are deployed, run the comprehensive validation:

```bash
echo "🔍 Running Comprehensive Platform Validation"
echo "==========================================="

# Run the master validation script
./apps/scripts/validate-all-layers.sh

# Additional health checks
echo ""
echo "📊 Additional Health Checks"
echo "============================"

# Check all pods are running
echo "🏃 Checking all pods status..."
kubectl get pods -A --field-selector=status.phase!=Running

# Check resource utilization
echo "📈 Checking resource utilization..."
kubectl top nodes
kubectl top pods -A

# Check events for warnings/errors
echo "⚠️ Checking recent events..."
kubectl get events --sort-by='.firstTimestamp' -A | tail -20

# Test end-to-end functionality
echo "🔄 Testing end-to-end functionality..."

# 1. Test secret synchronization
kubectl get secrets -A | grep -E "(platform|cert|dns)-.*-secrets"

# 2. Test certificate issuance
kubectl get certificates -A -o wide

# 3. Test DNS automation
kubectl get services -A -o jsonpath='{range .items[?(@.metadata.annotations.external-dns\.alpha\.kubernetes\.io/hostname)]}{.metadata.name}{" "}{.metadata.namespace}{" "}{.metadata.annotations.external-dns\.alpha\.kubernetes\.io/hostname}{"\n"}{end}'

# 4. Test platform API
kubectl port-forward -n platform-system svc/platform-api 8080:80 &
PORT_FORWARD_PID=$!
sleep 5

echo "Testing platform API endpoints..."
curl -s http://localhost:8080/health || echo "Health endpoint failed"
curl -s http://localhost:8080/api/namespaces || echo "Namespaces endpoint failed"

kill $PORT_FORWARD_PID 2>/dev/null || true

echo ""
echo "✅ Validation complete!"
```

## 🔧 Troubleshooting

### Common Issues

#### 1. External Secrets Not Syncing

```bash
# Check External Secrets Operator
kubectl logs -n external-secrets-system deployment/external-secrets
kubectl get externalsecrets -A -o wide

# Check Azure Key Vault connectivity
kubectl describe clustersecretstore azure-keyvault

# Verify workload identity
kubectl describe serviceaccount external-secrets -n external-secrets-system
```

#### 2. cert-manager Certificate Issues

```bash
# Check certificate status
kubectl get certificates -A -o wide
kubectl describe certificate <cert-name> -n <namespace>

# Check challenges
kubectl get challenges -A
kubectl describe challenge <challenge-name> -n <namespace>

# Check ClusterIssuer
kubectl describe clusterissuer letsencrypt-prod-dns01
```

#### 3. External DNS Not Creating Records

```bash
# Check external-dns logs
kubectl logs -n external-dns deployment/external-dns

# Check DNS zone permissions
az network dns zone show --name davidmarkgardiner.co.uk --resource-group $DNS_RG

# Test DNS resolution
nslookup test.davidmarkgardiner.co.uk
```

#### 4. Platform Services Not Ready

```bash
# Check deployment status
kubectl get deployments -n platform-system -o wide
kubectl get deployments -n argo -o wide

# Check pod logs
kubectl logs -n platform-system deployment/platform-api
kubectl logs -n argo deployment/argo-server

# Check resource constraints
kubectl describe pod -n platform-system -l app=platform-api
```

### Emergency Rollback

If deployment fails at any layer:

```bash
#!/bin/bash
# rollback-layer.sh

LAYER=$1

case $LAYER in
    "0")
        kubectl delete -k apps/00-configuration/ --ignore-not-found=true
        ;;
    "1")
        kubectl delete -k apps/01-infrastructure/ --ignore-not-found=true
        # Clean up CRDs if needed
        kubectl delete crd -l app.kubernetes.io/name=external-secrets --ignore-not-found=true
        kubectl delete crd -l app.kubernetes.io/name=cert-manager --ignore-not-found=true
        ;;
    "2")
        kubectl delete -k apps/02-config/ --ignore-not-found=true
        ;;
    "3")
        kubectl delete -k apps/03-platform/ --ignore-not-found=true
        ;;
    "4")
        kubectl delete -k apps/04-applications/ --ignore-not-found=true
        ;;
    "all")
        kubectl delete -k apps/ --ignore-not-found=true
        ;;
    *)
        echo "Usage: $0 {0|1|2|3|4|all}"
        exit 1
        ;;
esac

echo "Rollback of layer $LAYER completed"
```

## 📋 Post-Deployment Checklist

- [ ] All 5 layers deployed successfully
- [ ] All validation scripts pass
- [ ] DNS records resolve correctly
- [ ] Certificates are issued and valid
- [ ] External Secrets synchronizing
- [ ] Platform API responding to health checks
- [ ] Platform UI accessible (if deployed)
- [ ] Argo Workflows functional
- [ ] Test applications running
- [ ] No error events in recent cluster events
- [ ] Resource utilization within acceptable limits
- [ ] Backup and monitoring configured

## 🔄 Maintenance Commands

### Daily Health Checks

```bash
#!/bin/bash
# daily-health-check.sh

echo "📊 Daily Platform Health Check - $(date)"
echo "========================================"

# Quick validation
./apps/scripts/validate-all-layers.sh

# Check resource utilization
kubectl top nodes
kubectl top pods -A --containers

# Check for failed pods
kubectl get pods -A --field-selector=status.phase=Failed

# Check certificate expiry
kubectl get certificates -A -o jsonpath='{range .items[*]}{.metadata.namespace}{"/"}{.metadata.name}{": "}{.status.conditions[?(@.type=="Ready")].status}{" expires "}{.status.notAfter}{"\n"}{end}'

# Check external-dns activity
kubectl logs -n external-dns deployment/external-dns --since=24h | grep -E "(CREATE|UPDATE|DELETE)"

echo "✅ Daily health check completed"
```

### Update Platform

```bash
#!/bin/bash
# update-platform.sh

echo "🔄 Updating Platform Components"
echo "==============================="

# Update Helm repositories
helm repo update

# Check for available updates
helm list -A -o json | jq -r '.[] | "\(.name) \(.namespace) \(.chart) \(.app_version)"'

# Update specific components (example)
kubectl patch helmrelease external-secrets -n external-secrets-system --type merge -p '{"spec":{"chart":{"spec":{"version":"0.9.x"}}}}'

# Monitor update
flux get helmreleases -A

echo "✅ Platform update completed"
```

This deployment guide ensures a reliable, repeatable deployment process with proper validation at each stage. The layered approach prevents cascading failures and makes troubleshooting much easier.