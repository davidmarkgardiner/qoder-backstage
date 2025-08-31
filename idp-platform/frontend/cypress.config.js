const { defineConfig } = require('cypress')

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    retries: {
      runMode: 2,
      openMode: 0,
    },
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    pageLoadTimeout: 30000,
    execTimeout: 120000,
    taskTimeout: 120000,
    env: {
      apiUrl: 'http://localhost:3001',
      azureSubscriptionId: process.env.AZURE_SUBSCRIPTION_ID || '133d5755-4074-4d6e-ad38-eb2a6ad12903',
      azureResourceGroup: process.env.AZURE_RESOURCE_GROUP || 'rg-e2e-testing',
      testClusterPrefix: 'e2e-test',
      cleanupAfterTests: process.env.CLEANUP_AFTER_TESTS !== 'false',
      skipAzureValidation: process.env.SKIP_AZURE_VALIDATION === 'true',
      maxWaitTimeMinutes: 20,
    },
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.js',
    setupNodeEvents(on, config) {
      // Import grep plugin
      require('@cypress/grep/src/plugin')(config);
      
      // Import Kubernetes commands
      const kubernetesCommands = require('./cypress/support/kubernetes-commands');
      
      // Custom task to validate Azure resources and Kubernetes pods
      on('task', {
        log(message) {
          console.log(message)
          return null
        },
        
        // Kubernetes pod validation tasks
        validatePodResources: kubernetesCommands.validatePodResources,
        validateServiceConnectivity: kubernetesCommands.validateServiceConnectivity,
        validateServiceEndpoints: kubernetesCommands.validateServiceEndpoints,
        testCrossServiceCommunication: kubernetesCommands.testCrossServiceCommunication,
        validatePodResilience: kubernetesCommands.validatePodResilience,
        getPodLogs: kubernetesCommands.getPodLogs,
        validateIstioSidecar: kubernetesCommands.validateIstioSidecar,
        testExternalConnectivity: kubernetesCommands.testExternalConnectivity,
        
        async validateAzureCluster(clusterName) {
          const { exec } = require('child_process');
          const util = require('util');
          const execAsync = util.promisify(exec);
          
          try {
            const resourceGroup = `rg-${clusterName}`;
            const { stdout } = await execAsync(`az aks show --name ${clusterName} --resource-group ${resourceGroup} --output json`);
            const cluster = JSON.parse(stdout);
            
            return {
              exists: true,
              provisioningState: cluster.provisioningState,
              powerState: cluster.powerState?.code,
              kubernetesVersion: cluster.kubernetesVersion,
              nodeResourceGroup: cluster.nodeResourceGroup,
              fqdn: cluster.fqdn,
              enableRbac: cluster.enableRbac,
              networkProfile: cluster.networkProfile
            };
          } catch (error) {
            return {
              exists: false,
              error: error.message
            };
          }
        },
        
        async cleanupAzureResources(clusterName) {
          const { exec } = require('child_process');
          const util = require('util');
          const execAsync = util.promisify(exec);
          
          try {
            const resourceGroup = `rg-${clusterName}`;
            console.log(`Cleaning up Azure resources for cluster: ${clusterName}`);
            
            // Delete the resource group (this will delete all resources within it)
            await execAsync(`az group delete --name ${resourceGroup} --yes --no-wait`);
            
            return { success: true, message: `Cleanup initiated for ${resourceGroup}` };
          } catch (error) {
            return { success: false, error: error.message };
          }
        },
        
        async validateKubernetesResources(clusterName) {
          const { exec } = require('child_process');
          const util = require('util');
          const execAsync = util.promisify(exec);
          
          try {
            // Check KRO instance
            const kroCheck = await execAsync(`kubectl get aksclusters.kro.run ${clusterName} -o json`);
            const kroInstance = JSON.parse(kroCheck.stdout);
            
            // Check ASO resources
            const asoResourceGroup = await execAsync(`kubectl get resourcegroups.resources.azure.com rg-${clusterName} -n azure-system -o json`);
            const asoManagedCluster = await execAsync(`kubectl get managedclusters.containerservice.azure.com ${clusterName} -n azure-system -o json`);
            
            return {
              kroInstance: {
                exists: true,
                status: kroInstance.status,
                phase: kroInstance.status?.phase
              },
              asoResources: {
                resourceGroup: JSON.parse(asoResourceGroup.stdout),
                managedCluster: JSON.parse(asoManagedCluster.stdout)
              }
            };
          } catch (error) {
            return {
              error: error.message,
              kroInstance: { exists: false },
              asoResources: { exists: false }
            };
          }
        },
        
        async waitForWorkflowCompletion(workflowName, timeoutMinutes = 20) {
          const { exec } = require('child_process');
          const util = require('util');
          const execAsync = util.promisify(exec);
          
          const maxAttempts = timeoutMinutes * 2; // Check every 30 seconds
          let attempts = 0;
          
          while (attempts < maxAttempts) {
            try {
              const { stdout } = await execAsync(`kubectl get workflow ${workflowName} -o json`);
              const workflow = JSON.parse(stdout);
              
              if (workflow.status?.phase === 'Succeeded') {
                return { success: true, phase: 'Succeeded', message: 'Workflow completed successfully' };
              } else if (workflow.status?.phase === 'Failed' || workflow.status?.phase === 'Error') {
                return { success: false, phase: workflow.status.phase, message: 'Workflow failed', status: workflow.status };
              }
              
              attempts++;
              await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
            } catch (error) {
              attempts++;
              if (attempts >= maxAttempts) {
                return { success: false, error: error.message, message: 'Timeout waiting for workflow' };
              }
              await new Promise(resolve => setTimeout(resolve, 30000));
            }
          }
          
          return { success: false, message: 'Timeout waiting for workflow completion' };
        }
      });
      
      return config;
    },
  },
  
  component: {
    devServer: {
      framework: 'create-react-app',
      bundler: 'webpack',
    },
  },
})