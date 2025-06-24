#!/usr/bin/env node

const { exec } = require('child_process');
const path = require('path');

class RailwayMCP {
  constructor() {
    this.projectPath = process.env.RAILWAY_PROJECT_PATH || process.cwd();
  }

  async executeCommand(command, args = []) {
    return new Promise((resolve, reject) => {
      const fullCommand = `railway ${command} ${args.join(' ')}`;
      exec(fullCommand, { cwd: this.projectPath }, (error, stdout, stderr) => {
        if (error) {
          reject({ error: error.message, stderr });
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  async deploy(service = null) {
    try {
      if (service) {
        return await this.executeCommand('up', ['--service', service]);
      } else {
        return await this.executeCommand('up');
      }
    } catch (error) {
      throw new Error(`Deploy failed: ${error.error}`);
    }
  }

  async status() {
    try {
      return await this.executeCommand('status');
    } catch (error) {
      throw new Error(`Status check failed: ${error.error}`);
    }
  }

  async logs(service = null) {
    try {
      if (service) {
        return await this.executeCommand('logs', ['--service', service]);
      } else {
        return await this.executeCommand('logs');
      }
    } catch (error) {
      throw new Error(`Logs fetch failed: ${error.error}`);
    }
  }

  async setVariable(key, value, service = null) {
    try {
      const args = ['--set', `${key}=${value}`];
      if (service) {
        args.push('--service', service);
      }
      return await this.executeCommand('variables', args);
    } catch (error) {
      throw new Error(`Variable set failed: ${error.error}`);
    }
  }
}

// MCP Protocol Implementation
const railway = new RailwayMCP();

process.stdin.on('data', async (data) => {
  try {
    const request = JSON.parse(data.toString());
    
    let response;
    switch (request.method) {
      case 'deploy':
        response = await railway.deploy(request.params?.service);
        break;
      case 'status':
        response = await railway.status();
        break;
      case 'logs':
        response = await railway.logs(request.params?.service);
        break;
      case 'setVariable':
        response = await railway.setVariable(
          request.params.key,
          request.params.value,
          request.params?.service
        );
        break;
      default:
        throw new Error(`Unknown method: ${request.method}`);
    }
    
    console.log(JSON.stringify({
      id: request.id,
      result: response
    }));
  } catch (error) {
    console.log(JSON.stringify({
      id: request.id,
      error: {
        code: -1,
        message: error.message
      }
    }));
  }
});

console.log(JSON.stringify({
  jsonrpc: "2.0",
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: {
        "railway-deploy": {
          description: "Deploy service to Railway",
          inputSchema: {
            type: "object",
            properties: {
              service: { type: "string", description: "Service name to deploy" }
            }
          }
        },
        "railway-status": {
          description: "Get Railway project status",
          inputSchema: { type: "object", properties: {} }
        },
        "railway-logs": {
          description: "Get Railway service logs",
          inputSchema: {
            type: "object",
            properties: {
              service: { type: "string", description: "Service name for logs" }
            }
          }
        },
        "railway-set-variable": {
          description: "Set Railway environment variable",
          inputSchema: {
            type: "object",
            properties: {
              key: { type: "string", description: "Variable name" },
              value: { type: "string", description: "Variable value" },
              service: { type: "string", description: "Service name" }
            },
            required: ["key", "value"]
          }
        }
      }
    },
    serverInfo: {
      name: "railway-mcp",
      version: "1.0.0"
    }
  }
}));