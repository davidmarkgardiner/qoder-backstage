import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Tabs, 
  Tab, 
  Paper 
} from '@mui/material';
import { 
  CloudUpload, 
  Dashboard, 
  Storage 
} from '@mui/icons-material';

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const getTabValue = () => {
    switch (location.pathname) {
      case '/':
      case '/onboarding':
        return 0;
      case '/dashboard':
        return 1;
      case '/management':
        return 2;
      default:
        return 0;
    }
  };
  
  const handleTabChange = (event, newValue) => {
    switch (newValue) {
      case 0:
        navigate('/onboarding');
        break;
      case 1:
        navigate('/dashboard');
        break;
      case 2:
        navigate('/management');
        break;
      default:
        navigate('/onboarding');
    }
  };
  
  return (
    <Paper elevation={1} sx={{ borderRadius: 0 }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={getTabValue()}
          onChange={handleTabChange}
          aria-label="navigation tabs"
          variant="fullWidth"
          data-testid="navigation"
        >
          <Tab
            icon={<CloudUpload />}
            label="Cluster Onboarding"
            id="tab-0"
            aria-controls="tabpanel-0"
            data-testid="nav-onboarding"
          />
          <Tab
            icon={<Dashboard />}
            label="Workflow Dashboard"
            id="tab-1"
            aria-controls="tabpanel-1"
            data-testid="nav-dashboard"
          />
          <Tab
            icon={<Storage />}
            label="Cluster Management"
            id="tab-2"
            aria-controls="tabpanel-2"
            data-testid="nav-management"
          />
        </Tabs>
      </Box>
    </Paper>
  );
};

export default Navigation;