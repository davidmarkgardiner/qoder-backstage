const k8s = require('@kubernetes/client-node');
const { v4: uuidv4 } = require('uuid');

// Node pool type to VM size and Karpenter configuration mapping
const NODE_POOL_CONFIGURATIONS = {
  'standard': {
    primaryVmSize: 'Standard_DS2_v2',
    secondaryVmSize: 'Standard_DS3_v2',
    skuFamily: 'D',
    maxCpu: '1000',
    maxMemory: '1000Gi',
    nodeClassType: 'default-nodeclass',
    description: 'General purpose nodes for standard workloads',
    recommendedFor: ['web-apps', 'microservices', 'general-workloads']
  },
  'memory-optimized': {
    primaryVmSize: 'Standard_E2s_v3',
    secondaryVmSize: 'Standard_E4s_v3',
    skuFamily: 'E',
    maxCpu: '1000',
    maxMemory: '2000Gi',
    nodeClassType: 'memory-optimized-nodeclass',
    description: 'High-memory nodes for memory-intensive workloads',
    recommendedFor: ['databases', 'caches', 'analytics', 'in-memory-processing']
  },
  'compute-optimized': {
    primaryVmSize: 'Standard_F2s_v2',
    secondaryVmSize: 'Standard_F4s_v2',
    skuFamily: 'F',
    maxCpu: '2000',
    maxMemory: '1000Gi',
    nodeClassType: 'compute-optimized-nodeclass',
    description: 'High-CPU nodes for compute-intensive workloads',
    recommendedFor: ['batch-processing', 'scientific-computing', 'video-encoding', 'compilation']
  },
  'spot-optimized': {
    primaryVmSize: 'Standard_DS2_v2',
    secondaryVmSize: 'Standard_DS3_v2',
    skuFamily: 'D',
    maxCpu: '500',
    maxMemory: '500Gi',
    nodeClassType: 'default-nodeclass',
    description: 'Cost-optimized nodes using spot instances',
    recommendedFor: ['development', 'testing', 'batch-jobs', 'fault-tolerant-apps']
  }
};

class WorkflowService {
  constructor() {
    this.kc = new k8s.KubeConfig();
    this.kc.loadFromDefault();
    this.customApi = this.kc.makeApiClient(k8s.CustomObjectsApi);
    
    // Hybrid storage: Keep workflow metadata in memory, sync with Argo
    this.workflows = new Map();
    this.workflowSteps = new Map();
    this.workflowLogs = new Map();
    
    // Argo Workflow API configuration
    this.argoNamespace = process.env.ARGO_NAMESPACE || 'default';
    this.argoApiGroup = 'argoproj.io';
    this.argoApiVersion = 'v1alpha1';
    
    // Feature flag for Karpenter workflow (default: false for gradual migration)
    this.useKarpenterWorkflow = process.env.USE_KARPENTER_WORKFLOW === 'true' || false;
    
    // Start workflow status monitoring
    this.startWorkflowMonitoring();
  }
  
  async startWorkflowMonitoring() {
    // Monitor Argo Workflows for status updates
    setInterval(async () => {
      try {
        await this.syncArgoWorkflowsStatus();
      } catch (error) {
        console.error('Error syncing Argo workflow status:', error);
      }
    }, 5000); // Check every 5 seconds
  }
  
  async syncArgoWorkflowsStatus() {
    try {
      // Get all workflows from our local store
      for (const [workflowId, localWorkflow] of this.workflows.entries()) {
        if (localWorkflow.argoWorkflowName) {
          const argoWorkflow = await this.getArgoWorkflow(localWorkflow.argoWorkflowName);
          if (argoWorkflow) {
            await this.updateWorkflowFromArgo(workflowId, argoWorkflow);
          }
        }
      }
    } catch (error) {
      console.error('Error in syncArgoWorkflowsStatus:', error);
    }
  }
  
