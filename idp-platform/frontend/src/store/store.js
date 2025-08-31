import { configureStore } from '@reduxjs/toolkit';
import clustersReducer from './clustersSlice';
import workflowsReducer from './workflowsSlice';
import azureReducer from './azureSlice';
import uiReducer from './uiSlice';
import namespacesReducer from './namespacesSlice';

export const store = configureStore({
  reducer: {
    clusters: clustersReducer,
    workflows: workflowsReducer,
    azure: azureReducer,
    ui: uiReducer,
    namespaces: namespacesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;