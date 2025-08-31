const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const NamespaceService = require('../services/namespaceService');
const WorkflowService = require('../services/workflowService');

const router = express.Router();

// Validation schemas
const createNamespaceSchema = Joi.object({
  name: Joi.string().pattern(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/).min(3).max(63).required().messages({
    'string.pattern.base': 'Namespace name must be lowercase alphanumeric with hyphens, starting and ending with alphanumeric',
    'string.min': 'Namespace name must be at least 3 characters long',
    'string.max': 'Namespace name must be at most 63 characters long'
  }),
  description: Joi.string().max(255).optional().allow(''),
  resourceLimits: Joi.object({
    cpu: Joi.object({
      request: Joi.string().pattern(/^(\d+(?:\.\d+)?)(m)?$/).required().messages({
        'string.pattern.base': 'CPU request must be a valid Kubernetes resource value (e.g., 100m, 1)'
      }),
      limit: Joi.string().pattern(/^(\d+(?:\.\d+)?)(m)?$/).required().messages({
        'string.pattern.base': 'CPU limit must be a valid Kubernetes resource value (e.g., 1000m, 2)'
      })
    }).required(),
    memory: Joi.object({
      request: Joi.string().pattern(/^(\d+(?:\.\d+)?)(Mi|Gi)?$/).required().messages({
        'string.pattern.base': 'Memory request must be a valid Kubernetes resource value (e.g., 128Mi, 1Gi)'
      }),
      limit: Joi.string().pattern(/^(\d+(?:\.\d+)?)(Mi|Gi)?$/).required().messages({
        'string.pattern.base': 'Memory limit must be a valid Kubernetes resource value (e.g., 1Gi, 2Gi)'
      })
    }).required()
  }).required(),
  networkIsolated: Joi.boolean().default(true),
  dryRun: Joi.boolean().default(false)
});

const updateNamespaceSchema = Joi.object({
  description: Joi.string().max(255).optional().allow(''),
  resourceLimits: Joi.object({
    cpu: Joi.object({
      request: Joi.string().pattern(/^(\d+(?:\.\d+)?)(m)?$/),
      limit: Joi.string().pattern(/^(\d+(?:\.\d+)?)(m)?$/)
    }),
    memory: Joi.object({
      request: Joi.string().pattern(/^(\d+(?:\.\d+)?)(Mi|Gi)?$/),
      limit: Joi.string().pattern(/^(\d+(?:\.\d+)?)(Mi|Gi)?$/)
    })
  }).optional()
});

// GET /api/namespaces - List all namespaces
router.get('/', async (req, res) => {
  try {
    const namespaces = await NamespaceService.getNamespaces();
    res.json({
      namespaces,
      total: namespaces.length
    });
  } catch (error) {
    console.error('Error fetching namespaces:', error);
    res.status(500).json({ error: 'Failed to fetch namespaces' });
  }
});

// GET /api/namespaces/:name - Get specific namespace details
router.get('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const namespace = await NamespaceService.getNamespace(name);
    
    if (!namespace) {
      return res.status(404).json({ error: 'Namespace not found' });
    }
    
    res.json({ namespace });
  } catch (error) {
    console.error('Error fetching namespace:', error);
    res.status(500).json({ error: 'Failed to fetch namespace details' });
  }
});

// POST /api/namespaces - Create new namespace
router.post('/', async (req, res) => {
  try {
    const { error, value } = createNamespaceSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details 
      });
    }

    // Additional validation for resource limits
    try {
      NamespaceService.validateResourceLimits(value.resourceLimits);
    } catch (validationError) {
      return res.status(400).json({
        error: 'Resource limit validation failed',
        message: validationError.message
      });
    }
    
    const workflowId = uuidv4();
    
    // Create namespace with manifests
    const result = await NamespaceService.createNamespace(value);
    
    if (value.dryRun) {
      // Return manifests for preview without creating workflow
      res.json({
        namespace: result.namespace,
        manifests: result.manifests,
        dryRun: true,
        message: 'Dry run completed - no resources were created'
      });
    } else {
      // Start provisioning workflow
      const workflow = await WorkflowService.startNamespaceProvisioningWorkflow({
        workflowId,
        namespaceName: value.name,
        manifests: result.manifests,
        resourceLimits: value.resourceLimits,
        networkIsolated: value.networkIsolated
      });

      res.status(202).json({
        namespace: result.namespace,
        workflow,
        message: 'Namespace provisioning started'
      });
    }
  } catch (error) {
    console.error('Error creating namespace:', error);
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to create namespace' });
  }
});

