#!/bin/bash

# Docker Health Check Script for WhatsApp SaaS Platform
# This script checks the health of all services

set -e

echo "🔍 Checking WhatsApp SaaS Platform Health..."
echo "============================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running${NC}"
    exit 1
fi

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ docker-compose.yml not found${NC}"
    exit 1
fi

# Function to check service health
check_service() {
    local service_name=$1
    local health_endpoint=$2
    local port=$3
    
    echo -n "Checking $service_name... "
    
    # Check if container is running
    if ! docker-compose ps | grep -q "$service_name.*Up"; then
        echo -e "${RED}❌ Container not running${NC}"
        return 1
    fi
    
    # Check health endpoint if provided
    if [ -n "$health_endpoint" ]; then
        if curl -f -s "http://localhost:$port$health_endpoint" > /dev/null; then
            echo -e "${GREEN}✅ Healthy${NC}"
            return 0
        else
            echo -e "${RED}❌ Health check failed${NC}"
            return 1
        fi
    else
        # Just check if container is running
        echo -e "${GREEN}✅ Running${NC}"
        return 0
    fi
}

# Function to check database connectivity
check_database() {
    echo -n "Checking PostgreSQL... "
    if docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Connected${NC}"
        return 0
    else
        echo -e "${RED}❌ Connection failed${NC}"
        return 1
    fi
}

# Function to check Redis connectivity
check_redis() {
    echo -n "Checking Redis... "
    if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Connected${NC}"
        return 0
    else
        echo -e "${RED}❌ Connection failed${NC}"
        return 1
    fi
}

# Function to check RabbitMQ connectivity
check_rabbitmq() {
    echo -n "Checking RabbitMQ... "
    if docker-compose exec -T rabbitmq rabbitmq-diagnostics -q ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Connected${NC}"
        return 0
    else
        echo -e "${RED}❌ Connection failed${NC}"
        return 1
    fi
}

# Main health checks
health_status=0

echo "📊 Infrastructure Services:"
check_database || health_status=1
check_redis || health_status=1
check_rabbitmq || health_status=1

echo ""
echo "🚀 Application Services:"
check_service "backend-api" "/health" "3000" || health_status=1
check_service "backend-worker" "" "" || health_status=1
check_service "frontend" "" "8080" || health_status=1

echo ""
echo "📈 Service Status Overview:"
docker-compose ps

if [ $health_status -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All services are healthy!${NC}"
    echo ""
    echo "📱 Access Points:"
    echo "  • Frontend: http://localhost:8080"
    echo "  • API: http://localhost:3000"
    echo "  • RabbitMQ Management: http://localhost:15672 (rabbitmq/rabbitmq)"
    echo ""
else
    echo ""
    echo -e "${RED}⚠️  Some services are unhealthy. Check the logs:${NC}"
    echo "  docker-compose logs [service-name]"
    echo ""
fi

exit $health_status