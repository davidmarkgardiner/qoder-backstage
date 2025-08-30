const k8s = require('@kubernetes/client-node');
const { v4: uuidv4 } = require('uuid');

class WorkflowService {
  constructor() {
    this.kc = new k8s.KubeConfig();
    this.kc.loadFromDefault();
    this.customApi = this.kc.makeApiClient(k8s.CustomObjectsApi);
    
    // In-memory storage for demo purposes
    this.workflows = new Map();
    this.workflowSteps = new Map();
    this.workflowLogs = new Map();
  }
  
  async getWorkflows(filters = {}) {
    let workflows = Array.from(this.workflows.values());
    
    if (filters.status) {
      workflows = workflows.filter(w => w.status === filters.status);
    }
    
    if (filters.limit) {
      workflows = workflows.slice(0, filters.limit);
    }
    
    return workflows;
  }
  
  async getWorkflow(id) {
    return this.workflows.get(id) || null;
  }
  
  async getWorkflowSteps(id) {
    return this.workflowSteps.get(id) || [];
  }
  
  async getWorkflowLogs(id) {
    return this.workflowLogs.get(id) || [];
  }
  
  async startClusterProvisioningWorkflow(params) {
    const {
      workflowId,
      clusterId,
      clusterName,
      location,
      nodePoolType,
      dryRun,
      enableNAP,
      advancedConfig
    } = params;
    
    const workflow = {
      id: workflowId,
      name: `cluster-provisioning-${clusterName}`,
      type: 'cluster-provisioning',
      status: 'running',
      clusterId,
      startTime: new Date(),
      parameters: {
        clusterName,
        location,
        nodePoolType,
        dryRun,
        enableNAP,
        advancedConfig
      }
    };
    
    const steps = [
      { id: uuidv4(), name: 'validate-inputs', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'create-kro-instance', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'apply-aso-resources', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'wait-for-cluster', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'configure-gitops', status: 'pending', startTime: null, endTime: null }
    ];
    
    this.workflows.set(workflowId, workflow);
    this.workflowSteps.set(workflowId, steps);
    this.workflowLogs.set(workflowId, []);
    
    // Start the workflow execution
    this.executeWorkflow(workflowId);
    
    return workflow;
  }
  
  async startClusterDeletionWorkflow(params) {
    const { workflowId, clusterId, clusterName, force, dryRun } = params;
    
    const workflow = {
      id: workflowId,
      name: `cluster-deletion-${clusterName}`,
      type: 'cluster-deletion',
      status: 'running',
      clusterId,
      startTime: new Date(),
      parameters: {
        clusterName,
        force,
        dryRun
      }
    };
    
    const steps = [
      { id: uuidv4(), name: 'validate-deletion', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'delete-aso-resources', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'delete-kro-instance', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'cleanup-resources', status: 'pending', startTime: null, endTime: null }
    ];
    
    this.workflows.set(workflowId, workflow);
    this.workflowSteps.set(workflowId, steps);
    this.workflowLogs.set(workflowId, []);
    
    // Start the workflow execution
    this.executeWorkflow(workflowId);
    
    return workflow;
  }
  
  async executeWorkflow(workflowId) {
    try {
      const workflow = this.workflows.get(workflowId);
      const steps = this.workflowSteps.get(workflowId);
      
      if (!workflow || !steps) {
        throw new Error('Workflow or steps not found');
      }
      
      this.addLog(workflowId, `Starting workflow: ${workflow.name}`, 'info');
      
      // Execute steps sequentially
      for (const step of steps) {
        await this.executeStep(workflowId, step);
      }
      
      // Update workflow status
      workflow.status = 'succeeded';
      workflow.endTime = new Date();
      this.workflows.set(workflowId, workflow);
      
      this.addLog(workflowId, `Workflow completed successfully`, 'info');
      
    } catch (error) {
      console.error(`Workflow ${workflowId} failed:`, error);
      const workflow = this.workflows.get(workflowId);
      workflow.status = 'failed';
      workflow.endTime = new Date();
      workflow.error = error.message;
      this.workflows.set(workflowId, workflow);
      
      this.addLog(workflowId, `Workflow failed: ${error.message}`, 'error');
    }
  }
  
