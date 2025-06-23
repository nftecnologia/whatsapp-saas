# 🚀 WhatsApp SaaS Platform

Uma plataforma completa SaaS para envio de mensagens WhatsApp em massa, construída com arquitetura de microserviços.

## 📋 Funcionalidades

- ✅ **Autenticação completa** com Stack Auth
- ✅ **Gestão de contatos** com CRUD e importação
- ✅ **Templates de mensagem** com variáveis dinâmicas
- ✅ **Campanhas de envio** com agendamento e controle
- ✅ **Logs detalhados** com estatísticas em tempo real
- ✅ **Integração WhatsApp** via Evolution API
- ✅ **Arquitetura escalável** com RabbitMQ
- ✅ **Interface moderna** em React + TypeScript

## 🏗️ Arquitetura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │ Backend Worker  │
│   (React)       │◄──►│   (Express)     │◄──►│  (RabbitMQ)     │
│   Port: 5173    │    │   Port: 3000    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       ▼
         │              ┌─────────────────┐    ┌─────────────────┐
         │              │   PostgreSQL    │    │   Evolution API │
         │              │   (Database)    │    │   (WhatsApp)    │
         │              └─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│   Stack Auth    │    │     Redis       │
│ (Authentication)│    │    (Cache)      │
└─────────────────┘    └─────────────────┘
```

## 🛠️ Stack Tecnológica

### Backend
- **Node.js** + **Express** + **TypeScript**
- **PostgreSQL** para dados principais
- **Redis** para cache e sessões
- **RabbitMQ** para processamento assíncrono
- **Stack Auth** para autenticação
- **Evolution API** para integração WhatsApp

### Frontend
- **React** + **TypeScript** + **Vite**
- **TailwindCSS** para styling
- **React Query** para data fetching
- **Zustand** para state management
- **React Hook Form** + **Zod** para formulários

### DevOps
- **Docker** + **Docker Compose**
- **Railway** para deploy backend
- **Vercel** para deploy frontend
- **CloudAMQP** para RabbitMQ gerenciado

## 🚀 Quick Start

### 1. Pré-requisitos

- Node.js 18+
- Docker + Docker Compose
- Conta Stack Auth
- Evolution API instance

### 2. Clonagem e Setup

```bash
# Clonar repositório
git clone <seu-repo>
cd whatsapp-saas

# Copiar arquivos de ambiente
cp .env.example .env
cp backend-api/.env.example backend-api/.env
cp backend-worker/.env.example backend-worker/.env  
cp frontend/.env.example frontend/.env
```

### 3. Configurar Variáveis de Ambiente

Edite os arquivos `.env` com suas credenciais:

```env
# Stack Auth
STACK_AUTH_PROJECT_ID=your_project_id
STACK_AUTH_PUBLISHABLE_KEY=your_publishable_key
STACK_AUTH_SECRET_KEY=your_secret_key

# Evolution API  
EVOLUTION_API_BASE_URL=https://your-evolution-api.com
EVOLUTION_API_GLOBAL_KEY=your_global_key

# JWT Secret (gere uma chave segura)
JWT_SECRET=your_secure_jwt_secret
```

### 4. Desenvolvimento Local

#### Opção A: Docker Compose (Recomendado)

```bash
# Subir infraestrutura (PostgreSQL, Redis, RabbitMQ)
docker-compose -f docker-compose.dev.yml up -d

# Instalar dependências
npm run install:all

# Migrar banco de dados
cd backend-api && npm run migrate && npm run seed

# Iniciar todos os serviços
npm run dev
```

#### Opção B: Manual

```bash
# 1. Instalar dependências
cd backend-api && npm install
cd ../backend-worker && npm install  
cd ../frontend && npm install

# 2. Configurar banco (com PostgreSQL rodando)
cd backend-api
npm run migrate
npm run seed

