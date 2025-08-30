import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getWorkflows = (filters = {}) => {
  return apiClient.get('/workflows', { params: filters });
};

export const getWorkflow = (workflowId) => {
  return apiClient.get(`/workflows/${workflowId}`);
};

export const abortWorkflow = (workflowId, reason) => {
  return apiClient.post(`/workflows/${workflowId}/abort`, { reason });
};

export const retryWorkflow = (workflowId, fromStep) => {
  return apiClient.post(`/workflows/${workflowId}/retry`, { fromStep });
};