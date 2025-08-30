describe('Smoke Tests - Basic Application Functionality', { tags: ['@smoke'] }, () => {
  beforeEach(() => {
    // Set up API interceptions with correct response structure
    cy.intercept('GET', '**/api/azure/locations', { fixture: 'azure-locations' }).as('getLocations')
    cy.intercept('GET', '**/api/azure/node-pool-types', { fixture: 'node-pool-types' }).as('getNodePoolTypes')
    cy.intercept('GET', '**/health', { status: 'healthy', timestamp: new Date().toISOString() }).as('healthCheck')
    cy.intercept('GET', '**/api/clusters', { clusters: [], total: 0 }).as('getClusters')
    
    cy.visit('/')
    cy.wait(2000) // Give time for component mounting
  })

  it('should load the application without errors', () => {
    // Verify main components load
    cy.contains('AKS Internal Developer Platform').should('be.visible')
    cy.contains('AKS Cluster Onboarding').should('be.visible')
    
    // Verify navigation works
    cy.get('[data-testid="navigation"]').should('be.visible')
  })

  it('should display all required form fields', () => {
    // Wait for API calls to complete
    cy.wait('@getLocations')
    cy.wait('@getNodePoolTypes')
    
    // Verify all form fields are present
    cy.get('[data-testid="cluster-name-input"]').should('be.visible')
    cy.get('[data-testid="location-select"]').should('be.visible')
    cy.get('[data-testid="node-pool-type-select"]').should('be.visible')
    cy.get('[data-testid="dry-run-switch"]').should('be.visible')
    cy.get('[data-testid="enable-nap-switch"]').should('be.visible')
    cy.get('[data-testid="submit-cluster-button"]').should('be.visible')
  })

  it('should populate location dropdown with data', () => {
    cy.wait('@getLocations')
    
    cy.get('[data-testid="location-select"]').click()
    
    // Verify locations are loaded from fixture
    cy.get('[data-value="uksouth"]').should('be.visible')
    cy.get('[data-value="eastus"]').should('be.visible')
    cy.get('[data-value="westus2"]').should('be.visible')
    
    // Verify recommended locations are marked
    cy.contains('Recommended').should('be.visible')
  })

  it('should populate node pool types dropdown', () => {
    cy.wait('@getNodePoolTypes')
    
    cy.get('[data-testid="node-pool-type-select"]').click()
    
    // Verify node pool types are loaded from fixture
    cy.get('[data-value="standard"]').should('be.visible')
    cy.get('[data-value="memory-optimized"]').should('be.visible')
    cy.get('[data-value="compute-optimized"]').should('be.visible')
  })

  it('should validate form inputs correctly', () => {
    cy.wait('@getLocations')
    cy.wait('@getNodePoolTypes')
    
    // Submit button should be disabled initially
    cy.get('[data-testid="submit-cluster-button"]').should('be.disabled')
    
    // Fill minimum required fields
    cy.get('[data-testid="cluster-name-input"] input').type('test-cluster')
    cy.get('[data-testid="location-select"]').click()
    cy.get('[data-value="uksouth"]').click()
    cy.get('[data-testid="node-pool-type-select"]').click()
    cy.get('[data-value="standard"]').click()
    
    // Submit button should now be enabled
    cy.get('[data-testid="submit-cluster-button"]').should('not.be.disabled')
  })

  it('should show configuration preview when requested', () => {
    cy.wait('@getLocations')
    cy.wait('@getNodePoolTypes')
    
    // Fill form with test data
    cy.get('[data-testid="cluster-name-input"] input').type('preview-test-cluster')
    cy.get('[data-testid="location-select"]').click()
    cy.get('[data-value="uksouth"]').click()
    cy.get('[data-testid="node-pool-type-select"]').click()
    cy.get('[data-value="standard"]').click()
    
    // Show preview
    cy.get('[data-testid="preview-config-button"]').click()
    cy.get('[data-testid="config-preview"]').should('be.visible')
  })

  it('should navigate between pages successfully', () => {
    // Test navigation to all main pages
    cy.get('[data-testid="nav-onboarding"]').click()
    cy.url().should('satisfy', (url) => url.includes('/onboarding') || url === 'http://localhost:3000/')
    
    cy.get('[data-testid="nav-dashboard"]').click()
    cy.url().should('include', '/dashboard')
    
    cy.get('[data-testid="nav-management"]').click()
    cy.url().should('include', '/management')
    
    // Return to onboarding
    cy.get('[data-testid="nav-onboarding"]').click()
    cy.url().should('satisfy', (url) => url.includes('/onboarding') || url === 'http://localhost:3000/')
  })

  it('should check API connectivity', () => {
    const apiUrl = Cypress.env('apiUrl')
    
    // Test backend health endpoint
    cy.request(`${apiUrl}/health`).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.have.property('status', 'healthy')
    })
    
    // Test clusters endpoint
    cy.request(`${apiUrl}/api/clusters`).then((response) => {
      expect(response.status).to.eq(200)
      expect(response.body).to.be.an('object')
      expect(response.body).to.have.property('clusters')
    })
  })

  it('should handle invalid form inputs gracefully', () => {
    cy.wait('@getLocations')
    cy.wait('@getNodePoolTypes')
    
    // Test invalid cluster name (too short)
    cy.get('[data-testid="cluster-name-input"] input').type('ab')
    cy.get('[data-testid="submit-cluster-button"]').should('be.disabled')
    
    // Test invalid cluster name (too long)
    cy.get('[data-testid="cluster-name-input"] input')
      .clear()
      .type('this-cluster-name-is-way-too-long-for-azure-limits')
    cy.get('[data-testid="submit-cluster-button"]').should('be.disabled')
    
    // Test invalid characters
    cy.get('[data-testid="cluster-name-input"] input')
      .clear()
      .type('cluster-with-special-chars!')
    cy.get('[data-testid="submit-cluster-button"]').should('be.disabled')
  })

  it('should display help text and tooltips', () => {
    cy.wait('@getLocations')
    cy.wait('@getNodePoolTypes')
    
    // Verify help text for cluster name
    cy.contains('Must be 3-30 characters').should('be.visible')
    
    // Verify dry run explanation
    cy.contains('Dry run mode will validate your configuration').should('be.visible')
  })

  it('should test cluster creation workflow (dry-run)', () => {
    // Intercept the cluster creation request
    cy.intercept('POST', '**/api/clusters', {
      statusCode: 200,
      body: {
        cluster: {
          id: 'test-cluster-id',
          workflowId: 'test-workflow-id',
          name: 'smoke-test-cluster',
          status: 'provisioning'
        },
        workflow: {
          id: 'test-workflow-id',
          status: 'running'
        },
        message: 'Dry run workflow started'
      }
    }).as('createCluster')
    
    cy.wait('@getLocations')
    cy.wait('@getNodePoolTypes')
    
    // Fill out the form
    cy.get('[data-testid="cluster-name-input"] input').type('smoke-test-cluster')
    cy.get('[data-testid="location-select"]').click()
    cy.get('[data-value="uksouth"]').click()
    cy.get('[data-testid="node-pool-type-select"]').click()
    cy.get('[data-value="standard"]').click()
    
    // Ensure dry-run is enabled (should be default)
    cy.get('[data-testid="dry-run-switch"] input').should('be.checked')
    
    // Submit the form
    cy.get('[data-testid="submit-cluster-button"]').click()
    
    // Verify the API call was made
    cy.wait('@createCluster').then((interception) => {
      expect(interception.request.body).to.deep.include({
        name: 'smoke-test-cluster',
        location: 'uksouth',
        nodePoolType: 'standard',
        dryRun: true,
        enableNAP: true
      })
    })
  })
})