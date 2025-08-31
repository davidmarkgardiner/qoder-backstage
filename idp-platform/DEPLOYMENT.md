# IDP Platform Deployment for AKS

This directory contains the Kubernetes deployment manifests and automation scripts for deploying the Internal Developer Platform (IDP) to Azure Kubernetes Service (AKS).

## Overview

The IDP Platform provides a self-service portal for AKS cluster onboarding with integration to:
- Azure Service Operator (ASO)
- Argo Workflows
- Kubernetes Resource Orchestrator (KRO)
- External-DNS for automatic DNS management
- Cert-Manager for automatic TLS certificate provisioning

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AKS Cluster                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │   Frontend      │    │    Backend      │                │
│  │   (React)       │    │   (Node.js)     │                │
│  │   Port: 80      │    │   Port: 3001    │                │
│  └─────────────────┘    └─────────────────┘                │
│           │                       │                        │
│  ┌─────────────────────────────────────────────────────────┤
│  │              Istio Gateway                              │
│  │         idp.davidmarkgardiner.co.uk                     │
│  └─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┤
│  │  External-DNS    │  Cert-Manager  │   Azure DNS        │
│  │  (DNS Records)   │  (TLS Certs)   │   (Zone)           │
│  └─────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

Before deploying, ensure you have:

1. **AKS Cluster** with Flux-system installed
2. **Azure Service Operator (ASO)** v2.5.0+
3. **Argo Workflows** installed
4. **Kubernetes Resource Orchestrator (KRO)** installed
5. **External-DNS** configured for `davidmarkgardiner.co.uk`
6. **Cert-Manager** with Let's Encrypt ClusterIssuer
7. **Istio Service Mesh** (optional but recommended)

### Install Prerequisites

```bash
# Install Azure Service Operator
kubectl apply -f https://github.com/Azure/azure-service-operator/releases/latest/download/azureserviceoperator_v2.5.0_linux_amd64.yaml

# Install Argo Workflows
kubectl create namespace argo
kubectl apply -n argo -f https://github.com/argoproj/argo-workflows/releases/latest/download/install.yaml

# Install KRO
kubectl apply -f https://raw.githubusercontent.com/Azure/kro/main/config/install.yaml
```

## Deployment Options

### Option 1: Full Automated Deployment

```bash
# Deploy everything with a single command
./deploy.sh

# Or with custom settings
./deploy.sh -t v1.0.0 -r your-registry
```

### Option 2: Step-by-Step Deployment

```bash
# 1. Build Docker images
./build-images.sh

# 2. Push to Docker Hub (replace with your registry)
docker push davidgardiner/idp-backend:latest
docker push davidgardiner/idp-frontend:latest

# 3. Deploy to Kubernetes
./quick-deploy.sh
```

### Option 3: GitOps with Flux

```bash
# Deploy via Flux (recommended for production)
kubectl apply -f flux-kustomization.yaml
```

### Option 4: Manual Deployment

```bash
# Apply manifests manually
kubectl apply -f k8s-manifests/01-namespace-rbac.yaml
kubectl apply -f k8s-manifests/02-configmaps.yaml
kubectl apply -f k8s-manifests/03-deployments.yaml
kubectl apply -f k8s-manifests/04-services.yaml
kubectl apply -f k8s-manifests/05-istio-gateway.yaml
kubectl apply -f k8s-manifests/06-certificates.yaml
```

## Files Description

### Docker Configuration
- `Dockerfile.backend` - Node.js backend container
- `Dockerfile.frontend` - React frontend with nginx

### Kubernetes Manifests
- `01-namespace-rbac.yaml` - Namespace, ServiceAccount, and RBAC
- `02-configmaps.yaml` - Application configuration
- `03-deployments.yaml` - Frontend and backend deployments
- `04-services.yaml` - Kubernetes services
- `05-istio-gateway.yaml` - Istio Gateway and VirtualService
- `06-certificates.yaml` - TLS certificates

### Automation Scripts
- `deploy.sh` - Complete deployment automation
- `build-images.sh` - Build Docker images only
- `quick-deploy.sh` - Deploy to Kubernetes only

### GitOps Configuration
- `kustomization.yaml` - Kustomize configuration
- `flux-kustomization.yaml` - Flux GitOps setup
- `resource-config.yaml` - Kustomize resource configuration

## Configuration

