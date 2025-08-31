#!/bin/bash

# External Secrets Memory Initialization Script
# Initializes MCP memory for External Secrets Operator deployment

set -e

echo "🔐 Initializing External Secrets Memory..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to create memory entities
create_memory_entities() {
    echo -e "${YELLOW}Creating External Secrets entities in memory...${NC}"
    
    cat << 'EOF' | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: external-secrets-memory-init
  namespace: default
data:
  entities: |
    [
      {
        "name": "External Secrets Operator",
        "entityType": "Component",
        "observations": [
          "Kubernetes operator for syncing secrets from external systems",
          "Supports multiple secret backends including Azure Key Vault",
          "Installed via Helm chart external-secrets/external-secrets",
          "Requires CRDs for SecretStore, ExternalSecret resources",
          "Provides secure secret rotation and synchronization"
        ]
      },
      {
        "name": "Azure Key Vault",
        "entityType": "SecretBackend",
        "observations": [
          "Primary secret storage for production environments",
          "Supports Workload Identity authentication",
          "Provides secret versioning and soft delete",
          "Enables RBAC-based access control",
          "Integrates with External Secrets via ClusterSecretStore"
        ]
      },
      {
        "name": "ClusterSecretStore",
        "entityType": "Resource",
        "observations": [
          "Cluster-wide configuration for external secret providers",
          "Defines Azure Key Vault connection parameters",
          "Uses Workload Identity for authentication",
          "Shared across multiple namespaces",
          "Named 'azure-keyvault' for production use"
        ]
      },
      {
        "name": "SecretStore",
        "entityType": "Resource",
        "observations": [
          "Namespace-scoped secret provider configuration",
          "Used for development with Kubernetes secrets backend",
          "Enables multi-tenant secret isolation",
          "References service accounts for authentication",
          "Supports path-based secret filtering"
        ]
      },
      {
        "name": "ExternalSecret",
        "entityType": "Resource",
        "observations": [
          "Defines which secrets to fetch from external systems",
          "Creates and manages Kubernetes Secret objects",
          "Supports templating and transformation",
          "Configurable refresh intervals",
          "Uses creationPolicy for lifecycle management"
        ]
      },
      {
        "name": "external-secrets-identity",
        "entityType": "Identity",
        "observations": [
          "Managed Identity for External Secrets Operator",
          "Federated with AKS OIDC issuer",
          "Has Key Vault Secrets User role",
          "Bound to external-secrets service account",
          "Enables passwordless authentication"
        ]
      }
    ]
  relations: |
    [
      {
        "from": "External Secrets Operator",
        "to": "Azure Key Vault",
        "relationType": "syncs-with"
      },
      {
        "from": "External Secrets Operator",
        "to": "ClusterSecretStore",
        "relationType": "uses"
      },
      {
        "from": "ClusterSecretStore",
        "to": "Azure Key Vault",
        "relationType": "connects-to"
      },
      {
        "from": "ExternalSecret",
        "to": "ClusterSecretStore",
        "relationType": "references"
      },
      {
        "from": "external-secrets-identity",
        "to": "Azure Key Vault",
        "relationType": "authenticates-to"
      },
      {
        "from": "External Secrets Operator",
        "to": "external-secrets-identity",
        "relationType": "uses-identity"
      },
      {
        "from": "Platform API",
        "to": "ExternalSecret",
        "relationType": "consumes-secrets-from"
      },
      {
        "from": "Cert Manager",
        "to": "ExternalSecret",
        "relationType": "stores-certificates-via"
      },
      {
        "from": "External DNS",
        "to": "ExternalSecret",
        "relationType": "retrieves-credentials-from"
      }
    ]
EOF
}

