# Flux Setup Instructions

## 1. Push Configuration to GitHub Repository

You'll need to push the prepared configurations to your GitHub repository:

```bash
# Navigate to the local configuration directory
cd /Users/davidgardiner/Desktop/repo/aso-flux

# Initialize Git if needed
git init
git remote add origin https://github.com/davidmarkgardiner/aso-flux.git

# Add all files
git add .

# Commit
git commit -m "Initial Flux configuration"

# Push to the main branch
git push -u origin main
```

## 2. Install Flux Extension on AKS

Run the following script to install and configure Flux on your AKS cluster:

```bash
# Make script executable
chmod +x /Users/davidgardiner/Desktop/repo/aso-nap/working-claude/flux-config.sh

# Run the script
/Users/davidgardiner/Desktop/repo/aso-nap/working-claude/flux-config.sh
```

## 3. Apply Node Pools and Test Workloads

Since the cluster is private, you'll need to use ASO to create the resources:

```bash
# Apply the node pools
kubectl apply -f /Users/davidgardiner/Desktop/repo/aso-nap/working-claude/node-classes.yaml

# Apply the test workloads
kubectl apply -f /Users/davidgardiner/Desktop/repo/aso-nap/working-claude/nap-test.yaml
```

## 4. Verify Deployment

Check the Flux installation:

```bash
# Check Flux extension
kubectl get extension aso-flux-extension -n default

# Check Flux configuration
kubectl get fluxconfiguration aso-flux-config -n default
```

Check the deployed resources:

```bash
# Check for deployments in demo-app namespace (deployed by Flux)
kubectl get all -n demo-app

# Check the NAP test pods
kubectl get pods -n nap-test
```

## 5. Monitoring and Troubleshooting

Monitor Flux status:

```bash
# Check Flux controllers
kubectl get deployment -n flux-system

# Check GitRepository resource
kubectl get gitrepository -n flux-system

# Check Kustomization resource
kubectl get kustomization -n flux-system
```

If you need to debug:

```bash
# Check Flux logs
kubectl logs -n flux-system deployment/source-controller
kubectl logs -n flux-system deployment/kustomize-controller
```
