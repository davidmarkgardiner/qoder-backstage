import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as workflowService from '../services/workflowService';

// Async thunks
export const fetchWorkflows = createAsyncThunk(
  'workflows/fetchWorkflows',
  async (filters = {}) => {
    const response = await workflowService.getWorkflows(filters);
    return response.data;
  }
);

export const fetchWorkflow = createAsyncThunk(
  'workflows/fetchWorkflow',
  async (workflowId) => {
    const response = await workflowService.getWorkflow(workflowId);
    return response.data;
  }
);

export const abortWorkflow = createAsyncThunk(
  'workflows/abortWorkflow',
  async ({ workflowId, reason }) => {
    const response = await workflowService.abortWorkflow(workflowId, reason);
    return response.data;
  }
);

export const retryWorkflow = createAsyncThunk(
  'workflows/retryWorkflow',
  async ({ workflowId, fromStep }) => {
    const response = await workflowService.retryWorkflow(workflowId, fromStep);
    return response.data;
  }
);

const workflowsSlice = createSlice({
  name: 'workflows',
  initialState: {
    active: [],
    history: [],
    current: null,
    logs: [],
    loading: false,
    error: null
  },
  reducers: {
    updateWorkflowStatus: (state, action) => {
      const { workflowId, status } = action.payload;
      const workflow = [...state.active, ...state.history].find(w => w.id === workflowId);
      if (workflow) {
        workflow.status = status;
      }
      if (state.current && state.current.workflow.id === workflowId) {
        state.current.workflow.status = status;
      }
    },
    addWorkflowLog: (state, action) => {
      const { workflowId, log } = action.payload;
      if (state.current && state.current.workflow.id === workflowId) {
        state.current.logs.push(log);
      }
    },
    clearCurrentWorkflow: (state) => {
      state.current = null;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch workflows
      .addCase(fetchWorkflows.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWorkflows.fulfilled, (state, action) => {
        state.loading = false;
        const workflows = action.payload.workflows;
        state.active = workflows.filter(w => ['pending', 'running'].includes(w.status));
        state.history = workflows.filter(w => ['succeeded', 'failed', 'aborted'].includes(w.status));
      })
      .addCase(fetchWorkflows.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Fetch single workflow
      .addCase(fetchWorkflow.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWorkflow.fulfilled, (state, action) => {
        state.loading = false;
        state.current = action.payload;
      })
      .addCase(fetchWorkflow.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Abort workflow
      .addCase(abortWorkflow.fulfilled, (state, action) => {
        const workflow = action.payload.workflow;
        const index = state.active.findIndex(w => w.id === workflow.id);
        if (index !== -1) {
          state.active[index] = workflow;
        }
      })
      // Retry workflow
      .addCase(retryWorkflow.fulfilled, (state, action) => {
        const workflow = action.payload.workflow;
        const index = state.history.findIndex(w => w.id === workflow.id);
        if (index !== -1) {
          state.history.splice(index, 1);
          state.active.push(workflow);
        }
      });
  }
});

export const { 
  updateWorkflowStatus, 
  addWorkflowLog, 
  clearCurrentWorkflow, 
  clearError 
} = workflowsSlice.actions;
export default workflowsSlice.reducer;