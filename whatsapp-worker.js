/* whatsapp-worker.js — o WhatsApp roda AQUI, num processo separado.

   Motivo: whatsapp-web.js carrega o Puppeteer e sobe um Chromium. Esse
   trabalho trava o event loop por segundos — e, se algo dá errado, trava para
   sempre. Dentro do servidor isso congelava o app inteiro: a lista de leads
   parava de responder junto. Aqui, o pior caso é este processo travar sozinho;
   o ProspecApp continua de pé e só mostra "WhatsApp indisponível".

   Conversa com o pai por process.send/on('message').                        */

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const enviaPai = m => { if (process.send) process.send(m); };

/* Uma sessão de WhatsApp custa um QR escaneado à mão: ela não pode morrer por
   causa de um erro em qualquer canto do puppeteer. O Node encerra o processo
   em promessa rejeitada sem dono — aqui isso vira só um aviso. */
process.on('unhandledRejection', (err) => {
  enviaPai({ tipo: 'aviso', aviso: 'promessa rejeitada: ' +
    (err && err.message ? err.message : String(err)) });
});

process.on('uncaughtException', (err) => {
  enviaPai({ tipo: 'aviso', aviso: 'exceção: ' + err.message });
});

let client = null;

function morrer(motivo, err) {
  enviaPai({ tipo: 'erro', erro: `${motivo}: ${err && err.message ? err.message : err}` });
}

let Client, LocalAuth;
try {
  ({ Client, LocalAuth } = require('whatsapp-web.js'));
} catch (err) {
  morrer('whatsapp-web.js não carregou', err);
  process.exit(1);
}

/* Apontar o Chrome explicitamente evita que o puppeteer vá resolver sozinho
   qual navegador usar na hora do require — caminho que aqui custa minutos.
   Se o caminho fixo não existir (outra máquina, outra versão), caímos no
   comportamento padrão em vez de quebrar. */
function acharChrome(){
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const base = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome');
  if (!fs.existsSync(base)) return undefined;

  for (const versao of fs.readdirSync(base)) {
    for (const pasta of ['chrome-mac-x64', 'chrome-mac-arm64']) {
      const bin = path.join(base, versao, pasta,
        'Google Chrome for Testing.app', 'Contents', 'MacOS',
        'Google Chrome for Testing');
      if (fs.existsSync(bin)) return bin;
    }
  }
  return undefined;
}

const chrome = acharChrome();
if (chrome) console.log('WhatsApp: usando Chrome em', chrome);

/* A whatsapp-web.js 1.34.7 foi construída contra o WhatsApp Web
   2.3000.1017054665, versão que não existe mais no índice. Sem encontrá-la,
   ela cai na "latest" — e é daí que vem a quebra: getChats() estourando com
   "r" e sendMessage() devolvendo undefined. Fixamos então a versão mais
   antiga ainda publicada, que é a mais próxima do que a biblioteca conhece.

   Custo assumido: o HTML vem do repositório wa-version (wppconnect), de
   terceiros, e um dia essa versão também será desativada pelo WhatsApp.
   WPP_WEB_VERSION permite trocar sem mexer no código. */
const versaoWeb = process.env.WPP_WEB_VERSION || '2.3000.1042620056-alpha';

/* Sem dataPath explícito o LocalAuth grava em `process.cwd()/.wwebjs_auth`.
   No app empacotado o diretório de execução é a RAIZ do sistema, então ele
   tentava criar /.wwebjs_auth e morria com ENOENT. O Electron passa por
   PROSPEC_SESSAO um caminho gravável; pelo terminal, segue na pasta do
   projeto como antes. */
const pastaSessao = process.env.PROSPEC_SESSAO || path.join(__dirname, '.wwebjs_auth');
console.log('WhatsApp: sessão em', pastaSessao);

