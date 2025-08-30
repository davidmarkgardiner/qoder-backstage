class AzureService {
  constructor() {
    // Mock data for Azure locations and configurations
  }
  
  async getAvailableLocations() {
    return [
      {
        name: 'eastus',
        displayName: 'East US',
        region: 'us',
        recommended: true,
        description: 'Primary US East region'
      },
      {
        name: 'westus2',
        displayName: 'West US 2',
        region: 'us',
        recommended: true,
        description: 'Primary US West region'
      },
      {
        name: 'uksouth',
        displayName: 'UK South',
        region: 'uk',
        recommended: false,
        description: 'Primary UK region'
      },
      {
        name: 'westeurope',
        displayName: 'West Europe',
        region: 'eu',
        recommended: false,
        description: 'Primary Europe region'
      },
      {
        name: 'centralus',
        displayName: 'Central US',
        region: 'us',
        recommended: false,
        description: 'Central US region'
      }
    ];
  }
  
  async getNodePoolTypes() {
    return [
      {
        name: 'standard',
        displayName: 'Standard',
        description: 'Balanced CPU and memory for general workloads',
        vmSizes: ['Standard_DS2_v2', 'Standard_DS3_v2', 'Standard_DS4_v2'],
        defaultVmSize: 'Standard_DS2_v2',
        napSupported: true,
        costTier: 'low'
      },
      {
        name: 'memory-optimized',
        displayName: 'Memory Optimized',
        description: 'High memory-to-CPU ratio for memory-intensive workloads',
        vmSizes: ['Standard_E2s_v3', 'Standard_E4s_v3', 'Standard_E8s_v3'],
        defaultVmSize: 'Standard_E2s_v3',
        napSupported: true,
        costTier: 'medium'
      },
      {
        name: 'compute-optimized',
        displayName: 'Compute Optimized',
        description: 'High CPU-to-memory ratio for compute-intensive workloads',
        vmSizes: ['Standard_F2s_v2', 'Standard_F4s_v2', 'Standard_F8s_v2'],
        defaultVmSize: 'Standard_F2s_v2',
        napSupported: true,
        costTier: 'medium'
      }
    ];
  }
  
  async getNodePoolRecommendations() {
    return [
      {
        nodePoolType: 'standard',
        useCase: 'Web applications, microservices, development environments',
        pros: ['Cost-effective', 'Balanced performance', 'Good for most workloads'],
        cons: ['May not handle memory-intensive tasks well']
      },
      {
        nodePoolType: 'memory-optimized',
        useCase: 'In-memory databases, caches, big data analytics',
        pros: ['Excellent for memory-intensive workloads', 'High memory bandwidth'],
        cons: ['Higher cost per hour', 'Overkill for CPU-bound tasks']
      },
      {
        nodePoolType: 'compute-optimized',
        useCase: 'CPU-intensive applications, batch processing, gaming servers',
        pros: ['High CPU performance', 'Excellent for compute workloads'],
        cons: ['Limited memory per core', 'Higher cost for memory-intensive tasks']
      }
    ];
  }
  
  async getVMSizes(location) {
    // In a real implementation, this would call Azure APIs
    // For demo purposes, return mock data based on location
    const baseVMSizes = [
      {
        name: 'Standard_DS2_v2',
        displayName: 'DS2 v2',
        vcpus: 2,
        memoryGB: 7,
        costPerHour: 0.10,
        category: 'standard'
      },
      {
        name: 'Standard_DS3_v2',
        displayName: 'DS3 v2',
        vcpus: 4,
        memoryGB: 14,
        costPerHour: 0.20,
        category: 'standard'
      },
      {
        name: 'Standard_E2s_v3',
        displayName: 'E2s v3',
        vcpus: 2,
        memoryGB: 16,
        costPerHour: 0.13,
        category: 'memory-optimized'
      },
      {
        name: 'Standard_E4s_v3',
        displayName: 'E4s v3',
        vcpus: 4,
        memoryGB: 32,
        costPerHour: 0.25,
        category: 'memory-optimized'
      },
      {
        name: 'Standard_F2s_v2',
        displayName: 'F2s v2',
        vcpus: 2,
        memoryGB: 4,
        costPerHour: 0.08,
        category: 'compute-optimized'
      },
      {
        name: 'Standard_F4s_v2',
        displayName: 'F4s v2',
        vcpus: 4,
        memoryGB: 8,
        costPerHour: 0.17,
        category: 'compute-optimized'
      }
    ];
    
    // Adjust pricing based on location (simulation)
    const locationMultiplier = {
      'eastus': 1.0,
      'westus2': 1.0,
      'uksouth': 1.15,
      'westeurope': 1.10,
      'centralus': 0.95
    };
    
    const multiplier = locationMultiplier[location] || 1.0;
    
    return baseVMSizes.map(vmSize => ({
      ...vmSize,
      costPerHour: parseFloat((vmSize.costPerHour * multiplier).toFixed(3)),
      available: true
    }));
  }
  
  async validateAzureConnection() {
    // In a real implementation, this would validate Azure credentials and connectivity
    // For demo purposes, always return success
    return {
      connected: true,
      subscriptionId: 'demo-subscription-id',
      tenantId: 'demo-tenant-id'
    };
  }
}

module.exports = new AzureService();