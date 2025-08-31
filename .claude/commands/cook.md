# AKS Infrastructure Orchestration Command

This command orchestrates multiple specialized agents to deploy, configure, test, and document a complete AKS infrastructure setup with security validation and chaos engineering.

## Phase 1: Infrastructure Provisioning

**Lead Agent: aso-deployment-agent**
Deploy and monitor Azure Service Operator resources:

1. aso-deployment-agent: Deploy AKS cluster, managed identities, resource groups, and Flux GitOps configuration. Monitor resource provisioning status and debug any ASO-related issues. Ensure all resources reach Ready state before handoff.

## Phase 2: Core Services Setup (Parallel)

**Agents run in parallel after Phase 1 completes**

1. cert-manager: Install cert-manager for TLS certificate management. Configure ClusterIssuer for Let's Encrypt staging and production. Verify certificate provisioning.
2. external-dns: Deploy external-dns with Azure DNS provider. Configure DNS zones and ensure proper workload identity binding. Test DNS record creation.

## Phase 3: Service Mesh & Ingress

**Lead Agent: istio-deployment-agent**

1. istio-deployment-agent: Deploy Istio service mesh with production configuration. Setup ingress gateways, configure mTLS, implement traffic policies. Deploy observability stack (Prometheus, Grafana, Kiali).

## Phase 4: Application Deployment

**Agents work sequentially**

1. app-deployment-agent: Deploy target applications with proper Istio sidecar injection. Configure VirtualServices and DestinationRules. Implement progressive delivery strategies.

## Phase 5: Security & Testing (Parallel)

**Multiple agents work in parallel**

1. security-scanner: Run OWASP ZAP scans against exposed endpoints. Check for misconfigurations in RBAC and network policies. Validate workload identity configurations.
2. test-automator: Execute integration tests against deployed services. Validate service mesh traffic routing. Test autoscaling and load balancing.
3. chaos-engineer: Inject controlled failures (pod deletions, network latency, resource constraints). Document system resilience and recovery times.

## Phase 6: Monitoring & Documentation

**Agents work in parallel**

1. sre-monitor: Monitor cluster health, resource utilization, and application metrics. Set up alerts and runbooks. Document operational procedures.
2. documentation-engineer: Capture deployment artifacts, configuration details, and test results. Generate architecture diagrams and operational guides.

## Phase 7: Change Management

**Final phase after all validations**

1. change-manager: Compile comprehensive change request with deployment evidence, test results, and security assessments. Prepare rollback procedures and present for production approval.

## Error Handling & Recovery

**Support Agent: sre-debugger**

- Activates automatically when any agent encounters errors
- Provides root cause analysis and remediation steps
- Coordinates with failing agents for retry strategies

## State Management

All agents share state through:

- Kubernetes ConfigMaps for configuration data
- Memory service for operational patterns
- Git repository for infrastructure as code

## Success Criteria

- All ASO resources in Ready state
- DNS records resolving correctly
- Istio mesh healthy with mTLS enabled
- Applications accessible through ingress
- Security scans pass without critical findings
- Chaos tests demonstrate resilience
- Documentation complete and reviewed

## Rollback Strategy

Each phase maintains rollback points:

- Phase 1: Delete ASO resources via kubectl
- Phase 2-4: Helm rollback for each component
- Phase 5-7: No infrastructure changes, documentation only

## Agent Communication Protocol

Agents communicate through:

1. Shared memory context for operational state
2. Kubernetes events for status updates
3. Git commits for configuration changes
4. Structured handoff messages with validation criteria

## Execution Command

```bash
# Execute the full orchestration
claude cook

# Execute specific phase
claude cook --phase 1

# Execute with dry-run
claude cook --dry-run

# Execute with custom timeout
claude cook --timeout 3600
```

## Monitoring Dashboard

Track progress at:

- Kubernetes Dashboard: Resource provisioning
- Istio Kiali: Service mesh topology
- Grafana: Metrics and alerts
- Git Repository: Configuration history
