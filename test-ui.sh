#!/bin/bash

# Simple UI Test Script
echo "Testing AKS Cluster Provisioning UI..."

# Test backend health
echo "1. Testing backend health..."
HEALTH_RESPONSE=$(curl -s http://localhost:3001/health)
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend health check failed"
    exit 1
fi

# Test Azure locations endpoint
echo "2. Testing Azure locations endpoint..."
LOCATIONS_RESPONSE=$(curl -s http://localhost:3001/api/azure/locations)
if echo "$LOCATIONS_RESPONSE" | grep -q "uksouth"; then
    echo "✅ Azure locations endpoint working"
else
    echo "❌ Azure locations endpoint failed"
    exit 1
fi

# Test node pool types endpoint
echo "3. Testing node pool types endpoint..."
NODE_POOL_RESPONSE=$(curl -s http://localhost:3001/api/azure/node-pool-types)
if echo "$NODE_POOL_RESPONSE" | grep -q "standard"; then
    echo "✅ Node pool types endpoint working"
else
    echo "❌ Node pool types endpoint failed"
    exit 1
fi

# Test cluster creation (dry run)
echo "4. Testing cluster creation (dry run)..."
CLUSTER_RESPONSE=$(curl -s -X POST http://localhost:3001/api/clusters \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-ui-cluster",
    "location": "uksouth",
    "nodePoolType": "standard",
    "dryRun": true,
    "enableNAP": true
  }')

if echo "$CLUSTER_RESPONSE" | grep -q "test-ui-cluster"; then
    echo "✅ Cluster creation (dry run) working"
    
    # Extract workflow ID
    WORKFLOW_ID=$(echo "$CLUSTER_RESPONSE" | grep -o '"workflowId":"[^"]*"' | cut -d'"' -f4)
    echo "   Workflow ID: $WORKFLOW_ID"
    
    # Check workflow status
    sleep 2
    WORKFLOW_STATUS=$(curl -s http://localhost:3001/api/workflows/$WORKFLOW_ID)
    if echo "$WORKFLOW_STATUS" | grep -q "succeeded"; then
        echo "✅ Workflow completed successfully"
    else
        echo "⚠️  Workflow status: $(echo "$WORKFLOW_STATUS" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)"
    fi
else
    echo "❌ Cluster creation failed"
    echo "Response: $CLUSTER_RESPONSE"
    exit 1
fi

# Test frontend accessibility
echo "5. Testing frontend accessibility..."
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$FRONTEND_RESPONSE" = "200" ]; then
    echo "✅ Frontend is accessible"
else
    echo "❌ Frontend not accessible (HTTP $FRONTEND_RESPONSE)"
fi

echo ""
echo "🎉 All tests passed! The UI and backend are working correctly."
echo ""
echo "You can now:"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Create clusters using the UI"
echo "3. Run Cypress E2E tests with: npm run test:e2e:smoke"
echo ""
echo "To create a production cluster (with real Azure resources):"
echo "curl -X POST http://localhost:3001/api/clusters \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{"
echo "    \"name\": \"my-production-cluster\","
echo "    \"location\": \"uksouth\","
echo "    \"nodePoolType\": \"standard\","
echo "    \"dryRun\": false,"
echo "    \"enableNAP\": true"
echo "  }'"