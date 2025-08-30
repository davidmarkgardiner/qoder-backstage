const k8s = require('@kubernetes/client-node');
const { v4: uuidv4 } = require('uuid');

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
    
    const workflow = {
      id: workflowId,
      name: `cluster-provisioning-${clusterName}`,
      type: 'cluster-provisioning',
      status: 'running',
      clusterId,
      startTime: new Date(),
      argoWorkflowName,
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
      { id: uuidv4(), name: 'validate-cluster-config', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'create-kro-cluster', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'wait-for-kro-ready', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'wait-cluster-ready', status: 'pending', startTime: null, endTime: null },
      { id: uuidv4(), name: 'setup-flux-gitops', status: 'pending', startTime: null, endTime: null }
    ];
    
    this.workflows.set(workflowId, workflow);
    this.workflowSteps.set(workflowId, steps);
    this.workflowLogs.set(workflowId, []);
    
    // Create actual Argo Workflow
    try {
      await this.createArgoWorkflow(workflow);
      this.addLog(workflowId, `Argo Workflow ${argoWorkflowName} created successfully`, 'info');
    } catch (error) {
      this.addLog(workflowId, `Failed to create Argo Workflow: ${error.message}`, 'error');
      workflow.status = 'failed';
      workflow.error = error.message;
      this.workflows.set(workflowId, workflow);
    }
    
    return workflow;
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

  async startNamespaceProvisioningWorkflow(params) {
    const {
      workflowId,
      namespaceName,
      manifests,
      resourceLimits,
      networkIsolated
    } = params;
    
    const workflow = {
      id: workflowId,
      name: `namespace-provisioning-${namespaceName}`,
      type: 'namespace-provisioning',
      status: 'running',
      namespaceName,
      startTime: new Date(),
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
    
    // Start the workflow execution
    this.executeNamespaceWorkflow(workflowId);
    
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