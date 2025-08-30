# IDP Platform Deployment Checklist

## Pre-Deployment Checklist

### ✅ Infrastructure Prerequisites
- [ ] AKS cluster is running and accessible via kubectl
- [ ] Flux-system is installed and operational
- [ ] Azure Service Operator (ASO) v2.5.0+ is deployed
- [ ] Argo Workflows is installed in `argo` namespace
- [ ] Kubernetes Resource Orchestrator (KRO) is installed
- [ ] External-DNS is configured for `davidmarkgardiner.co.uk`
- [ ] Cert-Manager is installed with Let's Encrypt ClusterIssuer
- [ ] Istio service mesh is installed (optional but recommended)

### ✅ Access and Credentials
- [ ] Docker Hub account with push permissions to `davidgardiner` repository
- [ ] kubectl context configured for target AKS cluster
- [ ] Azure credentials configured for External-DNS and Cert-Manager
- [ ] DNS zone `davidmarkgardiner.co.uk` is configured in Azure DNS

### ✅ Domain and DNS
- [ ] DNS zone delegation is working
- [ ] External-DNS has permissions to manage DNS records
- [ ] ClusterIssuer `letsencrypt-prod-dns01` is ready
- [ ] Azure Workload Identity is configured for DNS challenges

## Deployment Steps

### 🚀 Option 1: Automated Deployment
```bash
# Single command deployment
cd idp-platform
./deploy.sh

# Monitor the deployment
watch kubectl get pods -n idp-platform
```

### 🔧 Option 2: Manual Step-by-Step
```bash
# 1. Build and push images
./build-images.sh
docker push davidgardiner/idp-backend:latest
docker push davidgardiner/idp-frontend:latest

# 2. Deploy to Kubernetes
./quick-deploy.sh

# 3. Validate deployment
./validate-deployment.sh
```

### 🏗️ Option 3: GitOps with Flux
```bash
# Update the repo URL in flux-kustomization.yaml first
kubectl apply -f flux-kustomization.yaml

# Check Flux reconciliation
flux get kustomizations --watch
```

## Post-Deployment Validation

### ✅ Core Components
- [ ] Namespace `idp-platform` is created
- [ ] Backend deployment has 2/2 pods running
- [ ] Frontend deployment has 2/2 pods running
- [ ] Services are exposing endpoints correctly
- [ ] RBAC permissions are configured

### ✅ Network and Security
- [ ] Istio Gateway is configured for `idp.davidmarkgardiner.co.uk`
- [ ] VirtualService is routing traffic correctly
- [ ] TLS certificate is issued and ready
- [ ] DNS record `idp.davidmarkgardiner.co.uk` resolves correctly

### ✅ Application Health
- [ ] Backend health endpoint responds: `https://idp.davidmarkgardiner.co.uk/api/health`
- [ ] Frontend loads successfully: `https://idp.davidmarkgardiner.co.uk`
- [ ] API endpoints are accessible through the gateway
- [ ] WebSocket connections work (if applicable)

### ✅ Integration Testing
- [ ] Backend can connect to Kubernetes API
- [ ] Backend can access Argo Workflows
- [ ] Backend can manage ASO resources
- [ ] Frontend can communicate with backend API

## Validation Commands

```bash
# Run comprehensive validation
./validate-deployment.sh

# Manual checks
kubectl get all -n idp-platform
kubectl get certificates -n idp-platform
kubectl get certificates -n aks-istio-system | grep idp
kubectl get gateway,virtualservice -n idp-platform

# Test endpoints
curl -k https://idp.davidmarkgardiner.co.uk/health
curl -k https://idp.davidmarkgardiner.co.uk/api/health

# Check logs
kubectl logs -f deployment/idp-backend -n idp-platform
kubectl logs -f deployment/idp-frontend -n idp-platform
```

## Troubleshooting Common Issues

