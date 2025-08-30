// Import commands
import './commands'
import './azure-commands'
import './cluster-commands'

// Import cypress-real-events
import 'cypress-real-events'

// Import grep support
import '@cypress/grep'

// Global configuration
Cypress.on('uncaught:exception', (err, runnable) => {
  // Return false here prevents Cypress from failing the test on uncaught exceptions
  // This is useful for handling React development warnings
  return false
})

// Global hooks
beforeEach(() => {
  // Set up common test data
  cy.fixture('test-clusters').as('testClusters')
  cy.fixture('azure-locations').as('azureLocations')
  cy.fixture('node-pool-types').as('nodePoolTypes')
})

// Custom configuration for different test types
Cypress.Commands.add('configureTestEnvironment', (testType) => {
  const baseUrl = Cypress.config('baseUrl')
  const apiUrl = Cypress.env('apiUrl')
  
  cy.log(`Configuring test environment for: ${testType}`)
  cy.log(`Frontend URL: ${baseUrl}`)
  cy.log(`Backend URL: ${apiUrl}`)
  
  // Verify backend is accessible
  cy.request(`${apiUrl}/health`).then((response) => {
    expect(response.status).to.eq(200)
  })
})