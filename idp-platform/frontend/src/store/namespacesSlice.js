import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

// Async thunks for API calls
export const fetchNamespaces = createAsyncThunk(
  'namespaces/fetchNamespaces',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/namespaces`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.namespaces;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchNamespace = createAsyncThunk(
  'namespaces/fetchNamespace',
  async (namespaceName, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/namespaces/${namespaceName}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.namespace;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createNamespace = createAsyncThunk(
  'namespaces/createNamespace',
  async (namespaceData, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/namespaces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(namespaceData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateNamespace = createAsyncThunk(
  'namespaces/updateNamespace',
  async ({ name, updates }, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/namespaces/${name}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteNamespace = createAsyncThunk(
  'namespaces/deleteNamespace',
  async ({ name, force = false, dryRun = false }, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams();
      if (force) queryParams.append('force', 'true');
      if (dryRun) queryParams.append('dryRun', 'true');

      const response = await fetch(
        `${API_BASE_URL}/api/namespaces/${name}?${queryParams.toString()}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return { name, ...data };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchNamespaceManifests = createAsyncThunk(
  'namespaces/fetchNamespaceManifests',
  async (namespaceName, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/namespaces/${namespaceName}/manifests`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return { namespaceName, manifests: data.manifests };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchNamespaceStatus = createAsyncThunk(
  'namespaces/fetchNamespaceStatus',
  async (namespaceName, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/namespaces/${namespaceName}/status`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return { namespaceName, status: data.status };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Default resource limits
const defaultResourceLimits = {
  cpu: {
    request: '100m',
    limit: '1000m'
  },
  memory: {
    request: '128Mi',
    limit: '1Gi'
  }
};

const namespacesSlice = createSlice({
  name: 'namespaces',
  initialState: {
    // Namespace list
    namespaces: [],
    loading: false,
    error: null,
    
    // Current namespace details
    currentNamespace: null,
    currentNamespaceLoading: false,
    currentNamespaceError: null,
    
    // Creation/Update operations
    creating: false,
    createError: null,
    updating: false,
    updateError: null,
    deleting: false,
    deleteError: null,
    
    // Manifests and status
    manifests: {},
    manifestsLoading: {},
    status: {},
    statusLoading: {},
    
    // Form state for namespace creation
    formData: {
      name: '',
      description: '',
      resourceLimits: defaultResourceLimits,
      networkIsolated: true,
      dryRun: false
    },
    
    // UI state
    showCreateDialog: false,
    showPreview: false,
    selectedNamespace: null,
  },
  reducers: {
    // UI actions
    showCreateDialog: (state) => {
      state.showCreateDialog = true;
      state.createError = null;
    },
    hideCreateDialog: (state) => {
      state.showCreateDialog = false;
      state.formData = {
        name: '',
        description: '',
        resourceLimits: defaultResourceLimits,
        networkIsolated: true,
        dryRun: false
      };
    },
    togglePreview: (state) => {
      state.showPreview = !state.showPreview;
    },
    selectNamespace: (state, action) => {
      state.selectedNamespace = action.payload;
    },
    
    // Form actions
    updateFormData: (state, action) => {
      state.formData = { ...state.formData, ...action.payload };
    },
    updateResourceLimits: (state, action) => {
      state.formData.resourceLimits = { ...state.formData.resourceLimits, ...action.payload };
    },
    resetForm: (state) => {
      state.formData = {
        name: '',
        description: '',
        resourceLimits: defaultResourceLimits,
        networkIsolated: true,
        dryRun: false
      };
      state.createError = null;
    },
    
    // Clear errors
    clearErrors: (state) => {
      state.error = null;
      state.createError = null;
      state.updateError = null;
      state.deleteError = null;
      state.currentNamespaceError = null;
    },
    
    // Real-time updates from WebSocket
    updateNamespaceStatus: (state, action) => {
      const { namespaceName, status: newStatus } = action.payload;
      state.status[namespaceName] = newStatus;
      
      // Update in namespace list if present
      const namespaceIndex = state.namespaces.findIndex(ns => ns.name === namespaceName);
      if (namespaceIndex !== -1) {
        state.namespaces[namespaceIndex].status = newStatus.namespace;
      }
      
      // Update current namespace if it's the one being updated
      if (state.currentNamespace?.name === namespaceName) {
        state.currentNamespace.status = newStatus.namespace;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch namespaces
      .addCase(fetchNamespaces.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNamespaces.fulfilled, (state, action) => {
        state.loading = false;
        state.namespaces = action.payload;
      })
      .addCase(fetchNamespaces.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Fetch single namespace
      .addCase(fetchNamespace.pending, (state) => {
        state.currentNamespaceLoading = true;
        state.currentNamespaceError = null;
      })
      .addCase(fetchNamespace.fulfilled, (state, action) => {
        state.currentNamespaceLoading = false;
        state.currentNamespace = action.payload;
      })
      .addCase(fetchNamespace.rejected, (state, action) => {
        state.currentNamespaceLoading = false;
        state.currentNamespaceError = action.payload;
      })
      
      // Create namespace
      .addCase(createNamespace.pending, (state) => {
        state.creating = true;
        state.createError = null;
      })
      .addCase(createNamespace.fulfilled, (state, action) => {
        state.creating = false;
        
        if (action.payload.dryRun) {
          // For dry run, store manifests for preview
          state.manifests[action.payload.namespace.name] = action.payload.manifests;
        } else {
          // For actual creation, add to namespace list
          state.namespaces.unshift(action.payload.namespace);
          state.showCreateDialog = false;
          state.formData = {
            name: '',
            description: '',
            resourceLimits: defaultResourceLimits,
            networkIsolated: true,
            dryRun: false
          };
        }
      })
      .addCase(createNamespace.rejected, (state, action) => {
        state.creating = false;
        state.createError = action.payload;
      })
      
      // Update namespace
      .addCase(updateNamespace.pending, (state) => {
        state.updating = true;
        state.updateError = null;
      })
      .addCase(updateNamespace.fulfilled, (state, action) => {
        state.updating = false;
        // Update in list and current namespace if applicable
        const namespaceIndex = state.namespaces.findIndex(ns => ns.name === action.payload.namespace);
        if (namespaceIndex !== -1) {
          state.namespaces[namespaceIndex] = { ...state.namespaces[namespaceIndex], ...action.payload };
        }
      })
      .addCase(updateNamespace.rejected, (state, action) => {
        state.updating = false;
        state.updateError = action.payload;
      })
      
      // Delete namespace
      .addCase(deleteNamespace.pending, (state) => {
        state.deleting = true;
        state.deleteError = null;
      })
      .addCase(deleteNamespace.fulfilled, (state, action) => {
        state.deleting = false;
        
        if (!action.payload.dryRun) {
          // Remove from namespace list
          state.namespaces = state.namespaces.filter(ns => ns.name !== action.payload.name);
          
          // Clear current namespace if it was deleted
          if (state.currentNamespace?.name === action.payload.name) {
            state.currentNamespace = null;
          }
          
          // Clean up manifests and status
          delete state.manifests[action.payload.name];
          delete state.status[action.payload.name];
        }
      })
      .addCase(deleteNamespace.rejected, (state, action) => {
        state.deleting = false;
        state.deleteError = action.payload;
      })
      
      // Fetch manifests
      .addCase(fetchNamespaceManifests.pending, (state, action) => {
        state.manifestsLoading[action.meta.arg] = true;
      })
      .addCase(fetchNamespaceManifests.fulfilled, (state, action) => {
        const { namespaceName, manifests } = action.payload;
        state.manifestsLoading[namespaceName] = false;
        state.manifests[namespaceName] = manifests;
      })
      .addCase(fetchNamespaceManifests.rejected, (state, action) => {
        state.manifestsLoading[action.meta.arg] = false;
      })
      
      // Fetch status
      .addCase(fetchNamespaceStatus.pending, (state, action) => {
        state.statusLoading[action.meta.arg] = true;
      })
      .addCase(fetchNamespaceStatus.fulfilled, (state, action) => {
        const { namespaceName, status } = action.payload;
        state.statusLoading[namespaceName] = false;
        state.status[namespaceName] = status;
      })
      .addCase(fetchNamespaceStatus.rejected, (state, action) => {
        state.statusLoading[action.meta.arg] = false;
      });
  },
});

// Export actions
export const {
  showCreateDialog,
  hideCreateDialog,
  togglePreview,
  selectNamespace,
  updateFormData,
  updateResourceLimits,
  resetForm,
  clearErrors,
  updateNamespaceStatus,
} = namespacesSlice.actions;

// Selectors
export const selectNamespaces = (state) => state.namespaces.namespaces;
export const selectNamespacesLoading = (state) => state.namespaces.loading;
export const selectNamespacesError = (state) => state.namespaces.error;

export const selectCurrentNamespace = (state) => state.namespaces.currentNamespace;
export const selectCurrentNamespaceLoading = (state) => state.namespaces.currentNamespaceLoading;

export const selectCreating = (state) => state.namespaces.creating;
export const selectCreateError = (state) => state.namespaces.createError;

export const selectFormData = (state) => state.namespaces.formData;
export const selectShowCreateDialog = (state) => state.namespaces.showCreateDialog;
export const selectShowPreview = (state) => state.namespaces.showPreview;

export const selectNamespaceManifests = (namespaceName) => (state) => 
  state.namespaces.manifests[namespaceName];

export const selectNamespaceStatus = (namespaceName) => (state) => 
  state.namespaces.status[namespaceName];

export default namespacesSlice.reducer;