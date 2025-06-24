#!/bin/bash
# INDIVIDUAL DEPLOYMENT SCRIPT - EVOLUTION API

set -e

echo "🚀 DEPLOYING EVOLUTION API"

cd evolution-api

# Backup and use minimal configs
cp railway.json railway.json.backup 2>/dev/null || true
cp Dockerfile Dockerfile.backup 2>/dev/null || true

cp railway.json.minimal railway.json
cp Dockerfile.minimal Dockerfile

echo "✅ Using minimal configurations"
echo "📦 Ready to deploy evolution-api"
echo
echo "Next steps:"
echo "1. railway up"
echo "2. Check logs: railway logs"
echo "3. Test API: curl https://your-domain.railway.app/manager/instance/me"