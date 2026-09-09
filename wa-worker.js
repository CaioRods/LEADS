#!/usr/bin/env node
/* wa-worker.js — o WhatsApp do agente, num processo separado.

   Processo à parte pelo mesmo motivo de antes: se a conexão travar, ela trava
   sozinha e o ProspecApp continua de pé. Mas agora sem Chromium — a Baileys
   fala o protocolo do WhatsApp por WebSocket, então isto custa megabytes em
   vez dos 350 MB e dos minutos de partida que o whatsapp-web.js custava.

   ISOLAMENTO — a regra mais importante deste arquivo
   O agente só pode ver e tocar conversas de leads que VOCÊ colocou sob gestão
   dele. Tudo o mais — sua família, seus amigos, seus clientes atuais, grupos,
   status — é descartado antes de qualquer processamento, e nem chega a ser
   registrado. A lista de números autorizados vem do processo pai e é a única
   porta de entrada: número fora dela não existe para este worker.

   LIMITES
   Banimento de número não vem de "ser automatizado", vem de volume, de
   insistência e de horário. Os tetos abaixo existem para proteger o número,
   não por burocracia. Eles são impostos AQUI, no worker, e não na camada que
   o agente controla — o agente não consegue pedir para exceder.            */

const fs = require('fs');
const path = require('path');
const os = require('os');

const enviaPai = m => { if (process.send) process.send(m); };

/* Uma sessão custa um QR escaneado à mão. Ela não pode morrer porque alguma
   promessa da biblioteca rejeitou sem dono. */
process.on('unhandledRejection', err => enviaPai({ tipo: 'aviso',
  aviso: 'promessa rejeitada: ' + (err?.message || String(err)) }));
process.on('uncaughtException', err => enviaPai({ tipo: 'aviso',
  aviso: 'exceção: ' + err.message }));

let baileys;
try {
  baileys = require('baileys');
} catch (err) {
  enviaPai({ tipo: 'erro', erro: 'baileys não carregou: ' + err.message });
  process.exit(1);
}

const { makeWASocket, useMultiFileAuthState, DisconnectReason,
        fetchLatestBaileysVersion } = baileys;

// ------------------------------------------------------------- configuração

const LIMITES = {
  // Teto diário de mensagens de PRIMEIRA abordagem. Responder quem escreveu
  // para você não conta: responder é o comportamento que menos gera denúncia.
  abordagensPorDia: +(process.env.WA_MAX_DIA || 25),

  // Espera entre envios, sorteada nesta faixa. Rajada em intervalo fixo é o
  // padrão que mais denuncia automação.
  intervaloMinS: +(process.env.WA_MIN_S || 45),
  intervaloMaxS: +(process.env.WA_MAX_S || 180),

  // Fora disto, nada sai. Mensagem comercial de madrugada é o caminho mais
  // curto para o botão de denunciar.
  horaInicio: +(process.env.WA_HORA_INI || 9),
  horaFim:    +(process.env.WA_HORA_FIM || 18),
  diasUteis:  process.env.WA_FIM_DE_SEMANA === '1' ? false : true
};

const pastaSessao = process.env.PROSPEC_SESSAO_WA
  || path.join(os.homedir(), 'Library', 'Application Support', 'ProspecApp', 'wa-agente');

// ---------------------------------------------------------------- isolamento

/* Números que o agente pode tocar. Vem do pai; começa VAZIA de propósito —
   antes de o pai mandar a lista, o worker não fala com ninguém. */
let autorizados = new Set();

const soDigitos = s => String(s || '').replace(/\D/g, '');

/* O WhatsApp guarda números brasileiros ora com o 9 do celular, ora sem, e o
   JID vem com o 55 na frente. Comparar os últimos 8 dígitos ignora todas
   essas variações sem confundir dois assinantes diferentes. */
const chaveFone = s => {
  const d = soDigitos(s);
  return d.length >= 8 ? d.slice(-8) : null;
};

function autorizado(jid) {
  if (!jid) return false;
  // Grupo, lista de transmissão, status e o "canal" nunca são lead.
  if (/@g\.us$|@broadcast$|@newsletter$/.test(jid)) return false;
  if (jid === 'status@broadcast') return false;

  const k = chaveFone(jid.split('@')[0]);
  return !!k && autorizados.has(k);
}

