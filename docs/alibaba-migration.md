# Migration Guide: AWS to Alibaba Cloud (ACK)

This guide explains how to migrate the Hello Eyego application from AWS EKS to Alibaba Cloud Container Service for Kubernetes (ACK).

## Prerequisites

- Alibaba Cloud CLI installed
- Docker installed
- `kubectl` installed
- Alibaba Cloud account with sufficient permissions

## Step 1: Setup Alibaba Cloud Environment

```bash
# Configure Alibaba Cloud CLI
aliyun configure

# Set environment variables
export REGION_ID="cn-hangzhou"
export CLUSTER_NAME="hello-eyego-cluster"
export NAMESPACE_NAME="default"
```

## Step 2: Create ACK Cluster

```bash
# Create managed Kubernetes cluster
aliyun cs CreateCluster \
  --name $CLUSTER_NAME \
  --cluster-type ManagedKubernetes \
  --region-id $REGION_ID \
  --kubernetes-version 1.28.3-aliyun.1 \
  --runtime docker \
  --num-of-nodes 2 \
  --master-instance-types ecs.n4.large \
  --worker-instance-types ecs.n4.large \
  --worker-system-disk-category cloud_efficiency \
  --worker-system-disk-size 120 \
  --worker-data-disk true \
  --worker-data-disk-category cloud_efficiency \
  --worker-data-disk-size 200 \
  --ssh-flags true \
  --cloud-monitor-flags true \
  --login-password YourPassword123! \
  --vpcid vpc-xxxxxxxx \
  --container-cidr 172.16.0.0/16 \
  --service-cidr 172.19.0.0/20

# Get cluster credentials
aliyun cs DescribeClusterUserKubeconfig --ClusterId <cluster-id> > ~/.kube/config
```

## Step 3: Setup Container Registry (ACR)

```bash
# Create namespace in ACR
aliyun cr CreateNamespace --NamespaceName hello-eyego

# Login to ACR
docker login --username=<your-username> registry.cn-hangzhou.aliyuncs.com

# Build and tag image
docker build -t registry.cn-hangzhou.aliyuncs.com/hello-eyego/hello-eyego:latest .

# Push to ACR
docker push registry.cn-hangzhou.aliyuncs.com/hello-eyego/hello-eyego:latest
```

## Step 4: Update Kubernetes Manifests

Update the `k8s/deployment.yaml` file:

```yaml
# Change the image reference from:
image: hello-eyego:latest

# To:
image: registry.cn-hangzhou.aliyuncs.com/hello-eyego/hello-eyego:latest
```

Update the `k8s/service.yaml` for Alibaba Cloud SLB:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: hello-eyego-service
  namespace: hello-eyego
  annotations:
    service.beta.kubernetes.io/alibaba-cloud-loadbalancer-spec: "slb.s1.small"
    service.beta.kubernetes.io/alibaba-cloud-loadbalancer-charge-type: "paybytraffic"
spec:
  selector:
    app: hello-eyego
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: LoadBalancer
```

Update the `k8s/ingress.yaml` for Alibaba Cloud:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: hello-eyego-ingress
  namespace: hello-eyego
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - host: hello-eyego.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
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

Create `.github/workflows/alibaba-ci-cd.yaml`:

```yaml
name: Alibaba Cloud CI/CD Pipeline

on:
  push:
    branches: [ main ]

env:
  REGION_ID: cn-hangzhou
  ACR_REGISTRY: registry.cn-hangzhou.aliyuncs.com
  ACR_NAMESPACE: hello-eyego
  ACK_CLUSTER_ID: ${{ secrets.ACK_CLUSTER_ID }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Alibaba Cloud CLI
      run: |
        wget https://aliyuncli.alicdn.com/aliyun-cli-linux-latest-amd64.tgz
        tar -xzf aliyun-cli-linux-latest-amd64.tgz
        sudo mv aliyun /usr/local/bin/
        aliyun configure set \
          --profile default \
          --mode AK \
          --region ${{ env.REGION_ID }} \
          --access-key-id ${{ secrets.ALIBABA_ACCESS_KEY_ID }} \
          --access-key-secret ${{ secrets.ALIBABA_ACCESS_KEY_SECRET }}
    
    - name: Login to ACR
      run: |
        docker login --username=${{ secrets.ACR_USERNAME }} --password=${{ secrets.ACR_PASSWORD }} ${{ env.ACR_REGISTRY }}
    
    - name: Build and push image
      run: |
        IMAGE_TAG=${{ github.sha }}
        docker build -t ${{ env.ACR_REGISTRY }}/${{ env.ACR_NAMESPACE }}/hello-eyego:$IMAGE_TAG .
        docker push ${{ env.ACR_REGISTRY }}/${{ env.ACR_NAMESPACE }}/hello-eyego:$IMAGE_TAG
    
    - name: Update kubeconfig
      run: |
        aliyun cs DescribeClusterUserKubeconfig --ClusterId ${{ env.ACK_CLUSTER_ID }} > ~/.kube/config
    
    - name: Deploy to ACK
      run: |
        IMAGE_TAG=${{ github.sha }}
        sed -i "s|image: hello-eyego:latest|image: ${{ env.ACR_REGISTRY }}/${{ env.ACR_NAMESPACE }}/hello-eyego:$IMAGE_TAG|g" k8s/deployment.yaml
        kubectl apply -f k8s/
        kubectl rollout status deployment/hello-eyego-deployment -n hello-eyego
```

## Step 7: Setup Monitoring (Optional)

```bash
# Install ARMS (Application Real-Time Monitoring Service)
kubectl apply -f https://raw.githubusercontent.com/AliyunContainerService/ack-arms-pilot/master/arms-pilot.yaml

# Add monitoring annotations to deployment
kubectl patch deployment hello-eyego-deployment -n hello-eyego -p '{"spec":{"template":{"metadata":{"annotations":{"armsPilotAutoEnable":"on","armsPilotCreateAppName":"hello-eyego"}}}}}'
```

## Cost Optimization for Alibaba Cloud

1. **Use Spot Instances**: Enable spot instances for worker nodes
2. **Auto Scaling**: Configure cluster auto-scaling
3. **Resource Management**: Set appropriate resource requests and limits
4. **Storage Optimization**: Use appropriate storage classes

## Key Differences from AWS

1. **Container Registry**: ACR instead of ECR
2. **Load Balancer**: Server Load Balancer (SLB) instead of ALB
3. **Ingress Controller**: Nginx-based instead of AWS Load Balancer Controller
4. **Monitoring**: ARMS instead of CloudWatch
5. **CLI Tool**: Alibaba Cloud CLI instead of AWS CLI

## Required Secrets for GitHub Actions

Add these secrets to your GitHub repository:

- `ALIBABA_ACCESS_KEY_ID`: Alibaba Cloud Access Key ID
- `ALIBABA_ACCESS_KEY_SECRET`: Alibaba Cloud Access Key Secret
- `ACR_USERNAME`: ACR username
- `ACR_PASSWORD`: ACR password
- `ACK_CLUSTER_ID`: ACK cluster ID
