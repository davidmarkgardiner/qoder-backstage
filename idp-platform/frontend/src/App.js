import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Container, Box } from '@mui/material';
import ClusterOnboarding from './pages/ClusterOnboarding';
import WorkflowDashboard from './pages/WorkflowDashboard';
import ClusterManagement from './pages/ClusterManagement';
import NamespaceOnboarding from './pages/NamespaceOnboarding';
import Navigation from './components/Navigation';

function App() {
  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            AKS Internal Developer Platform
          </Typography>
        </Toolbar>
      </AppBar>
      
      <Navigation />
      
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Routes>
          <Route path="/" element={<ClusterOnboarding />} />
          <Route path="/onboarding" element={<ClusterOnboarding />} />
          <Route path="/namespaces" element={<NamespaceOnboarding />} />
          <Route path="/dashboard" element={<WorkflowDashboard />} />
          <Route path="/management" element={<ClusterManagement />} />
        </Routes>
      </Container>
    </Box>
  );
}

export default App;