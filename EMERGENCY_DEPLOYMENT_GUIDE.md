# 🚨 EMERGENCY DEPLOYMENT GUIDE

This guide provides immediate deployment solutions when standard deployment methods fail.

## 🎯 QUICK FIX OPTIONS

### Option 1: Minimal Dockerfiles (RECOMMENDED)
```bash
# Use the emergency deployment script
./emergency-deploy.sh

# Choose option 1 for all services with minimal Dockerfiles
# Then deploy via Railway Dashboard
```

### Option 2: Manual Railway CLI Deployment
```bash
# Login to Railway
railway login

# Deploy each service individually
cd backend-api
cp railway.json.minimal railway.json
cp Dockerfile.minimal Dockerfile
railway up

cd ../backend-worker
cp railway.json.minimal railway.json
cp Dockerfile.minimal Dockerfile
railway up

cd ../frontend
cp railway.json.minimal railway.json
cp Dockerfile.minimal Dockerfile
railway up

cd ../evolution-api
cp railway.json.minimal railway.json
cp Dockerfile.minimal Dockerfile
railway up
```

### Option 3: NIXPACKS Alternative
```bash
# For backend services only (frontend needs nginx)
./emergency-deploy.sh

# Choose option 2 for NIXPACKS deployment
# Or manually for each service:

cd backend-api
cp nixpacks.toml.emergency nixpacks.toml
# Create simple railway.json with NIXPACKS builder
railway up

cd ../backend-worker
cp nixpacks.toml.emergency nixpacks.toml
railway up
```

## 🔍 IMMEDIATE FIXES IMPLEMENTED

### 1. Simplified Dockerfiles
- **backend-api/Dockerfile.minimal**: Single-stage build, no complex user management
- **backend-worker/Dockerfile.minimal**: Fixed missing TypeScript build step
- **frontend/Dockerfile.minimal**: Simplified nginx setup
- **evolution-api/Dockerfile.minimal**: Minimal configuration

### 2. Alternative NIXPACKS Configs
- **backend-api/nixpacks.toml.emergency**: Node.js-based build
- **backend-worker/nixpacks.toml.emergency**: Worker-specific build
- **frontend/nixpacks.toml.emergency**: Static file serving

### 3. Simplified Railway Configs
- **railway.json.minimal**: Reduced complexity, single replica, extended timeouts
- Removed complex health checks that might fail
- Simplified deployment parameters

## 🚀 DEPLOYMENT VERIFICATION

### Test Each Service Individually
```bash
# Backend API
curl https://your-backend-api.railway.app/health

# Frontend
curl https://your-frontend.railway.app/

# Evolution API
curl https://your-evolution-api.railway.app/manager/instance/me
```

### Common Issues & Quick Fixes

#### Build Timeout
- Use NIXPACKS instead of Dockerfile
- Reduce dependencies in package.json temporarily
- Deploy with minimal features first

#### Health Check Failures
- Use minimal railway.json without health checks
- Increase healthcheckTimeout to 120 seconds
- Deploy without health checks initially

#### Memory Issues
- Set numReplicas to 1 in railway.json
- Use NODE_OPTIONS="--max-old-space-size=512" for memory-constrained builds

#### Port Issues
- Ensure services use correct PORT environment variable
- Frontend should use port 8080
- Backend API should use port 3000
- Evolution API should use port 8080

## 🛠️ TROUBLESHOOTING COMMANDS

### Railway CLI Debugging
```bash
# Check deployment status
railway status

# View logs
railway logs

# Connect to service shell
railway shell

# Restart service
railway restart
```

### Local Testing of Minimal Configs
```bash
# Test minimal Dockerfile locally
docker build -f Dockerfile.minimal -t test-service .
docker run -p 3000:3000 test-service

# Test with environment variables
docker run -p 3000:3000 -e NODE_ENV=production -e PORT=3000 test-service
```

## 🎯 SUCCESS CRITERIA

✅ **Backend API**: Health endpoint returns 200  
✅ **Backend Worker**: Starts without errors in logs  
✅ **Frontend**: Home page loads correctly  
✅ **Evolution API**: Manager endpoint responds  

## 🔄 ROLLBACK PROCEDURE

If emergency deployment fails:
```bash
# Restore original configurations
./emergency-deploy.sh
# Choose option 5 to restore originals

# Or manually:
cd backend-api
mv railway.json.backup railway.json
mv Dockerfile.backup Dockerfile
```

## 🚨 CRITICAL SUCCESS PATH

1. **IMMEDIATE**: Use Option 1 (Minimal Dockerfiles)
2. **VERIFY**: Each service starts successfully
3. **CONFIGURE**: Environment variables via Railway Dashboard
4. **TEST**: Basic functionality works
5. **OPTIMIZE**: Gradually restore advanced features

This approach prioritizes getting a working deployment over advanced features.