# E2E Testing for AKS Cluster Provisioning Platform

This directory contains comprehensive end-to-end testing for the AKS Internal Developer Platform, validating the complete cluster provisioning workflow from UI interaction to Azure resource creation.

## Overview

The E2E testing suite validates:
- **UI Functionality**: Form validation, navigation, real-time updates
- **API Integration**: Backend services and Kubernetes interactions
- **Workflow Execution**: Argo Workflows for cluster provisioning
- **Azure Integration**: Actual AKS cluster creation and configuration
- **Resource Validation**: Kubernetes and Azure resource verification

## Test Categories

### 🚀 Smoke Tests (5-10 minutes)
Quick validation of basic application functionality:
- Application loads without errors
- Form fields are populated correctly
- Navigation works between pages
- API connectivity is verified
- Basic form validation works

```bash
npm run test:e2e:smoke
```

### 🔄 Dry-Run Tests (10-15 minutes)
Full UI workflow with simulated Azure resources:
- Complete cluster configuration form submission
- Workflow execution monitoring
- Kubernetes resource validation (KRO, ASO)
- No actual Azure resources created
- Real-time progress tracking

```bash
npm run test:e2e:dry-run
```

### 🌐 Production Tests (20-60 minutes)
Complete end-to-end with real Azure resources:
- Full cluster provisioning in Azure
- Azure resource validation
- Cluster connectivity testing
- Security configuration verification
- Resource cleanup after testing

```bash
npm run test:e2e:production
```

## Quick Start

### Prerequisites
1. **Node.js 18+** and npm
2. **Azure CLI** (for production tests)
3. **kubectl** (for cluster validation)
4. **Docker** (for local Minikube testing)

### Setup
1. Install dependencies and setup environment:
```bash
cd idp-platform/frontend
./cypress/scripts/setup-test-environment.sh
```

2. Configure Azure credentials (for production tests):
```bash
az login
```

3. Update test configuration:
```bash
# Edit .env.test file with your Azure subscription details
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_RESOURCE_GROUP=rg-e2e-testing
```

### Run Tests
```bash
# Quick smoke tests
npm run test:e2e:smoke

# Interactive mode for debugging
npm run test:e2e:interactive

# Full test suite
npm run test:e2e:all
```

## Directory Structure

```
cypress/
├── e2e/                          # Test specifications
│   ├── smoke/                    # Smoke tests
│   │   └── basic-functionality.cy.js
│   ├── dry-run/                  # Dry-run tests
│   │   └── cluster-validation.cy.js
│   └── production/               # Production tests
│       └── azure-cluster-creation.cy.js
├── fixtures/                     # Test data
│   ├── test-clusters.json        # Cluster configurations
│   ├── azure-locations.json      # Azure regions
│   └── node-pool-types.json      # Node pool types
├── support/                      # Support files
│   ├── e2e.js                    # Global setup
│   ├── commands.js               # UI commands
│   ├── azure-commands.js         # Azure validation commands
│   └── cluster-commands.js       # Cluster management commands
└── scripts/                      # Utility scripts
    ├── run-e2e-tests.sh          # Test runner
    ├── setup-test-environment.sh # Environment setup
    ├── validate-azure-resources.js # Azure validation
    └── cleanup-azure-resources.js  # Resource cleanup
```

## Test Configuration

### Environment Variables
- `AZURE_SUBSCRIPTION_ID`: Azure subscription for testing
- `AZURE_RESOURCE_GROUP`: Resource group for test resources
- `SKIP_AZURE_VALIDATION`: Skip Azure resource validation (true/false)
- `CLEANUP_AFTER_TESTS`: Cleanup resources after tests (true/false)
- `TEST_CLUSTER_PREFIX`: Prefix for test cluster names
- `CYPRESS_RECORD_KEY`: Cypress Dashboard recording key

### Test Data Configuration
Test cluster configurations are defined in `cypress/fixtures/test-clusters.json`:

```json
{
  "dryRunCluster": {
    "name": "e2e-test-dry-run",
    "location": "uksouth",
    "nodePoolType": "standard",
    "dryRun": true,
    "enableNAP": true
  },
  "productionCluster": {
    "name": "e2e-test-production",
    "location": "uksouth",
    "nodePoolType": "standard", 
    "dryRun": false,
    "enableNAP": true
  }
}
```

## Custom Cypress Commands

### UI Commands
- `cy.fillClusterOnboardingForm(config)` - Fill cluster creation form
- `cy.submitClusterCreation()` - Submit cluster creation
- `cy.verifyFormValidation(errors)` - Verify form validation
- `cy.navigateToClusterOnboarding()` - Navigate to onboarding page

### Azure Commands
- `cy.validateAzureClusterExists(name)` - Verify cluster in Azure
- `cy.validateKubernetesResources(name)` - Verify K8s resources
- `cy.waitForWorkflowCompletion(name)` - Wait for workflow
- `cy.cleanupAzureResources(name)` - Cleanup test resources

### Cluster Commands
- `cy.verifyClusterInManagement(name)` - Verify cluster in dashboard
- `cy.validateClusterResources(name)` - Validate cluster resources
- `cy.monitorWorkflowProgress(name)` - Monitor workflow progress

## Running Tests

