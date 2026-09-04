# ProspecApp — Electron

Agora o app roda **desktop nativo** com Electron.

## Instalação

```bash
npm install
```

## Rodar

```bash
npm start
```

Isso:
1. Inicia o servidor Express em `localhost:3000`
2. Abre uma janela Electron apontando para o servidor
3. Salva dados em `dados.json` na pasta do projeto

## Desenvolvimento

Para abrir as ferramentas de desenvolvedor (F12 no menu):
- **Arquivo** → Sair (ou Cmd+Q)
- **Desenvolvimento** → Ferramentas do desenvolvedor (F12)

## O que foi otimizado

✅ **Proximidade no score** — Leads de Presidente Prudente (próximos de Regente Feijó) ganham +5-15 pontos. CDI Hospital e Supermercado Estrela subiram para 99 QUENTE.

✅ **Animações de entrada/saída** — Painéis e modais abrem e fecham com easing suave (200-220ms). Tecla Esc anima a saída.

✅ **Preview de fotos clicável** — Avatar com foto passa a ser botão zoom-in. Clique abre a foto em grande (sem cortar), mostra link de origem e fecha com Esc mantendo o painel aberto.

✅ **Electron desktop** — Empacota o servidor Express dentro da janela. `npm start` abre tudo de uma vez; ao fechar a janela, o servidor morre junto.

## Estrutura

```
server.js          API Express
main.js            Janela Electron + spawn do servidor
index.html         Interface
app-web.js         Toda a lógica
styles.css         Soft UI + animações
dados.json         Base de leads (criado automaticamente)
assets/logos/      Fotos dos leads
```

Sem build, sem cache, sem SSL local — tudo roda em `localhost:3000`.
