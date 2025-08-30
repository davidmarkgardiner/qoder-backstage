const k8s = require('@kubernetes/client-node');

class ClusterService {
  constructor() {
    this.kc = new k8s.KubeConfig();
    this.kc.loadFromDefault();
    this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.customApi = this.kc.makeApiClient(k8s.CustomObjectsApi);
    
    // In-memory storage for demo purposes
    // In production, use a proper database
    this.clusters = new Map();
  }
  
  async getClusters() {
    return Array.from(this.clusters.values());
  }
  
  async getCluster(id) {
    return this.clusters.get(id) || null;
  }
  
  async createCluster(clusterData) {
    this.clusters.set(clusterData.id, clusterData);
    return clusterData;
  }
  
  async updateCluster(id, updates) {
    const cluster = this.clusters.get(id);
    if (!cluster) {
      throw new Error('Cluster not found');
    }
    
    const updatedCluster = { ...cluster, ...updates, updatedAt: new Date() };
    this.clusters.set(id, updatedCluster);
    return updatedCluster;
  }
  
  async deleteCluster(id) {
    return this.clusters.delete(id);
  }
  
  async getClusterResources(clusterId) {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) {
      return [];
    }
    
    try {
      // Get KRO instance status
      const kroInstances = await this.customApi.listNamespacedCustomObject(
        'kro.run',
        'v1alpha1',
        'default',
        'aksclusters',
        undefined,
        undefined,
        undefined,
        undefined,
        `metadata.name=${cluster.name}`
      );
      
      // Get ASO resources status
      const asoResources = await this.getASOResources(cluster.name);
      
      return {
        kroInstances: kroInstances.body.items,
        asoResources
      };
    } catch (error) {
      console.error('Error fetching cluster resources:', error);
      return [];
    }
  }
  
  async getASOResources(clusterName) {
    try {
      const resources = [];
      
      // Check ResourceGroup
      try {
        const rg = await this.customApi.listNamespacedCustomObject(
          'resources.azure.com',
          'v1api20200601',
          'azure-system',
          'resourcegroups',
          undefined,
          undefined,
          undefined,
          undefined,
          `metadata.name=rg-${clusterName}`
        );
        resources.push(...rg.body.items);
      } catch (error) {
        console.log('No ResourceGroup found for cluster:', clusterName);
      }
      
      // Check ManagedCluster
      try {
        const mc = await this.customApi.listNamespacedCustomObject(
          'containerservice.azure.com',
          'v1api20240402preview',
          'azure-system',
          'managedclusters',
          undefined,
          undefined,
          undefined,
          undefined,
          `metadata.name=${clusterName}`
        );
        resources.push(...mc.body.items);
      } catch (error) {
        console.log('No ManagedCluster found for cluster:', clusterName);
      }
      
      return resources;
    } catch (error) {
      console.error('Error fetching ASO resources:', error);
      return [];
    }
  }
}

module.exports = new ClusterService();