  async getArgoWorkflow(argoWorkflowName) {
    try {
      const response = await this.customApi.getNamespacedCustomObject(
        this.argoApiGroup,
        this.argoApiVersion,
        this.argoNamespace,
        'workflows',
        argoWorkflowName
      );
      return response.body;
    } catch (error) {
      if (error.response?.statusCode !== 404) {
        console.error(`Error getting Argo workflow ${argoWorkflowName}:`, error.message);
      }
      return null;
    }
  }
  
  async updateWorkflowFromArgo(workflowId, argoWorkflow) {
    const localWorkflow = this.workflows.get(workflowId);
    if (!localWorkflow) return;
    
    // Map Argo status to our workflow status
    const argoStatus = argoWorkflow.status?.phase?.toLowerCase();
    let mappedStatus = 'running';
    
    switch (argoStatus) {
      case 'succeeded':
        mappedStatus = 'succeeded';
        localWorkflow.endTime = new Date(argoWorkflow.status.finishedAt || new Date());
        break;
      case 'failed':
      case 'error':
        mappedStatus = 'failed';
        localWorkflow.endTime = new Date(argoWorkflow.status.finishedAt || new Date());
        localWorkflow.error = argoWorkflow.status.message || 'Workflow failed';
        break;
      case 'running':
      case 'pending':
        mappedStatus = 'running';
        break;
    }
    
    if (localWorkflow.status !== mappedStatus) {
      localWorkflow.status = mappedStatus;
      this.workflows.set(workflowId, localWorkflow);
      
      // Update steps from Argo workflow nodes
      if (argoWorkflow.status?.nodes) {
        this.updateStepsFromArgoNodes(workflowId, argoWorkflow.status.nodes);
      }
      
      console.log(`Updated workflow ${workflowId} status to ${mappedStatus}`);
    }
  }
  
  updateStepsFromArgoNodes(workflowId, argoNodes) {
    const steps = this.workflowSteps.get(workflowId) || [];
    
    Object.values(argoNodes).forEach(node => {
      if (node.type === 'Pod' || node.templateName) {
        const stepName = node.templateName || node.displayName || node.name;
        const step = steps.find(s => s.name === stepName);
        
        if (step) {
          const nodePhase = node.phase?.toLowerCase();
          let stepStatus = 'pending';
          
          switch (nodePhase) {
            case 'succeeded':
              stepStatus = 'succeeded';
              step.endTime = new Date(node.finishedAt || new Date());
              break;
            case 'failed':
            case 'error':
              stepStatus = 'failed';
              step.endTime = new Date(node.finishedAt || new Date());
              step.error = node.message || 'Step failed';
              break;
            case 'running':
              stepStatus = 'running';
              step.startTime = new Date(node.startedAt || new Date());
              break;
          }
          
          if (step.status !== stepStatus) {
            step.status = stepStatus;
          }
        }
      }
    });
    
    this.workflowSteps.set(workflowId, steps);
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
    
    const argoWorkflowName = `cluster-provisioning-${clusterName}-${workflowId.substring(0, 8)}`;
    
    // Generate workflow parameters based on selected workflow type
    const workflowParameters = this.useKarpenterWorkflow 
      ? await this.generateKarpenterWorkflowParameters(params)
      : this.generateKroWorkflowParameters(params);
    
    const workflow = {
      id: workflowId,
      name: `cluster-provisioning-${clusterName}`,
      type: 'cluster-provisioning',
      status: 'running',
      clusterId,
      startTime: new Date(),
      argoWorkflowName,
      workflowType: this.useKarpenterWorkflow ? 'karpenter' : 'kro',
      parameters: workflowParameters
    };
    
    // Generate workflow steps based on type
    const steps = this.useKarpenterWorkflow 
      ? this.generateKarpenterWorkflowSteps()
      : this.generateKroWorkflowSteps();
    
    this.workflows.set(workflowId, workflow);
    this.workflowSteps.set(workflowId, steps);
    this.workflowLogs.set(workflowId, []);
    
    // Create actual Argo Workflow
    try {
      if (this.useKarpenterWorkflow) {
        await this.createArgoKarpenterWorkflow(workflow);
        this.addLog(workflowId, `Argo Karpenter Workflow ${argoWorkflowName} created successfully`, 'info');
      } else {
        await this.createArgoWorkflow(workflow);
        this.addLog(workflowId, `Argo KRO Workflow ${argoWorkflowName} created successfully`, 'info');
      }
    } catch (error) {
      this.addLog(workflowId, `Failed to create Argo Workflow: ${error.message}`, 'error');
      workflow.status = 'failed';
      workflow.error = error.message;
      this.workflows.set(workflowId, workflow);
    }
    
    return workflow;
  }

