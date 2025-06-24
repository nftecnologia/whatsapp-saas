# Evolution API - Railway Deploy

This directory contains the Evolution API configuration for Railway deployment.

## Files

- `Dockerfile` - Docker configuration for Evolution API
- `railway.json` - Railway deployment configuration
- `package.json` - Node.js package configuration

## Deployment

This service is deployed as a Docker container using the official Evolution API image.

## Environment Variables

All environment variables are configured in `railway.json` and will be automatically set by Railway.

## Health Check

The service includes a health check endpoint at `/` on port 8080.