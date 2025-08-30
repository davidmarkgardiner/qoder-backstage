#!/bin/bash

# Validation script for KRO and Argo Workflows Helm releases
# This script validates that the infrastructure can be deployed using kubectl apply -k

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔍 Validating KRO and Argo Workflows infrastructure setup..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed or not in PATH"
    exit 1
fi

echo "✅ kubectl is available"

# Validate kustomization syntax
echo "🔧 Testing kustomization build..."
if kubectl kustomize "${PROJECT_ROOT}/01-infra/" > /dev/null; then
    echo "✅ Kustomization builds successfully"
else
    echo "❌ Kustomization build failed"
    exit 1
fi

# Validate with dry-run
echo "🧪 Testing dry-run deployment..."
if kubectl kustomize "${PROJECT_ROOT}/01-infra/" | kubectl apply --dry-run=client -f - > /dev/null; then
    echo "✅ Dry-run validation passed"
else
    echo "❌ Dry-run validation failed"
    exit 1
fi

# Validate KRO specific files
echo "🔍 Validating KRO configuration files..."
if [[ -f "${PROJECT_ROOT}/01-infra/kro/namespace.yaml" && \
      -f "${PROJECT_ROOT}/01-infra/kro/helm-repository.yaml" && \
      -f "${PROJECT_ROOT}/01-infra/kro/helm-release.yaml" && \
      -f "${PROJECT_ROOT}/01-infra/kro/kustomization.yaml" ]]; then
    echo "✅ All KRO files are present"
else
    echo "❌ Missing KRO configuration files"
    exit 1
fi

# Validate Argo Workflows specific files
echo "🔍 Validating Argo Workflows configuration files..."
if [[ -f "${PROJECT_ROOT}/01-infra/argo-workflows/namespace.yaml" && \
      -f "${PROJECT_ROOT}/01-infra/argo-workflows/helm-repository.yaml" && \
      -f "${PROJECT_ROOT}/01-infra/argo-workflows/helm-release.yaml" && \
      -f "${PROJECT_ROOT}/01-infra/argo-workflows/kustomization.yaml" ]]; then
    echo "✅ All Argo Workflows files are present"
else
    echo "❌ Missing Argo Workflows configuration files"
    exit 1
fi

echo ""
echo "🎉 All validations passed!"
echo ""
echo "📋 Next steps:"
echo "1. Ensure your cluster has flux-system installed"
echo "2. Apply the infrastructure: kubectl apply -k 01-infra/"
echo "3. Wait for all components to be ready"
echo "4. Verify installation:"
echo "   - kubectl get pods -n kro"
echo "   - kubectl get pods -n argo"
echo "   - kubectl get crd | grep kro"
echo "   - kubectl get crd | grep argoproj"