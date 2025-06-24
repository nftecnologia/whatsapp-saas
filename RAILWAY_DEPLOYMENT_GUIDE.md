# 🚂 Railway Deployment Guide - WhatsApp SaaS

Guia completo para deploy da plataforma WhatsApp SaaS 100% na Railway.

## 🎯 Arquitetura Railway

```
Railway Project: whatsapp-saas-production
├── 🎨 frontend (React + Vite)
├── 🔧 backend-api (Node.js + Express)  
├── 🐇 backend-worker (Node.js + Queue)
├── 🤖 evolution-api (WhatsApp Container)
├── 🗄️ PostgreSQL (Railway Plugin)
├── 🔴 Redis (Railway Plugin)
└── 🐰 RabbitMQ (CloudAMQP External)
```

## 🚀 Deploy Automático

### Opção 1: Script Automático (Recomendado)
```bash
# Executar script de deploy completo
./scripts/railway-deploy.sh
```

### Opção 2: Deploy Manual
```bash
# 1. Instalar Railway CLI
npm install -g @railway/cli

# 2. Login Railway
railway login

# 3. Criar projeto
railway init whatsapp-saas-production

# 4. Adicionar plugins
railway add postgresql
railway add redis

# 5. Deploy serviços
cd backend-api && railway up --service backend-api
cd backend-worker && railway up --service backend-worker  
cd frontend && railway up --service frontend
railway up --service evolution-api --dockerfile Dockerfile.evolution
```

## ⚙️ Configuração de Variáveis

### 🔧 Backend API
```bash
railway variables set NODE_ENV=production --service backend-api
railway variables set PORT=3000 --service backend-api
railway variables set JWT_SECRET=your_secure_jwt_secret --service backend-api
railway variables set ENCRYPTION_KEY=your_encryption_key --service backend-api
railway variables set STACK_AUTH_PROJECT_ID=your_stack_auth_id --service backend-api
railway variables set STACK_AUTH_SECRET_KEY=your_stack_secret --service backend-api
railway variables set CLOUDAMQP_URL=your_rabbitmq_url --service backend-api
```

### 🐇 Backend Worker
```bash
railway variables set NODE_ENV=production --service backend-worker
railway variables set WORKER_CONCURRENCY=5 --service backend-worker
railway variables set MAX_RETRY_ATTEMPTS=3 --service backend-worker
railway variables set CLOUDAMQP_URL=your_rabbitmq_url --service backend-worker
```

### 🤖 Evolution API
```bash
railway variables set AUTHENTICATION_API_KEY=whatsapp_saas_evolution_prod_key_2024 --service evolution-api
railway variables set SERVER_PORT=8080 --service evolution-api
railway variables set WA_BUSINESS_TOKEN_WEBHOOK=your_webhook_token --service evolution-api
```

### 🎨 Frontend
```bash
railway variables set NODE_ENV=production --service frontend
railway variables set VITE_STACK_AUTH_PROJECT_ID=your_stack_auth_id --service frontend
railway variables set VITE_STACK_AUTH_PUBLISHABLE_KEY=your_publishable_key --service frontend
```

## 🔗 Networking Interno Railway

### Comunicação entre Serviços
```
Frontend → Backend API: https://backend-api-production.railway.app
Backend API → Evolution API: http://evolution-api.railway.internal:8080
Backend API → PostgreSQL: ${{Postgres.DATABASE_URL}}
Backend API → Redis: ${{Redis.REDIS_URL}}
Worker → Evolution API: http://evolution-api.railway.internal:8080
```

### URLs de Produção
```
Frontend: https://frontend-production.railway.app
Backend API: https://backend-api-production.railway.app  
Evolution API: https://evolution-api-production.railway.app (interno)
```

## 📊 Configurações de Produção

### Replicas e Scaling
```yaml
frontend: 1 replica (static files)
backend-api: 2 replicas (load balanced)
backend-worker: 3 replicas (queue processing)
evolution-api: 1 replica (stateful)
```

### Health Checks
```yaml
frontend: GET / (status 200)
backend-api: GET /health (comprehensive check)
evolution-api: GET / (API status)
backend-worker: No health check (background)
```

### Resource Limits
```yaml
frontend: 512MB RAM, 0.5 CPU
backend-api: 1GB RAM, 1 CPU  
backend-worker: 512MB RAM, 0.5 CPU
evolution-api: 1GB RAM, 1 CPU
```

## 🔐 Configuração de Segurança

### Secrets Management
```bash
# Gerar secrets seguros
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
WEBHOOK_TOKEN=$(openssl rand -hex 16)

# Configurar no Railway
railway variables set JWT_SECRET=$JWT_SECRET --service backend-api
railway variables set ENCRYPTION_KEY=$ENCRYPTION_KEY --service backend-api
```

### CORS Configuration
```bash
# Frontend domain para CORS
FRONTEND_URL=$(railway status --service frontend --json | jq -r '.deployments[0].url')
railway variables set CORS_ORIGIN=$FRONTEND_URL --service backend-api
```

## 📋 Pré-requisitos Externos

### 1. CloudAMQP (RabbitMQ)
```bash
# 1. Criar conta CloudAMQP
# 2. Criar instância RabbitMQ
# 3. Copiar CLOUDAMQP_URL
# 4. Configurar no Railway
railway variables set CLOUDAMQP_URL=amqps://user:pass@host/vhost
```