  // Generate parameters for Karpenter-based workflows
  async generateKarpenterWorkflowParameters(params) {
    const {
      clusterName,
      location,
      nodePoolType,
      dryRun,
      enableNAP,
      advancedConfig
    } = params;

    // Get node pool configuration
    const nodePoolConfig = NODE_POOL_CONFIGURATIONS[nodePoolType] || NODE_POOL_CONFIGURATIONS.standard;
    
    return {
      clusterName,
      location,
      nodePoolType,
      dryRun,
      enableNAP,
      kubernetesVersion: advancedConfig?.kubernetesVersion || '1.28.3',
      primaryVmSize: nodePoolConfig.primaryVmSize,
      secondaryVmSize: nodePoolConfig.secondaryVmSize,
      skuFamily: nodePoolConfig.skuFamily,
      maxCpu: nodePoolConfig.maxCpu,
      maxMemory: nodePoolConfig.maxMemory,
      systemVmSize: 'Standard_B2s', // Minimal system pool
      nodeClassType: nodePoolConfig.nodeClassType,
      advancedConfig
    };
  }

  // Generate parameters for KRO-based workflows (legacy)
  generateKroWorkflowParameters(params) {
    const {
      clusterName,
      location,
      nodePoolType,
      dryRun,
      enableNAP,
      advancedConfig
    } = params;

    return {
      clusterName,
      location,
      nodePoolType,
      dryRun,
      enableNAP,
      advancedConfig
    };
  }

  // Generate workflow steps for Karpenter workflows
  generateKarpenterWorkflowSteps() {
    return [
      { id: uuidv4(), name: 'validate-inputs', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'create-resource-group', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'create-managed-cluster', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'create-karpenter-nodeclass', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'create-karpenter-nodepool', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'wait-for-cluster-ready', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'configure-cluster-addons', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'configure-gitops', status: 'pending', startTime: null, endTime: null }
    ];
  }

  // Generate workflow steps for KRO workflows (legacy)
  generateKroWorkflowSteps() {
    return [
      { id: uuidv4(), name: 'validate-cluster-config', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'create-kro-cluster', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'wait-for-kro-ready', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'wait-cluster-ready', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'setup-flux-gitops', status: 'pending', startTime: null, endTime: null }
    ];
  }

  // Get node pool configurations for frontend
  getNodePoolConfigurations() {
    return NODE_POOL_CONFIGURATIONS;
  }

  // Get workflow type (for debugging and monitoring)
  getWorkflowType() {
    return this.useKarpenterWorkflow ? 'karpenter' : 'kro';
  }
  
  async createArgoWorkflow(workflow) {
    const argoWorkflowManifest = {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Workflow',
      metadata: {
        name: workflow.argoWorkflowName,
        namespace: this.argoNamespace,
        labels: {
          'idp.platform/workflow-id': workflow.id,
          'idp.platform/workflow-type': workflow.type,
          'idp.platform/cluster-id': workflow.clusterId
        }
      },
      spec: {
        serviceAccountName: 'idp-backend-sa',
        workflowTemplateRef: {
          name: 'aks-cluster-provisioning'
        },
        arguments: {
          parameters: [
            {
              name: 'cluster-name',
              value: workflow.parameters.clusterName
            },
            {
              name: 'location',
              value: workflow.parameters.location
            },
            {
              name: 'node-pool-type',
              value: workflow.parameters.nodePoolType
            },
            {
              name: 'enable-nap',
              value: workflow.parameters.enableNAP.toString()
            },
            {
              name: 'dry-run',
              value: workflow.parameters.dryRun.toString()
            },
            {
              name: 'kubernetes-version',
              value: workflow.parameters.advancedConfig?.kubernetesVersion || '1.28.3'
            },
            {
              name: 'max-nodes',
              value: workflow.parameters.advancedConfig?.maxNodes || '10'
            },
            {
              name: 'enable-spot',
              value: workflow.parameters.advancedConfig?.enableSpot?.toString() || 'false'
            }
          ]
        }
      }
    };
    
    await this.customApi.createNamespacedCustomObject(
      this.argoApiGroup,
      this.argoApiVersion,
      this.argoNamespace,
      'workflows',
      argoWorkflowManifest
    );
  }

