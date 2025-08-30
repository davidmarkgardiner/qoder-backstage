import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  CloudDownload as CloudDownloadIcon
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { fetchClusters, deleteCluster } from '../store/clustersSlice';

const ClusterManagement = () => {
  const dispatch = useDispatch();
  const { list: clusters, loading, error, deleting } = useSelector(state => state.clusters);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  
  useEffect(() => {
    dispatch(fetchClusters());
  }, [dispatch]);
  
  const handleDeleteCluster = (cluster) => {
    setSelectedCluster(cluster);
    setDeleteDialogOpen(true);
  };
  
  const confirmDeleteCluster = () => {
    if (selectedCluster) {
      dispatch(deleteCluster({
        clusterId: selectedCluster.id,
        force: false,
        dryRun: true // Start with dry run
      }));
    }
    setDeleteDialogOpen(false);
    setSelectedCluster(null);
  };
  
  const handleViewCluster = (cluster) => {
    setSelectedCluster(cluster);
    setDetailsDialogOpen(true);
  };
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
        return 'success';
      case 'provisioning':
        return 'primary';
      case 'failed':
        return 'error';
      case 'deleting':
        return 'warning';
      default:
        return 'default';
    }
  };
  
  const columns = [
    {
      field: 'name',
      headerName: 'Cluster Name',
      width: 200,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
          {params.value}
        </Typography>
      )
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={getStatusColor(params.value)}
          size="small"
        />
      )
    },
    {
      field: 'location',
      headerName: 'Location',
      width: 130
    },
    {
      field: 'nodePoolType',
      headerName: 'Node Pool Type',
      width: 150,
      renderCell: (params) => (
        <Typography variant="body2">
          {params.value?.replace('-', ' ') || 'N/A'}
        </Typography>
      )
    },
    {
      field: 'enableNAP',
      headerName: 'NAP Enabled',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Yes' : 'No'}
          color={params.value ? 'success' : 'default'}
          size="small"
          variant="outlined"
        />
      )
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 180,
      renderCell: (params) => (
        <Typography variant="body2">
          {new Date(params.value).toLocaleString()}
        </Typography>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton
            size="small"
            onClick={() => handleViewCluster(params.row)}
            title="View Details"
          >
            <VisibilityIcon />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDeleteCluster(params.row)}
            title="Delete Cluster"
            color="error"
            disabled={params.row.status === 'deleting'}
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      )
    }
  ];
  
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Cluster Management
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        View and manage your AKS clusters
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Card>
        <CardHeader
          title={`Clusters (${clusters.length})`}
          action={
            <Button
              variant="outlined"
              startIcon={<CloudDownloadIcon />}
              onClick={() => dispatch(fetchClusters())}
              disabled={loading}
            >
              Refresh
            </Button>
          }
        />
        <CardContent>
          <Box sx={{ height: 600, width: '100%' }}>
            <DataGrid
              rows={clusters}
              columns={columns}
              pageSize={10}
              rowsPerPageOptions={[10, 25, 50]}
              loading={loading}
              disableSelectionOnClick
              sx={{
                '& .MuiDataGrid-cell:focus': {
                  outline: 'none',
                },
              }}
            />
          </Box>
        </CardContent>
      </Card>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Cluster</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will start a deletion workflow. The cluster will be marked for deletion
            and all associated resources will be removed.
          </Alert>
          <Typography>
            Are you sure you want to delete cluster <strong>{selectedCluster?.name}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={confirmDeleteCluster} 
            color="error"
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Cluster Details Dialog */}
      <Dialog 
        open={detailsDialogOpen} 
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Cluster Details: {selectedCluster?.name}</DialogTitle>
        <DialogContent>
          {selectedCluster && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
                <Box>
                  <Typography variant="caption">Cluster Name:</Typography>
                  <Typography variant="body1">{selectedCluster.name}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption">Status:</Typography>
                  <Chip
                    label={selectedCluster.status}
                    color={getStatusColor(selectedCluster.status)}
                    size="small"
                    sx={{ ml: 1 }}
                  />
                </Box>
                <Box>
                  <Typography variant="caption">Location:</Typography>
                  <Typography variant="body1">{selectedCluster.location}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption">Node Pool Type:</Typography>
                  <Typography variant="body1">{selectedCluster.nodePoolType}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption">NAP Enabled:</Typography>
                  <Typography variant="body1">{selectedCluster.enableNAP ? 'Yes' : 'No'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption">Created:</Typography>
                  <Typography variant="body1">
                    {new Date(selectedCluster.createdAt).toLocaleString()}
                  </Typography>
                </Box>
              </Box>
              
              <Typography variant="h6" gutterBottom>
                Workflow Information
              </Typography>
              <Box>
                <Typography variant="caption">Workflow ID:</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {selectedCluster.workflowId}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClusterManagement;