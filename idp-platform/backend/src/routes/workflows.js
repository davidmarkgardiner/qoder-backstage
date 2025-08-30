const express = require('express');
const WorkflowService = require('../services/workflowService');

const router = express.Router();

// GET /api/workflows/:id - Get workflow details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const workflow = await WorkflowService.getWorkflow(id);
    
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    
    const steps = await WorkflowService.getWorkflowSteps(id);
    const logs = await WorkflowService.getWorkflowLogs(id);
    
    res.json({
      workflow,
      steps,
      logs
    });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    res.status(500).json({ error: 'Failed to fetch workflow details' });
  }
});

// POST /api/workflows/:id/abort - Abort workflow
router.post('/:id/abort', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const result = await WorkflowService.abortWorkflow(id, reason);
    
    res.json({
      message: 'Workflow abort initiated',
      workflow: result
    });
  } catch (error) {
    console.error('Error aborting workflow:', error);
    res.status(500).json({ error: 'Failed to abort workflow' });
  }
});

// POST /api/workflows/:id/retry - Retry workflow
router.post('/:id/retry', async (req, res) => {
  try {
    const { id } = req.params;
    const { fromStep } = req.body;
    
    const result = await WorkflowService.retryWorkflow(id, fromStep);
    
    res.json({
      message: 'Workflow retry initiated',
      workflow: result
    });
  } catch (error) {
    console.error('Error retrying workflow:', error);
    res.status(500).json({ error: 'Failed to retry workflow' });
  }
});

// GET /api/workflows - List workflows
router.get('/', async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    const workflows = await WorkflowService.getWorkflows({ status, limit: parseInt(limit) });
    
    res.json({
      workflows,
      total: workflows.length
    });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

module.exports = router;