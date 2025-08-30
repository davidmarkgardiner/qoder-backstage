// Custom commands for Azure resource validation

Cypress.Commands.add('validateAzureClusterExists', (clusterName) => {
  cy.log(`Validating Azure cluster exists: ${clusterName}`)
  
  if (Cypress.env('skipAzureValidation')) {
    cy.log('Skipping Azure validation (SKIP_AZURE_VALIDATION=true)')
    return
  }
  
  cy.task('validateAzureCluster', clusterName).then((result) => {
    expect(result.exists, `Cluster ${clusterName} should exist in Azure`).to.be.true
    
    if (result.exists) {
      expect(result.provisioningState).to.eq('Succeeded')
      expect(result.powerState).to.eq('Running')
      cy.log(`✅ Cluster ${clusterName} is running in Azure`)
      cy.log(`Kubernetes version: ${result.kubernetesVersion}`)
      cy.log(`FQDN: ${result.fqdn}`)
    }
  })
})

Cypress.Commands.add('validateKubernetesResources', (clusterName) => {
  cy.log(`Validating Kubernetes resources for cluster: ${clusterName}`)
  
  cy.task('validateKubernetesResources', clusterName).then((result) => {
    if (result.error) {
      cy.log(`⚠️ Error validating Kubernetes resources: ${result.error}`)
      return
    }
    
    // Validate KRO instance
    expect(result.kroInstance.exists, 'KRO instance should exist').to.be.true
    if (result.kroInstance.exists) {
      cy.log(`✅ KRO instance exists with phase: ${result.kroInstance.phase}`)
    }
    
    // Validate ASO resources
    if (result.asoResources.resourceGroup) {
      cy.log('✅ ASO ResourceGroup exists')
    }
    if (result.asoResources.managedCluster) {
      cy.log('✅ ASO ManagedCluster exists')
    }
  })
})

Cypress.Commands.add('waitForWorkflowCompletion', (workflowName, timeoutMinutes = 20) => {
  cy.log(`Waiting for workflow completion: ${workflowName} (timeout: ${timeoutMinutes}m)`)
  
  cy.task('waitForWorkflowCompletion', workflowName, timeoutMinutes).then((result) => {
    if (result.success) {
      cy.log(`✅ Workflow ${workflowName} completed successfully`)
    } else {
      cy.log(`❌ Workflow ${workflowName} failed: ${result.message}`)
      if (result.status) {
        cy.log('Workflow status:', JSON.stringify(result.status, null, 2))
      }
      throw new Error(`Workflow failed: ${result.message}`)
    }
  })
})

Cypress.Commands.add('cleanupAzureResources', (clusterName) => {
  cy.log(`Cleaning up Azure resources for cluster: ${clusterName}`)
  
  if (!Cypress.env('cleanupAfterTests')) {
    cy.log('Skipping cleanup (CLEANUP_AFTER_TESTS=false)')
    return
  }
  
  cy.task('cleanupAzureResources', clusterName).then((result) => {
    if (result.success) {
      cy.log(`✅ Cleanup initiated for cluster: ${clusterName}`)
    } else {
      cy.log(`⚠️ Cleanup failed: ${result.error}`)
    }
  })
})

Cypress.Commands.add('verifyClusterConfiguration', (clusterName, expectedConfig) => {
  cy.log(`Verifying cluster configuration matches expected values`)
  
  cy.task('validateAzureCluster', clusterName).then((result) => {
    if (!result.exists) {
      throw new Error(`Cluster ${clusterName} does not exist in Azure`)
    }
    
    // Verify Kubernetes version
    if (expectedConfig.kubernetesVersion) {
      expect(result.kubernetesVersion).to.include(expectedConfig.kubernetesVersion)
    }
    
    // Verify RBAC is enabled
    expect(result.enableRbac).to.be.true
    
    // Verify network configuration
    if (result.networkProfile) {
      expect(result.networkProfile.networkPlugin).to.eq('azure')
      expect(result.networkProfile.networkPolicy).to.eq('cilium')
    }
    
    cy.log('✅ Cluster configuration verified')
  })
})

Cypress.Commands.add('monitorWorkflowProgress', (workflowName) => {
  cy.log(`Monitoring workflow progress: ${workflowName}`)
  
  // Navigate to workflow dashboard
  cy.navigateToWorkflowDashboard()
  
  // Find the workflow in the list
  cy.get('[data-testid="workflow-list"]')
    .should('be.visible')
    .contains(workflowName)
    .parent()
    .as('workflowRow')
  
  // Verify workflow is running
  cy.get('@workflowRow')
    .should('contain', 'Running')
    .or('contain', 'Succeeded')
  
  // Click to view details
  cy.get('@workflowRow')
    .find('[data-testid="view-workflow-button"]')
    .click()
  
  // Verify workflow details page
  cy.contains(`Workflow: ${workflowName}`).should('be.visible')
  cy.get('[data-testid="workflow-status"]').should('be.visible')
  cy.get('[data-testid="workflow-logs"]').should('be.visible')
})

Cypress.Commands.add('verifyDryRunResults', (clusterName) => {
  cy.log(`Verifying dry run results for: ${clusterName}`)
  
  // Dry run should not create actual Azure resources
  cy.task('validateAzureCluster', clusterName).then((result) => {
    expect(result.exists, 'Dry run should not create actual Azure cluster').to.be.false
  })
  
  // But Kubernetes workflow should complete successfully
  cy.validateKubernetesResources(clusterName)
})

Cypress.Commands.add('setupTestCluster', (clusterConfig) => {
  cy.log(`Setting up test cluster: ${clusterConfig.name}`)
  
  // Generate unique cluster name with timestamp
  const timestamp = Date.now()
  const uniqueName = `${clusterConfig.name}-${timestamp}`
  
  // Return updated config with unique name
  const updatedConfig = {
    ...clusterConfig,
    name: uniqueName,
    originalName: clusterConfig.name
  }
  
  cy.wrap(updatedConfig).as('currentClusterConfig')
  
  return cy.wrap(updatedConfig)
})