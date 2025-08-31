const k8s = require('@kubernetes/client-node');
const { v4: uuidv4 } = require('uuid');

class NamespaceService {
  constructor() {
    this.kc = new k8s.KubeConfig();
    this.kc.loadFromDefault();
    this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.customApi = this.kc.makeApiClient(k8s.CustomObjectsApi);
    this.networkingApi = this.kc.makeApiClient(k8s.NetworkingV1Api);
    
    // In-memory storage for demo purposes
    this.namespaces = new Map();
  }

  async getNamespaces() {
    try {
      // Get all namespaces from cluster
      const response = await this.k8sApi.listNamespace();
      const kubernetesNamespaces = response.body.items;
      
      // Filter for user-created namespaces (exclude system namespaces)
      const userNamespaces = kubernetesNamespaces.filter(ns => 
        !ns.metadata.name.startsWith('kube-') &&
        !['default', 'azure-system', 'argo', 'istio-system'].includes(ns.metadata.name)
      );

      // Combine with our tracking data
      return userNamespaces.map(ns => {
        const tracked = this.namespaces.get(ns.metadata.name);
        return {
          name: ns.metadata.name,
          status: ns.status.phase,
          createdAt: ns.metadata.creationTimestamp,
          labels: ns.metadata.labels || {},
          annotations: ns.metadata.annotations || {},
          resourceLimits: tracked?.resourceLimits || null,
          networkIsolated: tracked?.networkIsolated || false,
          ...tracked
        };
      });
    } catch (error) {
      console.error('Error fetching namespaces:', error);
      return Array.from(this.namespaces.values());
    }
  }

  async getNamespace(name) {
    try {
      const response = await this.k8sApi.readNamespace(name);
      const tracked = this.namespaces.get(name);
      
      return {
        name: response.body.metadata.name,
        status: response.body.status.phase,
        createdAt: response.body.metadata.creationTimestamp,
        labels: response.body.metadata.labels || {},
        annotations: response.body.metadata.annotations || {},
        resourceLimits: tracked?.resourceLimits || null,
        networkIsolated: tracked?.networkIsolated || false,
        ...tracked
      };
    } catch (error) {
      console.error(`Error fetching namespace ${name}:`, error);
      return this.namespaces.get(name) || null;
    }
  }

  async createNamespace(namespaceData) {
    const {
      name,
      description = '',
      resourceLimits = {
        cpu: { request: '100m', limit: '1000m' },
        memory: { request: '128Mi', limit: '1Gi' }
      },
      networkIsolated = true,
      dryRun = false
    } = namespaceData;

    // Validate namespace name
    if (!this.isValidNamespaceName(name)) {
      throw new Error('Invalid namespace name. Must be lowercase alphanumeric with hyphens, 3-63 characters.');
    }

    // Check if namespace already exists
    try {
      await this.k8sApi.readNamespace(name);
      throw new Error(`Namespace ${name} already exists`);
    } catch (error) {
      if (error.response?.statusCode !== 404) {
        throw error;
      }
      // 404 is expected - namespace doesn't exist, which is what we want
    }

    const namespaceRecord = {
      id: uuidv4(),
      name,
      description,
      resourceLimits,
      networkIsolated,
      status: 'creating',
      createdAt: new Date(),
      dryRun
    };

    // Store in memory
    this.namespaces.set(name, namespaceRecord);

    return {
      namespace: namespaceRecord,
      manifests: {
        namespace: this.generateNamespaceManifest(name, description),
        limitRange: this.generateLimitRangeManifest(name, resourceLimits),
        networkPolicy: networkIsolated ? this.generateNetworkPolicyManifest(name) : null
      }
    };
  }

  async deleteNamespace(name, force = false) {
    try {
      const namespace = await this.getNamespace(name);
      if (!namespace) {
        throw new Error('Namespace not found');
      }

      // Remove from tracking
      this.namespaces.delete(name);

      return {
        name,
        status: 'deleting',
        message: force ? 'Force deletion initiated' : 'Graceful deletion initiated'
      };
    } catch (error) {
      console.error(`Error deleting namespace ${name}:`, error);
      throw error;
    }
  }