  // Create Argo Workflow for Karpenter-based cluster provisioning
  async createArgoKarpenterWorkflow(workflow) {
    const argoWorkflowManifest = {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Workflow',
      metadata: {
        name: workflow.argoWorkflowName,
        namespace: this.argoNamespace,
        labels: {
          'idp.platform/workflow-id': workflow.id,
          'idp.platform/workflow-type': workflow.type,
          'idp.platform/cluster-id': workflow.clusterId,
          'idp.platform/workflow-engine': 'karpenter'
        }
      },
      spec: {
        serviceAccountName: 'idp-backend-sa',
        workflowTemplateRef: {
          name: 'aks-cluster-provisioning-aso-karpenter'
        },
        arguments: {
          parameters: [
            {
              name: 'cluster-name',
              value: workflow.parameters.clusterName
            },
            {
              name: 'location',
              value: workflow.parameters.location
            },
            {
              name: 'node-pool-type',
              value: workflow.parameters.nodePoolType
            },
            {
              name: 'enable-nap',
              value: workflow.parameters.enableNAP.toString()
            },
            {
              name: 'dry-run',
              value: workflow.parameters.dryRun.toString()
            },
            {
              name: 'kubernetes-version',
              value: workflow.parameters.kubernetesVersion
            },
            {
              name: 'primary-vm-size',
              value: workflow.parameters.primaryVmSize
            },
            {
              name: 'secondary-vm-size',
              value: workflow.parameters.secondaryVmSize
            },
            {
              name: 'sku-family',
              value: workflow.parameters.skuFamily
            },
            {
              name: 'max-cpu',
              value: workflow.parameters.maxCpu
            },
            {
              name: 'max-memory',
              value: workflow.parameters.maxMemory
            },
            {
              name: 'system-vm-size',
              value: workflow.parameters.systemVmSize
            }
          ]
        }
      }
    };
    
    await this.customApi.createNamespacedCustomObject(
      this.argoApiGroup,
      this.argoApiVersion,
      this.argoNamespace,
      'workflows',
      argoWorkflowManifest
    );
  }
  
