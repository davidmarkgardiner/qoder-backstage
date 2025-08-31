---
name: deploy-aks-stack
description: Automated deployment of complete AKS stack with ASO, cert-manager, and external-dns
---

You are a multi-agent orchestrator responsible for deploying a complete AKS stack using Azure Service Operator (ASO), cert-manager, and external-dns.

## Deployment Sequence

Execute the following agents in order:

Make sure you are in minikube k8s cluster
➜ kubectx minikube
Switched to context "minikube".

### 1. ASO Deployment Agent

Deploy ASO resources with the monitoring workflow:

- Wait 20 minutes initially after applying manifests
- Check cluster readiness every 5 minutes
- Debug any API issues
- Update memory-aso.json throughout deployment
- Confirm cluster is accessible via kubeconfig

### 2. Agent Cert-Manager Specialist

Once ASO deployment is complete:

- Install cert-manager v1.15.3 via Helm
- Configure Azure Workload Identity integration
- Set up Let's Encrypt ClusterIssuers (DNS-01 and HTTP-01)
- Create test certificates for validation
- Disable ServiceMonitor unless explicitly needed
- Update memory-certmanager.json with configuration

### 3. Agent External-DNS Specialist

After cert-manager is configured:

- Deploy external-dns via Helm
- Configure Azure DNS provider with workload identity
- Enable multiple sources (services, ingresses, Istio)
- Test DNS record creation and cleanup
- Ensure integration with cert-manager DNS01 challenges
- Update memory-externaldns.json with setup details

## Prerequisites Check

Before starting, verify:

- Azure subscription with contributor access
- ASO operator is installed and running
- Required resource groups and identities exist
- DNS zone is available for management

## Configuration Variables

These should be set or confirmed:

- **Region**: uksouth
- **DNS Zone**: davidmarkgardiner.co.uk
- **Namespace**: aso
- **Cluster Name**: Pattern like uk8s-tsshared-weu-gt025-int-prod

## Success Criteria

- ✅ AKS cluster operational and accessible
- ✅ Cert-manager issuing test certificates
- ✅ External-dns managing DNS records
- ✅ All memory files updated with patterns
- ✅ Complete handoff documentation generated

## Error Handling

If any stage fails:

1. Debug the specific issue
2. Update memory files with lessons learned
3. Retry from the failed stage
4. Do NOT proceed to next agent until current stage succeeds

## Final Output

Provide a comprehensive summary including:

- Cluster access details (FQDN, kubeconfig path)
- Identity configurations
- DNS and certificate status
- Next steps for application deployment

This command orchestrates the complete infrastructure stack deployment with proper monitoring, error handling, and documentation throughout the process.
