# Railway Deployment Instructions

## Projeto conectado: `whatsapp_saas` (9c4fdab7-d89e-436c-b80c-826ef64b7e52)

### 🚀 Deploy Backend API

1. **Via Railway Dashboard:**
   - Acesse: https://railway.app/project/9c4fdab7-d89e-436c-b80c-826ef64b7e52
   - Clique em "New Service" → "GitHub Repo"
   - Selecione: `nftecnologia/whatsapp-saas`
   - Root Directory: `backend-api`
   - Service Name: `backend-api`

2. **Configurar Variáveis de Ambiente:**
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
RABBITMQ_URL=<sua_cloudamqp_url>
STACK_AUTH_PROJECT_ID=<seu_stack_auth_project_id>
STACK_AUTH_PUBLISHABLE_KEY=<seu_stack_auth_publishable_key>
STACK_AUTH_SECRET_KEY=<seu_stack_auth_secret_key>
JWT_SECRET=<gere_uma_chave_segura>
SEND_MESSAGE_QUEUE=send_message
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
CORS_ORIGIN=*
```

### 🔄 Deploy Backend Worker

1. **Via Railway Dashboard:**
   - Clique em "New Service" → "GitHub Repo"
   - Selecione: `nftecnologia/whatsapp-saas`
   - Root Directory: `backend-worker`
   - Service Name: `backend-worker`

2. **Configurar Variáveis de Ambiente:**
```env
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
RABBITMQ_URL=<sua_cloudamqp_url>
EVOLUTION_API_BASE_URL=<sua_evolution_api_url>
EVOLUTION_API_GLOBAL_KEY=<sua_evolution_api_key>
SEND_MESSAGE_QUEUE=send_message
DEAD_LETTER_QUEUE=send_message_dlq
MAX_RETRIES=3
RETRY_DELAY=5000
PROCESSING_TIMEOUT=30000
```

### 🗄️ Adicionar PostgreSQL

1. **Via Railway Dashboard:**
   - Clique em "New Service" → "Database" → "Add PostgreSQL"
   - O Railway irá gerar automaticamente a `DATABASE_URL`

### 🔴 Adicionar Redis

1. **Via Railway Dashboard:**
   - Clique em "New Service" → "Database" → "Add Redis"
   - O Railway irá gerar automaticamente a `REDIS_URL`

### ⚡ Deploy via CLI

```bash
# Deploy Backend API
railway service backend-api
railway up

# Deploy Backend Worker  
railway service backend-worker
railway up
```

### 🔗 URLs após deploy

- **Backend API**: https://backend-api-production-XXXX.up.railway.app
- **Dashboard**: https://railway.app/project/9c4fdab7-d89e-436c-b80c-826ef64b7e52

### ✅ Checklist de Deploy

- [ ] PostgreSQL service adicionado
- [ ] Redis service adicionado
- [ ] Backend API service criado e configurado
- [ ] Backend Worker service criado e configurado
- [ ] Todas as variáveis de ambiente configuradas
- [ ] CloudAMQP URL configurada
- [ ] Stack Auth credentials configuradas
- [ ] Evolution API credentials configuradas
- [ ] Deploy realizado com sucesso
- [ ] Health checks funcionando
- [ ] Logs verificados

### 🔧 Comandos úteis

```bash
# Ver logs
railway logs

# Ver variáveis de ambiente
railway variables

# Conectar ao banco de dados
railway connect

# Status do projeto
railway status
```