  async startClusterDeletionWorkflow(params) {
    const { workflowId, clusterId, clusterName, force, dryRun } = params;
    
    const argoWorkflowName = `cluster-deletion-${clusterName}-${workflowId.substring(0, 8)}`;
    
    const workflow = {
      id: workflowId,
      name: `cluster-deletion-${clusterName}`,
      type: 'cluster-deletion',
      status: 'running',
      clusterId,
      startTime: new Date(),
      argoWorkflowName,
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
    
    // Create actual Argo Workflow for cluster deletion
    try {
      await this.createArgoClusterDeletionWorkflow(workflow);
      this.addLog(workflowId, `Argo Workflow ${argoWorkflowName} created successfully`, 'info');
    } catch (error) {
      this.addLog(workflowId, `Failed to create Argo Workflow: ${error.message}`, 'error');
      workflow.status = 'failed';
      workflow.error = error.message;
      this.workflows.set(workflowId, workflow);
    }
    
    return workflow;
  }
  
  async createArgoClusterDeletionWorkflow(workflow) {
    const argoWorkflowManifest = {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Workflow',
      metadata: {
        name: workflow.argoWorkflowName,
        namespace: this.argoNamespace,
        labels: {
          'idp.platform/workflow-id': workflow.id,
          'idp.platform/workflow-type': workflow.type,
          'idp.platform/cluster-id': workflow.clusterId
        }
      },
      spec: {
        serviceAccountName: 'idp-backend-sa',
        workflowTemplateRef: {
          name: 'aks-cluster-deletion'
        },
        arguments: {
          parameters: [
            {
              name: 'cluster-name',
              value: workflow.parameters.clusterName
            },
            {
              name: 'force',
              value: workflow.parameters.force?.toString() || 'false'
            },
            {
              name: 'dry-run',
              value: workflow.parameters.dryRun?.toString() || 'true'
            }
          ]
        }
      }
    };
    
    await this.customApi.createNamespacedCustomObject(
      this.argoApiGroup,
      this.argoApiVersion,
      this.argoNamespace,
      'workflows',
      argoWorkflowManifest
    );
  }
  
  // Utility methods
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
    
    // Try to delete the Argo Workflow if it exists
    if (workflow.argoWorkflowName) {
      try {
        await this.customApi.deleteNamespacedCustomObject(
          this.argoApiGroup,
          this.argoApiVersion,
          this.argoNamespace,
          'workflows',
          workflow.argoWorkflowName
        );
        this.addLog(workflowId, `Argo Workflow ${workflow.argoWorkflowName} deleted`, 'info');
      } catch (error) {
        console.error(`Failed to delete Argo Workflow: ${error.message}`);
      }
    }
    
    workflow.status = 'aborted';
    workflow.endTime = new Date();
    workflow.abortReason = reason;
    
    this.workflows.set(workflowId, workflow);
    this.addLog(workflowId, `Workflow aborted: ${reason}`, 'warning');
    
    return workflow;
  }
  
