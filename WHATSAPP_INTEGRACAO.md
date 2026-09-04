# 🔗 Integração WhatsApp — ProspecApp

## ✨ Duas Formas de Conectar

### **Opção 1: WhatsApp Business API (Oficial)**
- ✅ Confiável, oficial Meta
- ❌ Custa ~R$ 0,30 por mensagem
- ⏱️ Setup: 2-3 dias

### **Opção 2: WhatsApp Web (Rápido)**
- ✅ Funciona hoje (15 min de setup)
- ⚠️ Não-oficial, pode ter limite
- ✅ Gratuito

---

## 🚀 Começar Rápido (WhatsApp Web)

```bash
cd /Users/caiorodrigues/Documents/LEADS
npm install whatsapp-web.js qrcode-terminal
```

**No server.js:**
```javascript
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client();

client.on('qr', (qr) => {
  console.log('Escanear este QR code:');
  qrcode.generate(qr, { small: true });
});

client.on('message', (msg) => {
  console.log(`[WhatsApp] ${msg.from}: ${msg.body}`);
  // Aqui: salvar no banco, notificar UI
});

client.initialize();
```

**Enviar mensagem:**
```javascript
function enviarWhatsApp(numero, texto) {
  client.sendMessage(numero + '@c.us', texto);
}
```

---

## 📱 No App (Próxima Versão)

Adicionar seção "Conversas":

```
┌─ CONVERSAS ATIVAS ─────────┐
│ 🔵 João        (respondendo)│
│ ⏳ Maria       (aguardando) │
│ 🟢 Carlos      (concluído)  │
└────────────────────────────┘

Ao clicar em "João":
┌─ CONVERSA COM JOÃO ────┐
│ João: "Oi, tudo certo?"│
│ Você: "Claro! Sem...  │
│                        │
│ [Responder...]        │
│ [Enviar via WhatsApp] │
└────────────────────────┘
```

---

## ⏱️ Timeline

**Hoje (15 min):**
- ✅ Área "Conversas Ativas" (localStorage)
- ✅ Status: respondendo/aguardando

**Esta semana (3h):**
- ✅ WhatsApp Web conectado
- ✅ Receber mensagens em tempo real
- ✅ Enviar pelo app

**Próx semana (8h):**
- ✅ Business API (se quiser official)
- ✅ Histórico sincronizado
- ✅ Notificações push

---

Quer que eu comece com a área de conversas hoje?
