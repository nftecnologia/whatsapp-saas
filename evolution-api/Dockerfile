# Evolution API Railway Dockerfile
FROM atendai/evolution-api:latest

# Set working directory
WORKDIR /evolution

# Install curl for health checks
USER root
RUN apk add --no-cache curl

# Create directories for persistence
RUN mkdir -p /evolution/store /evolution/instances

# Set proper permissions
RUN chmod -R 755 /evolution/store /evolution/instances

# Switch back to non-root user
USER node

# Environment variables for Railway
ENV NODE_ENV=production
ENV SERVER_PORT=8080
ENV DATABASE_ENABLED=true
ENV DATABASE_PROVIDER=postgresql
ENV REDIS_ENABLED=true
ENV LOG_LEVEL=info
ENV LOG_COLOR=false

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD curl -f http://localhost:8080/manager/instance/me || exit 1

# Start the application
CMD ["node", "dist/src/main.js"]