# 3. Iniciar serviços (em terminais separados)
cd backend-api && npm run dev      # Port 3000
cd backend-worker && npm run dev   # Background worker
cd frontend && npm run dev         # Port 5173
```

### 5. Acessar Aplicação

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **RabbitMQ Management**: http://localhost:15672 (guest/guest)

## 📁 Estrutura do Projeto

```
whatsapp-saas/
├── backend-api/           # API REST (Express + TypeScript)
│   ├── src/
│   │   ├── controllers/   # Controladores da API
│   │   ├── models/        # Modelos de dados
│   │   ├── routes/        # Rotas da API
│   │   ├── services/      # Lógica de negócio
│   │   ├── middleware/    # Middlewares
│   │   └── database/      # Schema e migrations
│   ├── Dockerfile
│   └── package.json
│
├── backend-worker/        # Worker RabbitMQ (Node.js + TypeScript)
│   ├── src/
│   │   ├── services/      # Processamento de mensagens
│   │   ├── consumers/     # Consumers RabbitMQ
│   │   └── utils/         # Utilitários
│   ├── Dockerfile
│   └── package.json
│
├── frontend/              # Interface React (TypeScript + Vite)
│   ├── src/
│   │   ├── components/    # Componentes React
│   │   ├── pages/         # Páginas da aplicação
│   │   ├── services/      # API clients
│   │   ├── store/         # State management
│   │   └── types/         # Tipos TypeScript
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml     # Docker Compose produção
├── docker-compose.dev.yml # Docker Compose desenvolvimento
└── DEPLOYMENT.md          # Guia de deployment
```

## 🎯 Funcionalidades Principais

### 1. Gestão de Contatos
- ✅ CRUD completo de contatos
- ✅ Importação via CSV/Excel
- ✅ Tags e categorização
- ✅ Busca e filtros avançados

### 2. Templates de Mensagem
- ✅ Editor de templates com variáveis
- ✅ Preview em tempo real
- ✅ Categorização (Marketing, Suporte, etc.)
- ✅ Validação de variáveis

### 3. Campanhas
- ✅ Criação de campanhas de envio
- ✅ Seleção de contatos e templates
- ✅ Agendamento de envios
- ✅ Controles: Play, Pause, Cancel
- ✅ Progresso em tempo real

### 4. Logs e Relatórios
- ✅ Logs detalhados de todas as mensagens
- ✅ Status: Pendente, Enviada, Entregue, Lida, Falhou
- ✅ Estatísticas: Taxa de sucesso, entrega, leitura
- ✅ Filtros por campanha, período, status
- ✅ Detalhes técnicos e erros

### 5. Autenticação
- ✅ Login/Registro seguro via Stack Auth
- ✅ Gestão de empresas e usuários
- ✅ Controle de acesso por roles
- ✅ Sessões persistentes

## 🔧 Comandos Úteis

```bash
# Instalar todas as dependências
npm run install:all

# Desenvolvimento
npm run dev                # Todos os serviços
npm run dev:api           # Apenas Backend API
npm run dev:worker        # Apenas Worker
npm run dev:frontend      # Apenas Frontend

# Build
npm run build:all         # Build todos os serviços
npm run build:api         # Build Backend API
npm run build:worker      # Build Worker  
npm run build:frontend    # Build Frontend

# Docker
docker-compose up -d              # Produção
docker-compose -f docker-compose.dev.yml up -d  # Desenvolvimento

# Database
npm run migrate           # Rodar migrations
npm run seed             # Popular dados iniciais
npm run db:reset         # Reset completo do banco
```

## 🔐 Segurança

- ✅ **Autenticação JWT** via Stack Auth
- ✅ **Rate limiting** por IP e usuário
- ✅ **Validação** de entrada em todas as rotas
- ✅ **CORS** configurado corretamente
- ✅ **Sanitização** de dados
- ✅ **Headers de segurança** no nginx
- ✅ **Secrets** via variáveis de ambiente

## 📊 Performance

- ✅ **Cache Redis** para dados frequentes
- ✅ **Conexão pool** PostgreSQL
- ✅ **Processamento assíncrono** com RabbitMQ
- ✅ **Retry mechanism** com backoff exponencial
- ✅ **Dead letter queue** para falhas
- ✅ **Indexes** otimizados no banco
- ✅ **Pagination** em todas as listagens

## 🚀 Deploy

Consulte o [DEPLOYMENT.md](./DEPLOYMENT.md) para instruções completas de deploy nos seguintes provedores:

- **Frontend**: Vercel
- **Backend**: Railway
- **Database**: Railway PostgreSQL
- **Cache**: Railway Redis
- **Queue**: CloudAMQP

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 License

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

## 📞 Suporte

- 📧 Email: suporte@exemplo.com
- 💬 Discord: [Link do servidor]
- 📖 Documentação: [Link da documentação]
- 🐛 Issues: [GitHub Issues](https://github.com/seu-usuario/whatsapp-saas/issues)

---

⭐ Se este projeto foi útil para você, considere dar uma estrela no GitHub!

Made with ❤️ by [Seu Nome](https://github.com/seu-usuario)