### 🔍 Pods Not Starting
```bash
kubectl describe pods -n idp-platform
kubectl logs deployment/idp-backend -n idp-platform
kubectl get events -n idp-platform --sort-by='.lastTimestamp'
```

### 🔍 DNS/Certificate Issues
```bash
kubectl describe certificate idp-wildcard-tls-cert -n idp-platform
kubectl describe certificaterequest -n idp-platform
kubectl logs deployment/external-dns -n external-dns
kubectl logs deployment/cert-manager -n cert-manager
```

### 🔍 Network/Istio Issues
```bash
kubectl describe gateway idp-gateway -n idp-platform
kubectl describe virtualservice idp-virtualservice -n idp-platform
kubectl get svc -n aks-istio-system
istioctl proxy-status
```

### 🔍 Application Issues
```bash
# Port forward for direct access
kubectl port-forward -n idp-platform svc/idp-frontend-service 8080:80
kubectl port-forward -n idp-platform svc/idp-backend-service 8081:3001

# Check API connectivity
kubectl exec -it deployment/idp-backend -n idp-platform -- curl localhost:3001/health
```

## Performance and Scaling

### 📊 Resource Monitoring
```bash
kubectl top pods -n idp-platform
kubectl top nodes
kubectl describe hpa -n idp-platform  # If HPA is configured
```

### 📈 Scaling Operations
```bash
# Scale deployments
kubectl scale deployment idp-backend --replicas=3 -n idp-platform
kubectl scale deployment idp-frontend --replicas=3 -n idp-platform

# Check resource usage
kubectl describe deployment idp-backend -n idp-platform
kubectl describe deployment idp-frontend -n idp-platform
```

## Maintenance and Updates

### 🔄 Application Updates
```bash
# Build new version
export IMAGE_TAG=v1.1.0
./build-images.sh

# Push images
docker push davidgardiner/idp-backend:v1.1.0
docker push davidgardiner/idp-frontend:v1.1.0

# Update deployment
kubectl set image deployment/idp-backend backend=davidgardiner/idp-backend:v1.1.0 -n idp-platform
kubectl set image deployment/idp-frontend frontend=davidgardiner/idp-frontend:v1.1.0 -n idp-platform

# Monitor rollout
kubectl rollout status deployment/idp-backend -n idp-platform
kubectl rollout status deployment/idp-frontend -n idp-platform
```

### 🧹 Cleanup
```bash
# Remove application
./quick-deploy.sh delete

# Or complete cleanup
kubectl delete namespace idp-platform
kubectl delete certificate idp-wildcard-tls-cert -n aks-istio-system
kubectl delete -f flux-kustomization.yaml
```

## Production Readiness

### ✅ Security
- [ ] Security contexts configured for non-root execution
- [ ] Resource limits and requests are set
- [ ] Network policies implemented (if required)
- [ ] TLS encryption enabled
- [ ] RBAC follows least-privilege principle

### ✅ Reliability
- [ ] Multiple replicas for high availability
- [ ] Health checks configured
- [ ] Rolling update strategy
- [ ] Resource monitoring in place

### ✅ Observability
- [ ] Structured logging enabled
- [ ] Metrics collection configured
- [ ] Distributed tracing (if Istio is used)
- [ ] Alerting rules defined

### ✅ Backup and Recovery
- [ ] GitOps repository is backed up
- [ ] Configuration is version controlled
- [ ] Recovery procedures documented
- [ ] Disaster recovery plan in place

## Success Criteria

✅ **Deployment Complete** when:
- All pods are running and healthy
- DNS resolution works for `idp.davidmarkgardiner.co.uk`
- TLS certificate is valid and auto-renewing
- Application is accessible via HTTPS
- All health checks pass
- Integration with AKS management APIs works

🎉 **Ready for Production** when:
- All validation checks pass
- Performance testing completed
- Security review completed
- Monitoring and alerting configured
- Team training completed
- Documentation updated