/**
 * Cypress Kubernetes Commands
 * 
 * Custom Cypress commands for validating Kubernetes resources and pod health
 * These commands are used by the IDP pod health validation tests
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

module.exports = {
  /**
   * Validate pod resources in a given namespace
   */
  async validatePodResources({ namespace, labels, expectedCount = null }) {
    try {
      const { stdout } = await execAsync(`kubectl get pods -n ${namespace} -l ${labels} -o json`);
      const podList = JSON.parse(stdout);
      
      const pods = podList.items.map(pod => ({
        name: pod.metadata.name,
        status: pod.status.phase,
        ready: `${pod.status.containerStatuses?.filter(c => c.ready).length || 0}/${pod.spec.containers.length}`,
        restarts: pod.status.containerStatuses?.reduce((total, c) => total + c.restartCount, 0) || 0,
        age: pod.metadata.creationTimestamp,
        node: pod.spec.nodeName
      }));
      
      const runningPods = pods.filter(pod => pod.status === 'Running');
      
      return {
        success: true,
        pods: pods,
        runningCount: runningPods.length,
        totalCount: pods.length,
        expectedCount: expectedCount,
        meetsExpectations: expectedCount ? runningPods.length >= expectedCount : true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        pods: []
      };
    }
  },

  /**
   * Test service connectivity within the cluster
   */
  async validateServiceConnectivity({ namespace, services }) {
    const results = [];
    
    for (const service of services) {
      try {
        const testPodName = `connectivity-test-${Date.now()}`;
        const curlCommand = `kubectl run ${testPodName} --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- curl -f -s --connect-timeout 10 http://${service.name}.${namespace}.svc.cluster.local:${service.port}${service.path || '/'}`;
        
        await execAsync(curlCommand);
        
        results.push({
          service: service.name,
          port: service.port,
          path: service.path || '/',
          accessible: true,
          error: null
        });
      } catch (error) {
        results.push({
          service: service.name,
          port: service.port,
          path: service.path || '/',
          accessible: false,
          error: error.message
        });
      }
    }
    
    return {
      success: results.every(r => r.accessible),
      results: results
    };
  },

  /**
   * Validate service endpoints
   */
  async validateServiceEndpoints({ namespace, services }) {
    const endpoints = [];
    
    for (const serviceName of services) {
      try {
        const { stdout } = await execAsync(`kubectl get endpoints ${serviceName} -n ${namespace} -o json`);
        const endpoint = JSON.parse(stdout);
        
        const addresses = endpoint.subsets?.flatMap(subset => 
          subset.addresses?.map(addr => ({
            ip: addr.ip,
            nodeName: addr.nodeName,
            targetRef: addr.targetRef
          })) || []
        ) || [];
        
        endpoints.push({
          service: serviceName,
          addresses: addresses,
          ready: addresses.length > 0
        });
      } catch (error) {
        endpoints.push({
          service: serviceName,
          addresses: [],
          ready: false,
          error: error.message
        });
      }
    }
    
    return {
      success: endpoints.every(e => e.ready),
      endpoints: endpoints
    };
  },

  /**
   * Test cross-service communication
   */
  async testCrossServiceCommunication({ namespace, fromService, toService, endpoint }) {
    try {
      const testPodName = `cross-comm-test-${Date.now()}`;
      const curlCommand = `kubectl run ${testPodName} --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- curl -f -s -w "%{http_code}" --connect-timeout 10 http://${toService}.${namespace}.svc.cluster.local:3001${endpoint}`;
      
      const { stdout } = await execAsync(curlCommand);
      const responseCode = parseInt(stdout.trim().slice(-3)); // Get last 3 characters (HTTP code)
      
      return {
        success: responseCode >= 200 && responseCode < 400,
        responseCode: responseCode,
        fromService: fromService,
        toService: toService,
        endpoint: endpoint
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        fromService: fromService,
        toService: toService,
        endpoint: endpoint
      };
    }
  },

  /**
   * Validate pod resilience (check restart counts)
   */
  async validatePodResilience({ namespace, labels }) {
    try {
      const { stdout } = await execAsync(`kubectl get pods -n ${namespace} -l ${labels} -o json`);
      const podList = JSON.parse(stdout);
      
      const totalRestarts = podList.items.reduce((total, pod) => {
        const podRestarts = pod.status.containerStatuses?.reduce((podTotal, container) => 
          podTotal + container.restartCount, 0) || 0;
        return total + podRestarts;
      }, 0);
      
      const pods = podList.items.map(pod => ({
        name: pod.metadata.name,
        restarts: pod.status.containerStatuses?.reduce((total, c) => total + c.restartCount, 0) || 0,
        status: pod.status.phase,
        creationTimestamp: pod.metadata.creationTimestamp
      }));
      
      return {
        success: true,
        restartCount: totalRestarts,
        pods: pods,
        healthy: totalRestarts < 10 // Arbitrary threshold
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        restartCount: -1
      };
    }
  },

  /**
   * Get detailed pod logs for debugging
   */
  async getPodLogs({ namespace, podName, lines = 50 }) {
    try {
      const { stdout } = await execAsync(`kubectl logs ${podName} -n ${namespace} --tail=${lines}`);
      return {
        success: true,
        logs: stdout,
        podName: podName
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        logs: '',
        podName: podName
      };
    }
  },

  /**
   * Validate Istio sidecar injection
   */
  async validateIstioSidecar({ namespace, labels }) {
    try {
      const { stdout } = await execAsync(`kubectl get pods -n ${namespace} -l ${labels} -o json`);
      const podList = JSON.parse(stdout);
      
      const podsWithSidecar = podList.items.map(pod => ({
        name: pod.metadata.name,
        hasSidecar: pod.spec.containers.some(container => container.name === 'istio-proxy'),
        containerCount: pod.spec.containers.length,
        containers: pod.spec.containers.map(c => c.name)
      }));
      
      return {
        success: true,
        pods: podsWithSidecar,
        sidecarInjected: podsWithSidecar.every(p => p.hasSidecar)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        pods: []
      };
    }
  },

  /**
   * Test external ingress connectivity
   */
  async testExternalConnectivity({ url, timeout = 30000 }) {
    try {
      const testPodName = `external-test-${Date.now()}`;
      const curlCommand = `kubectl run ${testPodName} --rm -i --restart=Never --image=curlimages/curl:latest --timeout=30s -- curl -f -s -w "%{http_code}" --connect-timeout 10 ${url}`;
      
      const { stdout } = await execAsync(curlCommand);
      const responseCode = parseInt(stdout.trim().slice(-3));
      
      return {
        success: responseCode >= 200 && responseCode < 400,
        responseCode: responseCode,
        url: url
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        url: url
      };
    }
  }
};