### Local Development
```bash
# Interactive mode for debugging
npm run test:e2e:interactive

# Headless mode
npm run test:e2e:smoke

# Debug mode with verbose output
npm run test:e2e:debug

# Full test suite
npm run test:e2e:full
```

### CI/CD Pipeline
Tests are automatically triggered by GitHub Actions:

- **Push/PR**: Smoke tests only
- **Manual Trigger**: Choose test type (smoke/dry-run/production)
- **Scheduled**: Full test suite including production tests

### Advanced Usage
```bash
# Custom test runner with options
./cypress/scripts/run-e2e-tests.sh --type production --cleanup --verbose

# Parallel execution
npm run test:e2e:parallel

# Cleanup only
npm run test:e2e:cleanup
```

## Azure Resource Validation

### Validation Script
The validation script checks:
- Cluster existence and status
- Network configuration (Azure CNI, Cilium)
- Security features (RBAC, Workload Identity)
- Node pool configuration
- Addon status (Key Vault, Azure Policy)

```bash
# Validate specific cluster
node cypress/scripts/validate-azure-resources.js my-test-cluster

# Generate validation report
node cypress/scripts/validate-azure-resources.js my-test-cluster > report.json
```

### Cleanup Script
Safely removes test resources:

```bash
# Dry run to see what would be deleted
node cypress/scripts/cleanup-azure-resources.js --dry-run

# Cleanup all test resources
node cypress/scripts/cleanup-azure-resources.js --force

# Cleanup specific cluster
node cypress/scripts/cleanup-azure-resources.js --cluster my-test-cluster --force
```

## Debugging Tests

### Interactive Mode
Run tests interactively to debug issues:
```bash
npm run test:e2e:interactive
```

### Debug Logs
Enable verbose logging:
```bash
DEBUG=cypress:* npm run test:e2e:smoke
```

### Test Artifacts
Failed tests generate:
- Screenshots in `cypress/screenshots/`
- Videos in `cypress/videos/`
- Validation reports (for production tests)

### Common Issues

#### Azure Authentication
```bash
# Verify Azure CLI authentication
az account show

# Login if needed
az login
```

#### Kubernetes Connectivity
```bash
# Verify kubectl configuration
kubectl cluster-info

# Switch to correct context
kubectl config use-context minikube
```

#### Test Data
Update test cluster names with unique timestamps to avoid conflicts:
```javascript
const uniqueName = `e2e-test-${Date.now()}`
```

## Best Practices

### Test Development
1. **Use unique test data** - Generate unique cluster names with timestamps
2. **Implement proper cleanup** - Always cleanup resources after tests
3. **Add proper waits** - Use `cy.wait()` for network requests and async operations
4. **Use descriptive test names** - Make test purposes clear
5. **Group related tests** - Use `describe` blocks for logical grouping

### Azure Testing
1. **Use dedicated subscription** - Separate test resources from production
2. **Implement proper RBAC** - Use service principals with minimal permissions
3. **Monitor costs** - Cleanup resources promptly to avoid charges
4. **Use dry-run mode** - Test workflows without creating actual resources
5. **Validate configurations** - Verify cluster settings match expectations

### CI/CD Integration
1. **Use environment-specific configs** - Different settings for CI vs local
2. **Implement proper secrets management** - Use GitHub secrets for credentials
3. **Add proper timeouts** - Account for longer operations in CI
4. **Generate test reports** - Provide clear feedback on test results
5. **Implement notification** - Alert on test failures

## Troubleshooting

### Common Test Failures

#### Frontend Not Loading
```bash
# Check if services are running
curl http://localhost:3000
curl http://localhost:3001/health

# Restart services
npm run test:setup
```

#### Azure Resource Creation Failures
```bash
# Check Azure quotas and permissions
az vm list-usage --location uksouth
az role assignment list --assignee $(az account show --query user.name -o tsv)

# Verify subscription limits
az account show
```

#### Cypress Test Failures
```bash
# Clear Cypress cache
npx cypress cache clear

# Reinstall Cypress
npm uninstall cypress
npm install cypress
```

### Performance Optimization
- Use `cypress-grep` for running specific tests
- Implement parallel test execution for faster results
- Optimize test data to reduce execution time
- Use local services when possible

### Security Considerations
- Store sensitive data in environment variables
- Use service principals instead of user accounts
- Implement least-privilege access
- Regular rotation of test credentials

## Contributing

When adding new tests:

1. Follow the existing test structure
2. Add appropriate data-testid attributes to UI components
3. Use existing custom commands when possible
4. Include both positive and negative test cases
5. Update documentation for new features

### Test Naming Convention
```javascript
describe('Feature Area - Test Category', () => {
  it('should describe specific behavior being tested', () => {
    // Test implementation
  })
})
```

### Custom Command Development
```javascript
Cypress.Commands.add('customCommand', (parameter) => {
  cy.log(`Executing custom command with: ${parameter}`)
  // Command implementation
})
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review test logs and artifacts
3. Consult the Cypress documentation
4. Open an issue with detailed information about the problem

## Related Documentation
- [Cypress Documentation](https://docs.cypress.io/)
- [Azure CLI Reference](https://docs.microsoft.com/en-us/cli/azure/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Argo Workflows](https://argoproj.github.io/argo-workflows/)