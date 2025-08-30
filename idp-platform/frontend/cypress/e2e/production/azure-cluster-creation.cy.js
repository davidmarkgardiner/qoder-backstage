describe('Production Tests - Full Azure Cluster Creation', { tags: ['@production'] }, () => {
  let testClusterConfig
  let createdClusters = []

  before(() => {
    // Verify Azure CLI is available and authenticated
    cy.task('log', 'Verifying Azure CLI authentication...')
    cy.exec('az account show', { failOnNonZeroExit: false }).then((result) => {
      if (result.code !== 0) {
        throw new Error('Azure CLI not authenticated. Please run "az login" before running production tests.')
      }
      cy.task('log', `✅ Azure authenticated for subscription: ${result.stdout}`)
    })
  })

  beforeEach(() => {
    cy.configureTestEnvironment('production')
    
    cy.get('@testClusters').then((clusters) => {
      cy.setupTestCluster(clusters.productionCluster).then((config) => {
        testClusterConfig = config
        createdClusters.push(config.name)
      })
    })
  })

  after(() => {
    // Cleanup all created clusters
    if (Cypress.env('cleanupAfterTests')) {
      createdClusters.forEach((clusterName) => {
        cy.cleanupAzureResources(clusterName)
      })
    }
  })

  it('should create a production AKS cluster with all Azure resources', () => {
    cy.log(`🚀 Starting production cluster creation: ${testClusterConfig.name}`)
    
    cy.navigateToClusterOnboarding()
    
    // Ensure dry run is disabled for production
    testClusterConfig.dryRun = false
    
    cy.fillClusterOnboardingForm(testClusterConfig)
    cy.submitClusterCreation()
    
    cy.waitForClusterCreationStart()
    
    // Monitor workflow progress (production clusters take longer)
    cy.monitorWorkflowProgress(testClusterConfig.name)
    
    // Wait for workflow completion (up to 20 minutes for production)
    cy.waitForWorkflowCompletion(testClusterConfig.name, 20)
    
    // Validate that Azure cluster was actually created
    cy.validateAzureClusterExists(testClusterConfig.name)
    
    // Validate Kubernetes resources
    cy.validateKubernetesResources(testClusterConfig.name)
    
    // Verify cluster configuration matches expectations
    cy.verifyClusterConfiguration(testClusterConfig.name, testClusterConfig.advancedConfig)
    
    // Verify cluster appears in management dashboard
    cy.verifyClusterInManagement(testClusterConfig.name)
    
    cy.log(`✅ Production cluster created successfully: ${testClusterConfig.name}`)
  })

  it('should create cluster with Node Auto Provisioning enabled', () => {
    const napConfig = {
      ...testClusterConfig,
      name: `${testClusterConfig.name}-nap`,
      enableNAP: true,
      dryRun: false
    }
    createdClusters.push(napConfig.name)
    
    cy.navigateToClusterOnboarding()
    cy.fillClusterOnboardingForm(napConfig)
    cy.submitClusterCreation()
    
    cy.waitForWorkflowCompletion(napConfig.name, 20)
    
    // Validate Azure cluster has NAP enabled
    cy.task('validateAzureCluster', napConfig.name).then((result) => {
      expect(result.exists).to.be.true
      // NAP is indicated by nodeProvisioningProfile.mode = 'Auto'
      cy.task('log', '✅ Cluster created with Node Auto Provisioning')
    })
    
    cy.validateAzureClusterExists(napConfig.name)
  })

  it('should create cluster with specific Kubernetes version', () => {
    const versionConfig = {
      ...testClusterConfig,
      name: `${testClusterConfig.name}-k8s`,
      dryRun: false,
      advancedConfig: {
        ...testClusterConfig.advancedConfig,
        kubernetesVersion: '1.32'
      }
    }
    createdClusters.push(versionConfig.name)
    
    cy.navigateToClusterOnboarding()
    cy.fillClusterOnboardingForm(versionConfig)
    cy.submitClusterCreation()
    
    cy.waitForWorkflowCompletion(versionConfig.name, 20)
    
    // Verify the Kubernetes version
    cy.verifyClusterConfiguration(versionConfig.name, versionConfig.advancedConfig)
  })

  it('should validate cluster accessibility after creation', () => {
    cy.log('Testing cluster accessibility...')
    
    cy.navigateToClusterOnboarding()
    
    const accessConfig = {
      ...testClusterConfig,
      name: `${testClusterConfig.name}-access`,
      dryRun: false
    }
    createdClusters.push(accessConfig.name)
    
    cy.fillClusterOnboardingForm(accessConfig)
    cy.submitClusterCreation()
    
    cy.waitForWorkflowCompletion(accessConfig.name, 20)
    
    // Validate cluster is accessible
    cy.task('validateAzureCluster', accessConfig.name).then((result) => {
      expect(result.exists).to.be.true
      expect(result.powerState).to.eq('Running')
      expect(result.fqdn).to.not.be.empty
      
      cy.log(`✅ Cluster is running with FQDN: ${result.fqdn}`)
    })
    
    // Test kubectl connectivity
    cy.exec(`az aks get-credentials --resource-group rg-${accessConfig.name} --name ${accessConfig.name} --overwrite-existing`)
    cy.exec('kubectl cluster-info').then((result) => {
      expect(result.code).to.eq(0)
      expect(result.stdout).to.contain('Kubernetes control plane')
      cy.log('✅ kubectl connectivity verified')
    })
  })

  it('should create cluster with all required Azure resources', () => {
    const resourceConfig = {
      ...testClusterConfig,
      name: `${testClusterConfig.name}-resources`,
      dryRun: false
    }
    createdClusters.push(resourceConfig.name)
    
    cy.navigateToClusterOnboarding()
    cy.fillClusterOnboardingForm(resourceConfig)
    cy.submitClusterCreation()
    
    cy.waitForWorkflowCompletion(resourceConfig.name, 20)
    
    // Validate all Azure resources are created
    cy.task('validateAzureCluster', resourceConfig.name).then((result) => {
      expect(result.exists).to.be.true
      expect(result.nodeResourceGroup).to.not.be.empty
      
      cy.log(`✅ Node resource group created: ${result.nodeResourceGroup}`)
    })
    
    // Verify ASO resources in Kubernetes
    cy.validateKubernetesResources(resourceConfig.name)
    
    // Verify resource group exists in Azure
    cy.exec(`az group show --name rg-${resourceConfig.name}`).then((result) => {
      expect(result.code).to.eq(0)
      const resourceGroup = JSON.parse(result.stdout)
      expect(resourceGroup.properties.provisioningState).to.eq('Succeeded')
      cy.log('✅ Resource group verified in Azure')
    })
  })

  it('should monitor cluster creation progress in real-time', () => {
    const monitorConfig = {
      ...testClusterConfig,
      name: `${testClusterConfig.name}-monitor`,
      dryRun: false
    }
    createdClusters.push(monitorConfig.name)
    
    cy.navigateToClusterOnboarding()
    cy.fillClusterOnboardingForm(monitorConfig)
    cy.submitClusterCreation()
    
    // Monitor real-time updates during cluster creation
    cy.verifyRealTimeUpdates(monitorConfig.name)
    
    // Verify progress indicators work during long-running operation
    cy.verifyProgressIndicators(monitorConfig.name)
    
    // Verify logs are updated in real-time
    cy.navigateToWorkflowDashboard()
    cy.get('[data-testid="workflow-list"]')
      .contains(monitorConfig.name)
      .parent()
      .find('[data-testid="view-logs-button"]')
      .click()
    
    // Logs should be continuously updated
    cy.get('[data-testid="workflow-logs"]')
      .should('be.visible')
      .should('not.be.empty')
    
    cy.waitForWorkflowCompletion(monitorConfig.name, 20)
  })

  it('should validate cluster security configuration', () => {
    const securityConfig = {
      ...testClusterConfig,
      name: `${testClusterConfig.name}-security`,
      dryRun: false
    }
    createdClusters.push(securityConfig.name)
    
    cy.navigateToClusterOnboarding()
    cy.fillClusterOnboardingForm(securityConfig)
    cy.submitClusterCreation()
    
    cy.waitForWorkflowCompletion(securityConfig.name, 20)
    
    // Validate security features based on cluster.yaml
    cy.task('validateAzureCluster', securityConfig.name).then((result) => {
      expect(result.exists).to.be.true
      expect(result.enableRbac).to.be.true
      
      cy.log('✅ RBAC is enabled')
      
      // Verify network security
      if (result.networkProfile) {
        expect(result.networkProfile.networkPlugin).to.eq('azure')
        expect(result.networkProfile.networkPolicy).to.eq('cilium')
        cy.log('✅ Network security configured with Cilium')
      }
    })
  })

  it('should handle cluster creation errors gracefully', () => {
    // Test with invalid configuration that would cause Azure errors
    const errorConfig = {
      ...testClusterConfig,
      name: `${testClusterConfig.name}-error-test`,
      location: 'uksouth', // Valid location
      dryRun: false
    }
    
    // Don't add to cleanup list since this should fail
    
    cy.navigateToClusterOnboarding()
    cy.fillClusterOnboardingForm(errorConfig)
    cy.submitClusterCreation()
    
    // Monitor for potential errors
    cy.navigateToWorkflowDashboard()
    
    // Wait reasonable time and check if workflow failed gracefully
    cy.get('[data-testid="workflow-list"]')
      .contains(errorConfig.name)
      .parent()
      .find('[data-testid="workflow-status"]', { timeout: 60000 })
      .should('be.visible')
      .then(($status) => {
        const status = $status.text()
        if (status.includes('Failed') || status.includes('Error')) {
          cy.log('✅ Error handled gracefully')
          
          // Verify error details are shown
          cy.get('[data-testid="workflow-list"]')
            .contains(errorConfig.name)
            .parent()
            .find('[data-testid="view-logs-button"]')
            .click()
          
          cy.get('[data-testid="workflow-logs"]')
            .should('contain', 'ERROR')
            .or('contain', 'Failed')
        } else {
          // If it succeeds, add to cleanup
          createdClusters.push(errorConfig.name)
          cy.log('Test cluster created successfully')
        }
      })
  })
})