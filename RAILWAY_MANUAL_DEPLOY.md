# 🚀 Deploy Manual Railway - WhatsApp SaaS

## ⚡ Deploy via GitHub (Recomendado)

### **Passo 1: Push para GitHub**
```bash
git add .
git commit -m "feat: add Railway deployment configuration

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
git push origin main
```

### **Passo 2: Deploy via Railway Dashboard**

**1. Acesse:** https://railway.app/dashboard

**2. Clique em "New Project"**

**3. Selecione "Deploy from GitHub repo"**

**4. Conecte repositório:** `nftecnologia/whatsapp-saas`

**5. Configure 4 serviços:**

#### **🎨 Frontend Service**
- **Source:** `frontend/`
- **Build Command:** `npm run build`
- **Start Command:** `npm run start`
- **Port:** `$PORT` (automático)

**Variáveis:**
```
NODE_ENV=production
VITE_STACK_AUTH_PROJECT_ID=36ac5c46-cfff-4dea-9142-bfe2aecf37db
VITE_STACK_AUTH_PUBLISHABLE_KEY=pck_y7r6v2pm3pnefvc834agzv9y98dfqr73q7azbrrs4q6r8
VITE_API_URL=https://backend-api-production.railway.app
```

#### **🔧 Backend API Service**
- **Source:** `backend-api/`
- **Build Command:** `npm run build`
- **Start Command:** `npm run start`
- **Port:** `3000`

**Variáveis:**
```
NODE_ENV=production
PORT=3000
STACK_AUTH_PROJECT_ID=36ac5c46-cfff-4dea-9142-bfe2aecf37db
STACK_AUTH_PUBLISHABLE_KEY=pck_y7r6v2pm3pnefvc834agzv9y98dfqr73q7azbrrs4q6r8
STACK_AUTH_SECRET_KEY=ssk_7p2j367p86b4q3qa3z56111q1zf305585epzmrkqsf940
CLOUDAMQP_URL=amqps://qqdwzdbt:P5QYz582yO7fw55ntEEz_oShlGMgRg4T@leopard.lmq.cloudamqp.com/qqdwzdbt
RABBITMQ_URL=amqps://qqdwzdbt:P5QYz582yO7fw55ntEEz_oShlGMgRg4T@leopard.lmq.cloudamqp.com/qqdwzdbt
JWT_SECRET=your_generated_32_char_secret
ENCRYPTION_KEY=your_generated_32_char_key
EVOLUTION_API_KEY=whatsapp_saas_evolution_prod_key_2024
```

#### **🐇 Backend Worker Service**
- **Source:** `backend-worker/`
- **Build Command:** `npm run build`
- **Start Command:** `npm run start`
- **Port:** Não necessário (worker)

**Variáveis:**
```
NODE_ENV=production
CLOUDAMQP_URL=amqps://qqdwzdbt:P5QYz582yO7fw55ntEEz_oShlGMgRg4T@leopard.lmq.cloudamqp.com/qqdwzdbt
RABBITMQ_URL=amqps://qqdwzdbt:P5QYz582yO7fw55ntEEz_oShlGMgRg4T@leopard.lmq.cloudamqp.com/qqdwzdbt
WORKER_CONCURRENCY=5
```

#### **🤖 Evolution API Service**
- **Source:** Usar Docker image `atendai/evolution-api:v2`
- **Port:** `8080`

**Variáveis:**
```
AUTHENTICATION_API_KEY=whatsapp_saas_evolution_prod_key_2024
SERVER_PORT=8080
```

### **Passo 3: Adicionar Plugins**

**1. PostgreSQL:**
- Clique em "New" → "Database" → "PostgreSQL"
- Nome: `postgres`

**2. Redis:**
- Clique em "New" → "Database" → "Redis"  
- Nome: `redis`

### **Passo 4: Conectar Databases**

As variáveis serão automaticamente disponibilizadas:
- `${{Postgres.DATABASE_URL}}`
- `${{Redis.REDIS_URL}}`

Adicione aos serviços backend-api e backend-worker:
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
```

### **Passo 5: Configurar Health Checks**

**Backend API:**
- Health Check Path: `/health`
- Health Check Timeout: `30s`

## ⚡ Deploy Automático via CLI

Se preferir usar CLI (depois que os serviços estiverem criados):

```bash
# 1. Link aos serviços
cd backend-api && railway service
cd ../backend-worker && railway service  
cd ../frontend && railway service

# 2. Deploy específico
railway up --service backend-api
railway up --service backend-worker
railway up --service frontend
```

## 🔗 URLs Finais

Após o deploy:
```
Frontend: https://frontend-production.railway.app
Backend API: https://backend-api-production.railway.app
Evolution API: https://evolution-api-production.railway.app
Health Check: https://backend-api-production.railway.app/health
```

## 🎯 Checklist Deploy

### ✅ **Pré-Deploy (Feito)**
- [x] Credenciais Stack Auth configuradas
- [x] CloudAMQP RabbitMQ criado
- [x] Repository GitHub atualizado
- [x] Configurações Railway prontas

### 🚀 **Deploy Steps**
- [ ] Push código para GitHub
- [ ] Criar projeto Railway
- [ ] Configurar 4 serviços
- [ ] Adicionar PostgreSQL plugin
- [ ] Adicionar Redis plugin
- [ ] Configurar variáveis de ambiente
- [ ] Configurar health checks
- [ ] Testar deployment

### ⏳ **Pós-Deploy**
- [ ] Executar migrations database
- [ ] Configurar Meta Business Manager
- [ ] Testar authentication
- [ ] Testar envio de mensagens
- [ ] Configurar monitoring

## 🆘 Troubleshooting

### **Se build falhar:**
1. Check logs no Railway dashboard
2. Verificar package.json scripts
3. Verificar Dockerfile syntax

### **Se conexão database falhar:**
1. Verificar se plugins foram adicionados
2. Verificar variáveis DATABASE_URL e REDIS_URL
3. Executar migrations: `railway run npm run db:migrate`

### **Se authentication falhar:**
1. Verificar credenciais Stack Auth
2. Verificar CORS_ORIGIN configuration
3. Verificar JWT_SECRET generation

## 🚀 **Comando Único para Push:**

```bash
git add . && git commit -m "feat: Railway deployment ready" && git push origin main
```

**✅ Agora configure no Railway Dashboard usando as instruções acima!**