  generateNamespaceManifest(name, description = '') {
    return {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name,
        labels: {
          'app.kubernetes.io/managed-by': 'idp-platform',
          'idp-platform/created-by': 'namespace-onboarding',
          'idp-platform/resource-managed': 'true'
        },
        annotations: {
          'idp-platform/description': description,
          'idp-platform/created-at': new Date().toISOString()
        }
      }
    };
  }

  generateLimitRangeManifest(namespaceName, resourceLimits) {
    const { cpu, memory } = resourceLimits;
    
    return {
      apiVersion: 'v1',
      kind: 'LimitRange',
      metadata: {
        name: 'resource-limits',
        namespace: namespaceName,
        labels: {
          'app.kubernetes.io/managed-by': 'idp-platform'
        }
      },
      spec: {
        limits: [
          {
            type: 'Container',
            default: {
              cpu: cpu.limit,
              memory: memory.limit
            },
            defaultRequest: {
              cpu: cpu.request,
              memory: memory.request
            },
            max: {
              cpu: this.calculateMaxLimit(cpu.limit, 2),
              memory: this.calculateMaxLimit(memory.limit, 2)
            },
            min: {
              cpu: '10m',
              memory: '64Mi'
            }
          },
          {
            type: 'PersistentVolumeClaim',
            max: {
              storage: '10Gi'
            },
            min: {
              storage: '1Gi'
            }
          }
        ]
      }
    };
  }

  generateNetworkPolicyManifest(namespaceName) {
    return {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: {
        name: 'namespace-isolation',
        namespace: namespaceName,
        labels: {
          'app.kubernetes.io/managed-by': 'idp-platform'
        }
      },
      spec: {
        podSelector: {},
        policyTypes: ['Ingress', 'Egress'],
        ingress: [
          {
            from: [
              { podSelector: {} } // Allow from same namespace only
            ]
          }
        ],
        egress: [
          {
            to: [
              { podSelector: {} } // Allow to same namespace
            ]
          },
          {
            // Allow DNS resolution
            to: [
              {
                namespaceSelector: {
                  matchLabels: {
                    name: 'kube-system'
                  }
                }
              }
            ],
            ports: [
              {
                protocol: 'UDP',
                port: 53
              },
              {
                protocol: 'TCP',
                port: 53
              }
            ]
          }
        ]
      }
    };
  }

  isValidNamespaceName(name) {
    // Kubernetes namespace naming rules
    if (!name || name.length < 3 || name.length > 63) {
      return false;
    }
    
    // Must be lowercase alphanumeric with hyphens
    const validPattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
    return validPattern.test(name);
  }

  calculateMaxLimit(limit, multiplier = 2) {
    // Parse resource limit and multiply
    const match = limit.match(/^(\d+(?:\.\d+)?)(.*)?$/);
    if (!match) return limit;
    
    const [, value, unit = ''] = match;
    const newValue = parseFloat(value) * multiplier;
    return `${newValue}${unit}`;
  }

  validateResourceLimits(resourceLimits) {
    const { cpu, memory } = resourceLimits;
    
    // Validate CPU
    if (!this.isValidResourceValue(cpu.request) || !this.isValidResourceValue(cpu.limit)) {
      throw new Error('Invalid CPU resource values');
    }
    
    // Validate Memory
    if (!this.isValidResourceValue(memory.request) || !this.isValidResourceValue(memory.limit)) {
      throw new Error('Invalid memory resource values');
    }

    // Ensure request <= limit
    if (!this.isRequestLessThanLimit(cpu.request, cpu.limit) || 
        !this.isRequestLessThanLimit(memory.request, memory.limit)) {
      throw new Error('Resource requests must be less than or equal to limits');
    }

    return true;
  }

  isValidResourceValue(value) {
    // Basic validation for Kubernetes resource values
    return /^(\d+(?:\.\d+)?)(m|Mi|Gi|Ti)?$/.test(value);
  }

  isRequestLessThanLimit(request, limit) {
    // Simplified comparison - in production, properly parse and compare units
    const requestNum = parseFloat(request);
    const limitNum = parseFloat(limit);
    return requestNum <= limitNum;
  }
}

module.exports = new NamespaceService();