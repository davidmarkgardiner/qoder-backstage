import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getLocations = () => {
  return apiClient.get('/azure/locations');
};

export const getNodePoolTypes = () => {
  return apiClient.get('/azure/node-pool-types');
};

export const getVMSizes = (location) => {
  return apiClient.get('/azure/vm-sizes', { 
    params: { location } 
  });
};