### Environment Variables

The application supports these configuration options in `02-configmaps.yaml`:

```yaml
NODE_ENV: "production"
CORS_ORIGIN: "https://idp.davidmarkgardiner.co.uk"
AZURE_SUBSCRIPTION_ID: "your-subscription-id"
AZURE_TENANT_ID: "your-tenant-id"
DOMAIN_NAME: "davidmarkgardiner.co.uk"
```

### Image Registry

By default, images are pulled from Docker Hub (`davidgardiner/`). Update the registry in:
- Deployment manifests: `spec.template.spec.containers[].image`
- Build scripts: `DOCKER_REGISTRY` variable
- Flux configuration: `REGISTRY` substitution

### Domain Configuration

The application is configured for `idp.davidmarkgardiner.co.uk`. To change:
1. Update `DOMAIN` in ConfigMaps
2. Update hosts in Istio Gateway and VirtualService
3. Update DNS names in Certificate resources

## Security Features

- **Non-root containers** with security contexts
- **Read-only root filesystem** where possible
- **Resource limits** and requests
- **Network policies** (optional)
- **RBAC** with least-privilege access
- **TLS encryption** with Let's Encrypt certificates

## Monitoring and Observability

### Health Checks
- Backend: `GET /health`
- Frontend: `GET /health`

### Logging
```bash
# View application logs
kubectl logs -f deployment/idp-backend -n idp-platform
kubectl logs -f deployment/idp-frontend -n idp-platform
```

### Metrics
- Prometheus metrics exposed on backend `:3001/metrics`
- Health probes for liveness and readiness

## Troubleshooting

### Common Issues

1. **Pods not starting**
   ```bash
   kubectl describe pods -n idp-platform
   kubectl logs -f deployment/idp-backend -n idp-platform
   ```

2. **Certificate not ready**
   ```bash
   kubectl describe certificate idp-wildcard-tls-cert -n idp-platform
   kubectl describe certificaterequest -n idp-platform
   ```

3. **DNS not resolving**
   ```bash
   nslookup idp.davidmarkgardiner.co.uk
   kubectl logs -f deployment/external-dns -n external-dns
   ```

4. **Istio Gateway issues**
   ```bash
   kubectl get gateway -n idp-platform
   kubectl describe virtualservice idp-virtualservice -n idp-platform
   ```

### Validation Commands

```bash
# Check deployment status
kubectl get all -n idp-platform

# Check certificates
kubectl get certificates -n idp-platform
kubectl get certificates -n aks-istio-system | grep idp

# Check DNS records
kubectl logs deployment/external-dns -n external-dns

# Test connectivity
kubectl port-forward -n idp-platform svc/idp-frontend-service 8080:80
kubectl port-forward -n idp-platform svc/idp-backend-service 8081:3001
```

## Production Considerations

### High Availability
- 2 replicas for both frontend and backend
- Anti-affinity rules to spread pods across nodes
- Health checks and rolling updates

### Resource Management
- CPU and memory requests/limits configured
- Ephemeral storage limits
- Pod disruption budgets (can be added)

### Security
- Security contexts with non-root users
- Read-only root filesystem
- Network policies (can be added)
- Pod security standards compliance

### Backup and Recovery
- GitOps approach for infrastructure as code
- Persistent volume backup (if added later)
- Configuration stored in Git

## Scaling

### Horizontal Scaling
```bash
# Scale deployments
kubectl scale deployment idp-backend --replicas=3 -n idp-platform
kubectl scale deployment idp-frontend --replicas=3 -n idp-platform
```

### Vertical Scaling
Update resource requests/limits in deployment manifests.

## Updates and Maintenance

### Application Updates
1. Build new images with updated tag
2. Update image references in manifests
3. Apply changes via GitOps or kubectl

### Infrastructure Updates
- Monitor Flux reconciliation
- Update operator versions as needed
- Review security patches regularly

## Cleanup

```bash
# Remove the application
./quick-deploy.sh delete

# Or manually
kubectl delete namespace idp-platform
kubectl delete certificate idp-wildcard-tls-cert -n aks-istio-system
```

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review logs for error messages
3. Verify prerequisites are properly installed
4. Check Azure resource status in the portal

## Version History

- v1.0.0 - Initial deployment configuration
- Support for AKS with Istio, External-DNS, and Cert-Manager
- GitOps ready with Flux integration