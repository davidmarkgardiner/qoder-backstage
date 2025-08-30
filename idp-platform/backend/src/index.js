const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('ws');
const http = require('http');

const clusterRoutes = require('./routes/clusters');
const workflowRoutes = require('./routes/workflows');
const azureRoutes = require('./routes/azure');
const namespaceRoutes = require('./routes/namespaces');

const app = express();
const server = http.createServer(app);
const wss = new Server({ server, path: '/ws' });

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/clusters', clusterRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/azure', azureRoutes);
app.use('/api/namespaces', namespaceRoutes);

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  console.log('WebSocket connection established');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received WebSocket message:', data);
      
      // Handle different message types
      switch (data.type) {
        case 'subscribe_workflow':
          ws.workflowId = data.workflowId;
          break;
        case 'unsubscribe_workflow':
          delete ws.workflowId;
          break;
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

// Broadcast workflow updates to connected clients
const broadcastWorkflowUpdate = (workflowId, update) => {
  wss.clients.forEach((client) => {
    if (client.workflowId === workflowId && client.readyState === client.OPEN) {
      client.send(JSON.stringify({
        type: 'workflow_update',
        workflowId,
        data: update
      }));
    }
  });
};

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!', 
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`IDP Backend server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
});

module.exports = { app, broadcastWorkflowUpdate };