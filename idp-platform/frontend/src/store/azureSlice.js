import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as azureService from '../services/azureService';

// Async thunks
export const fetchLocations = createAsyncThunk(
  'azure/fetchLocations',
  async () => {
    const response = await azureService.getLocations();
    return response.data;
  }
);

export const fetchNodePoolTypes = createAsyncThunk(
  'azure/fetchNodePoolTypes',
  async () => {
    const response = await azureService.getNodePoolTypes();
    return response.data;
  }
);

export const fetchVMSizes = createAsyncThunk(
  'azure/fetchVMSizes',
  async (location) => {
    const response = await azureService.getVMSizes(location);
    return response.data;
  }
);

const azureSlice = createSlice({
  name: 'azure',
  initialState: {
    locations: [],
    nodePoolTypes: [],
    recommendations: [],
    vmSizes: {},
    loading: false,
    error: null
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch locations
      .addCase(fetchLocations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLocations.fulfilled, (state, action) => {
        state.loading = false;
        state.locations = action.payload.locations;
      })
      .addCase(fetchLocations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Fetch node pool types
      .addCase(fetchNodePoolTypes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNodePoolTypes.fulfilled, (state, action) => {
        state.loading = false;
        state.nodePoolTypes = action.payload.nodePoolTypes;
        state.recommendations = action.payload.recommendations;
      })
      .addCase(fetchNodePoolTypes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Fetch VM sizes
      .addCase(fetchVMSizes.fulfilled, (state, action) => {
        const { location, vmSizes } = action.payload;
        state.vmSizes[location] = vmSizes;
      });
  }
});

export const { clearError } = azureSlice.actions;
export default azureSlice.reducer;