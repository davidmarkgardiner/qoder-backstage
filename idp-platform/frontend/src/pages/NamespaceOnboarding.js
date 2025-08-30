import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  FormControl,
  InputLabel,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Grid,
  Paper,
  Typography,
  Alert,
  CircularProgress,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Slider,
  InputAdornment,
  Chip,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Preview as PreviewIcon,
  PlayArrow as PlayArrowIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import JsonView from '@uiw/react-json-view';

import {
  fetchNamespaces,
  createNamespace,
  deleteNamespace,
  updateFormData,
  updateResourceLimits,
  resetForm,
  clearErrors,
  selectNamespaces,
  selectNamespacesLoading,
  selectFormData,
  selectCreating,
  selectCreateError,
  selectNamespaceManifests
} from '../store/namespacesSlice';

const NamespaceOnboarding = () => {
  const dispatch = useDispatch();
  const namespaces = useSelector(selectNamespaces);
  const namespacesLoading = useSelector(selectNamespacesLoading);
  const formData = useSelector(selectFormData);
  const creating = useSelector(selectCreating);
  const createError = useSelector(selectCreateError);
  
  const [activeTab, setActiveTab] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [previewManifests, setPreviewManifests] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [namespaceToDelete, setNamespaceToDelete] = useState(null);

  useEffect(() => {
    dispatch(fetchNamespaces());
  }, [dispatch]);

  useEffect(() => {
    // Clear errors after 5 seconds
    if (createError) {
      const timer = setTimeout(() => {
        dispatch(clearErrors());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [createError, dispatch]);

  const handleInputChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    dispatch(updateFormData({ [field]: value }));
  };

  const handleResourceLimitChange = (resource, type) => (event, newValue) => {
    const value = typeof newValue === 'number' ? `${newValue}${getResourceUnit(resource, type)}` : event.target.value;
    dispatch(updateResourceLimits({
      [resource]: {
        ...formData.resourceLimits[resource],
        [type]: value
      }
    }));
  };

  const getResourceUnit = (resource, type) => {
    if (resource === 'cpu') {
      return type === 'request' ? 'm' : 'm';
    }
    return type === 'request' ? 'Mi' : 'Gi';
  };

  const parseResourceValue = (value) => {
    const match = value.match(/^(\d+(?:\.\d+)?)(.*)?$/);
    return match ? parseFloat(match[1]) : 0;
  };

  const handleSubmit = async (dryRun = false) => {
    const submitData = { ...formData, dryRun };
    
    if (dryRun) {
      // For preview, dispatch and handle the preview manifests
      try {
        const result = await dispatch(createNamespace(submitData)).unwrap();
        setPreviewManifests(result.manifests);
        setShowPreview(true);
      } catch (error) {
        // Error is handled by the reducer
      }
    } else {
      // For actual creation
      try {
        await dispatch(createNamespace(submitData)).unwrap();
        dispatch(resetForm());
        dispatch(fetchNamespaces()); // Refresh the list
        setActiveTab(1); // Switch to namespace list tab
      } catch (error) {
        // Error is handled by the reducer
      }
    }
  };

  const handleDelete = async (namespaceName, force = false) => {
    try {
      await dispatch(deleteNamespace({ name: namespaceName, force })).unwrap();
      dispatch(fetchNamespaces()); // Refresh the list
      setDeleteDialogOpen(false);
      setNamespaceToDelete(null);
    } catch (error) {
      // Error is handled by the reducer
    }
  };

  const isFormValid = () => {
    return formData.name && 
           formData.name.length >= 3 && 
           formData.name.length <= 63 &&
           /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(formData.name) &&
           formData.resourceLimits.cpu.request &&
           formData.resourceLimits.cpu.limit &&
           formData.resourceLimits.memory.request &&
           formData.resourceLimits.memory.limit;
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'healthy':
        return 'success';
      case 'pending':
      case 'creating':
        return 'warning';
      case 'failed':
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'healthy':
        return <CheckCircleIcon />;
      case 'pending':
      case 'creating':
        return <WarningIcon />;
      case 'failed':
      case 'error':
        return <ErrorIcon />;
      default:
        return <InfoIcon />;
    }
  };

  const NamespaceForm = () => (
    <Card>
      <CardHeader title="Create New Namespace" />
      <CardContent>
        {createError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {createError}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Namespace Name"
              value={formData.name}
              onChange={handleInputChange('name')}
              error={formData.name && (formData.name.length < 3 || formData.name.length > 63 || !/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(formData.name))}
              helperText={
                formData.name && (formData.name.length < 3 || formData.name.length > 63)
                  ? "Name must be 3-63 characters long"
                  : formData.name && !/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(formData.name)
                  ? "Name must be lowercase alphanumeric with hyphens"
                  : "Unique identifier for the namespace"
              }
              required
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={handleInputChange('description')}
              helperText="Optional description for the namespace"
              multiline
              rows={2}
            />
          </Grid>

          {/* Resource Limits */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Resource Limits
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                CPU Limits
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Request: {formData.resourceLimits.cpu.request}
                </Typography>
                <Slider
                  value={parseResourceValue(formData.resourceLimits.cpu.request)}
                  onChange={handleResourceLimitChange('cpu', 'request')}
                  min={100}
                  max={2000}
                  step={100}
                  marks={[
                    { value: 100, label: '100m' },
                    { value: 500, label: '500m' },
                    { value: 1000, label: '1000m' },
                    { value: 2000, label: '2000m' }
                  ]}
                />
              </Box>

              <Box>
                <Typography variant="body2" color="textSecondary">
                  Limit: {formData.resourceLimits.cpu.limit}
                </Typography>
                <Slider
                  value={parseResourceValue(formData.resourceLimits.cpu.limit)}
                  onChange={handleResourceLimitChange('cpu', 'limit')}
                  min={500}
                  max={4000}
                  step={250}
                  marks={[
                    { value: 500, label: '500m' },
                    { value: 1000, label: '1000m' },
                    { value: 2000, label: '2000m' },
                    { value: 4000, label: '4000m' }
                  ]}
                />
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Memory Limits
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Request: {formData.resourceLimits.memory.request}
                </Typography>
                <Slider
                  value={parseResourceValue(formData.resourceLimits.memory.request)}
                  onChange={handleResourceLimitChange('memory', 'request')}
                  min={128}
                  max={2048}
                  step={128}
                  marks={[
                    { value: 128, label: '128Mi' },
                    { value: 512, label: '512Mi' },
                    { value: 1024, label: '1Gi' },
                    { value: 2048, label: '2Gi' }
                  ]}
                />
              </Box>

              <Box>
                <Typography variant="body2" color="textSecondary">
                  Limit: {formData.resourceLimits.memory.limit}
                </Typography>
                <Slider
                  value={parseResourceValue(formData.resourceLimits.memory.limit) * (formData.resourceLimits.memory.limit.includes('Gi') ? 1024 : 1)}
                  onChange={(event, newValue) => {
                    const unit = newValue >= 1024 ? 'Gi' : 'Mi';
                    const value = newValue >= 1024 ? newValue / 1024 : newValue;
                    handleResourceLimitChange('memory', 'limit')(null, `${value}${unit}`);
                  }}
                  min={512}
                  max={8192}
                  step={512}
                  marks={[
                    { value: 512, label: '512Mi' },
                    { value: 1024, label: '1Gi' },
                    { value: 2048, label: '2Gi' },
                    { value: 4096, label: '4Gi' },
                    { value: 8192, label: '8Gi' }
                  ]}
                />
              </Box>
            </Paper>
          </Grid>

          {/* Network Configuration */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              Network Configuration
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.networkIsolated}
                  onChange={handleInputChange('networkIsolated')}
                  color="primary"
                />
              }
              label="Enable Network Isolation (Recommended)"
            />
            <Typography variant="body2" color="textSecondary" sx={{ ml: 4 }}>
              When enabled, pods in this namespace can only communicate with other pods in the same namespace and with DNS services.
            </Typography>
          </Grid>

          {/* Actions */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
              <Button
                variant="outlined"
                startIcon={<PreviewIcon />}
                onClick={() => handleSubmit(true)}
                disabled={!isFormValid() || creating}
              >
                Preview Manifests
              </Button>
              
              <Button
                variant="contained"
                startIcon={<PlayArrowIcon />}
                onClick={() => handleSubmit(false)}
                disabled={!isFormValid() || creating}
              >
                {creating ? <CircularProgress size={20} /> : 'Create Namespace'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const NamespaceList = () => (
    <Card>
      <CardHeader 
        title="Existing Namespaces"
        action={
          <IconButton onClick={() => dispatch(fetchNamespaces())}>
            <RefreshIcon />
          </IconButton>
        }
      />
      <CardContent>
        {namespacesLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Network Isolated</TableCell>
                  <TableCell>CPU Limits</TableCell>
                  <TableCell>Memory Limits</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {namespaces.map((namespace) => (
                  <TableRow key={namespace.name}>
                    <TableCell>
                      <Typography variant="subtitle2">
                        {namespace.name}
                      </Typography>
                      {namespace.description && (
                        <Typography variant="body2" color="textSecondary">
                          {namespace.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(namespace.status)}
                        label={namespace.status || 'Unknown'}
                        color={getStatusColor(namespace.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={namespace.networkIsolated ? 'Yes' : 'No'}
                        color={namespace.networkIsolated ? 'success' : 'warning'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {namespace.resourceLimits ? (
                        <Typography variant="body2">
                          {namespace.resourceLimits.cpu.request} / {namespace.resourceLimits.cpu.limit}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          Not set
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {namespace.resourceLimits ? (
                        <Typography variant="body2">
                          {namespace.resourceLimits.memory.request} / {namespace.resourceLimits.memory.limit}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          Not set
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {namespace.createdAt ? new Date(namespace.createdAt).toLocaleDateString() : 'Unknown'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setNamespaceToDelete(namespace);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {namespaces.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="textSecondary">
                        No namespaces found. Create your first namespace using the form above.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Namespace Onboarding
      </Typography>
      
      <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
        Create and manage Kubernetes namespaces with resource limits and network isolation.
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab label="Create Namespace" />
          <Tab label="Manage Namespaces" />
        </Tabs>
      </Box>

      {activeTab === 0 && <NamespaceForm />}
      {activeTab === 1 && <NamespaceList />}

      {/* Preview Dialog */}
      <Dialog
        open={showPreview}
        onClose={() => setShowPreview(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Preview Namespace Manifests</DialogTitle>
        <DialogContent>
          {previewManifests && (
            <Box sx={{ mt: 1 }}>
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Namespace</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <JsonView value={previewManifests.namespace} />
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Resource Limits</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <JsonView value={previewManifests.limitRange} />
                </AccordionDetails>
              </Accordion>

              {previewManifests.networkPolicy && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>Network Policy</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <JsonView value={previewManifests.networkPolicy} />
                  </AccordionDetails>
                </Accordion>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Namespace</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the namespace "{namespaceToDelete?.name}"?
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            This action cannot be undone. All resources in this namespace will be deleted.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => handleDelete(namespaceToDelete?.name)}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NamespaceOnboarding;