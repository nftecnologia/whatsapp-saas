# WhatsApp SaaS - Deployment Guide

Este guia explica como fazer o deploy da plataforma WhatsApp SaaS nos principais provedores de cloud.

## 🏗️ Arquitetura de Deployment

- **Frontend**: Vercel (React + Vite)
- **Backend API**: Railway (Node.js + Express)  
- **Backend Worker**: Railway (Node.js + RabbitMQ Consumer)
- **Database**: Railway PostgreSQL
- **Cache**: Railway Redis
- **Message Queue**: CloudAMQP (RabbitMQ)

## 📋 Pré-requisitos

1. **Contas necessárias:**
   - [Vercel](https://vercel.com) (Frontend)
   - [Railway](https://railway.app) (Backend + Database + Redis)  
   - [CloudAMQP](https://cloudamqp.com) (RabbitMQ)
   - [Stack Auth](https://stack-auth.com) (Autenticação)

2. **Evolution API:**
   - Uma instância da Evolution API rodando
   - URL base e Global Key da API

## 🚀 Deployment Steps

### 1. Setup Stack Auth

1. Crie um projeto no Stack Auth
2. Configure as URLs de callback:
   - Development: `http://localhost:5173`
   - Production: `https://your-frontend-domain.vercel.app`
3. Anote as seguintes credenciais:
   - `PROJECT_ID`
   - `PUBLISHABLE_KEY` 
   - `SECRET_KEY`

### 2. Setup CloudAMQP (RabbitMQ)

1. Crie uma conta no CloudAMQP
2. Crie uma nova instância (plano gratuito disponível)
3. Anote a `RABBITMQ_URL` (formato: `amqps://user:pass@host:port/vhost`)

### 3. Deploy Backend Services no Railway

#### 3.1 Deploy PostgreSQL Database

```bash
# Railway CLI (opcional)
railway login
railway new

# Ou via Railway Dashboard:
# 1. Conecte seu repositório GitHub
# 2. Adicione PostgreSQL service
# 3. Anote a DATABASE_URL
```

#### 3.2 Deploy Redis Cache

```bash
# No Railway Dashboard:
# 1. Adicione Redis service
# 2. Anote a REDIS_URL
```

#### 3.3 Deploy Backend API

1. **Via Railway Dashboard:**
   - Conecte seu repositório GitHub
   - Selecione a pasta `backend-api`
   - Configure as variáveis de ambiente:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=your_railway_postgres_url
REDIS_URL=your_railway_redis_url
RABBITMQ_URL=your_cloudamqp_url
STACK_AUTH_PROJECT_ID=your_stack_auth_project_id
STACK_AUTH_PUBLISHABLE_KEY=your_stack_auth_publishable_key
STACK_AUTH_SECRET_KEY=your_stack_auth_secret_key
JWT_SECRET=your_secure_jwt_secret
SEND_MESSAGE_QUEUE=send_message
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
CORS_ORIGIN=https://your-frontend-domain.vercel.app
```

2. **Deploy comando:**
```bash
# Railway detecta automaticamente o Dockerfile
# Build e deploy acontecem automaticamente
```

#### 3.4 Deploy Backend Worker

1. **Via Railway Dashboard:**
   - Adicione novo service conectado ao repositório
   - Selecione a pasta `backend-worker`
   - Configure as variáveis de ambiente:

```env
NODE_ENV=production
DATABASE_URL=your_railway_postgres_url
REDIS_URL=your_railway_redis_url
RABBITMQ_URL=your_cloudamqp_url
EVOLUTION_API_BASE_URL=https://your-evolution-api.com
EVOLUTION_API_GLOBAL_KEY=your_evolution_api_global_key
SEND_MESSAGE_QUEUE=send_message
DEAD_LETTER_QUEUE=send_message_dlq
MAX_RETRIES=3
RETRY_DELAY=5000
PROCESSING_TIMEOUT=30000
```

2. **Configurar scaling (opcional):**
```bash
# Via Railway CLI
railway up --replicas 2
```

### 4. Deploy Frontend no Vercel

1. **Conectar repositório:**
   - Vá para [Vercel Dashboard](https://vercel.com/dashboard)
   - Import projeto do GitHub
   - Selecione a pasta `frontend`

2. **Configurar build settings:**
   - Framework Preset: `Vite`
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. **Configurar variáveis de ambiente:**
```env
VITE_API_URL=https://your-backend-api.railway.app
VITE_STACK_AUTH_PROJECT_ID=your_stack_auth_project_id
VITE_STACK_AUTH_PUBLISHABLE_KEY=your_stack_auth_publishable_key
VITE_APP_NAME=WhatsApp SaaS
VITE_APP_VERSION=1.0.0
```

4. **Deploy:**
```bash
# Via Vercel CLI (opcional)
npx vercel --prod

# Ou automático via GitHub integration
git push origin main
```

## 🔧 Local Development

### Usando Docker

```bash
# Clonar repositório
git clone <seu-repo>
cd whatsapp-saas

# Copiar arquivos de ambiente
cp .env.example .env
cp backend-api/.env.example backend-api/.env
cp backend-worker/.env.example backend-worker/.env
cp frontend/.env.example frontend/.env

# Configurar variáveis de ambiente nos arquivos .env

# Subir apenas os serviços de infraestrutura
docker-compose -f docker-compose.dev.yml up -d

# Instalar dependências e rodar em modo desenvolvimento
cd backend-api && npm install && npm run dev &
cd backend-worker && npm install && npm run dev &
cd frontend && npm install && npm run dev
```

### Desenvolvimento Manual

```bash
# 1. Instalar PostgreSQL, Redis e RabbitMQ localmente
# 2. Configurar banco de dados
cd backend-api
npm run migrate
npm run seed

# 3. Iniciar serviços
cd backend-api && npm run dev &
cd backend-worker && npm run dev &
cd frontend && npm run dev
```

## 📊 Monitoramento

### Railway Monitoring
- Dashboard do Railway fornece logs e métricas
- Configurar alertas de CPU/Memory se necessário

### Application Monitoring
```javascript
// Adicionar ao backend-api/src/index.ts
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version
  });
});
```

### Logs
```bash
# Railway CLI
railway logs --service backend-api
railway logs --service backend-worker

