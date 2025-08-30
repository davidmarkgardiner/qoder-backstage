#!/usr/bin/env node

/**
 * Azure Resource Cleanup Script
 * Safely cleans up AKS clusters and related Azure resources created during testing
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class AzureCleanup {
  constructor(options = {}) {
    this.subscriptionId = options.subscriptionId || process.env.AZURE_SUBSCRIPTION_ID;
    this.dryRun = options.dryRun || false;
    this.force = options.force || false;
    this.verbose = options.verbose || false;
    this.maxConcurrent = options.maxConcurrent || 3;
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : level === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async validateAzureAuth() {
    try {
      const { stdout } = await execAsync('az account show');
      const account = JSON.parse(stdout);
      
      if (this.subscriptionId && account.id !== this.subscriptionId) {
        throw new Error(`Wrong subscription. Expected: ${this.subscriptionId}, Current: ${account.id}`);
      }
      
      this.log(`Azure authenticated for subscription: ${account.name} (${account.id})`, 'success');
      return true;
    } catch (error) {
      this.log(`Azure authentication failed: ${error.message}`, 'error');
      return false;
    }
  }

  async findTestClusters(namePattern = 'e2e-test') {
    try {
      this.log(`Finding test clusters with pattern: ${namePattern}`);
      
      const { stdout } = await execAsync('az aks list --query "[].{name:name, resourceGroup:resourceGroup, provisioningState:provisioningState, location:location}" --output json');
      const clusters = JSON.parse(stdout);
      
      const testClusters = clusters.filter(cluster => 
        cluster.name.includes(namePattern) || 
        cluster.resourceGroup.includes(namePattern)
      );
      
      this.log(`Found ${testClusters.length} test clusters to potentially clean up`);
      
      return testClusters;
    } catch (error) {
      this.log(`Failed to find test clusters: ${error.message}`, 'error');
      return [];
    }
  }

  async findTestResourceGroups(namePattern = 'rg-e2e-test') {
    try {
      this.log(`Finding test resource groups with pattern: ${namePattern}`);
      
      const { stdout } = await execAsync('az group list --query "[].{name:name, location:location, provisioningState:properties.provisioningState}" --output json');
      const resourceGroups = JSON.parse(stdout);
      
      const testResourceGroups = resourceGroups.filter(rg => 
        rg.name.includes(namePattern.replace('rg-', '')) ||
        rg.name.startsWith('rg-e2e') ||
        rg.name.startsWith('MC_rg-e2e') // Node resource groups
      );
      
      this.log(`Found ${testResourceGroups.length} test resource groups to potentially clean up`);
      
      return testResourceGroups;
    } catch (error) {
      this.log(`Failed to find test resource groups: ${error.message}`, 'error');
      return [];
    }
  }

  async deleteCluster(clusterName, resourceGroupName) {
    try {
      if (this.dryRun) {
        this.log(`[DRY RUN] Would delete cluster: ${clusterName} in ${resourceGroupName}`, 'warning');
        return { success: true, dryRun: true };
      }
      
      this.log(`Deleting cluster: ${clusterName} in ${resourceGroupName}`);
      
      // Delete the cluster (this will also clean up node resource group)
      await execAsync(`az aks delete --name ${clusterName} --resource-group ${resourceGroupName} --yes --no-wait`);
      
      this.log(`Cluster deletion initiated: ${clusterName}`, 'success');
      
      return { success: true, deleted: true };
    } catch (error) {
      this.log(`Failed to delete cluster ${clusterName}: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async deleteResourceGroup(resourceGroupName) {
    try {
      if (this.dryRun) {
        this.log(`[DRY RUN] Would delete resource group: ${resourceGroupName}`, 'warning');
        return { success: true, dryRun: true };
      }
      
      this.log(`Deleting resource group: ${resourceGroupName}`);
      
      // Delete the entire resource group
      await execAsync(`az group delete --name ${resourceGroupName} --yes --no-wait`);
      
      this.log(`Resource group deletion initiated: ${resourceGroupName}`, 'success');
      
      return { success: true, deleted: true };
    } catch (error) {
      this.log(`Failed to delete resource group ${resourceGroupName}: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async cleanupKubernetesResources(clusterName) {
    try {
      this.log(`Cleaning up Kubernetes resources for cluster: ${clusterName}`);
      
      if (this.dryRun) {
        this.log(`[DRY RUN] Would cleanup Kubernetes resources for: ${clusterName}`, 'warning');
        return { success: true, dryRun: true };
      }
      
      // Delete KRO instance
      try {
        await execAsync(`kubectl delete aksclusters.kro.run ${clusterName} --ignore-not-found=true`);
        this.log(`Deleted KRO instance: ${clusterName}`, 'success');
      } catch (error) {
        this.log(`Warning: Could not delete KRO instance: ${error.message}`, 'warning');
      }
      
      // Delete ASO resources
      try {
        const resourceGroup = `rg-${clusterName}`;
        await execAsync(`kubectl delete resourcegroups.resources.azure.com ${resourceGroup} -n azure-system --ignore-not-found=true`);
        await execAsync(`kubectl delete managedclusters.containerservice.azure.com ${clusterName} -n azure-system --ignore-not-found=true`);
        this.log(`Deleted ASO resources for: ${clusterName}`, 'success');
      } catch (error) {
        this.log(`Warning: Could not delete ASO resources: ${error.message}`, 'warning');
      }
      
      // Delete any workflows
      try {
        await execAsync(`kubectl delete workflows -l cluster-name=${clusterName} --ignore-not-found=true`);
        this.log(`Deleted workflows for: ${clusterName}`, 'success');
      } catch (error) {
        this.log(`Warning: Could not delete workflows: ${error.message}`, 'warning');
      }
      
      return { success: true, cleaned: true };
    } catch (error) {
      this.log(`Failed to cleanup Kubernetes resources: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async cleanupSingleCluster(clusterName) {
    this.log(`Starting cleanup for cluster: ${clusterName}`);
    
    const results = {
      clusterName,
      kubernetes: { skipped: true },
      cluster: { skipped: true },
      resourceGroup: { skipped: true }
    };
    
    try {
      // Step 1: Cleanup Kubernetes resources
      results.kubernetes = await this.cleanupKubernetesResources(clusterName);
      
      // Step 2: Check if Azure cluster exists
      const resourceGroup = `rg-${clusterName}`;
      
      try {
        await execAsync(`az aks show --name ${clusterName} --resource-group ${resourceGroup}`);
        
        // Cluster exists, delete it
        results.cluster = await this.deleteCluster(clusterName, resourceGroup);
      } catch (error) {
        // Cluster doesn't exist, that's fine
        this.log(`Cluster ${clusterName} does not exist in Azure`, 'info');
        results.cluster = { success: true, notFound: true };
      }
      
      // Step 3: Delete resource group if it exists
      try {
        await execAsync(`az group show --name ${resourceGroup}`);
        
        // Resource group exists, delete it
        results.resourceGroup = await this.deleteResourceGroup(resourceGroup);
      } catch (error) {
        // Resource group doesn't exist, that's fine
        this.log(`Resource group ${resourceGroup} does not exist`, 'info');
        results.resourceGroup = { success: true, notFound: true };
      }
      
      const overallSuccess = results.kubernetes.success && results.cluster.success && results.resourceGroup.success;
      
      if (overallSuccess) {
        this.log(`Cleanup completed successfully for: ${clusterName}`, 'success');
      } else {
        this.log(`Cleanup completed with some errors for: ${clusterName}`, 'warning');
      }
      
      return results;
      
    } catch (error) {
      this.log(`Cleanup failed for ${clusterName}: ${error.message}`, 'error');
      results.error = error.message;
      return results;
    }
  }

  async cleanupTestEnvironment(namePattern = 'e2e-test') {
    this.log(`Starting cleanup of test environment with pattern: ${namePattern}`);
    
    if (!await this.validateAzureAuth()) {
      throw new Error('Azure authentication required');
    }
    
    const results = {
      pattern: namePattern,
      timestamp: new Date().toISOString(),
      dryRun: this.dryRun,
      clusters: [],
      summary: { total: 0, successful: 0, failed: 0 }
    };
    
    try {
      // Find all test clusters
      const testClusters = await this.findTestClusters(namePattern);
      
      if (testClusters.length === 0) {
        this.log('No test clusters found to clean up', 'info');
        return results;
      }
      
      if (!this.force && !this.dryRun) {
        this.log(`Found ${testClusters.length} clusters to delete. Use --force to proceed or --dry-run to preview.`, 'warning');
        this.log('Clusters found:');
        testClusters.forEach(cluster => {
          this.log(`  - ${cluster.name} (${cluster.resourceGroup})`, 'info');
        });
        return results;
      }
      
      // Cleanup clusters
      results.summary.total = testClusters.length;
      
      for (const cluster of testClusters) {
        const clusterResult = await this.cleanupSingleCluster(cluster.name);
        results.clusters.push(clusterResult);
        
        if (clusterResult.error) {
          results.summary.failed++;
        } else {
          results.summary.successful++;
        }
      }
      
      // Also cleanup orphaned resource groups
      const orphanedResourceGroups = await this.findTestResourceGroups(`rg-${namePattern}`);
      
      for (const rg of orphanedResourceGroups) {
        const isOrphaned = !testClusters.some(cluster => 
          rg.name === `rg-${cluster.name}` || 
          rg.name.startsWith(`MC_rg-${cluster.name}`)
        );
        
        if (isOrphaned) {
          this.log(`Cleaning up orphaned resource group: ${rg.name}`);
          await this.deleteResourceGroup(rg.name);
        }
      }
      
      this.log(`Cleanup completed. Total: ${results.summary.total}, Successful: ${results.summary.successful}, Failed: ${results.summary.failed}`, 
        results.summary.failed === 0 ? 'success' : 'warning');
      
      return results;
      
    } catch (error) {
      this.log(`Test environment cleanup failed: ${error.message}`, 'error');
      results.error = error.message;
      return results;
    }
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  let clusterName = null;
  let command = 'cleanup-environment';
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--cluster':
        command = 'cleanup-cluster';
        clusterName = args[++i];
        break;
      case '--pattern':
        options.pattern = args[++i];
        break;
      case '--help':
        console.log(`
Azure Cleanup Script

Usage:
  node cleanup-azure-resources.js [options]
  node cleanup-azure-resources.js --cluster <cluster-name> [options]

Options:
  --dry-run       Show what would be deleted without actually deleting
  --force         Actually perform deletions (required for real cleanup)
  --verbose       Show detailed output
  --cluster       Cleanup specific cluster
  --pattern       Pattern to match test resources (default: e2e-test)
  --help          Show this help message

Examples:
  node cleanup-azure-resources.js --dry-run
  node cleanup-azure-resources.js --force
  node cleanup-azure-resources.js --cluster my-test-cluster --force
  node cleanup-azure-resources.js --pattern custom-test --dry-run
        `);
        process.exit(0);
        break;
      default:
        if (!clusterName && !arg.startsWith('--')) {
          clusterName = arg;
          command = 'cleanup-cluster';
        }
        break;
    }
  }
  
  const cleanup = new AzureCleanup(options);
  
  if (command === 'cleanup-cluster' && clusterName) {
    cleanup.cleanupSingleCluster(clusterName)
      .then(result => {
        console.log('\n' + '='.repeat(80));
        console.log('CLUSTER CLEANUP RESULT');
        console.log('='.repeat(80));
        console.log(JSON.stringify(result, null, 2));
        console.log('='.repeat(80));
        
        process.exit(result.error ? 1 : 0);
      })
      .catch(error => {
        console.error('Cleanup failed:', error.message);
        process.exit(1);
      });
  } else {
    cleanup.cleanupTestEnvironment(options.pattern || 'e2e-test')
      .then(result => {
        console.log('\n' + '='.repeat(80));
        console.log('TEST ENVIRONMENT CLEANUP RESULT');
        console.log('='.repeat(80));
        console.log(JSON.stringify(result, null, 2));
        console.log('='.repeat(80));
        
        process.exit(result.error || result.summary.failed > 0 ? 1 : 0);
      })
      .catch(error => {
        console.error('Cleanup failed:', error.message);
        process.exit(1);
      });
  }
}

module.exports = AzureCleanup;