# Migration Guide: AWS to Google Cloud Platform (GKE)

This guide explains how to migrate the Hello Eyego application from AWS EKS to Google Kubernetes Engine (GKE).

## Prerequisites

- Google Cloud SDK installed (`gcloud` CLI)
- Docker installed
- `kubectl` installed
- Google Cloud Project with billing enabled

## Step 1: Setup Google Cloud Environment

```bash
# Login to Google Cloud
gcloud auth login

# Set your project ID
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable container.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

## Step 2: Create GKE Cluster

```bash
# Create GKE cluster
gcloud container clusters create hello-eyego-cluster \
  --zone us-central1-a \
  --num-nodes 2 \
  --enable-autoscaling \
  --min-nodes 1 \
  --max-nodes 4 \
  --machine-type e2-medium \
  --enable-autorepair \
  --enable-autoupgrade

# Get cluster credentials
gcloud container clusters get-credentials hello-eyego-cluster --zone us-central1-a
```

## Step 3: Setup Container Registry

```bash
# Configure Docker to use gcloud as credential helper
gcloud auth configure-docker

# Build and tag image for Google Container Registry
docker build -t gcr.io/$PROJECT_ID/hello-eyego:latest .

# Push to Google Container Registry
docker push gcr.io/$PROJECT_ID/hello-eyego:latest
```

## Step 4: Update Kubernetes Manifests

Update the `k8s/deployment.yaml` file:

```yaml
# Change the image reference from:
image: hello-eyego:latest

# To:
image: gcr.io/YOUR_PROJECT_ID/hello-eyego:latest
```

Update the `k8s/ingress.yaml` file for GKE:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: hello-eyego-ingress
  namespace: hello-eyego
  annotations:
    kubernetes.io/ingress.class: gce
    kubernetes.io/ingress.global-static-ip-name: hello-eyego-ip
spec:
  rules:
  - host: hello-eyego.example.com
    http:
      paths:
      - path: /*
        pathType: ImplementationSpecific
        backend:
          service:
            name: hello-eyego-service
            port:
              number: 80
```

## Step 5: Deploy Application

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Wait for deployment
kubectl rollout status deployment/hello-eyego-deployment -n hello-eyego

# Get external IP
kubectl get services -n hello-eyego
```

## Step 6: Update CI/CD Pipeline

Create `.github/workflows/gcp-ci-cd.yaml`:

```yaml
name: GCP CI/CD Pipeline

on:
  push:
    branches: [ main ]

env:
  PROJECT_ID: your-project-id
  GKE_CLUSTER: hello-eyego-cluster
  GKE_ZONE: us-central1-a

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - uses: google-github-actions/setup-gcloud@v1
      with:
        service_account_key: ${{ secrets.GCP_SA_KEY }}
        project_id: ${{ env.PROJECT_ID }}
    
    - run: gcloud auth configure-docker
    
    - run: |
        docker build -t gcr.io/$PROJECT_ID/hello-eyego:$GITHUB_SHA .
        docker push gcr.io/$PROJECT_ID/hello-eyego:$GITHUB_SHA
    
    - run: gcloud container clusters get-credentials $GKE_CLUSTER --zone $GKE_ZONE
    
    - run: |
        sed -i "s|image: hello-eyego:latest|image: gcr.io/$PROJECT_ID/hello-eyego:$GITHUB_SHA|g" k8s/deployment.yaml
        kubectl apply -f k8s/
        kubectl rollout status deployment/hello-eyego-deployment -n hello-eyego
```

## Cost Optimization

- Use preemptible nodes for cost savings
- Set up cluster autoscaling
- Use Google Cloud's sustained use discounts

## Key Differences from AWS

1. **Container Registry**: GCR instead of ECR
2. **Load Balancer**: Google Cloud Load Balancer instead of ALB
3. **Ingress Controller**: Built-in GCE ingress instead of AWS Load Balancer Controller
4. **Authentication**: Service Account keys instead of IAM roles