# Function to store deployment patterns
store_deployment_patterns() {
    echo -e "${YELLOW}Storing deployment patterns...${NC}"
    
    cat << 'EOF' > /tmp/external-secrets-patterns.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: external-secrets-patterns
  namespace: default
data:
  helm-install-dev: |
    helm repo add external-secrets https://charts.external-secrets.io
    helm repo update
    helm install external-secrets \
      external-secrets/external-secrets \
      -n external-secrets-system \
      --create-namespace \
      --set installCRDs=true
  
  helm-install-prod: |
    helm install external-secrets \
      external-secrets/external-secrets \
      -n external-secrets-system \
      --create-namespace \
      --set installCRDs=true \
      --set serviceAccount.annotations."azure\.workload\.identity/client-id"="$IDENTITY_CLIENT_ID" \
      --set serviceAccount.labels."azure\.workload\.identity/use"="true" \
      --set podLabels."azure\.workload\.identity/use"="true"
  
  validation-script: |
    #!/bin/bash
    echo "Checking External Secrets Operator..."
    kubectl get pods -n external-secrets-system
    kubectl get crd | grep external-secrets
    kubectl get secretstores,clustersecretstores --all-namespaces
    kubectl get externalsecrets --all-namespaces
EOF
    
    kubectl apply -f /tmp/external-secrets-patterns.yaml
}

# Function to create test configurations
create_test_configs() {
    echo -e "${YELLOW}Creating test configurations...${NC}"
    
    cat << 'EOF' > /tmp/external-secrets-test.yaml
apiVersion: v1
kind: Secret
metadata:
  name: test-backend-secret
  namespace: external-secrets-system
type: Opaque
stringData:
  jwt-secret: "test-jwt-secret-$(date +%s)"
  db-password: "test-db-password"
  api-key: "test-api-key-12345"
---
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: test-secret-store
  namespace: default
spec:
  provider:
    kubernetes:
      remoteNamespace: external-secrets-system
      auth:
        serviceAccount:
          name: external-secrets
      server:
        caProvider:
          type: ConfigMap
          name: kube-root-ca.crt
          key: ca.crt
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: test-external-secret
  namespace: default
spec:
  refreshInterval: 30s
  secretStoreRef:
    name: test-secret-store
    kind: SecretStore
  target:
    name: test-synced-secret
    creationPolicy: Owner
  data:
  - secretKey: jwt
    remoteRef:
      key: test-backend-secret
      property: jwt-secret
  - secretKey: database
    remoteRef:
      key: test-backend-secret
      property: db-password
EOF
}

# Function to verify memory initialization
verify_memory() {
    echo -e "${YELLOW}Verifying memory initialization...${NC}"
    
    # Check if memory ConfigMaps exist
    if kubectl get configmap external-secrets-memory-init &>/dev/null; then
        echo -e "${GREEN}✓ Memory entities created successfully${NC}"
    else
        echo -e "${RED}✗ Failed to create memory entities${NC}"
        return 1
    fi
    
    if kubectl get configmap external-secrets-patterns &>/dev/null; then
        echo -e "${GREEN}✓ Deployment patterns stored successfully${NC}"
    else
        echo -e "${RED}✗ Failed to store deployment patterns${NC}"
        return 1
    fi
}

# Main execution
main() {
    echo "================================================"
    echo "External Secrets Memory Initialization"
    echo "================================================"
    
    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}kubectl is not installed or not in PATH${NC}"
        exit 1
    fi
    
    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        echo -e "${RED}Cannot connect to Kubernetes cluster${NC}"
        exit 1
    fi
    
    # Initialize memory
    create_memory_entities
    store_deployment_patterns
    create_test_configs
    
    # Verify initialization
    if verify_memory; then
        echo -e "${GREEN}✓ External Secrets memory initialization completed successfully${NC}"
        
        # Display next steps
        echo ""
        echo "Next steps:"
        echo "1. Deploy External Secrets Operator:"
        echo "   kubectl get cm external-secrets-patterns -o jsonpath='{.data.helm-install-dev}' | bash"
        echo ""
        echo "2. Apply test configuration:"
        echo "   kubectl apply -f /tmp/external-secrets-test.yaml"
        echo ""
        echo "3. Verify secret synchronization:"
        echo "   kubectl get secret test-synced-secret -o yaml"
        echo ""
    else
        echo -e "${RED}✗ Memory initialization failed${NC}"
        exit 1
    fi
}

# Run main function
main "$@"