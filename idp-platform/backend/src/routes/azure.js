const express = require('express');
const AzureService = require('../services/azureService');

const router = express.Router();

// GET /api/azure/locations - Get available Azure locations
router.get('/locations', async (req, res) => {
  try {
    const locations = await AzureService.getAvailableLocations();
    
    res.json({
      locations
    });
  } catch (error) {
    console.error('Error fetching Azure locations:', error);
    res.status(500).json({ error: 'Failed to fetch Azure locations' });
  }
});

// GET /api/azure/node-pool-types - Get available node pool types with NAP info
router.get('/node-pool-types', async (req, res) => {
  try {
    const nodePoolTypes = await AzureService.getNodePoolTypes();
    const recommendations = await AzureService.getNodePoolRecommendations();
    
    res.json({
      nodePoolTypes,
      recommendations
    });
  } catch (error) {
    console.error('Error fetching node pool types:', error);
    res.status(500).json({ error: 'Failed to fetch node pool types' });
  }
});

// GET /api/azure/vm-sizes - Get available VM sizes for location
router.get('/vm-sizes', async (req, res) => {
  try {
    const { location } = req.query;
    
    if (!location) {
      return res.status(400).json({ error: 'Location parameter is required' });
    }
    
    const vmSizes = await AzureService.getVMSizes(location);
    
    res.json({
      location,
      vmSizes
    });
  } catch (error) {
    console.error('Error fetching VM sizes:', error);
    res.status(500).json({ error: 'Failed to fetch VM sizes' });
  }
});

module.exports = router;