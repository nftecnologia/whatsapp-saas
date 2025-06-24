# WhatsApp SaaS Platform - Docker Management
.PHONY: help build up down restart logs clean test

# Default target
help: ## Show this help message
	@echo "WhatsApp SaaS Platform - Docker Commands"
	@echo "======================================="
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Development Environment
dev: ## Start development environment
	docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build

dev-logs: ## Follow development logs
	docker compose -f docker-compose.yml -f docker-compose.override.yml logs -f

dev-down: ## Stop development environment
	docker compose -f docker-compose.yml -f docker-compose.override.yml down

# Production Environment
prod: ## Start production environment
	docker compose -f docker-compose.yml up -d --build

prod-logs: ## Follow production logs
	docker compose -f docker-compose.yml logs -f

prod-down: ## Stop production environment
	docker compose -f docker-compose.yml down

# Database Management
db-migrate: ## Run database migrations
	docker compose exec backend-api npm run db:migrate

db-seed: ## Seed database with initial data
	docker compose exec backend-api npm run db:seed

db-reset: ## Reset database (migrate + seed)
	docker compose exec backend-api npm run db:migrate
	docker compose exec backend-api npm run db:seed

# Service Management
build: ## Build all services
	docker compose build

rebuild: ## Rebuild all services (no cache)
	docker compose build --no-cache

up: ## Start all services
	docker compose up -d

down: ## Stop all services
	docker compose down

restart: ## Restart all services
	docker compose restart

# Logs and Monitoring
logs: ## Show logs for all services
	docker compose logs

logs-api: ## Show logs for backend API
	docker compose logs -f backend-api

logs-worker: ## Show logs for backend worker
	docker compose logs -f backend-worker

logs-frontend: ## Show logs for frontend
	docker compose logs -f frontend

# Health and Status
status: ## Show status of all services
	docker compose ps

health: ## Check health of all services
	docker compose exec backend-api curl -f http://localhost:3000/health || echo "API unhealthy"
	docker compose exec frontend curl -f http://localhost:8080 || echo "Frontend unhealthy"

# Testing
test: ## Run tests for all services
	docker compose exec backend-api npm test
	docker compose exec backend-worker npm test
	docker compose exec frontend npm test

test-api: ## Run API tests only
	docker compose exec backend-api npm test

test-worker: ## Run worker tests only
	docker compose exec backend-worker npm test

test-frontend: ## Run frontend tests only
	docker compose exec frontend npm test

# Development Tools
shell-api: ## Open shell in API container
	docker compose exec backend-api sh

shell-worker: ## Open shell in worker container
	docker compose exec backend-worker sh

shell-frontend: ## Open shell in frontend container
	docker compose exec frontend sh

shell-db: ## Open PostgreSQL shell
	docker compose exec postgres psql -U postgres -d whatsapp_saas

shell-redis: ## Open Redis shell
	docker compose exec redis redis-cli

shell-rabbitmq: ## Open RabbitMQ management (browser)
	@echo "RabbitMQ Management: http://localhost:15672"
	@echo "Username: rabbitmq, Password: rabbitmq"

# Cleanup
clean: ## Clean up containers, networks, images and volumes
	docker compose down -v --rmi all --remove-orphans

clean-volumes: ## Clean up volumes only
	docker compose down -v

clean-images: ## Clean up images only
	docker compose down --rmi all

# Backup and Restore
backup-db: ## Backup database
	mkdir -p ./backups
	docker compose exec postgres pg_dump -U postgres whatsapp_saas > ./backups/db_backup_$$(date +%Y%m%d_%H%M%S).sql

restore-db: ## Restore database (usage: make restore-db FILE=backup_file.sql)
	@if [ -z "$(FILE)" ]; then echo "Usage: make restore-db FILE=backup_file.sql"; exit 1; fi
	docker compose exec -T postgres psql -U postgres whatsapp_saas < $(FILE)

# Security
security-scan: ## Run security scan on images
	docker scout quickview
	docker scout cves

# Performance
stats: ## Show resource usage stats
	docker stats

# Environment Setup
init: ## Initialize project (first time setup)
	@echo "Setting up WhatsApp SaaS Platform..."
	@if [ ! -f .env ]; then echo "Creating .env file from template..."; cp .env.example .env; fi
	make dev
	@echo "Waiting for services to start..."
	sleep 30
	make db-migrate
	make db-seed
	@echo "Setup complete! Access the application at:"
	@echo "  Frontend: http://localhost:5173 (dev) or http://localhost:8080 (prod)"
	@echo "  API: http://localhost:3000"
	@echo "  RabbitMQ Management: http://localhost:15672"