# Vercel CLI  
vercel logs your-frontend-domain.vercel.app
```

## 🔐 Segurança

1. **Variáveis de ambiente:**
   - Nunca commitar arquivos `.env`
   - Usar senhas fortes para JWT_SECRET
   - Rotacionar chaves periodicamente

2. **CORS:**
   - Configurar CORS_ORIGIN apenas para domínios confiáveis
   - Evitar usar `*` em produção

3. **Rate Limiting:**
   - Ajustar RATE_LIMIT_MAX conforme necessário
   - Monitorar tentativas de abuse

## 🐛 Troubleshooting

### Problemas Comuns

1. **Backend API não conecta ao banco:**
   ```bash
   # Verificar DATABASE_URL
   railway logs --service backend-api
   ```

2. **Worker não processa mensagens:**
   ```bash
   # Verificar RabbitMQ connection
   railway logs --service backend-worker
   ```

3. **Frontend não carrega:**
   ```bash
   # Verificar VITE_API_URL
   vercel logs
   ```

4. **CORS errors:**
   - Verificar CORS_ORIGIN no backend
   - Verificar VITE_API_URL no frontend

### Performance Tuning

1. **Database:**
   - Adicionar índices se necessário
   - Monitorar query performance

2. **Worker Scaling:**
   ```bash
   # Aumentar replicas se necessário
   railway up --replicas 3
   ```

3. **Redis Caching:**
   - Implementar cache para queries frequentes
   - Configurar TTL apropriado

## 📈 Scaling

### Horizontal Scaling
- Railway: Aumentar replicas do worker
- Vercel: Scaling automático
- CloudAMQP: Upgrade de plano se necessário

### Vertical Scaling  
- Railway: Upgrade de plano para mais CPU/RAM
- PostgreSQL: Upgrade para plano com mais storage

## 🔄 CI/CD

### GitHub Actions (Opcional)
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Railway
        run: railway deploy
      - name: Deploy to Vercel  
        run: vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
```

## 📝 Backup

### Database Backup
```bash
# Railway CLI
railway connect
pg_dump $DATABASE_URL > backup.sql
```

### Environment Backup
- Salvar todas as variáveis de ambiente em local seguro
- Documentar todas as URLs e credenciais de serviços

---

## ✅ Checklist de Deploy

- [ ] Stack Auth configurado
- [ ] CloudAMQP instance criada
- [ ] Railway PostgreSQL deployed
- [ ] Railway Redis deployed  
- [ ] Backend API deployed no Railway
- [ ] Backend Worker deployed no Railway
- [ ] Frontend deployed no Vercel
- [ ] Todas as variáveis de ambiente configuradas
- [ ] CORS configurado corretamente
- [ ] Testes de integração rodando
- [ ] Monitoramento configurado
- [ ] Backup strategy implementada

Para suporte, consulte a documentação dos serviços ou abra uma issue no repositório.