/* whatsapp-module.js — a ponte entre o servidor e o WhatsApp.

   Nada de whatsapp-web.js aqui dentro: ele vive em whatsapp-worker.js, num
   processo separado, justamente para que o Chromium não congele o Express.
   Este arquivo só guarda o estado e conversa com o filho por IPC.           */

const { fork } = require('child_process');
const path = require('path');

let filho = null;
let pronto = false;
let qrAtual = null;          // data URL do QR enquanto não há sessão
let qrTexto = null;          // o mesmo QR em texto, se a imagem falhar
let erroAtual = null;
let statusCallback = null;
let conversas = {};

const pendentes = new Map();  // envios esperando resposta do filho
let seq = 0;

function initWhatsApp(onStatusChange) {
  statusCallback = onStatusChange;

  try {
    // stdin FECHADO ('ignore'). Com 'inherit' o filho herdava o terminal como
    // stdin e travava para sempre num read() nele: 0% de CPU, nenhum Chromium,
    // nenhum erro — e o QR não chegava nunca. stdout/stderr seguem no terminal
    // para os logs aparecerem, e 'ipc' é obrigatório para o fork conversar.
    filho = fork(path.join(__dirname, 'whatsapp-worker.js'), [], {
      stdio: ['ignore', 'inherit', 'inherit', 'ipc']
    });
  } catch (err) {
    erroAtual = 'não consegui abrir o processo do WhatsApp: ' + err.message;
    console.error(erroAtual);
    return false;
  }

  filho.on('message', (m) => {
    switch (m.tipo) {
      case 'qr':
        qrAtual = m.qr; qrTexto = m.texto; erroAtual = null;
        console.log('WhatsApp: QR pronto — abra a aba WhatsApp e escaneie.');
        break;

      case 'autenticado':
        qrAtual = qrTexto = null;
        console.log('WhatsApp autenticado.');
        break;

      case 'pronto':
        pronto = true; erroAtual = null;
        console.log('WhatsApp pronto.');
        if (statusCallback) statusCallback(true);
        break;

      case 'conversas':
        conversas = m.conversas || {};
        console.log(`WhatsApp: ${Object.keys(conversas).length} conversas carregadas.`);
        break;

      case 'mensagem':
        adicionarMensagem(m.numero, m.msg);
        break;

      case 'desconectado':
        pronto = false;
        console.log('WhatsApp desconectado.');
        if (statusCallback) statusCallback(false);
        break;

      case 'enviado': {
        const p = pendentes.get(m.id);
        if (!p) break;
        pendentes.delete(m.id);
        m.ok ? p.resolve({ sucesso: true, id: m.msgId })
             : p.reject(new Error(m.erro));
        break;
      }

      case 'diagnostico': {
        const p = pendentes.get(m.id);
        if (!p) break;
        pendentes.delete(m.id);
        m.ok ? p.resolve(m.dados) : p.reject(new Error(m.erro));
        break;
      }

      case 'aviso':
        // Contratempo, não falha: a sessão segue de pé.
        console.warn('WhatsApp (aviso):', m.aviso);
        break;

      case 'erro':
        erroAtual = m.erro;
        console.error('WhatsApp:', m.erro);
        break;
    }
  });

  filho.on('exit', (code) => {
    pronto = false;
    filho = null;
    if (!erroAtual) erroAtual = `o processo do WhatsApp encerrou (código ${code})`;
    console.error('WhatsApp:', erroAtual);
    if (statusCallback) statusCallback(false);
  });

  filho.on('error', (err) => {
    erroAtual = 'erro no processo do WhatsApp: ' + err.message;
    console.error(erroAtual);
  });

  // Nesta máquina, só carregar a árvore de módulos do whatsapp-web.js leva
  // vários minutos (medido). 90s dava alarme falso; 6min só acusa o que é
  // travamento de verdade.
  setTimeout(() => {
    if (pronto || qrAtual || erroAtual) return;
    erroAtual = 'o WhatsApp não respondeu em 6 minutos. Veja o terminal do servidor.';
    console.error(erroAtual);
  }, 360000).unref();

  return true;
}

const isConnected = () => pronto;
const obterQr     = () => qrAtual;
const obterQrTexto= () => qrTexto;
const obterErro   = () => erroAtual;

const soDigitos = n => String(n).replace(/\D/g, '').slice(-11);

function enviarMensagem(numero, texto) {
  if (!filho)  return Promise.reject(new Error('WhatsApp não está rodando'));
  if (!pronto) return Promise.reject(new Error('WhatsApp não conectado'));

  const id = ++seq;

  return new Promise((resolve, reject) => {
    pendentes.set(id, { resolve, reject });
    filho.send({ tipo: 'enviar', id, numero, texto });

    // Se o filho travar, quem chamou não pode ficar pendurado para sempre.
    setTimeout(() => {
      if (!pendentes.has(id)) return;
      pendentes.delete(id);
      reject(new Error('o WhatsApp não respondeu a tempo'));
    }, 30000);
  }).then(r => {
    adicionarMensagem(numero, {
      id: r.id, texto, tipo: 'saida', data: new Date(), autor: 'eu'
    });
    return r;
  });
}

function diagnosticar(){
  if (!filho) return Promise.reject(new Error('WhatsApp não está rodando'));
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pendentes.set(id, { resolve, reject });
    filho.send({ tipo: 'diagnostico', id });
    setTimeout(() => {
      if (!pendentes.has(id)) return;
      pendentes.delete(id);
      reject(new Error('diagnóstico não respondeu'));
    }, 20000);
  });
}

const carregarConversas = async () => conversas;
const obterConversa  = numero => conversas[soDigitos(numero)] || [];
const obterConversas = () => conversas;

function adicionarMensagem(numero, msg) {
  const chatId = soDigitos(numero);
  (conversas[chatId] || (conversas[chatId] = [])).push(msg);
}

async function fecharWhatsApp() {
  if (!filho) return;

  // SIGTERM para o filho fechar a sessão direito; só matamos à força se ele
  // não sair sozinho. Matar direto era o que estragava o .wwebjs_auth.
  const morto = new Promise(r => filho.once('exit', r));
  filho.kill('SIGTERM');

  await Promise.race([morto, new Promise(r => setTimeout(r, 8000))]);

  if (filho && !filho.killed) filho.kill('SIGKILL');
  filho = null;
  pronto = false;
}

module.exports = {
  initWhatsApp, isConnected, obterQr, obterQrTexto, obterErro, diagnosticar,
  enviarMensagem, carregarConversas, obterConversa, obterConversas,
  adicionarMensagem, fecharWhatsApp
};
