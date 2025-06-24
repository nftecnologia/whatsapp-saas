#!/bin/bash
# EMERGENCY DEPLOYMENT SCRIPT FOR RAILWAY
# This script provides immediate deployment options when normal deployment fails

set -e

echo "🚨 EMERGENCY DEPLOYMENT SCRIPT STARTED 🚨"
echo "This script will attempt rapid deployment using simplified configurations"
echo

# Function to deploy with minimal config
deploy_minimal() {
    local service=$1
    echo "📦 Deploying $service with minimal configuration..."
    
    cd "$service"
    
    # Backup original configs
    if [ -f "railway.json" ]; then
        cp railway.json railway.json.backup
    fi
    
    if [ -f "Dockerfile" ]; then
        cp Dockerfile Dockerfile.backup
    fi
    
    # Use minimal configs
    if [ -f "railway.json.minimal" ]; then
        cp railway.json.minimal railway.json
        echo "✅ Using minimal railway.json for $service"
    fi
    
    if [ -f "Dockerfile.minimal" ]; then
        cp Dockerfile.minimal Dockerfile
        echo "✅ Using minimal Dockerfile for $service"
    fi
    
    cd ..
}

# Function to deploy with nixpacks
deploy_nixpacks() {
    local service=$1
    echo "📦 Deploying $service with NIXPACKS..."
    
    cd "$service"
    
    # Use nixpacks config
    if [ -f "nixpacks.toml.emergency" ]; then
        cp nixpacks.toml.emergency nixpacks.toml
        echo "✅ Using emergency nixpacks.toml for $service"
    fi
    
    # Create minimal railway.json for nixpacks
    cat > railway.json << EOF
{
  "\$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE"
  }
}
EOF
    
    cd ..
}

# Function to restore original configs
restore_configs() {
    local service=$1
    echo "🔄 Restoring original configs for $service..."
    
    cd "$service"
    
    if [ -f "railway.json.backup" ]; then
        mv railway.json.backup railway.json
    fi
    
    if [ -f "Dockerfile.backup" ]; then
        mv Dockerfile.backup Dockerfile
    fi
    
    cd ..
}

# Main deployment options
echo "Choose deployment strategy:"
echo "1) Deploy all services with minimal Dockerfiles"
echo "2) Deploy all services with NIXPACKS"
echo "3) Deploy individual service with minimal config"
echo "4) Deploy individual service with NIXPACKS"
echo "5) Restore original configurations"
echo

read -p "Enter choice (1-5): " choice

case $choice in
    1)
        echo "🚀 DEPLOYING ALL SERVICES WITH MINIMAL DOCKERFILES"
        deploy_minimal "backend-api"
        deploy_minimal "backend-worker"
        deploy_minimal "frontend"
        deploy_minimal "evolution-api"
        echo "✅ All services configured with minimal setup"
        echo "💡 Now deploy via Railway Dashboard or CLI"
        ;;
    2)
        echo "🚀 DEPLOYING ALL SERVICES WITH NIXPACKS"
        deploy_nixpacks "backend-api"
        deploy_nixpacks "backend-worker"
        deploy_nixpacks "frontend"
        echo "✅ All services configured with NIXPACKS"
        echo "💡 Now deploy via Railway Dashboard or CLI"
        ;;
    3)
        echo "Available services: backend-api, backend-worker, frontend, evolution-api"
        read -p "Enter service name: " service
        deploy_minimal "$service"
        echo "✅ $service configured with minimal setup"
        ;;
    4)
        echo "Available services: backend-api, backend-worker, frontend"
        read -p "Enter service name: " service
        deploy_nixpacks "$service"
        echo "✅ $service configured with NIXPACKS"
        ;;
    5)
        echo "🔄 RESTORING ORIGINAL CONFIGURATIONS"
        restore_configs "backend-api"
        restore_configs "backend-worker"
        restore_configs "frontend"
        restore_configs "evolution-api"
        echo "✅ Original configurations restored"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo
echo "🎯 NEXT STEPS:"
echo "1. Commit and push changes to GitHub"
echo "2. Deploy via Railway Dashboard or CLI"
echo "3. Monitor deployment logs"
echo "4. Test deployed services"
echo
echo "Railway CLI commands:"
echo "railway login"
echo "railway link [project-id]"
echo "railway up"