const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const ClusterService = require('../services/clusterService');
const WorkflowService = require('../services/workflowService');

const router = express.Router();

// Validation schemas
const createClusterSchema = Joi.object({
  name: Joi.string().pattern(/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/).min(3).max(30).required().messages({
    'string.pattern.base': 'Cluster name must start and end with alphanumeric characters and can contain hyphens',
    'string.min': 'Cluster name must be at least 3 characters long',
    'string.max': 'Cluster name must be at most 30 characters long'
  }),
  location: Joi.string().valid('eastus', 'westus2', 'uksouth', 'westeurope', 'centralus').required(),
  nodePoolType: Joi.string().valid('standard', 'memory-optimized', 'compute-optimized').required(),
  dryRun: Joi.boolean().default(true),
  enableNAP: Joi.boolean().default(true),
  advancedConfig: Joi.object({
    kubernetesVersion: Joi.string().optional(),
    maxNodes: Joi.number().min(1).max(100).optional(),
    enableSpot: Joi.boolean().optional()
  }).optional()
});

// GET /api/clusters - List all clusters
router.get('/', async (req, res) => {
  try {
    const clusters = await ClusterService.getClusters();
    res.json({
      clusters,
      total: clusters.length
    });
  } catch (error) {
    console.error('Error fetching clusters:', error);
    res.status(500).json({ error: 'Failed to fetch clusters' });
  }
});

// GET /api/clusters/:id - Get specific cluster details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cluster = await ClusterService.getCluster(id);
    
    if (!cluster) {
      return res.status(404).json({ error: 'Cluster not found' });
    }
    
    const workflow = await WorkflowService.getWorkflow(cluster.workflowId);
    const resources = await ClusterService.getClusterResources(id);
    
    res.json({
      cluster,
      workflow,
      resources
    });
  } catch (error) {
    console.error('Error fetching cluster:', error);
    res.status(500).json({ error: 'Failed to fetch cluster details' });
  }
});

// POST /api/clusters - Create new cluster
router.post('/', async (req, res) => {
  try {
    const { error, value } = createClusterSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details 
      });
    }
    
    const clusterId = uuidv4();
    const workflowId = uuidv4();
    
    // Create cluster record
    const cluster = await ClusterService.createCluster({
      id: clusterId,
      workflowId,
      ...value,
      status: 'provisioning',
      createdAt: new Date()
    });
    
    // Start workflow
    const workflow = await WorkflowService.startClusterProvisioningWorkflow({
      workflowId,
      clusterId,
      clusterName: value.name,
      location: value.location,
      nodePoolType: value.nodePoolType,
      dryRun: value.dryRun,
      enableNAP: value.enableNAP,
      advancedConfig: value.advancedConfig || {}
    });
    
    res.status(201).json({
      cluster,
      workflow,
      message: value.dryRun ? 'Dry run workflow started' : 'Cluster provisioning started'
    });
    
  } catch (error) {
    console.error('Error creating cluster:', error);
    res.status(500).json({ error: 'Failed to create cluster' });
  }
});

// DELETE /api/clusters/:id - Delete cluster
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { force = false, dryRun = true } = req.query;
    
    const cluster = await ClusterService.getCluster(id);
    if (!cluster) {
      return res.status(404).json({ error: 'Cluster not found' });
    }
    
    // Start deletion workflow
    const deletionWorkflowId = uuidv4();
    const deletionWorkflow = await WorkflowService.startClusterDeletionWorkflow({
      workflowId: deletionWorkflowId,
      clusterId: id,
      clusterName: cluster.name,
      force,
      dryRun
    });
    
    res.json({
      message: dryRun ? 'Dry run deletion started' : 'Cluster deletion started',
      workflow: deletionWorkflow
    });
    
  } catch (error) {
    console.error('Error deleting cluster:', error);
    res.status(500).json({ error: 'Failed to delete cluster' });
  }
});

module.exports = router;