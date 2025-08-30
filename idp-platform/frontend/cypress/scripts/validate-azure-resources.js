#!/usr/bin/env node

/**
 * Azure Resource Validation Script
 * Validates that AKS clusters and related resources are properly created in Azure
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class AzureValidator {
  constructor(options = {}) {
    this.subscriptionId = options.subscriptionId || process.env.AZURE_SUBSCRIPTION_ID;
    this.verbose = options.verbose || false;
    this.timeout = options.timeout || 300000; // 5 minutes default
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : 'ℹ️';
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
      return { authenticated: true, subscription: account };
    } catch (error) {
      this.log(`Azure authentication failed: ${error.message}`, 'error');
      return { authenticated: false, error: error.message };
    }
  }

  async validateCluster(clusterName) {
    try {
      const resourceGroup = `rg-${clusterName}`;
      
      this.log(`Validating cluster: ${clusterName} in resource group: ${resourceGroup}`);
      
      // Check if cluster exists
      const { stdout } = await execAsync(`az aks show --name ${clusterName} --resource-group ${resourceGroup} --output json`);
      const cluster = JSON.parse(stdout);
      
      const validation = {
        exists: true,
        name: cluster.name,
        resourceGroup: cluster.resourceGroup,
        location: cluster.location,
        provisioningState: cluster.provisioningState,
        powerState: cluster.powerState?.code,
        kubernetesVersion: cluster.kubernetesVersion,
        nodeResourceGroup: cluster.nodeResourceGroup,
        fqdn: cluster.fqdn,
        enableRbac: cluster.enableRbac,
        networkProfile: cluster.networkProfile,
        agentPoolProfiles: cluster.agentPoolProfiles,
        addonProfiles: cluster.addonProfiles,
        identity: cluster.identity,
        aadProfile: cluster.aadProfile,
        autoUpgradeProfile: cluster.autoUpgradeProfile,
        securityProfile: cluster.securityProfile
      };
      
      // Validate critical properties
      const issues = [];
      
      if (validation.provisioningState !== 'Succeeded') {
        issues.push(`Provisioning state is ${validation.provisioningState}, expected Succeeded`);
      }
      
      if (validation.powerState !== 'Running') {
        issues.push(`Power state is ${validation.powerState}, expected Running`);
      }
      
      if (!validation.enableRbac) {
        issues.push('RBAC should be enabled');
      }
      
      if (!validation.fqdn) {
        issues.push('FQDN is missing');
      }
      
      // Validate network configuration based on cluster.yaml
      if (validation.networkProfile) {
        if (validation.networkProfile.networkPlugin !== 'azure') {
          issues.push(`Network plugin is ${validation.networkProfile.networkPlugin}, expected azure`);
        }
        
        if (validation.networkProfile.networkPolicy !== 'cilium') {
          issues.push(`Network policy is ${validation.networkProfile.networkPolicy}, expected cilium`);
        }
        
        if (validation.networkProfile.networkDataplane !== 'cilium') {
          issues.push(`Network dataplane is ${validation.networkProfile.networkDataplane}, expected cilium`);
        }
      }
      
      // Validate node pool configuration
      if (validation.agentPoolProfiles && validation.agentPoolProfiles.length > 0) {
        const systemPool = validation.agentPoolProfiles.find(pool => pool.mode === 'System');
        if (!systemPool) {
          issues.push('System node pool is missing');
        } else {
          if (systemPool.osType !== 'Linux') {
            issues.push(`System pool OS type is ${systemPool.osType}, expected Linux`);
          }
          
          if (systemPool.osSku !== 'AzureLinux') {
            issues.push(`System pool OS SKU is ${systemPool.osSku}, expected AzureLinux`);
          }
        }
      }
      
      // Validate addons
      if (validation.addonProfiles) {
        if (!validation.addonProfiles.azureKeyvaultSecretsProvider?.enabled) {
          issues.push('Azure Key Vault Secrets Provider addon should be enabled');
        }
        
        if (!validation.addonProfiles.azurepolicy?.enabled) {
          issues.push('Azure Policy addon should be enabled');
        }
      }
      
      // Validate security features
      if (validation.securityProfile) {
        if (!validation.securityProfile.workloadIdentity?.enabled) {
          issues.push('Workload Identity should be enabled');
        }
        
        if (!validation.securityProfile.defender?.securityMonitoring?.enabled) {
          issues.push('Microsoft Defender security monitoring should be enabled');
        }
      }
      
      validation.issues = issues;
      validation.isValid = issues.length === 0;
      
      if (validation.isValid) {
        this.log(`Cluster validation passed: ${clusterName}`, 'success');
      } else {
        this.log(`Cluster validation issues found for ${clusterName}:`, 'error');
        issues.forEach(issue => this.log(`  - ${issue}`, 'error'));
      }
      
      return validation;
      
    } catch (error) {
      this.log(`Cluster validation failed: ${error.message}`, 'error');
      return {
        exists: false,
        error: error.message,
        isValid: false
      };
    }
  }

  async validateResourceGroup(resourceGroupName) {
    try {
      const { stdout } = await execAsync(`az group show --name ${resourceGroupName} --output json`);
      const rg = JSON.parse(stdout);
      
      this.log(`Resource group ${resourceGroupName} exists with status: ${rg.properties.provisioningState}`, 'success');
      
      return {
        exists: true,
        name: rg.name,
        location: rg.location,
        provisioningState: rg.properties.provisioningState,
        tags: rg.tags
      };
    } catch (error) {
      this.log(`Resource group validation failed: ${error.message}`, 'error');
      return {
        exists: false,
        error: error.message
      };
    }
  }

  async validateNodeResourceGroup(clusterName) {
    try {
      const cluster = await this.validateCluster(clusterName);
      if (!cluster.exists || !cluster.nodeResourceGroup) {
        throw new Error('Cluster or node resource group not found');
      }
      
      const nodeRG = await this.validateResourceGroup(cluster.nodeResourceGroup);
      
      if (nodeRG.exists) {
        this.log(`Node resource group validated: ${cluster.nodeResourceGroup}`, 'success');
      }
      
      return nodeRG;
    } catch (error) {
      this.log(`Node resource group validation failed: ${error.message}`, 'error');
      return {
        exists: false,
        error: error.message
      };
    }
  }

  async validateClusterConnectivity(clusterName) {
    try {
      const resourceGroup = `rg-${clusterName}`;
      
      // Get cluster credentials
      await execAsync(`az aks get-credentials --resource-group ${resourceGroup} --name ${clusterName} --overwrite-existing`);
      
      // Test kubectl connectivity
      const { stdout: clusterInfo } = await execAsync('kubectl cluster-info');
      
      if (!clusterInfo.includes('Kubernetes control plane')) {
        throw new Error('Cluster info does not show control plane');
      }
      
      // Test node connectivity
      const { stdout: nodes } = await execAsync('kubectl get nodes --output json');
      const nodeList = JSON.parse(nodes);
      
      if (nodeList.items.length === 0) {
        throw new Error('No nodes found in cluster');
      }
      
      const readyNodes = nodeList.items.filter(node => 
        node.status.conditions.some(condition => 
          condition.type === 'Ready' && condition.status === 'True'
        )
      );
      
      if (readyNodes.length === 0) {
        throw new Error('No ready nodes found');
      }
      
      this.log(`Cluster connectivity validated: ${readyNodes.length} ready nodes`, 'success');
      
      return {
        connected: true,
        totalNodes: nodeList.items.length,
        readyNodes: readyNodes.length,
        nodes: nodeList.items.map(node => ({
          name: node.metadata.name,
          status: node.status.conditions.find(c => c.type === 'Ready')?.status,
          version: node.status.nodeInfo.kubeletVersion,
          osImage: node.status.nodeInfo.osImage
        }))
      };
      
    } catch (error) {
      this.log(`Cluster connectivity validation failed: ${error.message}`, 'error');
      return {
        connected: false,
        error: error.message
      };
    }
  }

  async generateValidationReport(clusterName) {
    const report = {
      clusterName,
      timestamp: new Date().toISOString(),
      validations: {}
    };
    
    try {
      // Validate Azure authentication
      report.validations.authentication = await this.validateAzureAuth();
      
      if (!report.validations.authentication.authenticated) {
        throw new Error('Azure authentication required');
      }
      
      // Validate cluster
      report.validations.cluster = await this.validateCluster(clusterName);
      
      // Validate resource group
      const resourceGroup = `rg-${clusterName}`;
      report.validations.resourceGroup = await this.validateResourceGroup(resourceGroup);
      
      // Validate node resource group
      if (report.validations.cluster.exists) {
        report.validations.nodeResourceGroup = await this.validateNodeResourceGroup(clusterName);
      }
      
      // Validate connectivity
      if (report.validations.cluster.exists && report.validations.cluster.powerState === 'Running') {
        report.validations.connectivity = await this.validateClusterConnectivity(clusterName);
      }
      
      // Overall status
      report.overallStatus = Object.values(report.validations).every(validation => 
        validation.authenticated !== false && 
        validation.exists !== false && 
        validation.connected !== false &&
        validation.isValid !== false
      ) ? 'PASSED' : 'FAILED';
      
      this.log(`Validation report generated for ${clusterName}: ${report.overallStatus}`, 
        report.overallStatus === 'PASSED' ? 'success' : 'error');
      
      return report;
      
    } catch (error) {
      report.validations.error = error.message;
      report.overallStatus = 'ERROR';
      this.log(`Validation report generation failed: ${error.message}`, 'error');
      return report;
    }
  }
}

// CLI usage
if (require.main === module) {
  const clusterName = process.argv[2];
  
  if (!clusterName) {
    console.error('Usage: node validate-azure-resources.js <cluster-name>');
    process.exit(1);
  }
  
  const validator = new AzureValidator({ verbose: true });
  
  validator.generateValidationReport(clusterName)
    .then(report => {
      console.log('\n' + '='.repeat(80));
      console.log('AZURE CLUSTER VALIDATION REPORT');
      console.log('='.repeat(80));
      console.log(JSON.stringify(report, null, 2));
      console.log('='.repeat(80));
      
      process.exit(report.overallStatus === 'PASSED' ? 0 : 1);
    })
    .catch(error => {
      console.error('Validation failed:', error.message);
      process.exit(1);
    });
}

module.exports = AzureValidator;