// ------------------------------------------------------------------- limites

let enviadasHoje = 0;
let diaCorrente = new Date().toDateString();
let ultimoEnvio = 0;

function viraODia() {
  const hoje = new Date().toDateString();
  if (hoje !== diaCorrente) { diaCorrente = hoje; enviadasHoje = 0; }
}

/* Devolve null se pode enviar, ou o motivo da recusa. Separar "pode" de
   "envia" deixa o agente saber POR QUE não saiu, em vez de só falhar. */
function porQueNaoPodeEnviar(ehResposta) {
  viraODia();

  const agora = new Date();
  const h = agora.getHours();
  const diaSemana = agora.getDay();

  if (LIMITES.diasUteis && (diaSemana === 0 || diaSemana === 6))
    return 'fim de semana — mensagem comercial fora do horário gera denúncia';

  if (h < LIMITES.horaInicio || h >= LIMITES.horaFim)
    return `fora do horário comercial (${LIMITES.horaInicio}h às ${LIMITES.horaFim}h)`;

  // Responder quem te escreveu não conta no teto: é o oposto de spam.
  if (!ehResposta && enviadasHoje >= LIMITES.abordagensPorDia)
    return `teto diário atingido (${LIMITES.abordagensPorDia} abordagens)`;

  return null;
}

const esperaSorteada = () => {
  const { intervaloMinS: a, intervaloMaxS: b } = LIMITES;
  return (a + Math.random() * (b - a)) * 1000;
};

// -------------------------------------------------------------------- socket

let sock = null;
let conectado = false;

async function conectar() {
  fs.mkdirSync(pastaSessao, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(pastaSessao);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    // A Baileys imprime muito no stdout por padrão; aqui o stdout é do IPC.
    logger: require('pino')({ level: 'silent' }),
    // Marcar-se como online faz o WhatsApp entregar notificação ao celular do
    // destinatário de forma diferente; ficar offline é o comportamento de
    // quem só usa o aparelho, que é o que queremos parecer.
    markOnlineOnConnect: false,
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect, qr } = u;

    if (qr) {
      require('qrcode').toDataURL(qr, { margin: 1, width: 260 })
        .then(img => enviaPai({ tipo: 'qr', qr: img, texto: qr }))
        .catch(() => enviaPai({ tipo: 'qr', qr: null, texto: qr }));
    }

    if (connection === 'open') {
      conectado = true;
      enviaPai({ tipo: 'pronto', numero: sock.user?.id?.split(':')[0] || null });
    }

    if (connection === 'close') {
      conectado = false;
      const code = lastDisconnect?.error?.output?.statusCode;

      // Deslogado é definitivo: a sessão foi revogada no celular e insistir
      // só gera tentativas mortas. Qualquer outra queda é transitória.
      if (code === DisconnectReason.loggedOut) {
        enviaPai({ tipo: 'desconectado', definitivo: true });
        return;
      }
      enviaPai({ tipo: 'desconectado', definitivo: false });
      setTimeout(() => conectar().catch(e =>
        enviaPai({ tipo: 'erro', erro: 'reconexão falhou: ' + e.message })), 5000);
    }
  });

  /* AQUI mora o isolamento. Toda mensagem que chega passa por este funil, e
     o que não é de lead sob gestão é descartado sem ser lido nem registrado. */
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const m of messages) {
      if (m.key.fromMe) continue;                    // eco do que eu mandei
      const jid = m.key.remoteJid;
      if (!autorizado(jid)) continue;                // <- a porta fechada

      const texto = m.message?.conversation
                 || m.message?.extendedTextMessage?.text
                 || m.message?.imageMessage?.caption
                 || '';
      if (!texto.trim()) continue;

      enviaPai({
        tipo: 'mensagem',
        numero: soDigitos(jid.split('@')[0]),
        texto: texto.slice(0, 4000),
        em: new Date((Number(m.messageTimestamp) || Date.now() / 1000) * 1000).toISOString()
      });
    }
  });
}

