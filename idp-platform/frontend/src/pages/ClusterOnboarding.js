import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Grid,
  Paper,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CloudUpload as CloudUploadIcon,
  Preview as PreviewIcon
} from '@mui/icons-material';
import { fetchLocations, fetchNodePoolTypes } from '../store/azureSlice';
import { createCluster } from '../store/clustersSlice';
import JsonView from '@uiw/react-json-view';

const ClusterOnboarding = () => {
  const dispatch = useDispatch();
  const { locations, nodePoolTypes, recommendations } = useSelector(state => state.azure);
  const { creating, error } = useSelector(state => state.clusters);
  
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    nodePoolType: '',
    dryRun: true,
    enableNAP: true,
    advancedConfig: {
      kubernetesVersion: '',
      maxNodes: 10,
      enableSpot: false
    }
  });
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  useEffect(() => {
    dispatch(fetchLocations());
    dispatch(fetchNodePoolTypes());
  }, [dispatch]);
  
  const handleInputChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleAdvancedChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setFormData(prev => ({
      ...prev,
      advancedConfig: {
        ...prev.advancedConfig,
        [field]: value
      }
    }));
  };
  
  const handleSubmit = (event) => {
    event.preventDefault();
    dispatch(createCluster(formData));
  };
  
  const isFormValid = () => {
    return formData.name && 
           formData.location && 
           formData.nodePoolType &&
           isClusterNameValid(formData.name);
  };
  
  const isClusterNameValid = (name) => {
    if (!name || name.length < 3 || name.length > 30) {
      return false;
    }
    // Must start and end with alphanumeric, can contain hyphens
    const validPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
    return validPattern.test(name);
  };
  
  const getClusterNameError = () => {
    if (!formData.name) return '';
    if (formData.name.length < 3) return 'Name too short (minimum 3 characters)';
    if (formData.name.length > 30) return 'Name too long (maximum 30 characters)';
    if (!isClusterNameValid(formData.name)) {
      return 'Name must start and end with alphanumeric characters, hyphens allowed in middle';
    }
    return '';
  };
  
  const getSelectedNodePoolType = () => {
    return nodePoolTypes.find(type => type.name === formData.nodePoolType);
  };
  
  const getSelectedLocation = () => {
    return locations.find(loc => loc.name === formData.location);
  };
  
  const getRecommendation = () => {
    return recommendations.find(rec => rec.nodePoolType === formData.nodePoolType);
  };
  
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        AKS Cluster Onboarding
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Deploy a new Azure Kubernetes Service cluster with Node Auto Provisioning
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader
              title="Cluster Configuration"
              avatar={<CloudUploadIcon />}
            />
            <CardContent>
              <form onSubmit={handleSubmit}>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Cluster Name"
                      value={formData.name}
                      onChange={handleInputChange('name')}
                      required
                      error={!!getClusterNameError()}
                      helperText={getClusterNameError() || "Must be 3-30 characters, alphanumeric with hyphens allowed (e.g., my-cluster-name)"}
                      data-testid="cluster-name-input"
                    />
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth required>
                      <InputLabel>Azure Region</InputLabel>
                      <Select
                        value={formData.location}
                        onChange={handleInputChange('location')}
                        label="Azure Region"
                        data-testid="location-select"
                      >
                        {locations.filter(loc => loc.recommended).map(location => (
                          <MenuItem key={location.name} value={location.name}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {location.displayName}
                              <Chip label="Recommended" size="small" color="primary" />
                            </Box>
                          </MenuItem>
                        ))}
                        <Divider />
                        {locations.filter(loc => !loc.recommended).map(location => (
                          <MenuItem key={location.name} value={location.name}>
                            {location.displayName}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth required>
                      <InputLabel>Node Pool Type</InputLabel>
                      <Select
                        value={formData.nodePoolType}
                        onChange={handleInputChange('nodePoolType')}
                        label="Node Pool Type"
                        data-testid="node-pool-type-select"
                      >
                        {nodePoolTypes.map(type => (
                          <MenuItem key={type.name} value={type.name}>
                            <Box>
                              <Typography variant="body1">{type.displayName}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {type.description}
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={formData.dryRun}
                            onChange={handleInputChange('dryRun')}
                            color="warning"
                            data-testid="dry-run-switch"
                          />
                        }
                        label="Dry Run Mode"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={formData.enableNAP}
                            onChange={handleInputChange('enableNAP')}
                            color="primary"
                            data-testid="enable-nap-switch"
                          />
                        }
                        label="Enable Node Auto Provisioning"
                      />
                    </Box>
                    {formData.dryRun && (
                      <Alert severity="info" sx={{ mt: 1 }}>
                        Dry run mode will validate your configuration without creating actual Azure resources.
                      </Alert>
                    )}
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Accordion expanded={showAdvanced} onChange={() => setShowAdvanced(!showAdvanced)} data-testid="advanced-config-accordion">
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography>Advanced Configuration</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth
                              label="Kubernetes Version"
                              value={formData.advancedConfig.kubernetesVersion}
                              onChange={handleAdvancedChange('kubernetesVersion')}
                              placeholder="e.g., 1.28.3"
                              helperText="Leave empty for latest stable version"
                              data-testid="kubernetes-version-input"
                            />
                          </Grid>
                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth
                              type="number"
                              label="Max Nodes"
                              value={formData.advancedConfig.maxNodes}
                              onChange={handleAdvancedChange('maxNodes')}
                              inputProps={{ min: 1, max: 100 }}
                              data-testid="max-nodes-input"
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={formData.advancedConfig.enableSpot}
                                  onChange={handleAdvancedChange('enableSpot')}
                                  data-testid="enable-spot-switch"
                                />
                              }
                              label="Enable Spot Instances (Cost Optimization)"
                            />
                          </Grid>
                        </Grid>
                      </AccordionDetails>
                    </Accordion>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={!isFormValid() || creating}
                        startIcon={creating ? <CircularProgress size={20} /> : <CloudUploadIcon />}
                        data-testid="submit-cluster-button"
                      >
                        {creating ? 'Creating...' : (formData.dryRun ? 'Validate Configuration' : 'Create Cluster')}
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => setShowPreview(!showPreview)}
                        startIcon={<PreviewIcon />}
                        disabled={!isFormValid()}
                        data-testid="preview-config-button"
                      >
                        Preview Configuration
                      </Button>
                    </Box>
                  </Grid>
                  
                  {error && (
                    <Grid item xs={12}>
                      <Alert severity="error">
                        <strong>Error creating cluster:</strong><br />
                        {error}
                      </Alert>
                    </Grid>
                  )}
                </Grid>
              </form>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Location Info */}
            {getSelectedLocation() && (
              <Card>
                <CardHeader title="Selected Region" />
                <CardContent>
                  <Typography variant="h6">{getSelectedLocation().displayName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {getSelectedLocation().description}
                  </Typography>
                  {getSelectedLocation().recommended && (
                    <Chip label="Recommended" size="small" color="primary" sx={{ mt: 1 }} />
                  )}
                </CardContent>
              </Card>
            )}
            
            {/* Node Pool Type Info */}
            {getSelectedNodePoolType() && (
              <Card>
                <CardHeader title="Node Pool Configuration" />
                <CardContent>
                  <Typography variant="h6">{getSelectedNodePoolType().displayName}</Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {getSelectedNodePoolType().description}
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" display="block">Default VM Size:</Typography>
                    <Typography variant="body2">{getSelectedNodePoolType().defaultVmSize}</Typography>
                    
                    <Typography variant="caption" display="block" sx={{ mt: 1 }}>NAP Support:</Typography>
                    <Chip 
                      label={getSelectedNodePoolType().napSupported ? 'Supported' : 'Not Supported'} 
                      size="small" 
                      color={getSelectedNodePoolType().napSupported ? 'success' : 'default'}
                    />
                    
                    <Typography variant="caption" display="block" sx={{ mt: 1 }}>Cost Tier:</Typography>
                    <Chip 
                      label={getSelectedNodePoolType().costTier} 
                      size="small" 
                      color={getSelectedNodePoolType().costTier === 'low' ? 'success' : 'warning'}
                    />
                  </Box>
                </CardContent>
              </Card>
            )}
            
            {/* Recommendations */}
            {getRecommendation() && (
              <Card>
                <CardHeader title="Recommendations" />
                <CardContent>
                  <Typography variant="body2" gutterBottom>
                    <strong>Best for:</strong> {getRecommendation().useCase}
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="success.main">Pros:</Typography>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {getRecommendation().pros.map((pro, index) => (
                        <li key={index}>
                          <Typography variant="body2">{pro}</Typography>
                        </li>
                      ))}
                    </ul>
                  </Box>
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="warning.main">Cons:</Typography>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {getRecommendation().cons.map((con, index) => (
                        <li key={index}>
                          <Typography variant="body2">{con}</Typography>
                        </li>
                      ))}
                    </ul>
                  </Box>
                </CardContent>
              </Card>
            )}
          </Box>
        </Grid>
        
        {/* Configuration Preview */}
        {showPreview && isFormValid() && (
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Configuration Preview" />
              <CardContent>
                <JsonView 
                  value={formData} 
                  style={{ 
                    backgroundColor: '#f5f5f5',
                    padding: '16px',
                    borderRadius: '4px'
                  }}
                  data-testid="config-preview"
                />
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default ClusterOnboarding;