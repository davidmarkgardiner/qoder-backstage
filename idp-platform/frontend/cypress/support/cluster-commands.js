// Commands for cluster-specific operations

Cypress.Commands.add('verifyClusterInManagement', (clusterName) => {
  cy.log(`Verifying cluster appears in management dashboard: ${clusterName}`)
  
  cy.navigateToClusterManagement()
  
  // Wait for cluster list to load
  cy.get('[data-testid="cluster-list"]', { timeout: 10000 })
    .should('be.visible')
  
  // Find the cluster in the list
  cy.get('[data-testid="cluster-list"]')
    .contains(clusterName)
    .should('be.visible')
    .parent()
    .as('clusterRow')
  
  // Verify cluster status
  cy.get('@clusterRow')
    .should('contain', 'Active')
    .or('contain', 'Running')
    .or('contain', 'Ready')
  
  // Verify cluster details are accessible
  cy.get('@clusterRow')
    .find('[data-testid="view-cluster-button"]')
    .should('be.visible')
    .click()
  
  // Verify cluster details page
  cy.contains(`Cluster: ${clusterName}`).should('be.visible')
  cy.get('[data-testid="cluster-status"]').should('be.visible')
  cy.get('[data-testid="cluster-resources"]').should('be.visible')
})

Cypress.Commands.add('validateClusterResources', (clusterName) => {
  cy.log(`Validating cluster resources: ${clusterName}`)
  
  // Navigate to cluster details
  cy.navigateToClusterManagement()
  cy.get('[data-testid="cluster-list"]')
    .contains(clusterName)
    .parent()
    .find('[data-testid="view-cluster-button"]')
    .click()
  
  // Verify KRO resources section
  cy.get('[data-testid="kro-resources"]')
    .should('be.visible')
    .within(() => {
      cy.contains('KRO Instance').should('be.visible')
      cy.get('[data-testid="kro-status"]').should('contain', 'Ready')
    })
  
  // Verify ASO resources section  
  cy.get('[data-testid="aso-resources"]')
    .should('be.visible')
    .within(() => {
      cy.contains('Resource Group').should('be.visible')
      cy.contains('Managed Cluster').should('be.visible')
      cy.get('[data-testid="aso-status"]').should('contain', 'Provisioned')
    })
})

Cypress.Commands.add('deleteClusterFromUI', (clusterName) => {
  cy.log(`Deleting cluster from UI: ${clusterName}`)
  
  cy.navigateToClusterManagement()
  
  // Find cluster and click delete
  cy.get('[data-testid="cluster-list"]')
    .contains(clusterName)
    .parent()
    .find('[data-testid="delete-cluster-button"]')
    .click()
  
  // Confirm deletion in modal
  cy.get('[data-testid="confirm-delete-modal"]')
    .should('be.visible')
    .within(() => {
      cy.get('[data-testid="confirm-delete-button"]').click()
    })
  
  // Verify deletion started
  cy.contains('Cluster deletion initiated').should('be.visible')
})

Cypress.Commands.add('validateClusterLogs', (clusterName) => {
  cy.log(`Validating cluster creation logs: ${clusterName}`)
  
  cy.navigateToWorkflowDashboard()
  
  // Find the workflow for this cluster
  cy.get('[data-testid="workflow-list"]')
    .contains(clusterName)
    .parent()
    .find('[data-testid="view-logs-button"]')
    .click()
  
  // Verify logs are displayed
  cy.get('[data-testid="workflow-logs"]')
    .should('be.visible')
    .should('not.be.empty')
  
  // Verify key log entries
  cy.get('[data-testid="workflow-logs"]')
    .should('contain', 'Validating cluster configuration')
    .should('contain', 'Creating KRO instance')
    .should('contain', 'Waiting for KRO resources')
  
  // If not dry run, should contain Azure-specific logs
  cy.get('[data-testid="workflow-logs"]').then(($logs) => {
    const logText = $logs.text()
    if (!logText.includes('DRY RUN')) {
      cy.wrap($logs)
        .should('contain', 'ManagedCluster ready')
        .should('contain', 'Cluster is accessible')
    }
  })
})

Cypress.Commands.add('verifyRealTimeUpdates', (clusterName) => {
  cy.log(`Verifying real-time updates for cluster: ${clusterName}`)
  
  cy.navigateToWorkflowDashboard()
  
  // Find the workflow
  cy.get('[data-testid="workflow-list"]')
    .contains(clusterName)
    .parent()
    .as('workflowRow')
  
  // Monitor status changes
  let previousStatus = ''
  
  cy.get('@workflowRow')
    .find('[data-testid="workflow-status"]')
    .should('be.visible')
    .then(($status) => {
      previousStatus = $status.text()
      cy.log(`Initial status: ${previousStatus}`)
    })
  
  // Wait for status to change (indicating real-time updates)
  cy.get('@workflowRow')
    .find('[data-testid="workflow-status"]')
    .should('not.contain', previousStatus, { timeout: 30000 })
    .then(($status) => {
      const newStatus = $status.text()
      cy.log(`Status updated to: ${newStatus}`)
      expect(newStatus).to.not.equal(previousStatus)
    })
})

Cypress.Commands.add('verifyProgressIndicators', (clusterName) => {
  cy.log(`Verifying progress indicators for cluster: ${clusterName}`)
  
  cy.navigateToWorkflowDashboard()
  
  // Find the workflow
  cy.get('[data-testid="workflow-list"]')
    .contains(clusterName)
    .parent()
    .find('[data-testid="view-workflow-button"]')
    .click()
  
  // Verify progress bar exists and shows progress
  cy.get('[data-testid="workflow-progress"]')
    .should('be.visible')
    .should('have.attr', 'aria-valuenow')
    .then((progress) => {
      const progressValue = parseInt(progress)
      expect(progressValue).to.be.greaterThan(0)
      expect(progressValue).to.be.lessThanOrEqual(100)
    })
  
  // Verify step indicators
  cy.get('[data-testid="workflow-steps"]')
    .should('be.visible')
    .within(() => {
      cy.get('[data-testid="step-indicator"]').should('have.length.greaterThan', 0)
      
      // At least one step should be completed or in progress
      cy.get('[data-testid="step-indicator"]')
        .should('contain', 'completed')
        .or('contain', 'in-progress')
    })
})