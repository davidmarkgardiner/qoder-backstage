import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as clusterService from '../services/clusterService';

// Async thunks
export const fetchClusters = createAsyncThunk(
  'clusters/fetchClusters',
  async () => {
    const response = await clusterService.getClusters();
    return response.data;
  }
);

export const createCluster = createAsyncThunk(
  'clusters/createCluster',
  async (clusterConfig, { rejectWithValue }) => {
    try {
      const response = await clusterService.createCluster(clusterConfig);
      return response.data;
    } catch (error) {
      if (error.response && error.response.data) {
        return rejectWithValue(error.response.data);
      }
      return rejectWithValue({ error: error.message });
    }
  }
);

export const fetchCluster = createAsyncThunk(
  'clusters/fetchCluster',
  async (clusterId) => {
    const response = await clusterService.getCluster(clusterId);
    return response.data;
  }
);

export const deleteCluster = createAsyncThunk(
  'clusters/deleteCluster',
  async ({ clusterId, force = false, dryRun = true }) => {
    const response = await clusterService.deleteCluster(clusterId, { force, dryRun });
    return { clusterId, ...response.data };
  }
);

const clustersSlice = createSlice({
  name: 'clusters',
  initialState: {
    list: [],
    current: null,
    loading: false,
    error: null,
    creating: false,
    deleting: false
  },
  reducers: {
    clearCurrentCluster: (state) => {
      state.current = null;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch clusters
      .addCase(fetchClusters.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchClusters.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.clusters;
      })
      .addCase(fetchClusters.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Create cluster
      .addCase(createCluster.pending, (state) => {
        state.creating = true;
        state.error = null;
      })
      .addCase(createCluster.fulfilled, (state, action) => {
        state.creating = false;
        state.list.push(action.payload.cluster);
        state.current = action.payload.cluster;
      })
      .addCase(createCluster.rejected, (state, action) => {
        state.creating = false;
        if (action.payload) {
          // Handle API error response
          if (action.payload.details && action.payload.details.length > 0) {
            // Validation errors
            state.error = action.payload.details.map(d => d.message).join(', ');
          } else {
            state.error = action.payload.error || 'Failed to create cluster';
          }
        } else {
          state.error = action.error.message;
        }
      })
      // Fetch single cluster
      .addCase(fetchCluster.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCluster.fulfilled, (state, action) => {
        state.loading = false;
        state.current = action.payload.cluster;
      })
      .addCase(fetchCluster.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Delete cluster
      .addCase(deleteCluster.pending, (state) => {
        state.deleting = true;
        state.error = null;
      })
      .addCase(deleteCluster.fulfilled, (state, action) => {
        state.deleting = false;
        state.list = state.list.filter(cluster => cluster.id !== action.payload.clusterId);
      })
      .addCase(deleteCluster.rejected, (state, action) => {
        state.deleting = false;
        state.error = action.error.message;
      });
  }
});

export const { clearCurrentCluster, clearError } = clustersSlice.actions;
export default clustersSlice.reducer;