// ------------------------------------------------------------ ordens do pai

process.on('message', async (ordem) => {
  if (!ordem || !ordem.tipo) return;

  if (ordem.tipo === 'autorizados') {
    autorizados = new Set((ordem.numeros || []).map(chaveFone).filter(Boolean));
    enviaPai({ tipo: 'autorizados-ok', total: autorizados.size });
    return;
  }

  if (ordem.tipo === 'estado') {
    viraODia();
    enviaPai({ tipo: 'estado', conectado,
      numero: sock?.user?.id?.split(':')[0] || null,
      autorizados: autorizados.size,
      enviadasHoje, limites: LIMITES });
    return;
  }

  if (ordem.tipo !== 'enviar') return;

  const { id, numero, texto, ehResposta } = ordem;

  /* O isolamento é avaliado ANTES de qualquer outra coisa, inclusive da
     conexão. Duas razões: é a trava que protege terceiros, então não pode
     depender de nenhum estado anterior dar certo; e assim ela é verificável
     sem WhatsApp conectado — do contrário a única forma de testar o
     isolamento seria com uma sessão real, e uma trava que não se testa é uma
     trava em que não se confia.

     A checagem é dupla de propósito: mesmo o pai pedindo, um bug na camada de
     cima não vira mensagem enviada para a pessoa errada. */
  const k = chaveFone(numero);
  if (!k || !autorizados.has(k))
    return enviaPai({ tipo: 'enviado', id, ok: false,
      erro: 'número não está sob gestão do agente — recusado pelo isolamento' });

  /* Os limites também vêm antes da conexão, pela mesma razão: são proteção,
     e "está fora do horário" é uma resposta mais útil que "não conectado"
     quando as duas coisas valem. Além disso torna a política verificável sem
     uma sessão real de WhatsApp. */
  const recusa = porQueNaoPodeEnviar(ehResposta);
  if (recusa)
    return enviaPai({ tipo: 'enviado', id, ok: false, erro: recusa, adiavel: true });

  if (!conectado)
    return enviaPai({ tipo: 'enviado', id, ok: false, erro: 'WhatsApp não conectado' });

  // Espaça os envios mesmo quando o pai pede em sequência.
  const desdeUltimo = Date.now() - ultimoEnvio;
  const alvo = esperaSorteada();
  if (desdeUltimo < alvo) await new Promise(r => setTimeout(r, alvo - desdeUltimo));

  try {
    const jid = '55' + soDigitos(numero).slice(-11) + '@s.whatsapp.net';

    // Confere que o número existe no WhatsApp antes de mandar. Disparar para
    // número inválido em série é um dos sinais que o WhatsApp usa para
    // identificar automação.
    const [existe] = await sock.onWhatsApp(jid);
    if (!existe?.exists)
      return enviaPai({ tipo: 'enviado', id, ok: false,
        erro: 'este número não tem WhatsApp' });

    await sock.sendMessage(existe.jid, { text: texto });

    ultimoEnvio = Date.now();
    if (!ehResposta) enviadasHoje++;

    enviaPai({ tipo: 'enviado', id, ok: true, enviadasHoje });
  } catch (err) {
    enviaPai({ tipo: 'enviado', id, ok: false, erro: err.message });
  }
});

/* Encerrar com calma, mas com prazo. sock.end() pode nunca resolver se a
   conexão já caiu de um jeito estranho, e um await sem teto deixava o worker
   vivo depois do SIGTERM — cada reinício do app acumulava um órfão, todos
   ainda segurando a mesma sessão. */
function encerrar() {
  const prazo = setTimeout(() => process.exit(0), 3000);
  Promise.resolve()
    .then(() => sock?.end())
    .catch(() => {})
    .finally(() => { clearTimeout(prazo); process.exit(0); });
}

process.on('SIGTERM', encerrar);
process.on('SIGINT', encerrar);

// Se o pai morrer, o worker não tem para quem falar: não faz sentido seguir
// vivo segurando a sessão do WhatsApp.
process.on('disconnect', encerrar);

conectar().catch(e => enviaPai({ tipo: 'erro', erro: 'não conectei: ' + e.message }));