  async executeStep(workflowId, step) {
    const workflow = this.workflows.get(workflowId);
    const steps = this.workflowSteps.get(workflowId);
    
    // Update step status
    step.status = 'running';
    step.startTime = new Date();
    this.workflowSteps.set(workflowId, steps);
    
    this.addLog(workflowId, `Starting step: ${step.name}`, 'info');
    
    try {
      switch (step.name) {
        case 'validate-inputs':
          await this.validateInputs(workflowId, workflow.parameters);
          break;
        case 'create-kro-instance':
          await this.createKROInstance(workflowId, workflow.parameters);
          break;
        case 'apply-aso-resources':
          await this.applyASOResources(workflowId, workflow.parameters);
          break;
        case 'wait-for-cluster':
          if (!workflow.parameters.dryRun) {
            await this.waitForCluster(workflowId, workflow.parameters);
          } else {
            this.addLog(workflowId, 'Skipping cluster wait (dry-run mode)', 'info');
          }
          break;
        case 'configure-gitops':
          if (!workflow.parameters.dryRun) {
            await this.configureGitOps(workflowId, workflow.parameters);
          } else {
            this.addLog(workflowId, 'Skipping GitOps configuration (dry-run mode)', 'info');
          }
          break;
        default:
          this.addLog(workflowId, `Unknown step: ${step.name}`, 'warning');
      }
      
      step.status = 'succeeded';
      step.endTime = new Date();
      this.addLog(workflowId, `Step completed: ${step.name}`, 'info');
      
    } catch (error) {
      step.status = 'failed';
      step.endTime = new Date();
      step.error = error.message;
      this.addLog(workflowId, `Step failed: ${step.name} - ${error.message}`, 'error');
      throw error;
    }
    
    this.workflowSteps.set(workflowId, steps);
  }
  
  async validateInputs(workflowId, params) {
    this.addLog(workflowId, 'Validating cluster configuration...', 'info');
    
    // Simulate validation delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Validate required parameters
    if (!params.clusterName || !params.location || !params.nodePoolType) {
      throw new Error('Missing required parameters');
    }
    
    this.addLog(workflowId, 'Configuration validation passed', 'info');
  }
  
  async createKROInstance(workflowId, params) {
    this.addLog(workflowId, 'Creating KRO instance...', 'info');
    
    const kroInstance = {
      apiVersion: 'kro.run/v1alpha1',
      kind: 'AKSCluster',
      metadata: {
        name: params.clusterName,
        namespace: 'default'
      },
      spec: {
        location: params.location,
        nodePoolType: params.nodePoolType,
        enableNAP: params.enableNAP,
        dryRun: params.dryRun
      }
    };
    
    if (params.dryRun) {
      this.addLog(workflowId, 'DRY RUN: Would create KRO instance', 'info');
      this.addLog(workflowId, JSON.stringify(kroInstance, null, 2), 'debug');
    } else {
      try {
        await this.customApi.createNamespacedCustomObject(
          'kro.run',
          'v1alpha1',
          'default',
          'aksclusters',
          kroInstance
        );
        this.addLog(workflowId, 'KRO instance created successfully', 'info');
      } catch (error) {
        if (error.response && error.response.statusCode === 409) {
          this.addLog(workflowId, 'KRO instance already exists', 'warning');
        } else {
          throw error;
        }
      }
    }
  }
  
  async applyASOResources(workflowId, params) {
    this.addLog(workflowId, 'Applying ASO resources...', 'info');
    
    if (params.dryRun) {
      this.addLog(workflowId, 'DRY RUN: Would apply ASO manifests', 'info');
      this.addLog(workflowId, 'Resources that would be created:', 'info');
      this.addLog(workflowId, `- ResourceGroup: rg-${params.clusterName}`, 'info');
      this.addLog(workflowId, `- ManagedCluster: ${params.clusterName}`, 'info');
    } else {
      // Apply actual ASO resources
      await this.applyResourceGroup(workflowId, params);
      await this.applyManagedCluster(workflowId, params);
    }
  }
  
  async applyResourceGroup(workflowId, params) {
    const resourceGroup = {
      apiVersion: 'resources.azure.com/v1api20200601',
      kind: 'ResourceGroup',
      metadata: {
        name: `rg-${params.clusterName}`,
        namespace: 'azure-system'
      },
      spec: {
        location: params.location
      }
    };
    
    try {
      await this.customApi.createNamespacedCustomObject(
        'resources.azure.com',
        'v1api20200601',
        'azure-system',
        'resourcegroups',
        resourceGroup
      );
      this.addLog(workflowId, `ResourceGroup created: rg-${params.clusterName}`, 'info');
    } catch (error) {
      if (error.response && error.response.statusCode === 409) {
        this.addLog(workflowId, 'ResourceGroup already exists', 'warning');
      } else {
        // Log detailed error information
        this.addLog(workflowId, `Failed to create ResourceGroup: ${error.message}`, 'error');
        if (error.response) {
          this.addLog(workflowId, `HTTP Status: ${error.response.statusCode}`, 'error');
          this.addLog(workflowId, `Response: ${JSON.stringify(error.response.body, null, 2)}`, 'error');
        }
        throw error;
      }
    }
  }
  
