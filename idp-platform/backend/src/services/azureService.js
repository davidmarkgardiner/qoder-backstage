const WorkflowService = require('./workflowService');

class AzureService {
  constructor() {
    // Mock data for Azure locations and configurations
    this.workflowService = WorkflowService;
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
    // Get node pool configurations from WorkflowService
    const nodePoolConfigs = this.workflowService.getNodePoolConfigurations();
    
    // Convert to frontend format
    const nodePoolTypes = Object.entries(nodePoolConfigs).map(([name, config]) => ({
      name,
      displayName: this.formatDisplayName(name),
      description: config.description,
      vmSizes: [config.primaryVmSize, config.secondaryVmSize],
      defaultVmSize: config.primaryVmSize,
      napSupported: true, // All Karpenter pools support NAP
      costTier: this.getCostTier(name),
      karpenterConfig: {
        skuFamily: config.skuFamily,
        maxCpu: config.maxCpu,
        maxMemory: config.maxMemory,
        nodeClassType: config.nodeClassType
      },
      recommendedFor: config.recommendedFor || []
    }));
    
    return nodePoolTypes;
  }

  // Helper method to format display names
  formatDisplayName(name) {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Helper method to determine cost tier
  getCostTier(nodePoolType) {
    const costTiers = {
      'standard': 'low',
      'memory-optimized': 'medium',
      'compute-optimized': 'medium',
      'spot-optimized': 'very-low'
    };
    return costTiers[nodePoolType] || 'medium';
  }
  
  async getNodePoolRecommendations() {
    const nodePoolConfigs = this.workflowService.getNodePoolConfigurations();
    
    // Generate recommendations based on node pool configurations
    const recommendations = Object.entries(nodePoolConfigs).map(([nodePoolType, config]) => ({
      nodePoolType,
      displayName: this.formatDisplayName(nodePoolType),
      useCase: this.getUseCase(nodePoolType, config),
      pros: this.getPros(nodePoolType, config),
      cons: this.getCons(nodePoolType, config),
      recommendedFor: config.recommendedFor,
      karpenterFeatures: this.getKarpenterFeatures(nodePoolType, config)
    }));
    
    return recommendations;
  }

  // Helper method to get use case description
  getUseCase(nodePoolType, config) {
    const useCases = {
      'standard': 'Web applications, microservices, development environments, general-purpose workloads',
      'memory-optimized': 'In-memory databases, caches, big data analytics, memory-intensive applications',
      'compute-optimized': 'CPU-intensive applications, batch processing, scientific computing, compilation tasks',
      'spot-optimized': 'Development environments, testing, fault-tolerant batch jobs, cost-sensitive workloads'
    };
    
    return useCases[nodePoolType] || `Workloads optimized for ${nodePoolType} requirements`;
  }

  // Helper method to get pros
  getPros(nodePoolType, config) {
    const prosMap = {
      'standard': [
        'Cost-effective for most workloads',
        'Balanced CPU and memory ratio',
        'Good performance for general use cases',
        'Karpenter auto-scaling and optimization'
      ],
      'memory-optimized': [
        'Excellent for memory-intensive workloads',
        'High memory-to-CPU ratio',
        'Karpenter intelligent node management',
        'Suitable for in-memory processing'
      ],
      'compute-optimized': [
        'High CPU performance per core',
        'Excellent for compute-bound tasks',
        'Karpenter spot instance support',
        'Fast processing capabilities'
      ],
      'spot-optimized': [
        'Significant cost savings (up to 90%)',
        'Karpenter handles spot interruptions',
        'Good for fault-tolerant workloads',
        'Automatic fallback to on-demand'
      ]
    };
    
    return prosMap[nodePoolType] || ['Optimized for specific use cases', 'Karpenter management'];
  }

  // Helper method to get cons
  getCons(nodePoolType, config) {
    const consMap = {
      'standard': [
        'May not excel at specialized workloads',
        'Not optimized for high-memory or high-CPU tasks'
      ],
      'memory-optimized': [
        'Higher cost per hour',
        'Overkill for CPU-bound tasks',
        'Limited CPU performance per dollar'
      ],
      'compute-optimized': [
        'Limited memory per core',
        'Higher cost for memory-intensive tasks',
        'May need more nodes for balanced workloads'
      ],
      'spot-optimized': [
        'Potential for instance interruptions',
        'Not suitable for mission-critical workloads',
        'Unpredictable availability'
      ]
    };
    
    return consMap[nodePoolType] || ['Trade-offs depend on specific requirements'];
  }

  // Helper method to get Karpenter-specific features
  getKarpenterFeatures(nodePoolType, config) {
    return {
      autoScaling: 'Intelligent node provisioning and deprovisioning',
      spotSupport: nodePoolType === 'spot-optimized' ? 'Optimized for spot instances' : 'Spot instance capable',
      nodeConsolidation: 'Automatic node consolidation when possible',
      multiInstanceType: `Supports ${config.primaryVmSize} and ${config.secondaryVmSize}`,
      resourceLimits: `Max ${config.maxCpu} CPU, ${config.maxMemory} memory`,
      taints: `Specialized taints for ${nodePoolType} workloads`
    };
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