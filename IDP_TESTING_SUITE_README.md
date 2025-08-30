# IDP Pod Testing and Validation Suite

## Overview

This comprehensive testing suite has been created to validate the health, connectivity, and functionality of IDP (Internal Developer Platform) pods running in Azure Kubernetes Service (AKS). The suite includes multiple layers of testing from basic health checks to complete end-to-end validation.

## Created Testing Infrastructure

### 1. Pod Health Validation Script
**File:** `idp-platform/scripts/validate-idp-pods.sh`

This script performs comprehensive validation of IDP pods including:
- Cluster connectivity verification
- Namespace validation  
- Pod status and health checks
- Service configuration validation
- Internal connectivity testing
- Resource utilization monitoring
- Istio integration validation

### 2. Service Connectivity Testing Script
**File:** `idp-platform/scripts/test-service-connectivity.sh`

This script tests internal service connectivity including:
- DNS resolution testing
- Service endpoint validation
- Load balancing verification
- API endpoint testing
- Frontend route testing
- Cross-service communication
- Port connectivity validation

### 3. External Access Validation Script
**File:** `idp-platform/scripts/validate-external-access.sh`

This script validates external access and ingress including:
- DNS resolution testing
- HTTP/HTTPS connectivity validation
- Istio Gateway configuration
- TLS certificate management
- Load balancer validation
- External DNS validation
- Security headers validation
- WebSocket connectivity

### 4. Cypress E2E Testing Suite
**Files:** 
- `idp-platform/frontend/cypress/e2e/smoke/idp-pod-health.cy.js`
- `idp-platform/frontend/cypress/support/kubernetes-commands.js`

Enhanced Cypress testing suite for:
- Backend pod health validation
- Frontend pod health validation
- Service connectivity validation
- Performance and reliability testing
- Integration health checks
- Error handling validation

### 5. Main Orchestration Script
**File:** `idp-platform/scripts/validate-deployment.sh`

Main orchestration script that runs all validation tests:
- Prerequisites validation
- Pod health validation
- Service connectivity tests
- External access validation
- Cypress E2E tests
- Smoke tests
- Performance tests
- Comprehensive reporting

### 6. Quick Test Script
**File:** `idp-platform/scripts/quick-test.sh`

Quick health check script for immediate validation:
- Basic pod status verification
- Internal connectivity testing
- External access validation
- Summary reporting

## Usage Instructions

### Prerequisites
1. Ensure you're connected to the correct AKS cluster:
   ```bash
   kubectl config current-context
   ```

2. Verify the IDP platform is deployed in the `idp-platform` namespace:
   ```bash
   kubectl get pods -n idp-platform
   ```

### Running Tests

#### Quick Health Check
```bash
./idp-platform/scripts/quick-test.sh
```

#### Comprehensive Validation
```bash
./idp-platform/scripts/validate-deployment.sh
```

#### Individual Component Tests
```bash
# Pod health validation
./idp-platform/scripts/validate-idp-pods.sh

# Service connectivity testing
./idp-platform/scripts/test-service-connectivity.sh

# External access validation
./idp-platform/scripts/validate-external-access.sh
```

#### Cypress E2E Tests
```bash
cd idp-platform/frontend
npx cypress run --spec "cypress/e2e/smoke/idp-pod-health.cy.js" --env grepTags="@idp-health"
```

### Test Options

The main validation script supports several options:
```bash
# Skip Cypress tests
./idp-platform/scripts/validate-deployment.sh --skip-cypress

# Skip performance tests
./idp-platform/scripts/validate-deployment.sh --skip-performance

# Quick mode (basic health checks only)
./idp-platform/scripts/validate-deployment.sh --quick

# Generate report without running tests
./idp-platform/scripts/validate-deployment.sh --report-only
```

## Configuration

### Environment Variables
- `NAMESPACE`: Target Kubernetes namespace (default: idp-platform)
- `DOMAIN`: Application domain (default: idp.davidmarkgardiner.co.uk)

### Expected Pod Labels
The scripts expect pods to have these labels:
- Backend pods: `app.kubernetes.io/name=idp-backend`
- Frontend pods: `app.kubernetes.io/name=idp-frontend`

### Expected Services
The scripts look for these services:
- `idp-backend-service` (ClusterIP on port 3001)
- `idp-frontend-service` (ClusterIP on port 80)

## Validation Scope

### Pod Health
- ✅ Pod status (Running/Ready)
- ✅ Container health checks
- ✅ Resource utilization
- ✅ Restart counts
- ✅ Log analysis

### Service Connectivity
- ✅ Internal DNS resolution
- ✅ Service endpoint availability
- ✅ Load balancing verification
- ✅ Cross-service communication

### External Access
- ✅ Domain DNS resolution
- ✅ HTTP/HTTPS connectivity
- ✅ TLS certificate validation
- ✅ Ingress/Gateway configuration
- ✅ Security headers

### Integration Testing
- ✅ End-to-end workflow validation
- ✅ API endpoint testing
- ✅ UI functionality verification
- ✅ Error handling validation

## Troubleshooting

### Common Issues and Solutions

1. **Pods not found**
   - Verify correct namespace: `kubectl get namespaces`
   - Check pod labels: `kubectl get pods -n idp-platform --show-labels`

2. **Service connectivity failures**
   - Check service configuration: `kubectl describe service -n idp-platform`
   - Verify service endpoints: `kubectl get endpoints -n idp-platform`

3. **External access issues**
   - Verify DNS resolution: `nslookup idp.davidmarkgardiner.co.uk`
   - Check ingress/gateway: `kubectl get gateway,ingress -n idp-platform`

4. **Cypress test failures**
   - Install dependencies: `cd idp-platform/frontend && npm install`
   - Check environment variables and API accessibility

## Reporting

All tests generate detailed reports including:
- Test execution summary
- Pod and service status
- Performance metrics
- Configuration validation
- Troubleshooting recommendations

Reports are saved to `/tmp/idp-validation-report-[timestamp].txt` for detailed analysis.

## Next Steps

1. **Deploy IDP Platform** (if not already deployed)
2. **Run Quick Test** to verify basic functionality
3. **Execute Comprehensive Validation** for full assessment
4. **Review Reports** and address any identified issues
5. **Set up Monitoring** using the validation scripts as health checks

## Integration with CI/CD

The validation scripts can be integrated into CI/CD pipelines:
```yaml
# Example for Azure DevOps or GitHub Actions
- name: Validate IDP Deployment
  run: |
    ./idp-platform/scripts/validate-deployment.sh --skip-cypress
```

This testing suite provides comprehensive validation capabilities for ensuring the IDP platform is healthy and functioning correctly in your AKS environment.