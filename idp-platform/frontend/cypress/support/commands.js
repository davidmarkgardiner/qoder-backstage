// Custom commands for interacting with the cluster onboarding UI

Cypress.Commands.add('fillClusterOnboardingForm', (clusterConfig) => {
  cy.log(`Filling cluster onboarding form with config: ${clusterConfig.name}`)
  
  // Fill cluster name
  cy.get('[data-testid="cluster-name-input"]')
    .should('be.visible')
    .clear()
    .type(clusterConfig.name)
  
  // Select location
  cy.get('[data-testid="location-select"]')
    .should('be.visible')
    .click()
  
  cy.get(`[data-value="${clusterConfig.location}"]`)
    .should('be.visible')
    .click()
  
  // Select node pool type
  cy.get('[data-testid="node-pool-type-select"]')
    .should('be.visible')
    .click()
    
  cy.get(`[data-value="${clusterConfig.nodePoolType}"]`)
    .should('be.visible')
    .click()
  
  // Configure dry run mode
  if (clusterConfig.dryRun !== undefined) {
    cy.get('[data-testid="dry-run-switch"]')
      .should('be.visible')
      .then(($switch) => {
        const isChecked = $switch.find('input').prop('checked')
        if (isChecked !== clusterConfig.dryRun) {
          cy.wrap($switch).click()
        }
      })
  }
  
  // Configure NAP
  if (clusterConfig.enableNAP !== undefined) {
    cy.get('[data-testid="enable-nap-switch"]')
      .should('be.visible')
      .then(($switch) => {
        const isChecked = $switch.find('input').prop('checked')
        if (isChecked !== clusterConfig.enableNAP) {
          cy.wrap($switch).click()
        }
      })
  }
  
  // Configure advanced settings if provided
  if (clusterConfig.advancedConfig) {
    cy.get('[data-testid="advanced-config-accordion"]')
      .should('be.visible')
      .click()
    
    if (clusterConfig.advancedConfig.kubernetesVersion) {
      cy.get('[data-testid="kubernetes-version-input"]')
        .clear()
        .type(clusterConfig.advancedConfig.kubernetesVersion)
    }
    
    if (clusterConfig.advancedConfig.maxNodes) {
      cy.get('[data-testid="max-nodes-input"]')
        .clear()
        .type(clusterConfig.advancedConfig.maxNodes.toString())
    }
    
    if (clusterConfig.advancedConfig.enableSpot !== undefined) {
      cy.get('[data-testid="enable-spot-switch"]')
        .then(($switch) => {
          const isChecked = $switch.find('input').prop('checked')
          if (isChecked !== clusterConfig.advancedConfig.enableSpot) {
            cy.wrap($switch).click()
          }
        })
    }
  }
})

Cypress.Commands.add('submitClusterCreation', () => {
  cy.log('Submitting cluster creation form')
  
  cy.get('[data-testid="submit-cluster-button"]')
    .should('be.visible')
    .should('not.be.disabled')
    .click()
})

Cypress.Commands.add('verifyFormValidation', (expectedErrors = []) => {
  cy.log('Verifying form validation')
  
  if (expectedErrors.length === 0) {
    // No errors expected - submit button should be enabled
    cy.get('[data-testid="submit-cluster-button"]')
      .should('not.be.disabled')
  } else {
    // Errors expected - submit button should be disabled
    cy.get('[data-testid="submit-cluster-button"]')
      .should('be.disabled')
    
    // Check for specific error messages
    expectedErrors.forEach(error => {
      cy.contains(error).should('be.visible')
    })
  }
})

Cypress.Commands.add('verifyClusterConfigPreview', (expectedConfig) => {
  cy.log('Verifying cluster configuration preview')
  
  cy.get('[data-testid="preview-config-button"]')
    .should('be.visible')
    .click()
  
  cy.get('[data-testid="config-preview"]')
    .should('be.visible')
  
  // Verify key configuration values are displayed
  cy.get('[data-testid="config-preview"]')
    .should('contain', expectedConfig.name)
    .should('contain', expectedConfig.location)
    .should('contain', expectedConfig.nodePoolType)
})

Cypress.Commands.add('waitForClusterCreationStart', () => {
  cy.log('Waiting for cluster creation to start')
  
  // Button should show loading state
  cy.get('[data-testid="submit-cluster-button"]')
    .should('contain', 'Creating...')
    .should('be.disabled')
  
  // Should redirect to workflow dashboard or show success message
  cy.url().should('match', /\/(dashboard|management)/)
})

Cypress.Commands.add('navigateToClusterOnboarding', () => {
  cy.log('Navigating to cluster onboarding page')
  
  cy.visit('/')
  cy.url().should('include', '/onboarding')
  
  // Verify page loaded correctly
  cy.contains('AKS Cluster Onboarding').should('be.visible')
  cy.get('[data-testid="cluster-name-input"]').should('be.visible')
})

Cypress.Commands.add('navigateToWorkflowDashboard', () => {
  cy.log('Navigating to workflow dashboard')
  
  cy.visit('/dashboard')
  cy.url().should('include', '/dashboard')
  
  // Verify page loaded correctly
  cy.contains('Workflow Dashboard').should('be.visible')
})

Cypress.Commands.add('navigateToClusterManagement', () => {
  cy.log('Navigating to cluster management')
  
  cy.visit('/management')
  cy.url().should('include', '/management')
  
  // Verify page loaded correctly
  cy.contains('Cluster Management').should('be.visible')
})