client = new Client({
  authStrategy: new LocalAuth({ clientId: 'prospecapp', dataPath: pastaSessao }),
  webVersion: versaoWeb,
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/' +
                `wa-version/main/html/${versaoWeb}.html`
  },
  // Sem bypassCSP a política de segurança da página bloqueia a injeção do
  // Store — e o diagnóstico mostrou Store com zero chaves, com o WWebJS
  // inteiro carregado em cima do vazio. É a peça que faltava.
  bypassCSP: true,
  puppeteer: {
    headless: true,
    executablePath: chrome,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  }
});

console.log('WhatsApp: fixando WhatsApp Web', versaoWeb);

client.on('qr', async (qr) => {
  let dataUrl = null;
  try {
    const qrcode = require('qrcode');
    dataUrl = await qrcode.toDataURL(qr, { margin: 1, width: 240 });
  } catch (err) {
    // Sem imagem ainda dá para conectar: o pai manda o texto para a tela.
    enviaPai({ tipo: 'erro', erro: 'QR sem imagem (' + err.message + ')' });
  }
  enviaPai({ tipo: 'qr', qr: dataUrl, texto: qr });
});

client.on('authenticated', () => enviaPai({ tipo: 'autenticado' }));
client.on('auth_failure', () => morrer('falha de autenticação', 'o WhatsApp recusou a sessão'));
client.on('disconnected', () => enviaPai({ tipo: 'desconectado' }));

client.on('ready', () => {
  enviaPai({ tipo: 'pronto' });
  // Sem await aqui: se a listagem falhar, a rejeição não pode escapar de um
  // handler async e derrubar o processo — foi assim que uma sessão recém
  // autenticada morreu junto com o worker.
  carregarComCalma();
});

/* O WhatsApp Web demora a montar suas estruturas internas depois do 'ready':
   chamar getChats() cedo demais estoura com um erro opaco ("r: r"). Então
   tentamos algumas vezes, com folga crescente, e desistimos sem morrer. */
async function carregarComCalma(){
  const esperas = [3000, 6000, 10000, 15000, 25000];

  for (let i = 0; i < esperas.length; i++){
    await new Promise(r => setTimeout(r, esperas[i]));
    try {
      const conversas = await lerConversas();
      enviaPai({ tipo: 'conversas', conversas });
      return;
    } catch (err) {
      enviaPai({ tipo: 'aviso', aviso:
        `tentativa ${i + 1} de listar conversas falhou: ${err.message}` });
    }
  }

  enviaPai({ tipo: 'erro',
    erro: 'conectado, mas não consegui listar as conversas.' });
}

client.on('message', async (msg) => {
  const de = msg.from || '';

  // Grupo, lista de transmissão e status não são conversa com lead. O filtro
  // existia no getChats() e faltava aqui: spam de grupo entrava na aba.
  if (de.endsWith('@g.us') || de.endsWith('@broadcast') || msg.isStatus) return;

  let numero = de.split('@')[0];

  /* @lid é o identificador anônimo novo do WhatsApp, não um telefone. Cortar
     seus últimos 11 dígitos produzia um número inventado, que não casa com
     lead nenhum. Pedimos o contato real; sem número utilizável, ignoramos em
     vez de guardar lixo. */
  if (de.endsWith('@lid')) {
    try {
      const contato = await msg.getContact();
      const real = (contato && (contato.number || (contato.id && contato.id.user))) || '';
      if (!/^\d{10,15}$/.test(String(real))) return;
      numero = String(real);
    } catch (_) { return; }
  }

  enviaPai({
    tipo: 'mensagem',
    numero,
    msg: {
      id: msg.id.id,
      texto: msg.body,
      tipo: 'entrada',
      data: new Date(msg.timestamp * 1000),
      autor: de
    }
  });
});

async function lerConversas() {
  const eu = client.info.wid.user;
  const chats = (await client.getChats()).filter(c => !c.isGroup).slice(0, 30);

  const saida = {};
  for (const chat of chats) {
    const numero = chat.id._serialized.split('@')[0].replace(/\D/g, '').slice(-11);
    const mensagens = await chat.fetchMessages({ limit: 50 });

    saida[numero] = mensagens.map(m => ({
      id: m.id.id,
      texto: m.body,
      tipo: m.from.includes(eu) ? 'saida' : 'entrada',
      data: new Date(m.timestamp * 1000),
      autor: m.from
    }));
  }
  return saida;
}

