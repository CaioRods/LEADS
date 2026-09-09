/* wa-ponte.js — o lado do servidor da conversa do agente.

   Sobe o wa-worker, mantém a lista de leads sob gestão sempre sincronizada
   com ele, e grava no dados.json o que chega. O worker não conhece leads nem
   arquivo; a ponte não conhece WhatsApp. Cada um sabe uma coisa só.        */

const { fork } = require('child_process');
const path = require('path');

let worker = null;
let estado = { conectado: false, qr: null, qrTexto: null, numero: null,
               erro: null, enviadasHoje: 0, autorizados: 0 };

let pendentes = new Map();     // id do envio -> resolve
let proximoId = 1;

/* A ponte não guarda leads: pede ao dono do dado quando precisa. Assim não há
   duas cópias da verdade para divergir. */
let lerLeads = () => [];
let gravarMensagem = () => {};

function iniciar({ lerLeads: ler, gravarMensagem: gravar }) {
  if (worker) return;
  lerLeads = ler;
  gravarMensagem = gravar;

  worker = fork(path.join(__dirname, 'wa-worker.js'), [], {
    // stdin ignorado: herdar o terminal travava o processo filho quando ele
    // tentava ler algo que nunca vinha — foi assim que o worker anterior
    // ficava pendurado sem dar sinal.
    stdio: ['ignore', 'inherit', 'inherit', 'ipc']
  });

  worker.on('message', (m) => {
    if (m.tipo === 'qr') {
      estado.qr = m.qr; estado.qrTexto = m.texto; estado.erro = null;
    }

    if (m.tipo === 'pronto') {
      estado.conectado = true; estado.qr = null; estado.numero = m.numero;
      sincronizarAutorizados();
    }

    if (m.tipo === 'desconectado') {
      estado.conectado = false;
      if (m.definitivo) estado.erro = 'sessão encerrada no celular — escaneie o QR de novo';
    }

    if (m.tipo === 'erro')   estado.erro = m.erro;
    if (m.tipo === 'aviso')  console.warn('[wa]', m.aviso);
    if (m.tipo === 'autorizados-ok') estado.autorizados = m.total;

    if (m.tipo === 'estado') {
      estado.enviadasHoje = m.enviadasHoje;
      estado.limites = m.limites;
      estado.autorizados = m.autorizados;
    }

    // Resposta de um lead sob gestão. O worker já filtrou tudo o que não é.
    if (m.tipo === 'mensagem') {
      const lead = acharPorFone(m.numero);
      if (lead) gravarMensagem(lead.id, m.texto, 'entrada', m.em);
    }

    if (m.tipo === 'enviado') {
      const r = pendentes.get(m.id);
      if (r) { pendentes.delete(m.id); r(m); }
      if (m.enviadasHoje != null) estado.enviadasHoje = m.enviadasHoje;
    }
  });

  worker.on('exit', (c) => {
    worker = null; estado.conectado = false;
    if (c) estado.erro = `o WhatsApp do agente encerrou (código ${c})`;
  });
}

const soDigitos = s => String(s || '').replace(/\D/g, '');
const chaveFone = s => { const d = soDigitos(s); return d.length >= 8 ? d.slice(-8) : null; };

const souGerido = l => l.agente === true && l.status !== 'descartado';

function acharPorFone(numero) {
  const k = chaveFone(numero);
  if (!k) return null;
  return lerLeads().find(l => souGerido(l) && chaveFone(l.telefone) === k) || null;
}

/* A lista de autorizados é derivada, nunca digitada: é sempre exatamente
   quem está marcado como sob gestão. Chamada toda vez que algo muda, para
   não existir a janela em que o worker acha que ainda pode falar com um lead
   que você acabou de tirar. */
function sincronizarAutorizados() {
  if (!worker) return;
  const numeros = lerLeads().filter(souGerido).map(l => l.telefone).filter(Boolean);
  worker.send({ tipo: 'autorizados', numeros });
}

function enviar(numero, texto, ehResposta = false) {
  return new Promise((resolve) => {
    if (!worker || !estado.conectado)
      return resolve({ ok: false, erro: 'WhatsApp do agente não está conectado' });

    const id = proximoId++;
    pendentes.set(id, resolve);
    worker.send({ tipo: 'enviar', id, numero, texto, ehResposta });

    // O worker espera de propósito entre envios; a folga aqui cobre a maior
    // espera possível mais o tempo da rede.
    setTimeout(() => {
      if (pendentes.has(id)) {
        pendentes.delete(id);
        resolve({ ok: false, erro: 'sem resposta do WhatsApp (tempo esgotado)' });
      }
    }, 240000);
  });
}

function pedirEstado() {
  if (worker) worker.send({ tipo: 'estado' });
  return estado;
}

function encerrar() {
  if (!worker) return;
  worker.send({ tipo: 'sair' });
  worker.kill('SIGTERM');
  worker = null;
}

module.exports = { iniciar, enviar, pedirEstado, sincronizarAutorizados, encerrar,
                   get estado(){ return estado; } };