  async applyManagedCluster(workflowId, params) {
    const managedCluster = {
      apiVersion: 'containerservice.azure.com/v1api20240402preview',
      kind: 'ManagedCluster',
      metadata: {
        name: params.clusterName,
        namespace: 'azure-system'
      },
      spec: {
        location: params.location,
        owner: {
          name: `rg-${params.clusterName}`
        },
        dnsPrefix: `${params.clusterName}k8s`,
        nodeProvisioningProfile: {
          mode: params.enableNAP ? 'Auto' : 'Manual'
        },
        agentPoolProfiles: [{
          name: 'systempool',
          mode: 'System',
          count: 1,
          vmSize: this.getVMSizeForNodePoolType(params.nodePoolType),
          enableAutoScaling: params.enableNAP ? false : true, // NAP and agent pool auto-scaling are mutually exclusive
          minCount: params.enableNAP ? undefined : 1,
          maxCount: params.enableNAP ? undefined : 3,
          osDiskType: 'Managed',
          osDiskSizeGB: 64,
          osType: 'Linux',
          maxPods: 110
        }],
        networkProfile: {
          networkPlugin: 'azure',
          networkPluginMode: 'overlay',
          serviceCidr: '10.0.0.0/16',
          dnsServiceIP: '10.0.0.10',
          podCidr: '10.1.0.0/16',
          loadBalancerSku: 'standard',
          outboundType: 'loadBalancer'
        },
        identity: {
          type: 'SystemAssigned'
        },
        enableRBAC: true,
        sku: {
          name: 'Base',
          tier: 'Free'
        },
        kubernetesVersion: params.advancedConfig?.kubernetesVersion || '1.30',
        tags: {
          environment: 'development',
          createdBy: 'idp-platform',
          clusterName: params.clusterName
        }
      }
    };
    
    try {
      await this.customApi.createNamespacedCustomObject(
        'containerservice.azure.com',
        'v1api20240402preview',
        'azure-system',
        'managedclusters',
        managedCluster
      );
      this.addLog(workflowId, `ManagedCluster created: ${params.clusterName}`, 'info');
    } catch (error) {
      if (error.response && error.response.statusCode === 409) {
        this.addLog(workflowId, 'ManagedCluster already exists', 'warning');
      } else {
        // Log detailed error information
        this.addLog(workflowId, `Failed to create ManagedCluster: ${error.message}`, 'error');
        if (error.response) {
          this.addLog(workflowId, `HTTP Status: ${error.response.statusCode}`, 'error');
          this.addLog(workflowId, `Response: ${JSON.stringify(error.response.body, null, 2)}`, 'error');
        }
        throw error;
      }
    }
  }
  
  getVMSizeForNodePoolType(nodePoolType) {
    const vmSizeMap = {
      'standard': 'Standard_DS2_v2',
      'memory-optimized': 'Standard_E2s_v3',
      'compute-optimized': 'Standard_F2s_v2'
    };
    return vmSizeMap[nodePoolType] || 'Standard_DS2_v2';
  }
  
  async waitForCluster(workflowId, params) {
    this.addLog(workflowId, 'Waiting for cluster to be ready...', 'info');
    
    // In a real implementation, this would poll the cluster status
    // For demo purposes, we'll simulate the wait
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      this.addLog(workflowId, `Checking cluster status... (${i + 1}/5)`, 'info');
    }
    
    this.addLog(workflowId, 'Cluster is ready!', 'info');
  }
  
  async configureGitOps(workflowId, params) {
    this.addLog(workflowId, 'Configuring GitOps with Flux...', 'info');
    
    // Simulate GitOps configuration
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.addLog(workflowId, 'GitOps configuration completed', 'info');
  }
  
  addLog(workflowId, message, level = 'info') {
    const logs = this.workflowLogs.get(workflowId) || [];
    logs.push({
      timestamp: new Date(),
      level,
      message
    });
    this.workflowLogs.set(workflowId, logs);
    console.log(`[${workflowId}] [${level.toUpperCase()}] ${message}`);
  }
  
  async abortWorkflow(workflowId, reason) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }
    
    workflow.status = 'aborted';
    workflow.endTime = new Date();
    workflow.abortReason = reason;
    
    this.workflows.set(workflowId, workflow);
    this.addLog(workflowId, `Workflow aborted: ${reason}`, 'warning');
    
    return workflow;
  }
  
  async retryWorkflow(workflowId, fromStep) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }
    
    workflow.status = 'running';
    workflow.retryCount = (workflow.retryCount || 0) + 1;
    
    this.workflows.set(workflowId, workflow);
    this.addLog(workflowId, `Workflow retry initiated (retry #${workflow.retryCount})`, 'info');
    
    // Restart workflow execution
    this.executeWorkflow(workflowId);
    
    return workflow;
  }
}

module.exports = new WorkflowService();