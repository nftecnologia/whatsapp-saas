# 📱 Guia de Configuração WhatsApp Cloud API

Este guia explica como configurar a integração WhatsApp Cloud API oficial da Meta para sua empresa.

## 🎯 Visão Geral

A integração WhatsApp Cloud API permite enviar mensagens WhatsApp oficiais através da plataforma Meta Business, oferecendo:

- ✅ **Confiabilidade máxima** - API oficial Meta
- ✅ **Recursos empresariais** - Templates aprovados, botões interativos
- ✅ **Escalabilidade** - Volume alto sem limitações técnicas
- ✅ **Compliance** - GDPR/LGPD via Meta Business
- ✅ **SLA garantido** - Uptime 99.9%

## 📋 Pré-requisitos

Antes de configurar no sistema, você precisa:

### 1. Conta Facebook Business Manager
- Acesse [business.facebook.com](https://business.facebook.com)
- Crie uma conta Business Manager
- Complete a verificação de negócio

### 2. App WhatsApp Business
- Acesse [developers.facebook.com](https://developers.facebook.com)
- Crie um novo App tipo "Business"
- Adicione o produto "WhatsApp Business"

### 3. Número WhatsApp Verificado
- Adicione um número de telefone ao app
- Complete o processo de verificação
- Número deve ser dedicado para Business API

## 🔧 Passos de Configuração

### Passo 1: Obter Credenciais Meta

#### 1.1 Access Token Permanente
```
1. Vá para App Dashboard → WhatsApp → API Setup
2. Clique "Generate Access Token"
3. Selecione permissões: whatsapp_business_messaging
4. Copie o token (começa com EAA...)
5. Configure para não expirar (opcional)
```

#### 1.2 Phone Number ID
```
1. No mesmo painel API Setup
2. Seção "From phone number ID"
3. Copie o número ID (formato: 123456789012345)
```

#### 1.3 Business Account ID
```
1. Vá para Business Manager → Configurações
2. Seção "Informações da empresa"
3. Copie o Business Account ID
```

### Passo 2: Configurar Webhook

#### 2.1 URL do Webhook
```
URL: https://seu-dominio.com/webhooks/evolution
Método: POST
Eventos: messages, message_status
```

#### 2.2 Verificação
```
1. Configure verify token no Meta
2. Webhook será verificado automaticamente
3. Teste com mensagem de exemplo
```

### Passo 3: Configurar no Sistema

#### 3.1 Acessar Integrações
```
1. Faça login no sistema
2. Vá para menu "Integrações"
3. Clique "Nova Integração WhatsApp"
```

#### 3.2 Preencher Formulário
```
Nome da Instância: nome-da-sua-empresa
Meta Access Token: EAA... (token obtido no passo 1.1)
Phone Number ID: 123456789012345 (ID do passo 1.2)
Business Account ID: 987654321 (ID do passo 1.3)
```

#### 3.3 Conectar
```
1. Clique "Criar Integração"
2. Sistema validará credenciais automaticamente
3. Aguarde status "Conectado"
4. Teste enviando mensagem
```

## ✅ Verificação da Configuração

### Status da Integração
- **🟢 Conectado**: Tudo funcionando
- **🟡 Conectando**: Em processo de conexão
- **🔴 Erro**: Problema na configuração
- **⚪ Desconectado**: Não conectado

### Teste de Envio
```
1. Vá para "Campanhas" → "Nova Campanha"
2. Selecione contato de teste
3. Escolha template "hello_world"
4. Envie mensagem
5. Verifique entrega no WhatsApp
```

## 🔧 Solução de Problemas

### Erro: "Token inválido"
**Causa**: Access token expirado ou inválido
**Solução**:
1. Gere novo token no Meta Business
2. Verifique permissões whatsapp_business_messaging
3. Atualize token no sistema

### Erro: "Phone Number ID não encontrado"
**Causa**: ID incorreto ou número não verificado
**Solução**:
1. Verifique ID no painel Meta
2. Confirme que número está verificado
3. Aguarde até 24h para propagação

### Erro: "Business Account ID inválido"
**Causa**: ID incorreto ou conta não aprovada
**Solução**:
1. Confirme ID no Business Manager
2. Verifique status de verificação da conta
3. Complete verificação se necessário

### Status "Conectando" por muito tempo
**Causa**: Webhook não configurado ou inacessível
**Solução**:
1. Verifique URL do webhook no Meta
2. Confirme que domínio está acessível
3. Teste webhook manualmente

## 📊 Limites e Custos

### Limites de Mensagens
- **Teste**: 250 conversas gratuitas
- **Produção**: Baseado no plano Meta Business
- **Rate limit**: 1000 mensagens/segundo (padrão)

### Custos (Meta Business)
- **Conversas de Marketing**: Variável por país
- **Conversas de Utilitário**: Gratuitas em janela de 24h
- **Conversas de Serviço**: Gratuitas
- **Templates**: Sujeitos a aprovação Meta

### Tipos de Mensagem
- **Templates**: Aprovados pela Meta (marketing, utilitário)
- **Mensagens livres**: Apenas em janela de 24h
- **Mídia**: Imagens, vídeos, documentos, áudio
- **Interativos**: Botões, listas, carrossel

## 🛡️ Boas Práticas

### Segurança
- ✅ Mantenha tokens seguros
- ✅ Use HTTPS para webhooks
- ✅ Monitore logs de acesso
- ✅ Rotacione tokens periodicamente

### Conformidade
- ✅ Obtenha opt-in dos usuários
- ✅ Respeite opt-out imediato
- ✅ Não envie spam
- ✅ Siga políticas Meta Business

### Performance
- ✅ Use templates pré-aprovados
- ✅ Monitore taxa de entrega
- ✅ Evite volume excessivo
- ✅ Otimize conteúdo das mensagens

## 📞 Suporte

### Documentação Oficial
- [Meta WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/)
- [Business Manager Help](https://www.facebook.com/business/help)

### Suporte Técnico
- **Sistema**: suporte@sua-empresa.com
- **Meta Business**: Através do Business Manager
- **Emergência**: Contato direto da empresa

---

## 🎉 Parabéns!

Sua integração WhatsApp Cloud API está configurada e pronta para uso empresarial com máxima confiabilidade e recursos oficiais da Meta.