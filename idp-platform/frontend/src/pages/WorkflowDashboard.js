import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Grid,
  Chip,
  Button,
  LinearProgress,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as HourglassEmptyIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { fetchWorkflows, fetchWorkflow, abortWorkflow, retryWorkflow } from '../store/workflowsSlice';

const WorkflowDashboard = () => {
  const dispatch = useDispatch();
  const { active, history, current, loading, error } = useSelector(state => state.workflows);
  
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [abortDialogOpen, setAbortDialogOpen] = useState(false);
  const [abortReason, setAbortReason] = useState('');
  
  useEffect(() => {
    dispatch(fetchWorkflows());
    // Set up polling for active workflows
    const interval = setInterval(() => {
      if (active.length > 0) {
        dispatch(fetchWorkflows());
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [dispatch, active.length]);
  
  const getStatusIcon = (status) => {
    switch (status) {
      case 'running':
        return <HourglassEmptyIcon color="primary" />;
      case 'succeeded':
        return <CheckCircleIcon color="success" />;
      case 'failed':
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return <HourglassEmptyIcon color="disabled" />;
    }
  };
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
        return 'primary';
      case 'succeeded':
        return 'success';
      case 'failed':
      case 'error':
        return 'error';
      case 'aborted':
        return 'warning';
      default:
        return 'default';
    }
  };
  
  const handleViewWorkflow = (workflow) => {
    setSelectedWorkflow(workflow);
    dispatch(fetchWorkflow(workflow.id));
  };
  
  const handleAbortWorkflow = (workflow) => {
    setSelectedWorkflow(workflow);
    setAbortDialogOpen(true);
  };
  
  const confirmAbortWorkflow = () => {
    if (selectedWorkflow) {
      dispatch(abortWorkflow({
        workflowId: selectedWorkflow.id,
        reason: abortReason
      }));
    }
    setAbortDialogOpen(false);
    setAbortReason('');
    setSelectedWorkflow(null);
  };
  
  const handleRetryWorkflow = (workflow) => {
    dispatch(retryWorkflow({ workflowId: workflow.id }));
  };
  
  const formatDuration = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = Math.floor((end - start) / 1000);
    
    if (duration < 60) {
      return `${duration}s`;
    } else if (duration < 3600) {
      return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    } else {
      return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
    }
  };
  
  const WorkflowCard = ({ workflow, showActions = true }) => (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h6" gutterBottom>
              {workflow.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Chip
                icon={getStatusIcon(workflow.status)}
                label={workflow.status.toUpperCase()}
                color={getStatusColor(workflow.status)}
                size="small"
                data-testid="workflow-status"
              />
              <Typography variant="body2" color="text.secondary">
                {workflow.type}
              </Typography>
            </Box>
          </Box>
          {showActions && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton
                size="small"
                onClick={() => handleViewWorkflow(workflow)}
                title="View Details"
                data-testid="view-workflow-button"
              >
                <VisibilityIcon />
              </IconButton>
              {workflow.status === 'running' && (
                <IconButton
                  size="small"
                  onClick={() => handleAbortWorkflow(workflow)}
                  title="Abort Workflow"
                  color="error"
                >
                  <StopIcon />
                </IconButton>
              )}
              {['failed', 'error', 'aborted'].includes(workflow.status) && (
                <IconButton
                  size="small"
                  onClick={() => handleRetryWorkflow(workflow)}
                  title="Retry Workflow"
                  color="primary"
                >
                  <RefreshIcon />
                </IconButton>
              )}
            </Box>
          )}
        </Box>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Started: {new Date(workflow.startTime).toLocaleString()}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Duration: {formatDuration(workflow.startTime, workflow.endTime)}
          </Typography>
        </Box>
        
        {workflow.status === 'running' && (
          <LinearProgress sx={{ mt: 1 }} />
        )}
      </CardContent>
    </Card>
  );
  
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Workflow Dashboard
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Monitor cluster provisioning workflows and their progress
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Grid container spacing={3}>
        {/* Active Workflows */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Active Workflows ({active.length})
            </Typography>
            {loading ? (
              <LinearProgress />
            ) : active.length === 0 ? (
              <Typography color="text.secondary">
                No active workflows
              </Typography>
            ) : (
              <Box data-testid="workflow-list">
                {active.map(workflow => (
                  <WorkflowCard key={workflow.id} workflow={workflow} />
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
        
        {/* Workflow History */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recent History ({history.length})
            </Typography>
            {history.length === 0 ? (
              <Typography color="text.secondary">
                No workflow history
              </Typography>
            ) : (
              history.slice(0, 5).map(workflow => (
                <WorkflowCard key={workflow.id} workflow={workflow} />
              ))
            )}
          </Paper>
        </Grid>
        
        {/* Workflow Details */}
        {current && (
          <Grid item xs={12}>
            <Card>
              <CardHeader 
                title={`Workflow Details: ${current.workflow.name}`}
                action={
                  <Button
                    variant="outlined"
                    onClick={() => setSelectedWorkflow(null)}
                  >
                    Close
                  </Button>
                }
              />
              <CardContent>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom>
                      Steps
                    </Typography>
                    <List>
                      {current.steps.map((step, index) => (
                        <ListItem key={step.id}>
                          <ListItemIcon>
                            {getStatusIcon(step.status)}
                          </ListItemIcon>
                          <ListItemText
                            primary={step.name}
                            secondary={step.startTime ? 
                              `Started: ${new Date(step.startTime).toLocaleString()}` : 
                              'Not started'
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom>
                      Logs
                    </Typography>
                    <Paper 
                      variant="outlined" 
                      sx={{ 
                        p: 2, 
                        maxHeight: 400, 
                        overflow: 'auto',
                        backgroundColor: '#f5f5f5',
                        fontFamily: 'monospace'
                      }}
                    >
                      {current.logs.map((log, index) => (
                        <Box key={index} sx={{ mb: 1 }}>
                          <Typography 
                            variant="caption" 
                            color={log.level === 'error' ? 'error' : 'text.secondary'}
                          >
                            [{new Date(log.timestamp).toLocaleTimeString()}] [{log.level.toUpperCase()}]
                          </Typography>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontFamily: 'monospace',
                              color: log.level === 'error' ? 'error.main' : 'text.primary'
                            }}
                          >
                            {log.message}
                          </Typography>
                        </Box>
                      ))}
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
      
      {/* Abort Workflow Dialog */}
      <Dialog open={abortDialogOpen} onClose={() => setAbortDialogOpen(false)}>
        <DialogTitle>Abort Workflow</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Are you sure you want to abort this workflow?
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Reason (optional)"
            fullWidth
            variant="outlined"
            value={abortReason}
            onChange={(e) => setAbortReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAbortDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={confirmAbortWorkflow} color="error">
            Abort
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WorkflowDashboard;