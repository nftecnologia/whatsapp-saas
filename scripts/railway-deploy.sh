#!/bin/bash

# Railway Deploy Script for WhatsApp SaaS
# This script automates the deployment of all services to Railway

set -e

echo "🚀 Starting Railway deployment for WhatsApp SaaS..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
    echo "✅ Railway CLI installed successfully"
fi

# Login to Railway (if not already logged in)
echo "🔐 Checking Railway authentication..."
if ! railway whoami &> /dev/null; then
    echo "Please login to Railway:"
    railway login
fi

# Create Railway project if it doesn't exist
echo "📁 Setting up Railway project..."
PROJECT_NAME="whatsapp-saas-production"

# Check if project exists
if ! railway status &> /dev/null; then
    echo "Creating new Railway project: $PROJECT_NAME"
    railway init $PROJECT_NAME
else
    echo "✅ Using existing Railway project"
fi

# Deploy services in order
echo "🔧 Deploying services..."

# 1. Deploy PostgreSQL Plugin
echo "📊 Setting up PostgreSQL database..."
railway add postgresql
echo "✅ PostgreSQL database ready"

# 2. Deploy Redis Plugin  
echo "🔴 Setting up Redis cache..."
railway add redis
echo "✅ Redis cache ready"

# 3. Deploy Backend API
echo "🔧 Deploying Backend API..."
cd backend-api
railway up --service backend-api
cd ..
echo "✅ Backend API deployed"

# 4. Deploy Backend Worker
echo "🐇 Deploying Backend Worker..."
cd backend-worker  
railway up --service backend-worker
cd ..
echo "✅ Backend Worker deployed"

# 5. Deploy Evolution API
echo "🤖 Deploying Evolution API..."
railway up --service evolution-api --dockerfile Dockerfile.evolution
echo "✅ Evolution API deployed"

# 6. Deploy Frontend
echo "🎨 Deploying Frontend..."
cd frontend
railway up --service frontend
cd ..
echo "✅ Frontend deployed"

# Set environment variables
echo "⚙️ Configuring environment variables..."

# Backend API environment variables
railway variables set NODE_ENV=production --service backend-api
railway variables set PORT=3000 --service backend-api
railway variables set JWT_SECRET=$(openssl rand -hex 32) --service backend-api
railway variables set ENCRYPTION_KEY=$(openssl rand -hex 32) --service backend-api

# Stack Auth credentials (provided)
railway variables set STACK_AUTH_PROJECT_ID=36ac5c46-cfff-4dea-9142-bfe2aecf37db --service backend-api
railway variables set STACK_AUTH_PUBLISHABLE_KEY=pck_y7r6v2pm3pnefvc834agzv9y98dfqr73q7azbrrs4q6r8 --service backend-api
railway variables set STACK_AUTH_SECRET_KEY=ssk_7p2j367p86b4q3qa3z56111q1zf305585epzmrkqsf940 --service backend-api

# Backend Worker environment variables  
railway variables set NODE_ENV=production --service backend-worker
railway variables set WORKER_CONCURRENCY=5 --service backend-worker

# Evolution API environment variables
railway variables set AUTHENTICATION_API_KEY=whatsapp_saas_evolution_prod_key_2024 --service evolution-api
railway variables set SERVER_PORT=8080 --service evolution-api

# Frontend environment variables
railway variables set NODE_ENV=production --service frontend
railway variables set VITE_STACK_AUTH_PROJECT_ID=36ac5c46-cfff-4dea-9142-bfe2aecf37db --service frontend
railway variables set VITE_STACK_AUTH_PUBLISHABLE_KEY=pck_y7r6v2pm3pnefvc834agzv9y98dfqr73q7azbrrs4q6r8 --service frontend

# Configure CloudAMQP URL (provided)
echo "🐰 Configuring CloudAMQP RabbitMQ..."
railway variables set CLOUDAMQP_URL="amqps://qqdwzdbt:P5QYz582yO7fw55ntEEz_oShlGMgRg4T@leopard.lmq.cloudamqp.com/qqdwzdbt" --service backend-api
railway variables set CLOUDAMQP_URL="amqps://qqdwzdbt:P5QYz582yO7fw55ntEEz_oShlGMgRg4T@leopard.lmq.cloudamqp.com/qqdwzdbt" --service backend-worker
railway variables set RABBITMQ_URL="amqps://qqdwzdbt:P5QYz582yO7fw55ntEEz_oShlGMgRg4T@leopard.lmq.cloudamqp.com/qqdwzdbt" --service backend-api
railway variables set RABBITMQ_URL="amqps://qqdwzdbt:P5QYz582yO7fw55ntEEz_oShlGMgRg4T@leopard.lmq.cloudamqp.com/qqdwzdbt" --service backend-worker

echo "🔗 Setting up service connections..."

# Link services to databases
railway link --service backend-api
railway link --service backend-worker  
railway link --service evolution-api

# Run database migrations
echo "📊 Running database migrations..."
railway run --service backend-api npm run db:migrate

echo "🎉 Deployment completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Configure external services:"
echo "   - CloudAMQP RabbitMQ instance"
echo "   - Stack Auth production credentials"
echo "   - Meta Business Manager tokens"
echo ""
echo "2. Set production environment variables:"
echo "   - CLOUDAMQP_URL (from CloudAMQP dashboard)"
echo "   - STACK_AUTH_* (from Stack Auth dashboard)"
echo "   - Meta Business tokens for Evolution API"
echo ""
echo "3. Test the deployment:"
echo "   - Frontend: Check Railway dashboard for public URL"
echo "   - API: Test health endpoint"
echo "   - Worker: Monitor queue processing"
echo ""
echo "✅ WhatsApp SaaS Platform deployed to Railway!"