# 🎯 ProspecApp — Instalação e Uso

## ✅ O que foi entregue

### 1️⃣ **Proximidade no topo**
- Leads de Presidente Prudente ganham +5-15 pontos (próximos de Regente Feijó)
- **CDI Hospital e Supermercado Estrela sobem para 99 QUENTE**
- Vê em `score.js:74-81`

### 2️⃣ **Animações fluidas**
- Painéis abrem/fecham em 200ms com easing
- Modais aparecem com scale suave (220ms)
- Esc anima a saída (não desaparece bruscamente)
- Vê em `styles.css:798+` (keyframes `entra`, `sai`, `entra-m`, `sai-m`)

### 3️⃣ **Preview de fotos clicável**
- Clique no avatar (se tiver foto) abre tamanho grande
- Sem corte, mostra origem abaixo
- Fecha com Esc/véu/X (mantém painel aberto)
- Vê em `app-web.js:795-831`

### 4️⃣ **Logo e Electron**
- Ícone gradiente com símbolo de alvo (proximidade)
- App desktop com `npm start`
- Servidor Express inicia automaticamente
- Vê em `main.js` e `assets/icon.png`

### 5️⃣ **Base de 107 leads**
- Todos de Presidente Prudente (~100 km de Regente)
- 31 com site confirmado por domínio
- 82 com foto comprovada
- Todos têm telefone e endereço

---

## 🚀 Como rodar

### Versão web (navegador)

```bash
cd /Users/caiorodrigues/Documents/LEADS
npm install
node server.js
```

Abra `http://localhost:3000` no navegador.

### Versão desktop (Electron) — **recomendado**

```bash
cd /Users/caiorodrigues/Documents/LEADS
npm install
npm start
```

Isso:
1. Inicia o servidor Express
2. Abre uma janela Electron (desktop nativo)
3. Salva dados em `dados.json` na pasta do projeto

**Menus:** 
- Cmd+Q para sair
- F12 para dev tools (Desenvolvimento → Ferramentas do desenvolvedor)

---

## 🗂️ Estrutura

```
server.js              API Express + persistência
app-web.js             Lógica toda (interface, score, animações)
index.html             Estrutura
styles.css             Soft UI + animações
dados.json             Base de leads (criado automaticamente)
assets/logos/          Fotos (82 leads)
assets/icon.png        Ícone do Electron
main.js                Janela Electron + spawn do servidor
package.json           Dependências (express, cors, electron, sharp)
```

---

## 🎨 O que você controla

### Proximidade
Em `score.js`, linha 74-81, mude os pesos:
```javascript
const proxPts = prox === 2 ? 15 : prox === 3 ? 10 : prox === 4 ? 5 : 0;
//                      ↑ mesmo bairro    ↑ centro    ↑ outro bairro
```

### Cores e animações
Em `styles.css`, busque `--acento`, `--curva`, `entra-m`, `sai-m`.

### Bairro da sua localização
Em `score.js`, linha 7:
```javascript
const MEU_BAIRRO = "Centro";  // Mude para seu bairro em Regente Feijó
```

---

## 🔍 Dados

- **Sem login, sem nuvem** — `dados.json` fica no seu disco
- **Fotos de 82 leads** em `assets/logos/` (4.3 MB)
- **Site confirmado** para 31 (prova de domínio + cidade/telefone)
- **Fonte:** Diretório Prudente Empresas, búsqueda Bing, verificação automática

---

## 🐛 Se não funcionar

1. Verifica se a porta 3000 está livre:
   ```bash
   lsof -i :3000
   # Se algo estiver usando, mata:
   # kill -9 <PID>
   ```

2. Rodando direto (sem Electron):
   ```bash
   npm install express cors
   node server.js
   ```

3. Verifica os logs:
   ```bash
   tail -50 /tmp/server.log
   ```

---

**Pronto para prospectar! 📞**