// PATCH /api/namespaces/:name - Update namespace
router.patch('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { error, value } = updateNamespaceSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details 
      });
    }

    const namespace = await NamespaceService.getNamespace(name);
    if (!namespace) {
      return res.status(404).json({ error: 'Namespace not found' });
    }

    // Validate resource limits if provided
    if (value.resourceLimits) {
      try {
        NamespaceService.validateResourceLimits(value.resourceLimits);
      } catch (validationError) {
        return res.status(400).json({
          error: 'Resource limit validation failed',
          message: validationError.message
        });
      }
    }

    // Start update workflow
    const workflowId = uuidv4();
    const workflow = await WorkflowService.startNamespaceUpdateWorkflow({
      workflowId,
      namespaceName: name,
      updates: value
    });

    res.json({
      namespace: name,
      workflow,
      message: 'Namespace update started'
    });
  } catch (error) {
    console.error('Error updating namespace:', error);
    res.status(500).json({ error: 'Failed to update namespace' });
  }
});

// DELETE /api/namespaces/:name - Delete namespace
router.delete('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { force = false, dryRun = false } = req.query;

    const namespace = await NamespaceService.getNamespace(name);
    if (!namespace) {
      return res.status(404).json({ error: 'Namespace not found' });
    }

    if (dryRun === 'true') {
      res.json({
        namespace: name,
        dryRun: true,
        message: 'Dry run - namespace would be deleted',
        resources: [
          `Namespace: ${name}`,
          `LimitRange: resource-limits`,
          `NetworkPolicy: namespace-isolation`
        ]
      });
    } else {
      // Start deletion workflow
      const workflowId = uuidv4();
      const workflow = await WorkflowService.startNamespaceDeletionWorkflow({
        workflowId,
        namespaceName: name,
        force: force === 'true'
      });

      const result = await NamespaceService.deleteNamespace(name, force === 'true');

      res.json({
        ...result,
        workflow,
        message: 'Namespace deletion started'
      });
    }
  } catch (error) {
    console.error('Error deleting namespace:', error);
    res.status(500).json({ error: 'Failed to delete namespace' });
  }
});

// GET /api/namespaces/:name/manifests - Get generated manifests for namespace
router.get('/:name/manifests', async (req, res) => {
  try {
    const { name } = req.params;
    const namespace = await NamespaceService.getNamespace(name);
    
    if (!namespace) {
      return res.status(404).json({ error: 'Namespace not found' });
    }

    const manifests = {
      namespace: NamespaceService.generateNamespaceManifest(name, namespace.description),
      limitRange: NamespaceService.generateLimitRangeManifest(name, namespace.resourceLimits),
      networkPolicy: namespace.networkIsolated ? 
        NamespaceService.generateNetworkPolicyManifest(name) : null
    };

    res.json({ manifests });
  } catch (error) {
    console.error('Error generating manifests:', error);
    res.status(500).json({ error: 'Failed to generate manifests' });
  }
});

// GET /api/namespaces/:name/status - Get namespace status and health
router.get('/:name/status', async (req, res) => {
  try {
    const { name } = req.params;
    const namespace = await NamespaceService.getNamespace(name);
    
    if (!namespace) {
      return res.status(404).json({ error: 'Namespace not found' });
    }

    // TODO: Add actual health checks for resources
    const status = {
      namespace: namespace.status || 'Unknown',
      resources: {
        limitRange: 'Active',
        networkPolicy: namespace.networkIsolated ? 'Active' : 'Not Applied'
      },
      health: 'Healthy',
      lastChecked: new Date().toISOString()
    };

    res.json({ status });
  } catch (error) {
    console.error('Error fetching namespace status:', error);
    res.status(500).json({ error: 'Failed to fetch namespace status' });
  }
});

module.exports = router;