process.on('message', async (ordem) => {
  if (!ordem) return;

  /* Diagnóstico: olha dentro da página do WhatsApp Web para ver quais peças
     a biblioteca conseguiu injetar. É a diferença entre adivinhar e saber por
     que sendMessage devolve undefined. */
  if (ordem.tipo === 'diagnostico') {
    try {
      const pagina = client.pupPage;
      const r = await pagina.evaluate(() => ({
        versaoWeb:   (window.Debug && window.Debug.VERSION) || null,
        temStore:    typeof window.Store !== 'undefined',
        temChat:     !!(window.Store && window.Store.Chat),
        temMsg:      !!(window.Store && window.Store.Msg),
        temSendMsg:  !!(window.Store && window.Store.SendMessage),
        temWid:      !!(window.Store && window.Store.WidFactory),
        temWWebJS:   typeof window.WWebJS !== 'undefined',
        funcsWWebJS: window.WWebJS ? Object.keys(window.WWebJS).slice(0, 25) : [],
        chavesStore: window.Store ? Object.keys(window.Store).length : 0
      }));
      enviaPai({ tipo: 'diagnostico', id: ordem.id, ok: true, dados: r });
    } catch (err) {
      enviaPai({ tipo: 'diagnostico', id: ordem.id, ok: false, erro: err.message });
    }
    return;
  }

  if (ordem.tipo !== 'enviar') return;

  const { id, numero, texto } = ordem;
  try {
    const destino = `55${String(numero).replace(/\D/g, '').slice(-11)}@c.us`;
    const r = await client.sendMessage(destino, texto);

    // sendMessage pode devolver undefined quando a camada que a biblioteca
    // injeta no WhatsApp Web está fora de sintonia com a versão atual do site.
    // Ler r.id.id às cegas transformava isso em "Cannot read properties of
    // undefined" — mensagem que não diz nada a quem está usando o app.
    if (!r || !r.id) {
      enviaPai({ tipo: 'enviado', id, ok: false, erro:
        'o WhatsApp Web não confirmou o envio — a biblioteca está fora de ' +
        'sintonia com a versão atual do site. A mensagem pode não ter saído.' });
      return;
    }

    enviaPai({ tipo: 'enviado', id, ok: true, msgId: r.id.id });
  } catch (err) {
    enviaPai({ tipo: 'enviado', id, ok: false, erro: err.message });
  }
});

/* O primeiro initialize costuma falhar com "Execution context was destroyed"
   quando a página do WhatsApp navega no meio da subida — é transitório, e não
   pode deixar o WhatsApp morto até alguém reiniciar à mão. Tentamos de novo
   algumas vezes antes de desistir. */
async function subir(tentativa = 1) {
  const MAX = 4;
  try {
    await client.initialize();
  } catch (err) {
    if (tentativa >= MAX) return morrer(`não consegui inicializar após ${MAX} tentativas`, err);

    enviaPai({ tipo: 'aviso', aviso:
      `initialize falhou (${tentativa}/${MAX}): ${err.message} — tentando de novo` });

    await new Promise(r => setTimeout(r, 4000 * tentativa));
    return subir(tentativa + 1);
  }
}

/* Desligar sem fechar o cliente corrompe a sessão salva em .wwebjs_auth e
   obriga o usuário a escanear o QR de novo. Foi o que aconteceu quando
   reiniciei o servidor à força. Aqui fechamos com calma antes de sair. */
let saindo = false;

async function sairComCalma(sinal) {
  if (saindo) return;
  saindo = true;
  console.log(`WhatsApp: encerrando (${sinal}) — fechando a sessão com calma…`);
  try { await client.destroy(); } catch (_) {}
  process.exit(0);
}

process.on('SIGTERM', () => sairComCalma('SIGTERM'));
process.on('SIGINT',  () => sairComCalma('SIGINT'));

subir();
