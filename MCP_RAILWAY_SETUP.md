# 🔗 MCP Railway Setup Guide

## ✅ **Configuração MCP Completa**

### **1. Arquivos Criados:**
- `~/.config/claude/mcp_settings.json` - Configuração Claude MCP
- `scripts/mcp-railway.js` - Wrapper MCP para Railway
- `.claude/mcp_settings.json` - Configuração local do projeto

### **2. Como Usar MCP Railway:**

#### **Reiniciar Claude Code:**
```bash
# Feche e reabra Claude Code para carregar MCP
claude mcp
```

#### **Comandos MCP Disponíveis:**
- `railway-deploy` - Deploy serviço para Railway
- `railway-status` - Status do projeto Railway  
- `railway-logs` - Logs dos serviços
- `railway-set-variable` - Configurar variáveis de ambiente

### **3. Deploy via MCP:**

```javascript
// Exemplo de uso via MCP
{
  "method": "railway-deploy",
  "params": {
    "service": "backend-api"
  }
}
```

### **4. Verificar MCP:**

```bash
# Verificar se MCP está funcionando
claude mcp list

# Testar conexão MCP Railway
node scripts/mcp-railway.js
```

### **5. Deploy Direto via CLI:**

Se MCP não funcionar, use CLI diretamente:

```bash
# 1. Deploy backend-api
cd backend-api
railway up --detach

# 2. Deploy backend-worker  
cd ../backend-worker
railway up --detach

# 3. Deploy frontend
cd ../frontend
railway up --detach
```

### **6. Configurar Variáveis via MCP:**

```bash
# Através do wrapper MCP
echo '{"method":"setVariable","params":{"key":"NODE_ENV","value":"production","service":"backend-api"}}' | node scripts/mcp-railway.js
```

## 🚀 **Próximos Passos:**

### **Opção A: MCP Railway (se funcionar)**
1. Reinicie Claude Code
2. Execute `claude mcp`
3. Use comandos MCP para deploy

### **Opção B: Railway Dashboard (recomendado)**
1. Acesse https://railway.app/dashboard
2. New Project → Deploy from GitHub
3. Conecte `nftecnologia/whatsapp-saas`
4. Siga `RAILWAY_MANUAL_DEPLOY.md`

### **Opção C: CLI Manual**
1. Execute comandos CLI um por um
2. Use `railway up --service <nome>`
3. Configure variáveis manualmente

## 🎯 **Estado Atual:**

✅ **Pronto para deploy:**
- Stack Auth configurado
- CloudAMQP configurado  
- GitHub atualizado
- Railway configs prontos
- MCP wrapper criado

⏳ **Pendente:**
- Executar deploy (qualquer método acima)
- Configurar Meta Business Manager
- Testar deployment

## 🔧 **Troubleshooting MCP:**

### **Se MCP não funcionar:**
1. Verificar Node.js instalado
2. Verificar Railway CLI funcionando
3. Usar Railway Dashboard como alternativa

### **Logs MCP:**
```bash
# Debug MCP Railway
node scripts/mcp-railway.js --debug
```

**✅ MCP Railway configurado! Escolha método de deploy acima.**