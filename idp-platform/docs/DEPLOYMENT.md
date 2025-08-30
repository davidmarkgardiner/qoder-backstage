# Deployment Guide

This guide provides detailed instructions for deploying the AKS IDP Platform in different environments.

## 🏢 Production Deployment

### Prerequisites for Production

1. **Azure Subscription** with appropriate permissions
2. **Kubernetes Cluster** (AKS, EKS, or self-managed)
3. **Azure Service Operator** installed and configured
4. **Argo Workflows** installed
5. **Domain name** and SSL certificates (optional)

### Step 1: Azure Service Principal Setup

Create a service principal for Azure resource management:

```bash
# Create service principal
az ad sp create-for-rbac --name "aks-idp-sp" --role "Contributor" --scopes "/subscriptions/{subscription-id}"

# Note down the output:
# - appId (clientId)
# - password (clientSecret)
# - tenant
```

### Step 2: Update Configuration

Update the Azure credentials in Kubernetes:

```bash
# Create secret with actual Azure credentials
kubectl create secret generic azure-service-principal \
  --from-literal=clientId=<your-client-id> \
  --from-literal=clientSecret=<your-client-secret> \
  --from-literal=tenantId=<your-tenant-id> \
  --from-literal=subscriptionId=<your-subscription-id> \
  -n azure-system
```

### Step 3: Deploy to Production Cluster

```bash
# Apply all manifests
kubectl apply -f k8s-manifests/aso-resources/
kubectl apply -f k8s-manifests/kro-resources/
kubectl apply -f k8s-manifests/argo-workflows/

# Verify deployment
kubectl get pods -A | grep -E "(argo|azure|kro)"
```

### Step 4: Configure Ingress (Optional)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: idp-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - idp.yourdomain.com
    secretName: idp-tls
  rules:
  - host: idp.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: idp-frontend
            port:
              number: 80
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: idp-backend
            port:
              number: 3001
```

## 🐳 Docker Deployment

### Backend Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start the application
CMD ["node", "src/index.js"]
```

### Frontend Dockerfile

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - KUBE_CONFIG=/etc/kubeconfig/config
    volumes:
      - ~/.kube/config:/etc/kubeconfig/config:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    environment:
      - REACT_APP_API_BASE_URL=http://localhost:3001/api
```

## ☸️ Kubernetes Deployment

### Backend Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: idp-backend
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: idp-backend
  template:
    metadata:
      labels:
        app: idp-backend
    spec:
      serviceAccountName: aks-idp-operator
      containers:
      - name: backend
        image: your-registry/idp-backend:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3001"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: idp-backend
  namespace: default
spec:
  selector:
    app: idp-backend
  ports:
  - protocol: TCP
    port: 3001
    targetPort: 3001
  type: ClusterIP
```

### Frontend Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: idp-frontend
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: idp-frontend
  template:
    metadata:
      labels:
        app: idp-frontend
    spec:
      containers:
      - name: frontend
        image: your-registry/idp-frontend:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
---
apiVersion: v1
kind: Service
metadata:
  name: idp-frontend
  namespace: default
spec:
  selector:
    app: idp-frontend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
  type: ClusterIP
```

## 🔧 Configuration Management

### ConfigMap for Environment-Specific Settings

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: idp-config
  namespace: default
data:
  config.yaml: |
    environment: production
    api:
      port: 3001
      cors:
        enabled: true
        origins: ["https://idp.yourdomain.com"]
    
    azure:
      defaultRegion: "eastus"
      enableMonitoring: true
      enablePolicy: true
      
    workflows:
      defaultTimeout: "3600s"
      retryLimit: 3
      
    dryRun:
      default: false  # In production, default to actual deployment
```

### Secrets Management

```bash
# Create secrets for production
kubectl create secret generic azure-credentials \
  --from-literal=client-id=$AZURE_CLIENT_ID \
  --from-literal=client-secret=$AZURE_CLIENT_SECRET \
  --from-literal=tenant-id=$AZURE_TENANT_ID \
  --from-literal=subscription-id=$AZURE_SUBSCRIPTION_ID

# Create TLS secret for HTTPS
kubectl create secret tls idp-tls \
  --cert=path/to/tls.crt \
  --key=path/to/tls.key
```

## 📊 Monitoring and Observability

### Prometheus Monitoring

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: idp-backend-monitor
spec:
  selector:
    matchLabels:
      app: idp-backend
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
```

### Grafana Dashboard

Create a dashboard to monitor:
- Workflow execution times
- API response times
- Cluster provisioning success rate
- Resource utilization

### Logging

Configure structured logging with tools like:
- **Fluentd** or **Fluent Bit** for log collection
- **Elasticsearch** for log storage
- **Kibana** for log visualization

## 🔄 CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy IDP Platform

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: |
        cd backend && npm ci
        cd ../frontend && npm ci
        
    - name: Run tests
      run: |
        cd backend && npm test
        cd ../frontend && npm test
        
    - name: Build Docker images
      run: |
        docker build -t ${{ secrets.REGISTRY }}/idp-backend:${{ github.sha }} ./backend
        docker build -t ${{ secrets.REGISTRY }}/idp-frontend:${{ github.sha }} ./frontend
        
    - name: Push to registry
      run: |
        docker push ${{ secrets.REGISTRY }}/idp-backend:${{ github.sha }}
        docker push ${{ secrets.REGISTRY }}/idp-frontend:${{ github.sha }}
        
    - name: Deploy to Kubernetes
      run: |
        kubectl set image deployment/idp-backend backend=${{ secrets.REGISTRY }}/idp-backend:${{ github.sha }}
        kubectl set image deployment/idp-frontend frontend=${{ secrets.REGISTRY }}/idp-frontend:${{ github.sha }}
```

## 🔒 Security Considerations

### 1. Network Security
- Use network policies to restrict pod-to-pod communication
- Enable TLS for all external communications
- Use private container registries

### 2. RBAC Configuration
- Follow principle of least privilege
- Create specific service accounts for each component
- Regularly audit permissions

### 3. Secret Management
- Use external secret management (Azure Key Vault, HashiCorp Vault)
- Rotate credentials regularly
- Never store secrets in code or configuration files

### 4. Container Security
- Use distroless or minimal base images
- Scan images for vulnerabilities
- Run containers as non-root users

## 🧪 Testing in Production

### Health Checks

```bash
# Check all components
kubectl get pods -l app.kubernetes.io/part-of=idp-platform

# Test API endpoints
curl -f https://idp.yourdomain.com/api/health

# Submit test workflow
kubectl create -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  generateName: production-test-
spec:
  workflowTemplateRef:
    name: aks-cluster-provisioning-simple
  arguments:
    parameters:
    - name: cluster-name
      value: 'prod-test-cluster'
    - name: dry-run
      value: 'true'
EOF
```

### Load Testing

Use tools like **k6** or **Artillery** to test the platform under load:

```javascript
import http from 'k6/http';
import { check } from 'k6';

export default function () {
  const response = http.get('https://idp.yourdomain.com/api/azure/locations');
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}
```

## 🔄 Backup and Disaster Recovery

### Backup Strategy

1. **Kubernetes Resources**: Use Velero for cluster backups
2. **Workflow History**: Archive completed workflows
3. **Configuration**: Version control all manifests
4. **Data**: Backup any persistent data

### Disaster Recovery Plan

1. **Infrastructure**: Automate cluster recreation
2. **Application**: Use GitOps for application deployment
3. **Data**: Restore from backups
4. **Testing**: Regularly test recovery procedures

---

This deployment guide provides comprehensive instructions for deploying the AKS IDP Platform in production environments with proper security, monitoring, and operational considerations.