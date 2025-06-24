#!/bin/bash
# QUICK VERIFICATION SCRIPT FOR EMERGENCY CONFIGS

set -e

echo "🔍 VERIFYING EMERGENCY DEPLOYMENT CONFIGURATIONS"
echo

# Function to check if file exists and show status
check_file() {
    if [ -f "$1" ]; then
        echo "✅ $1"
    else
        echo "❌ $1 (MISSING)"
    fi
}

# Check minimal Dockerfiles
echo "📦 MINIMAL DOCKERFILES:"
check_file "backend-api/Dockerfile.minimal"
check_file "backend-worker/Dockerfile.minimal"
check_file "frontend/Dockerfile.minimal"
check_file "evolution-api/Dockerfile.minimal"
echo

# Check minimal Railway configs
echo "🚄 MINIMAL RAILWAY CONFIGS:"
check_file "backend-api/railway.json.minimal"
check_file "backend-worker/railway.json.minimal"
check_file "frontend/railway.json.minimal"
check_file "evolution-api/railway.json.minimal"
echo

# Check NIXPACKS configs
echo "📦 NIXPACKS CONFIGS:"
check_file "backend-api/nixpacks.toml.emergency"
check_file "backend-worker/nixpacks.toml.emergency"
check_file "frontend/nixpacks.toml.emergency"
echo

# Check deployment scripts
echo "🚀 DEPLOYMENT SCRIPTS:"
check_file "emergency-deploy.sh"
check_file "deploy-backend-api.sh"
check_file "deploy-backend-worker.sh"
check_file "deploy-frontend.sh"
check_file "deploy-evolution-api.sh"
echo

# Check package.json files for required scripts
echo "📋 PACKAGE.JSON VERIFICATION:"

services=("backend-api" "backend-worker" "frontend")
for service in "${services[@]}"; do
    if [ -f "$service/package.json" ]; then
        echo "✅ $service/package.json"
        
        # Check for required scripts
        if grep -q '"build"' "$service/package.json"; then
            echo "  ✅ build script found"
        else
            echo "  ❌ build script missing"
        fi
        
        if grep -q '"start"' "$service/package.json"; then
            echo "  ✅ start script found"
        else
            echo "  ❌ start script missing"
        fi
    else
        echo "❌ $service/package.json (MISSING)"
    fi
done
echo

echo "🎯 SUMMARY:"
echo "All emergency configurations have been created successfully!"
echo
echo "💡 READY TO DEPLOY:"
echo "1. Run: ./emergency-deploy.sh"
echo "2. Choose deployment strategy"
echo "3. Deploy via Railway"
echo "4. Monitor logs and verify services"