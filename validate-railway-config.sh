#!/bin/bash

echo "🔍 Railway Configuration Validation Script"
echo "=========================================="
echo

# Check all services have required files
services=("backend-api" "backend-worker" "frontend" "evolution-api")

for service in "${services[@]}"; do
    echo "🔧 Validating $service..."
    
    # Check Dockerfile exists
    if [[ -f "$service/Dockerfile" ]]; then
        echo "  ✅ Dockerfile exists"
    else
        echo "  ❌ Dockerfile missing"
    fi
    
    # Check railway.json exists
    if [[ -f "$service/railway.json" ]]; then
        echo "  ✅ railway.json exists"
        
        # Check dockerfilePath configuration
        dockerfile_path=$(grep -o '"dockerfilePath": "[^"]*"' "$service/railway.json" | cut -d'"' -f4)
        if [[ -n "$dockerfile_path" ]]; then
            echo "  📄 dockerfilePath: $dockerfile_path"
            
            # Validate path exists
            if [[ -f "$service/$dockerfile_path" ]]; then
                echo "  ✅ Dockerfile path valid"
            else
                echo "  ❌ Dockerfile path invalid"
            fi
        else
            echo "  📄 dockerfilePath: <default>"
        fi
    else
        echo "  ❌ railway.json missing"
    fi
    
    # Check .dockerignore exists
    if [[ -f "$service/.dockerignore" ]]; then
        echo "  ✅ .dockerignore exists"
    else
        echo "  ⚠️  .dockerignore missing (optional)"
    fi
    
    echo
done

echo "🏗️  Railway Build Configuration Summary"
echo "======================================="
echo

for service in "${services[@]}"; do
    if [[ -f "$service/railway.json" ]]; then
        echo "📦 $service:"
        echo "   Builder: $(grep -o '"builder": "[^"]*"' "$service/railway.json" | cut -d'"' -f4)"
        dockerfile_path=$(grep -o '"dockerfilePath": "[^"]*"' "$service/railway.json" | cut -d'"' -f4)
        if [[ -n "$dockerfile_path" ]]; then
            echo "   Dockerfile: $dockerfile_path"
        else
            echo "   Dockerfile: <default discovery>"
        fi
        echo
    fi
done

echo "🎯 Deployment Readiness Check"
echo "============================="

all_valid=true

for service in "${services[@]}"; do
    if [[ ! -f "$service/Dockerfile" ]] || [[ ! -f "$service/railway.json" ]]; then
        all_valid=false
        break
    fi
done

if $all_valid; then
    echo "✅ All services ready for Railway deployment!"
    echo
    echo "📋 Next Steps:"
    echo "1. Set Root Directory for each service in Railway Dashboard:"
    echo "   - backend-api: 'backend-api'"
    echo "   - backend-worker: 'backend-worker'"
    echo "   - frontend: 'frontend'"
    echo "   - evolution-api: 'evolution-api'"
    echo "2. Deploy services in this order:"
    echo "   - PostgreSQL database"
    echo "   - Redis cache"
    echo "   - evolution-api"
    echo "   - backend-api"
    echo "   - backend-worker"
    echo "   - frontend"
else
    echo "❌ Some services missing required files. Check validation above."
fi

echo
echo "🛠️  Alternative Configurations Available:"
echo "   - railway.alternative.json (no dockerfilePath)"
echo "   - railway.monorepo.json (full paths)"
echo "   - railway.railway-dockerfile.json (alternative naming)"
echo