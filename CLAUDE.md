# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WhatsApp SaaS messaging platform with three independent microservices using Evolution API integration.

## Architecture

### 🏗️ Backend API (Node.js + Express)
- REST API for data management, authentication, and business logic
- PostgreSQL database (Railway)
- Redis for caching and rate limiting (Railway)
- RabbitMQ queue publisher (CloudAMQP) - publishes to `send_message` queue
- Stack Auth integration for authentication
- Evolution API integration for WhatsApp management
- CRUD operations: Users, Companies, Contacts, Templates, Campaigns, Message logs

### 🐇 Worker Service (Node.js)
- Independent message processing service
- RabbitMQ consumer for `send_message` queue
- Evolution API integration for WhatsApp message sending
- PostgreSQL logging of message delivery status
- Automatic retry and dead-letter queue support

### 🎨 Frontend (React)
- Administrative SaaS interface
- Stack Auth authentication
- Dashboard with campaign analytics
- Contact, template, and campaign management
- Message dispatch interface (manual and batch)
- Detailed delivery logs per campaign

## Infrastructure

- **Database**: PostgreSQL (Railway)
- **Cache/Rate Limiting**: Redis (Railway)
- **Message Queue**: RabbitMQ (CloudAMQP)
- **Media Storage**: Cloudflare R2
- **Authentication**: Stack Auth
- **Deployment**: Railway, Vercel, CloudAMQP

## Development Commands

### Backend API
```bash
cd backend-api
npm install
npm run dev          # Development server
npm run build        # Production build
npm run start        # Production server
npm run test         # Run tests
npm run lint         # Lint code
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed database
```

### Worker Service
```bash
cd backend-worker
npm install
npm run dev          # Development worker
npm run start        # Production worker
npm run test         # Run tests
npm run lint         # Lint code
```

### Frontend
```bash
cd frontend
npm install
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Preview production build
npm run test         # Run tests
npm run lint         # Lint code
```

### Docker Development
```bash
docker-compose up -d          # Start all services
docker-compose down           # Stop all services
docker-compose logs -f        # Follow logs
docker-compose build          # Rebuild images
```

## Key Endpoints

- `POST /auth/login` - Authentication via Stack Auth
- `GET|POST|PUT|DELETE /contacts` - Contact management
- `GET|POST|PUT|DELETE /templates` - Template management
- `GET|POST|PUT|DELETE /campaigns` - Campaign management
- `POST /campaigns/:id/send` - Trigger campaign (publishes to queue)
- `GET /logs/:campaignId` - Campaign delivery logs
- `GET /integrations` - WhatsApp integrations status

## Important Notes

- Backend API only publishes jobs to RabbitMQ, never sends messages directly
- Worker service handles all Evolution API communication
- Each service runs independently with separate deployment
- Rate limiting implemented via Redis
- Complete audit trail for all message operations
- Retry mechanism with exponential backoff in worker
- Modular, scalable architecture ready for Railway deployment

## Development Tasks

### 🔄 Current Status: Project Setup Phase

**High Priority Tasks:**
1. ✅ Create project structure with backend-api, backend-worker, and frontend directories
2. ✅ Setup Backend API with Express, PostgreSQL, Redis, and RabbitMQ publisher
3. ✅ Create database schema and migrations for PostgreSQL
4. ✅ Implement Stack Auth integration in Backend API
5. ✅ Create CRUD endpoints for Users, Companies, Contacts, Templates, Campaigns
6. ✅ Implement campaign send endpoint that publishes to RabbitMQ queue
7. ✅ Setup Worker service with RabbitMQ consumer
8. ✅ Implement Evolution API integration in Worker for WhatsApp messaging
9. ✅ Add retry mechanism and dead-letter queue to Worker
10. ✅ Create React frontend with authentication and dashboard
11. ✅ Implement frontend pages for Contacts, Templates, Campaigns management
12. ⏳ Create message dispatch interface and logs visualization

**Medium Priority Tasks:**
13. ⏳ Setup Docker configuration for all services
14. ⏳ Create environment configuration files (.env.example)

**Low Priority Tasks:**
15. ⏳ Write deployment documentation for Railway, Vercel, CloudAMQP

### 🎯 Next Steps
✅ Frontend management pages completed! Full CRUD interfaces for Contacts, Templates, and Campaigns with advanced features like bulk operations, filtering, pagination, and campaign controls. Next: Create message dispatch interface and logs visualization.