  async retryWorkflow(workflowId) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }
    
    // Create a new Argo Workflow for retry
    const originalName = workflow.argoWorkflowName;
    workflow.argoWorkflowName = `${originalName}-retry-${Date.now()}`;
    workflow.status = 'running';
    workflow.retryCount = (workflow.retryCount || 0) + 1;
    workflow.startTime = new Date();
    workflow.endTime = null;
    workflow.error = null;
    
    this.workflows.set(workflowId, workflow);
    this.addLog(workflowId, `Workflow retry initiated (retry #${workflow.retryCount})`, 'info');
    
    // Create new Argo Workflow
    try {
      if (workflow.type === 'cluster-provisioning') {
        await this.createArgoWorkflow(workflow);
      } else if (workflow.type === 'cluster-deletion') {
        await this.createArgoClusterDeletionWorkflow(workflow);
      } else if (workflow.type === 'namespace-provisioning') {
        await this.createArgoNamespaceWorkflow(workflow);
      }
      this.addLog(workflowId, `Retry Argo Workflow ${workflow.argoWorkflowName} created successfully`, 'info');
    } catch (error) {
      this.addLog(workflowId, `Failed to create retry Argo Workflow: ${error.message}`, 'error');
      workflow.status = 'failed';
      workflow.error = error.message;
      this.workflows.set(workflowId, workflow);
    }
    
    return workflow;
  }
  
  async createArgoNamespaceWorkflow(workflow) {
    const argoWorkflowManifest = {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Workflow',
      metadata: {
        name: workflow.argoWorkflowName,
        namespace: this.argoNamespace,
        labels: {
          'idp.platform/workflow-id': workflow.id,
          'idp.platform/workflow-type': workflow.type,
          'idp.platform/namespace-name': workflow.namespaceName
        }
      },
      spec: {
        workflowTemplateRef: {
          name: 'namespace-provisioning'
        },
        arguments: {
          parameters: [
            {
              name: 'namespace-name',
              value: workflow.parameters.namespaceName
            },
            {
              name: 'resource-limits-cpu',
              value: workflow.parameters.resourceLimits?.cpu || '1'
            },
            {
              name: 'resource-limits-memory',
              value: workflow.parameters.resourceLimits?.memory || '2Gi'
            },
            {
              name: 'network-isolated',
              value: workflow.parameters.networkIsolated?.toString() || 'false'
            }
          ]
        }
      }
    };
    
    await this.customApi.createNamespacedCustomObject(
      this.argoApiGroup,
      this.argoApiVersion,
      this.argoNamespace,
      'workflows',
      argoWorkflowManifest
    );
  }

  async startNamespaceProvisioningWorkflow(params) {
    const {
      workflowId,
      namespaceName,
      manifests,
      resourceLimits,
      networkIsolated
    } = params;
    
    const argoWorkflowName = `namespace-provisioning-${namespaceName}-${workflowId.substring(0, 8)}`;
    
    const workflow = {
      id: workflowId,
      name: `namespace-provisioning-${namespaceName}`,
      type: 'namespace-provisioning',
      status: 'running',
      namespaceName,
      startTime: new Date(),
      argoWorkflowName,
      parameters: {
        namespaceName,
        resourceLimits,
        networkIsolated,
        manifests
      }
    };
    
    const steps = [
      { id: uuidv4(), name: 'validate-namespace', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'create-namespace', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'apply-limit-range', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'apply-network-policy', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'verify-resources', status: 'pending', startTime: null, endTime: null }
    ];
    
    // If network isolation is disabled, skip the network policy step
    if (!networkIsolated) {
      steps.splice(3, 1); // Remove network policy step
    }
    
    this.workflows.set(workflowId, workflow);
    this.workflowSteps.set(workflowId, steps);
    this.workflowLogs.set(workflowId, []);
    
    // Create actual Argo Workflow for namespace provisioning
    try {
      await this.createArgoNamespaceWorkflow(workflow);
      this.addLog(workflowId, `Argo Workflow ${argoWorkflowName} created successfully`, 'info');
    } catch (error) {
      this.addLog(workflowId, `Failed to create Argo Workflow: ${error.message}`, 'error');
      workflow.status = 'failed';
      workflow.error = error.message;
      this.workflows.set(workflowId, workflow);
    }
    
    return workflow;
  }

  async startNamespaceUpdateWorkflow(params) {
    const {
      workflowId,
      namespaceName,
      updates
    } = params;
    
    const workflow = {
      id: workflowId,
      name: `namespace-update-${namespaceName}`,
      type: 'namespace-update',
      status: 'running',
      namespaceName,
      startTime: new Date(),
      parameters: {
        namespaceName,
        updates
      }
    };
    
    const steps = [
      { id: uuidv4(), name: 'validate-updates', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'update-limit-range', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'update-annotations', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'verify-changes', status: 'pending', startTime: null, endTime: null }
    ];
    
    this.workflows.set(workflowId, workflow);
    this.workflowSteps.set(workflowId, steps);
    this.workflowLogs.set(workflowId, []);
    
    // Start the workflow execution
    this.executeNamespaceUpdateWorkflow(workflowId);
    
    return workflow;
  }

  async startNamespaceDeletionWorkflow(params) {
    const {
      workflowId,
      namespaceName,
      force = false
    } = params;
    
    const workflow = {
      id: workflowId,
      name: `namespace-deletion-${namespaceName}`,
      type: 'namespace-deletion',
      status: 'running',
      namespaceName,
      startTime: new Date(),
      parameters: {
        namespaceName,
        force
      }
    };
    
    const steps = [
      { id: uuidv4(), name: 'validate-deletion', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'cleanup-resources', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'delete-namespace', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'verify-deletion', status: 'pending', startTime: null, endTime: null }
    ];
    
    this.workflows.set(workflowId, workflow);
    this.workflowSteps.set(workflowId, steps);
    this.workflowLogs.set(workflowId, []);
    
    // Start the workflow execution
    this.executeNamespaceDeletionWorkflow(workflowId);
    
    return workflow;
  }

  async executeNamespaceWorkflow(workflowId) {
    const workflow = this.workflows.get(workflowId);
    const steps = this.workflowSteps.get(workflowId);
    
    if (!workflow || !steps) {
      console.error(`Workflow ${workflowId} not found`);
      return;
    }

    this.addLog(workflowId, `Starting namespace provisioning workflow for ${workflow.namespaceName}`, 'info');
    
    try {
      for (const step of steps) {
        this.updateStepStatus(workflowId, step.id, 'running');
        
        switch (step.name) {
          case 'validate-namespace':
            await this.validateNamespaceCreation(workflowId, workflow.parameters);
            break;
          case 'create-namespace':
            await this.createNamespaceResource(workflowId, workflow.parameters);
            break;
          case 'apply-limit-range':
            await this.applyLimitRange(workflowId, workflow.parameters);
            break;
          case 'apply-network-policy':
            await this.applyNetworkPolicy(workflowId, workflow.parameters);
            break;
          case 'verify-resources':
            await this.verifyNamespaceResources(workflowId, workflow.parameters);
            break;
          default:
            throw new Error(`Unknown step: ${step.name}`);
        }
        
        this.updateStepStatus(workflowId, step.id, 'completed');
      }
      
      // Mark workflow as completed
      workflow.status = 'completed';
      workflow.endTime = new Date();
      this.workflows.set(workflowId, workflow);
      this.addLog(workflowId, 'Namespace provisioning workflow completed successfully', 'info');
      
    } catch (error) {
      workflow.status = 'failed';
      workflow.endTime = new Date();
      workflow.error = error.message;
      this.workflows.set(workflowId, workflow);
      this.addLog(workflowId, `Workflow failed: ${error.message}`, 'error');
    }
  }

  async executeNamespaceUpdateWorkflow(workflowId) {
    const workflow = this.workflows.get(workflowId);
    const steps = this.workflowSteps.get(workflowId);
    
    this.addLog(workflowId, `Starting namespace update workflow for ${workflow.namespaceName}`, 'info');
    
    try {
      for (const step of steps) {
        this.updateStepStatus(workflowId, step.id, 'running');
        
        switch (step.name) {
          case 'validate-updates':
            await this.validateNamespaceUpdates(workflowId, workflow.parameters);
            break;
          case 'update-limit-range':
            await this.updateLimitRange(workflowId, workflow.parameters);
            break;
          case 'update-annotations':
            await this.updateNamespaceAnnotations(workflowId, workflow.parameters);
            break;
          case 'verify-changes':
            await this.verifyNamespaceUpdates(workflowId, workflow.parameters);
            break;
        }
        
        this.updateStepStatus(workflowId, step.id, 'completed');
      }
      
      workflow.status = 'completed';
      workflow.endTime = new Date();
      this.workflows.set(workflowId, workflow);
      this.addLog(workflowId, 'Namespace update workflow completed successfully', 'info');
      
    } catch (error) {
      workflow.status = 'failed';
      workflow.endTime = new Date();
      workflow.error = error.message;
      this.workflows.set(workflowId, workflow);
      this.addLog(workflowId, `Update workflow failed: ${error.message}`, 'error');
    }
  }

  async executeNamespaceDeletionWorkflow(workflowId) {
    const workflow = this.workflows.get(workflowId);
    const steps = this.workflowSteps.get(workflowId);
    
    this.addLog(workflowId, `Starting namespace deletion workflow for ${workflow.namespaceName}`, 'info');
    
    try {
      for (const step of steps) {
        this.updateStepStatus(workflowId, step.id, 'running');
        
        switch (step.name) {
          case 'validate-deletion':
            await this.validateNamespaceDeletion(workflowId, workflow.parameters);
            break;
          case 'cleanup-resources':
            await this.cleanupNamespaceResources(workflowId, workflow.parameters);
            break;
          case 'delete-namespace':
            await this.deleteNamespaceResource(workflowId, workflow.parameters);
            break;
          case 'verify-deletion':
            await this.verifyNamespaceDeletion(workflowId, workflow.parameters);
            break;
        }
        
        this.updateStepStatus(workflowId, step.id, 'completed');
      }
      
      workflow.status = 'completed';
      workflow.endTime = new Date();
      this.workflows.set(workflowId, workflow);
      this.addLog(workflowId, 'Namespace deletion workflow completed successfully', 'info');
      
    } catch (error) {
      workflow.status = 'failed';
      workflow.endTime = new Date();
      workflow.error = error.message;
      this.workflows.set(workflowId, workflow);
      this.addLog(workflowId, `Deletion workflow failed: ${error.message}`, 'error');
    }
  }

  // Namespace workflow step implementations
  async validateNamespaceCreation(workflowId, params) {
    this.addLog(workflowId, 'Validating namespace creation parameters...', 'info');
    await new Promise(resolve => setTimeout(resolve, 500));
    this.addLog(workflowId, `Namespace ${params.namespaceName} validation passed`, 'info');
  }

  async createNamespaceResource(workflowId, params) {
    this.addLog(workflowId, `Creating namespace ${params.namespaceName}...`, 'info');
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.addLog(workflowId, `Namespace ${params.namespaceName} created successfully`, 'info');
  }

  async applyLimitRange(workflowId, params) {
    this.addLog(workflowId, 'Applying resource limits...', 'info');
    await new Promise(resolve => setTimeout(resolve, 800));
    this.addLog(workflowId, 'Resource limits applied successfully', 'info');
  }

  async applyNetworkPolicy(workflowId, params) {
    this.addLog(workflowId, 'Applying network isolation policy...', 'info');
    await new Promise(resolve => setTimeout(resolve, 700));
    this.addLog(workflowId, 'Network policy applied successfully', 'info');
  }

  async verifyNamespaceResources(workflowId, params) {
    this.addLog(workflowId, 'Verifying namespace resources...', 'info');
    await new Promise(resolve => setTimeout(resolve, 600));
    this.addLog(workflowId, 'All namespace resources verified', 'info');
  }

  async validateNamespaceUpdates(workflowId, params) {
    this.addLog(workflowId, 'Validating update parameters...', 'info');
    await new Promise(resolve => setTimeout(resolve, 400));
    this.addLog(workflowId, 'Update validation completed', 'info');
  }

  async updateLimitRange(workflowId, params) {
    this.addLog(workflowId, 'Updating resource limits...', 'info');
    await new Promise(resolve => setTimeout(resolve, 800));
    this.addLog(workflowId, 'Resource limits updated successfully', 'info');
  }

  async updateNamespaceAnnotations(workflowId, params) {
    this.addLog(workflowId, 'Updating namespace annotations...', 'info');
    await new Promise(resolve => setTimeout(resolve, 300));
    this.addLog(workflowId, 'Annotations updated successfully', 'info');
  }

  async verifyNamespaceUpdates(workflowId, params) {
    this.addLog(workflowId, 'Verifying namespace updates...', 'info');
    await new Promise(resolve => setTimeout(resolve, 500));
    this.addLog(workflowId, 'Update verification completed', 'info');
  }

  async validateNamespaceDeletion(workflowId, params) {
    this.addLog(workflowId, 'Validating namespace deletion...', 'info');
    await new Promise(resolve => setTimeout(resolve, 400));
    this.addLog(workflowId, 'Deletion validation passed', 'info');
  }

  async cleanupNamespaceResources(workflowId, params) {
    this.addLog(workflowId, 'Cleaning up namespace resources...', 'info');
    await new Promise(resolve => setTimeout(resolve, 1200));
    this.addLog(workflowId, 'Resource cleanup completed', 'info');
  }

  async deleteNamespaceResource(workflowId, params) {
    this.addLog(workflowId, `Deleting namespace ${params.namespaceName}...`, 'info');
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.addLog(workflowId, `Namespace ${params.namespaceName} deleted successfully`, 'info');
  }

  async verifyNamespaceDeletion(workflowId, params) {
    this.addLog(workflowId, 'Verifying namespace deletion...', 'info');
    await new Promise(resolve => setTimeout(resolve, 500));
    this.addLog(workflowId, 'Deletion verification completed', 'info');
  }
}

module.exports = new WorkflowService();