### 2. Stack Auth
```bash
# 1. Criar projeto Stack Auth
# 2. Configurar production URLs
# 3. Obter credenciais
railway variables set STACK_AUTH_PROJECT_ID=your_project_id
railway variables set STACK_AUTH_SECRET_KEY=your_secret_key
railway variables set STACK_AUTH_PUBLISHABLE_KEY=your_publishable_key
```

### 3. Meta Business Manager
```bash
# 1. Criar App WhatsApp Business
# 2. Gerar token permanente
# 3. Configurar webhook URL
# Webhook: https://backend-api-production.railway.app/webhooks/evolution
```

## 🧪 Testing Deployment

### 1. Verificar Serviços
```bash
# Status geral
railway status

# Logs específicos
railway logs --service backend-api
railway logs --service backend-worker
railway logs --service frontend
railway logs --service evolution-api

# Health checks
curl https://backend-api-production.railway.app/health
curl https://frontend-production.railway.app
curl https://evolution-api-production.railway.app
```

### 2. Testar Funcionalidades
```bash
# 1. Acessar frontend
open https://frontend-production.railway.app

# 2. Fazer login teste
# Email: admin@teste.com
# Senha: teste123

# 3. Testar integração WhatsApp
# - Ir para /integrations
# - Adicionar tokens Meta
# - Conectar instância
# - Enviar mensagem teste
```

## 🔧 Troubleshooting

### Problemas Comuns

#### 1. Frontend não carrega
```bash
# Verificar build
railway logs --service frontend | grep -i error

# Verificar variáveis
railway variables --service frontend

# Rebuild
railway redeploy --service frontend
```

#### 2. Backend API não conecta
```bash
# Verificar database connection
railway logs --service backend-api | grep -i database

# Testar health endpoint
curl https://backend-api-production.railway.app/health

# Verificar variáveis ambiente
railway variables --service backend-api
```

#### 3. Worker não processa mensagens
```bash
# Verificar logs worker
railway logs --service backend-worker | grep -i queue

# Verificar RabbitMQ connection
railway logs --service backend-worker | grep -i rabbitmq

# Restart worker
railway redeploy --service backend-worker
```

#### 4. Evolution API não conecta
```bash
# Verificar logs Evolution
railway logs --service evolution-api

# Testar endpoint
curl https://evolution-api-production.railway.app

# Verificar webhook configuration
curl -H "apikey: your_api_key" https://evolution-api-production.railway.app/webhook
```

## 📊 Monitoring & Alerts

### Railway Dashboard
```
1. Acessar Railway dashboard
2. Monitorar resource usage
3. Configurar alerts para:
   - High CPU usage (>80%)
   - High memory usage (>90%)
   - Service downtime
   - Error rate spikes
```

### Custom Monitoring
```bash
# Setup monitoring endpoints
curl https://backend-api-production.railway.app/health
curl https://backend-api-production.railway.app/metrics

# Log aggregation
railway logs --follow --service backend-api
railway logs --follow --service backend-worker
```

## 💰 Cost Optimization

### Resource Management
```yaml
# Development environment
replicas: 1 para todos os serviços
resources: mínimos

# Production environment  
frontend: 1 replica (static)
backend-api: 2 replicas (HA)
backend-worker: 3 replicas (throughput)
evolution-api: 1 replica (stateful)
```

### Database Optimization
```sql
-- Otimizar queries
-- Adicionar indexes necessários
-- Configurar connection pooling
-- Monitorar slow queries
```

## 🚀 Deployment Checklist

- [ ] Railway CLI instalado e configurado
- [ ] Projeto Railway criado
- [ ] PostgreSQL plugin adicionado
- [ ] Redis plugin adicionado
- [ ] CloudAMQP configurado
- [ ] Stack Auth configurado
- [ ] Meta Business Manager configurado
- [ ] Backend API deployed
- [ ] Backend Worker deployed
- [ ] Evolution API deployed
- [ ] Frontend deployed
- [ ] Variáveis de ambiente configuradas
- [ ] Database migrations executadas
- [ ] Health checks funcionando
- [ ] Networking interno testado
- [ ] Webhooks configurados
- [ ] SSL certificates configurados
- [ ] Monitoring configurado
- [ ] Backup strategy implementada

## 📞 Support

### Railway Support
- **Dashboard**: https://railway.app/dashboard
- **Documentation**: https://docs.railway.app
- **Community**: https://discord.gg/railway

### Project Support
- **Repository**: GitHub issues
- **Documentation**: README.md
- **Contact**: support@your-domain.com

---

## ✅ Success!

Sua plataforma WhatsApp SaaS está agora **100% deployada na Railway** com:

- ✅ **Frontend React** servindo static files
- ✅ **Backend API** com load balancing
- ✅ **Backend Worker** processando filas
- ✅ **Evolution API** integrado WhatsApp Cloud
- ✅ **PostgreSQL** managed database
- ✅ **Redis** managed cache
- ✅ **Networking interno** otimizado
- ✅ **Monitoring** e alerts configurados

**🎉 Plataforma production-ready na Railway!**