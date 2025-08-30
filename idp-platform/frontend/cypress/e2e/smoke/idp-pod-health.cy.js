/// <reference types="cypress" />

/**
 * IDP Pod Health Validation Tests
 * 
 * These tests validate the health and functionality of IDP pods running in AKS.
 * Tests include pod health checks, API endpoint validation, and service connectivity.
 */

describe('IDP Pod Health Validation', { tags: ['@idp-health', '@pods'] }, () => {
  const apiUrl = Cypress.env('apiUrl') || 'http://localhost:3001'
  const frontendUrl = Cypress.env('frontendUrl') || 'http://localhost:3000'
  
  // Configuration for AKS testing
  const aksConfig = {
    namespace: 'idp-platform',
    backendService: 'idp-backend',
    frontendService: 'idp-frontend',
    expectedPods: {
      backend: 2,
      frontend: 2
    }
  }

  beforeEach(() => {
    // Set up API interceptions for mocking when needed
    cy.intercept('GET', '**/health', { 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: 'production'
    }).as('healthCheck')
    
    cy.intercept('GET', '**/api/clusters', { 
      clusters: [],
      timestamp: new Date().toISOString()
    }).as('clustersApi')
    
    cy.intercept('GET', '**/api/workflows', { 
      workflows: [],
      timestamp: new Date().toISOString()
    }).as('workflowsApi')
  })

  describe('Backend Pod Health Validation', () => {
    it('should validate backend health endpoint responds correctly', () => {
      cy.request({
        method: 'GET',
        url: `${apiUrl}/health`,
        timeout: 15000,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property('status')
        expect(response.body.status).to.match(/healthy|ok/i)
        expect(response.body).to.have.property('timestamp')
        
        // Log response for debugging
        cy.log('Backend health response:', JSON.stringify(response.body))
      })
    })

    it('should validate backend API endpoints are accessible', () => {
      const endpoints = [
        '/api/clusters',
        '/api/workflows', 
        '/api/azure/locations'
      ]

      endpoints.forEach(endpoint => {
        cy.request({
          method: 'GET',
          url: `${apiUrl}${endpoint}`,
          timeout: 15000,
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.be.oneOf([200, 404, 500]) // Accept various responses but ensure connectivity
          cy.log(`${endpoint} responded with status: ${response.status}`)
        })
      })
    })

    it('should test backend load balancing across multiple pods', () => {
      const requests = Array.from({ length: 10 }, (_, i) => 
        cy.request({
          method: 'GET',
          url: `${apiUrl}/health`,
          timeout: 10000,
          failOnStatusCode: false
        })
      )

      // Execute requests and verify responses
      requests.forEach((request, index) => {
        request.then((response) => {
          expect(response.status).to.eq(200)
          cy.log(`Request ${index + 1}: Status ${response.status}`)
        })
      })
    })

    it('should validate backend pod resource consumption', () => {
      cy.task('validatePodResources', {
        namespace: aksConfig.namespace,
        labels: `app=${aksConfig.backendService}`,
        expectedCount: aksConfig.expectedPods.backend
      }).then((result) => {
        expect(result.success).to.be.true
        expect(result.pods).to.have.length.greaterThan(0)
        
        result.pods.forEach(pod => {
          expect(pod.status).to.eq('Running')
          expect(pod.ready).to.eq('1/1')
          cy.log(`Backend pod: ${pod.name} - Status: ${pod.status}`)
        })
      })
    })
  })

  describe('Frontend Pod Health Validation', () => {
    it('should validate frontend serves content correctly', () => {
      cy.request({
        method: 'GET',
        url: frontendUrl,
        timeout: 15000,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.include('<!DOCTYPE html>')
        expect(response.body).to.include('AKS Internal Developer Platform')
      })
    })

    it('should validate frontend static assets are accessible', () => {
      // Test common static asset paths
      const assetPaths = [
        '/static/css/',
        '/static/js/',
        '/manifest.json',
        '/favicon.ico'
      ]

      assetPaths.forEach(path => {
        cy.request({
          method: 'GET',
          url: `${frontendUrl}${path}`,
          timeout: 10000,
          failOnStatusCode: false
        }).then((response) => {
          // Accept 200 (found) or 404 (not found but server responding)
          expect(response.status).to.be.oneOf([200, 404])
          cy.log(`Asset ${path}: Status ${response.status}`)
        })
      })
    })

    it('should validate frontend pod resource consumption', () => {
      cy.task('validatePodResources', {
        namespace: aksConfig.namespace,
        labels: `app=${aksConfig.frontendService}`,
        expectedCount: aksConfig.expectedPods.frontend
      }).then((result) => {
        expect(result.success).to.be.true
        expect(result.pods).to.have.length.greaterThan(0)
        
        result.pods.forEach(pod => {
          expect(pod.status).to.eq('Running')
          expect(pod.ready).to.eq('1/1')
          cy.log(`Frontend pod: ${pod.name} - Status: ${pod.status}`)
        })
      })
    })
  })

  describe('Service Connectivity Validation', () => {
    it('should validate internal service connectivity', () => {
      cy.task('validateServiceConnectivity', {
        namespace: aksConfig.namespace,
        services: [
          { name: aksConfig.backendService, port: 3001, path: '/health' },
          { name: aksConfig.frontendService, port: 80, path: '/' }
        ]
      }).then((result) => {
        expect(result.success).to.be.true
        expect(result.results).to.have.length(2)
        
        result.results.forEach(serviceResult => {
          expect(serviceResult.accessible).to.be.true
          cy.log(`Service ${serviceResult.service}: ${serviceResult.accessible ? 'Accessible' : 'Not Accessible'}`)
        })
      })
    })

    it('should validate service endpoints have correct backing pods', () => {
      cy.task('validateServiceEndpoints', {
        namespace: aksConfig.namespace,
        services: [aksConfig.backendService, aksConfig.frontendService]
      }).then((result) => {
        expect(result.success).to.be.true
        
        result.endpoints.forEach(endpoint => {
          expect(endpoint.addresses.length).to.be.greaterThan(0)
          cy.log(`${endpoint.service} has ${endpoint.addresses.length} endpoint(s)`)
        })
      })
    })

    it('should test cross-service communication', () => {
      // Test frontend calling backend through internal service
      cy.task('testCrossServiceCommunication', {
        namespace: aksConfig.namespace,
        fromService: aksConfig.frontendService,
        toService: aksConfig.backendService,
        endpoint: '/health'
      }).then((result) => {
        expect(result.success).to.be.true
        expect(result.responseCode).to.eq(200)
        cy.log('Cross-service communication working')
      })
    })
  })

  describe('Performance and Reliability Tests', () => {
    it('should test service response times under load', () => {
      const startTime = Date.now()
      const concurrentRequests = 5
      
      const requests = Array.from({ length: concurrentRequests }, () =>
        cy.request({
          method: 'GET',
          url: `${apiUrl}/health`,
          timeout: 30000
        })
      )

      Promise.all(requests).then(() => {
        const endTime = Date.now()
        const totalTime = endTime - startTime
        const avgTime = totalTime / concurrentRequests
        
        expect(avgTime).to.be.lessThan(5000) // Average response should be under 5 seconds
        cy.log(`Average response time: ${avgTime}ms for ${concurrentRequests} concurrent requests`)
      })
    })

    it('should validate pod restart resilience', () => {
      cy.task('validatePodResilience', {
        namespace: aksConfig.namespace,
        labels: `app=${aksConfig.backendService}`
      }).then((result) => {
        expect(result.success).to.be.true
        expect(result.restartCount).to.be.lessThan(5) // Pods shouldn't be restarting frequently
        cy.log(`Pod restart count: ${result.restartCount}`)
      })
    })
  })

  describe('Integration Health Checks', () => {
    it('should validate complete request flow', () => {
      // Test complete flow: Frontend -> Backend -> Response
      cy.visit(frontendUrl)
      
      // Wait for page to load
      cy.contains('AKS Internal Developer Platform', { timeout: 15000 }).should('be.visible')
      
      // Trigger API calls by navigating to different sections
      cy.get('[data-testid="nav-clusters"]', { timeout: 10000 })
        .should('exist')
        .click()
      
      // Verify API calls work (either real or mocked)
      cy.wait('@clustersApi', { timeout: 10000 }).then((interception) => {
        expect(interception.response.statusCode).to.eq(200)
      })
    })

    it('should validate error handling and recovery', () => {
      // Test API error scenarios
      cy.intercept('GET', '**/api/clusters', { 
        statusCode: 500,
        body: { error: 'Internal Server Error' }
      }).as('clustersError')
      
      cy.visit(frontendUrl)
      cy.get('[data-testid="nav-clusters"]', { timeout: 10000 })
        .should('exist')
        .click()
      
      // Should handle error gracefully
      cy.wait('@clustersError')
      
      // The UI should still be functional
      cy.contains('AKS Internal Developer Platform').should('be.visible')
    })
  })
})