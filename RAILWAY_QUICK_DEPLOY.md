# 🚀 Railway Quick Deploy - WhatsApp SaaS

## ✅ Stack Auth Configurado!

**Credenciais Stack Auth já configuradas nos arquivos Railway:**
- **Project ID**: `36ac5c46-cfff-4dea-9142-bfe2aecf37db`
- **Publishable Key**: `pck_y7r6v2pm3pnefvc834agzv9y98dfqr73q7azbrrs4q6r8`
- **Secret Key**: `ssk_7p2j367p86b4q3qa3z56111q1zf305585epzmrkqsf940`

## 🎯 Deploy em 3 Passos Simples

### **Passo 1: Setup CloudAMQP (5 min)**
```bash
# 1. Criar conta: https://cloudamqp.com
# 2. Criar instância RabbitMQ (plano gratuito disponível)
# 3. Copiar CLOUDAMQP_URL (formato: amqps://user:pass@host/vhost)
```

### **Passo 2: Deploy Automático Railway (15 min)**
```bash
# Executar script de deploy com Stack Auth já configurado
./scripts/railway-deploy.sh

# O script irá:
# ✅ Configurar Stack Auth automaticamente
# ✅ Gerar JWT_SECRET e ENCRYPTION_KEY
# ✅ Deploy todos os serviços
# ✅ Configurar networking interno
# ✅ Executar migrations
```

### **Passo 3: Configurar Meta Business (10 min)**
```bash
# Após deploy Railway, configurar:
# 1. Meta Business Manager - WhatsApp Business App
# 2. Webhook URL: https://backend-api-production.railway.app/webhooks/evolution
# 3. Gerar tokens Meta e adicionar no sistema
```

## 📋 Checklist Rápido

### ✅ **Já Configurado:**
- [x] Stack Auth production credentials
- [x] Railway configurations
- [x] Frontend optimizations
- [x] Backend API setup
- [x] Worker configurations
- [x] Evolution API setup
- [x] Networking interno
- [x] Health checks
- [x] Auto-scaling

### ⏳ **Pendente (Você precisa fazer):**
- [ ] CloudAMQP account e instance
- [ ] Executar `./scripts/railway-deploy.sh`
- [ ] Meta Business Manager setup
- [ ] Test deployment

## 🚀 Comando Deploy

```bash
# 1. Configure CLOUDAMQP_URL
export CLOUDAMQP_URL="amqps://your-user:your-pass@your-host/your-vhost"

# 2. Execute deploy completo
./scripts/railway-deploy.sh

# 3. Configure Meta Business Manager
# Webhook: https://backend-api-production.railway.app/webhooks/evolution
```

## 📊 URLs Finais (Após Deploy)

```
Frontend: https://frontend-production.railway.app
Backend API: https://backend-api-production.railway.app  
Evolution API: https://evolution-api-production.railway.app
Health Check: https://backend-api-production.railway.app/health
```

## 🔧 Variáveis Configuradas Automaticamente

### **Backend API:**
- `STACK_AUTH_PROJECT_ID=36ac5c46-cfff-4dea-9142-bfe2aecf37db`
- `STACK_AUTH_PUBLISHABLE_KEY=pck_y7r6v2pm3pnefvc834agzv9y98dfqr73q7azbrrs4q6r8`
- `STACK_AUTH_SECRET_KEY=ssk_7p2j367p86b4q3qa3z56111q1zf305585epzmrkqsf940`
- `JWT_SECRET=auto_generated`
- `ENCRYPTION_KEY=auto_generated`

### **Frontend:**
- `VITE_STACK_AUTH_PROJECT_ID=36ac5c46-cfff-4dea-9142-bfe2aecf37db`
- `VITE_STACK_AUTH_PUBLISHABLE_KEY=pck_y7r6v2pm3pnefvc834agzv9y98dfqr73q7azbrrs4q6r8`
- `VITE_API_URL=https://backend-api-production.railway.app`

## 🎉 Resultado Final

Após executar o deploy, você terá:
- ✅ **Plataforma WhatsApp SaaS** rodando em produção
- ✅ **Authentication** funcionando com Stack Auth
- ✅ **Database** PostgreSQL configurado
- ✅ **Cache** Redis configurado
- ✅ **Queue** RabbitMQ processando
- ✅ **Frontend** servindo usuários
- ✅ **API** respondendo requests
- ✅ **Worker** processando mensagens
- ✅ **Evolution API** pronto para WhatsApp

**🚀 Execute `./scripts/railway-deploy.sh` agora para deploy completo!**