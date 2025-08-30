import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getClusters = () => {
  return apiClient.get('/clusters');
};

export const getCluster = (clusterId) => {
  return apiClient.get(`/clusters/${clusterId}`);
};

export const createCluster = (clusterData) => {
  return apiClient.post('/clusters', clusterData);
};

export const deleteCluster = (clusterId, options = {}) => {
  return apiClient.delete(`/clusters/${clusterId}`, {
    params: options
  });
};