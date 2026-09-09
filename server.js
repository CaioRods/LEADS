const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const wa = require('./wa-ponte');
const helo = require('./helo');

const app = express();
const PORT = 3000;
/* No app empacotado o dados.json fica dentro do app.asar, que é somente
   leitura: salvar um lead falharia. O Electron passa por PROSPEC_DADOS um
   caminho gravável na pasta do usuário. Rodando pelo terminal, segue o
   arquivo do projeto. */
const dataPath = process.env.PROSPEC_DADOS || path.join(__dirname, 'dados.json');

// Middleware
app.use(cors());
// 6 MB: o padrão do express são 100 kb, e uma imagem arrastada chega como
// data URL — base64 infla ~33%, então 4 MB de arquivo viram ~5,4 MB de corpo.
app.use(express.json({ limit: '6mb' }));
// Leaflet servido do próprio node_modules: o mapa funciona sem internet
// para a biblioteca (os tiles ainda vêm da rede, esses não dá para embutir).
app.use('/vendor', express.static(path.join(__dirname, 'node_modules', 'leaflet', 'dist')));

// Sem cache no app-web.js/styles.css: durante o desenvolvimento o navegador
// servia versões velhas e os erros apontavam para linhas que já não existiam.
// __dirname, não '.': dentro do app empacotado o diretório de execução não é
// a pasta do projeto, e os arquivos da interface voltavam 404.
app.use(express.static(__dirname, {
  etag: false,
  lastModified: false,
  setHeaders: (res, caminho) => {
    if (/\.(js|css|html)$/.test(caminho)) res.setHeader('Cache-Control', 'no-store');
  }
}));

// Carregar dados
function loadData() {
  try {
    if (fs.existsSync(dataPath)) {
      return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    }
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
  }
  return { leads: [], activities: [] };
}

// Salvar dados
function saveData(data) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Erro ao salvar dados:', error);
    return false;
  }
}

// APIs

// GET /api/leads
app.get('/api/leads', (req, res) => {
  const data = loadData();
  res.json(data.leads || []);
});

// POST /api/leads
app.post('/api/leads', (req, res) => {
  const data = loadData();
  const newLead = {
    id: Date.now(),
    ...req.body,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString()
  };

  if (!data.leads) data.leads = [];
  data.leads.push(newLead);

  if (saveData(data)) {
    res.status(201).json(newLead);
  } else {
    res.status(500).json({ error: 'Erro ao salvar lead' });
  }
});

// PUT /api/leads/:id
app.put('/api/leads/:id', (req, res) => {
  const data = loadData();
  const id = parseInt(req.params.id);
  const index = data.leads.findIndex(l => l.id === id);

  if (index !== -1) {
    data.leads[index] = {
      ...data.leads[index],
      ...req.body,
      atualizado_em: new Date().toISOString()
    };

    if (saveData(data)) {
      res.json(data.leads[index]);
    } else {
      res.status(500).json({ error: 'Erro ao atualizar lead' });
    }
  } else {
    res.status(404).json({ error: 'Lead não encontrado' });
  }
});

// DELETE /api/leads/:id
app.delete('/api/leads/:id', (req, res) => {
  const data = loadData();
  const id = parseInt(req.params.id);
  const index = data.leads.findIndex(l => l.id === id);

  if (index !== -1) {
    const deleted = data.leads.splice(index, 1);

    if (saveData(data)) {
      res.json(deleted[0]);
    } else {
      res.status(500).json({ error: 'Erro ao deletar lead' });
    }
  } else {
    res.status(404).json({ error: 'Lead não encontrado' });
  }
});

// GET /api/activities/:leadId
app.get('/api/activities/:leadId', (req, res) => {
  const data = loadData();
  const leadId = parseInt(req.params.leadId);
  const activities = (data.activities || []).filter(a => a.leadId === leadId);
  res.json(activities);
});

// POST /api/activities/:leadId
app.post('/api/activities/:leadId', (req, res) => {
  const data = loadData();
  const leadId = parseInt(req.params.leadId);

  if (!data.activities) data.activities = [];

  const newActivity = {
    id: Date.now(),
    leadId,
    ...req.body,
    criado_em: new Date().toISOString()
  };

  data.activities.push(newActivity);

  if (saveData(data)) {
    res.status(201).json(newActivity);
  } else {
    res.status(500).json({ error: 'Erro ao salvar atividade' });
  }
});

// DELETE /api/activities/:id
app.delete('/api/activities/:id', (req, res) => {
  const data = loadData();
  const id = parseInt(req.params.id);
  const index = data.activities.findIndex(a => a.id === id);

  if (index !== -1) {
    const deleted = data.activities.splice(index, 1);

    if (saveData(data)) {
      res.json(deleted[0]);
    } else {
      res.status(500).json({ error: 'Erro ao deletar atividade' });
    }
  } else {
    res.status(404).json({ error: 'Atividade não encontrada' });
  }
});

// GET /api/export
app.get('/api/export', (req, res) => {
  const data = loadData();
  const leads = data.leads || [];

  if (leads.length === 0) {
    return res.send('Nenhum lead para exportar');
  }

  const headers = ['ID', 'Nome', 'Empresa', 'Telefone', 'Email', 'Categoria', 'Status', 'Prioridade', 'Site', 'Endereço', 'Observações', 'Criado em', 'Atualizado em'];
  const rows = leads.map(lead => [
    lead.id,
    lead.nome || '',
    lead.empresa || '',
    lead.telefone || '',
    lead.email || '',
    lead.categoria || '',
    lead.status || '',
    lead.prioridade || '',
    lead.site || '',
    (lead.endereco || '').replace(/"/g, '""'),
    (lead.observacoes || '').replace(/"/g, '""'),
    lead.criado_em || '',
    lead.atualizado_em || ''
  ]);

  let csv = headers.map(h => `"${h}"`).join(',') + '\n';
  csv += rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

  res.type('text/csv');
  res.send(csv);
});

/* ---------------------------------------------------------------------------
   BUSCA DE IMAGEM — candidatos para o usuário ESCOLHER.
   Nunca preenche sozinho: para comércio pequeno de cidade pequena o buscador
   devolve imagem só semanticamente parecida ("Montanha" vira foto de montanha),
   e imagem errada num arquivo de prospecção é pior que imagem nenhuma.
   Usa curl porque só ele enxerga o proxy desta máquina.
--------------------------------------------------------------------------- */
const { execFile } = require('child_process');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function buscarImagens(termo) {
  return new Promise((resolve) => {
    const url = 'https://www.bing.com/images/search?q=' + encodeURIComponent(termo) + '&form=HDRSC2';
    execFile('curl', ['-sL', '--max-time', '25', '-A', UA, url],
      { maxBuffer: 12 * 1024 * 1024 }, (err, html) => {
        if (err || !html) return resolve([]);
        const vistos = new Set(), out = [];
        const re = /murl&quot;:&quot;(.*?)&quot;/g;
        let m;
        while ((m = re.exec(html)) && out.length < 24) {
          const u = m[1].replace(/\\u002f/g, '/').replace(/\\/g, '');
          if (!/^https?:\/\//.test(u)) continue;
          if (!/\.(jpe?g|png|webp)(\?|$)/i.test(u)) continue;
          if (vistos.has(u)) continue;
          vistos.add(u); out.push(u);
        }
        resolve(out);
      });
  });
}

// GET /api/imagens?q=...  -> lista de candidatos
app.get('/api/imagens', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'informe q' });
  res.json({ termo: q, candidatos: await buscarImagens(q) });
});

// GET /api/proxy-img?u=...  -> repassa a imagem (evita bloqueio de hotlink no <img>)
app.get('/api/proxy-img', (req, res) => {
  const u = String(req.query.u || '');
  if (!/^https:\/\//.test(u)) return res.status(400).end();
  execFile('curl', ['-sL', '--max-time', '20', '-A', UA, '--max-filesize', '4000000', u],
    { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 }, (err, buf) => {
      if (err || !buf || !buf.length) return res.status(502).end();
      const t = buf.slice(0, 4).toString('hex');
      const tipo = t.startsWith('ffd8') ? 'image/jpeg'
                 : t.startsWith('8950') ? 'image/png'
                 : t.startsWith('5249') ? 'image/webp' : 'application/octet-stream';
      res.set('Content-Type', tipo).set('Cache-Control', 'public, max-age=86400').send(buf);
    });
});

// POST /api/salvar-imagem  { id, url } -> baixa para assets/logos/<id>.<ext>
app.post('/api/salvar-imagem', (req, res) => {
  const { id, url, dados } = req.body || {};

  /* Dois caminhos: uma URL para baixar, ou uma imagem arrastada do Finder
     que chega como data URL. O segundo existe porque a busca automática não
     acha nada para boa parte do comércio pequeno. */
  if (id && typeof dados === 'string' && dados.startsWith('data:image/')) {
    const m = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i.exec(dados);
    if (!m) return res.status(415).json({ error: 'formato de imagem não suportado' });

    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 4_000_000) return res.status(413).json({ error: 'imagem muito grande' });

    const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase();
    const dir = path.join(__dirname, 'assets', 'logos');
    fs.mkdirSync(dir, { recursive: true });

    const rel = `assets/logos/${id}.${ext}`;
    fs.writeFileSync(path.join(__dirname, rel), buf);

    const base = loadData();
    const lead = (base.leads || []).find(x => String(x.id) === String(id));
    if (lead) { lead.logo = rel; lead.atualizado_em = new Date().toISOString(); saveData(base); }
    return res.json({ logo: rel, bytes: buf.length });
  }

  if (!id || !/^https:\/\//.test(url || '')) return res.status(400).json({ error: 'id e url são obrigatórios' });
  const dir = path.join(__dirname, 'assets', 'logos');
  fs.mkdirSync(dir, { recursive: true });
  execFile('curl', ['-sL', '--max-time', '25', '-A', UA, '--max-filesize', '4000000', url],
    { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 }, (err, buf) => {
      if (err || !buf || buf.length < 512) return res.status(502).json({ error: 'não consegui baixar a imagem' });
      const t = buf.slice(0, 4).toString('hex');
      const ext = t.startsWith('ffd8') ? 'jpg' : t.startsWith('8950') ? 'png'
                : t.startsWith('5249') ? 'webp' : null;
      if (!ext) return res.status(415).json({ error: 'o arquivo não é uma imagem' });
      const rel = `assets/logos/${id}.${ext}`;
      fs.writeFileSync(path.join(__dirname, rel), buf);
      const dados = loadData();
      const l = (dados.leads || []).find(x => String(x.id) === String(id));
      if (l) { l.logo = rel; l.atualizado_em = new Date().toISOString(); saveData(dados); }
      res.json({ logo: rel, bytes: buf.length });
    });
});

/* ===== CONVERSAS =====
   O histórico é do PRÓPRIO app: cada mensagem que você registra fica gravada
   no lead. Não há conexão com o WhatsApp Web.

   Motivo: a whatsapp-web.js perdeu acesso ao Store do WhatsApp Web — o
   diagnóstico mostrou zero chaves — e desde então sendMessage devolvia
   undefined sem erro e getChats estourava. Sustentar aquilo custava um
   Chromium de 350 MB, minutos de partida, QR code e uma sessão que corrompia
   a cada reinício, tudo para uma funcionalidade que não funcionava.
   O envio de verdade acontece abrindo o WhatsApp por link wa.me.            */

// POST /api/leads/:id/mensagens — registra uma mensagem na conversa do lead
app.post('/api/leads/:id/mensagens', (req, res) => {
  const { texto, tipo } = req.body || {};
  if (!texto || !String(texto).trim()) {
    return res.status(400).json({ error: 'texto é obrigatório' });
  }

  const dados = loadData();
  const lead = (dados.leads || []).find(l => String(l.id) === String(req.params.id));
  if (!lead) return res.status(404).json({ error: 'lead não encontrado' });

  const msg = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    texto: String(texto).slice(0, 4000),
    tipo: tipo === 'entrada' ? 'entrada' : 'saida',
    data: new Date().toISOString()
  };

  (lead.mensagens = lead.mensagens || []).push(msg);
  lead.atualizado_em = msg.data;

  if (!saveData(dados)) return res.status(500).json({ error: 'não consegui salvar' });
  res.json(msg);
});

// DELETE /api/leads/:id/mensagens/:msg — apaga uma mensagem registrada
app.delete('/api/leads/:id/mensagens/:msg', (req, res) => {
  const dados = loadData();
  const lead = (dados.leads || []).find(l => String(l.id) === String(req.params.id));
  if (!lead || !Array.isArray(lead.mensagens)) {
    return res.status(404).json({ error: 'não encontrado' });
  }

  const antes = lead.mensagens.length;
  lead.mensagens = lead.mensagens.filter(m => m.id !== req.params.msg);
  if (lead.mensagens.length === antes) {
    return res.status(404).json({ error: 'mensagem não encontrada' });
  }

  if (!saveData(dados)) return res.status(500).json({ error: 'não consegui salvar' });
  res.json({ ok: true });
});

/* ===== WHATSAPP DO AGENTE =====
   O worker só fala com leads marcados `agente: true`. Esses endpoints são a
   única forma de mexer nessa lista, e cada mudança ressincroniza o worker na
   hora — não existe janela em que ele ache que ainda pode falar com alguém
   que você acabou de tirar da gestão.                                      */

wa.iniciar({
  lerLeads: () => loadData().leads || [],
  gravarMensagem: (id, texto, tipo, em) => {
    const d = loadData();
    const l = (d.leads || []).find(x => x.id === id);
    if (!l) return;
    (l.mensagens = l.mensagens || []).push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      texto, tipo, data: em || new Date().toISOString()
    });
    // Quem respondeu está com a bola do nosso lado de novo.
    if (tipo === 'entrada' && l.estado === 'aguardando') l.estado = 'conversando';
    l.atualizado_em = new Date().toISOString();
    saveData(d);
  }
});

// GET /api/agente/estado — conectado? QR pendente? quantos sob gestão?
app.get('/api/agente/estado', (req, res) => {
  const e = wa.pedirEstado();
  const leads = loadData().leads || [];
  res.json({
    ...e,
    sobGestao: leads.filter(l => l.agente === true).map(l =>
      ({ id: l.id, nome: l.nome, telefone: l.telefone, estado: l.estado }))
  });
});

// POST /api/agente/gestao — coloca ou tira um lead da gestão do agente
app.post('/api/agente/gestao', (req, res) => {
  const { id, ativo } = req.body || {};
  const d = loadData();
  const l = (d.leads || []).find(x => String(x.id) === String(id));
  if (!l) return res.status(404).json({ error: 'lead não encontrado' });

  if (ativo && !l.telefone)
    return res.status(400).json({ error: 'lead sem telefone não pode ser gerido' });

  l.agente = !!ativo;
  l.atualizado_em = new Date().toISOString();
  if (!saveData(d)) return res.status(500).json({ error: 'não consegui salvar' });

  wa.sincronizarAutorizados();
  res.json({ id: l.id, nome: l.nome, agente: l.agente });
});

// POST /api/agente/enviar — envia de verdade, pelo WhatsApp
app.post('/api/agente/enviar', async (req, res) => {
  const { id, texto } = req.body || {};
  if (!texto || !String(texto).trim())
    return res.status(400).json({ error: 'texto é obrigatório' });

  const d = loadData();
  const l = (d.leads || []).find(x => String(x.id) === String(id));
  if (!l) return res.status(404).json({ error: 'lead não encontrado' });
  if (!l.agente) return res.status(403).json({
    error: 'este lead não está sob gestão do agente' });

  // Responder quem já falou conosco não conta no teto diário.
  const jaFalou = (l.mensagens || []).some(m => m.tipo === 'entrada');
  const r = await wa.enviar(l.telefone, texto, jaFalou);
  if (!r.ok) return res.status(r.adiavel ? 429 : 502).json({ error: r.erro });

  const d2 = loadData();
  const l2 = d2.leads.find(x => String(x.id) === String(id));
  (l2.mensagens = l2.mensagens || []).push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    texto, tipo: 'saida', data: new Date().toISOString()
  });
  // Mandou e está esperando: a bola passa para o lado dele.
  if (!l2.estado || l2.estado === 'conversando') l2.estado = 'aguardando';
  if (l2.chance == null) l2.chance = 5;
  l2.atualizado_em = new Date().toISOString();
  saveData(d2);

  res.json({ ok: true, enviadasHoje: r.enviadasHoje });
});

/* ===== CAMPANHA =====
   A Helô percorrendo a fila sozinha, do lead com mais chance para o com
   menos. Ela redige, o worker envia, e cada envio continua passando por todas
   as travas: só quem está sob gestão, dentro do horário, dentro do teto, com
   o espaçamento sorteado entre mensagens. A campanha não fura nada — ela só
   evita que você precise ficar sentado conduzindo.

   Estado em memória de propósito: se o app fechar no meio, a campanha morre
   junto, que é o comportamento seguro. Nada continua mandando mensagem sem
   alguém por perto.                                                        */

let campanha = {
  rodando: false, parar: false, fila: [], feitos: 0, erros: 0,
  atual: null, comecou: null, ultimoErro: null
};

const chaveClaude = () => process.env.ANTHROPIC_API_KEY || campanha.chave || null;

async function rodarCampanha() {
  campanha.rodando = true;
  campanha.parar = false;
  campanha.feitos = 0;
  campanha.erros = 0;
  campanha.comecou = new Date().toISOString();

  for (const id of campanha.fila) {
    if (campanha.parar) break;

    const dados = loadData();
    const lead = (dados.leads || []).find(l => l.id === id);

    // A gestão pode ter mudado depois que a fila foi montada.
    if (!lead || !lead.agente) continue;

    campanha.atual = lead.nome;

    try {
      const jaFalamos = (lead.mensagens || []).some(m => m.tipo === 'saida');
      const responderam = (lead.mensagens || []).some(m => m.tipo === 'entrada');

      // Quem não respondeu a primeira não recebe uma segunda. Reabordagem é o
      // que mais gera denúncia, e é a coisa que mais rápido queima o número.
      if (jaFalamos && !responderam) continue;

      let texto, diag = null;
      if (responderam) {
        const r = await helo.responder(chaveClaude(), lead);
        texto = r.mensagem;
        diag = r;
      } else {
        texto = await helo.primeiraMensagem(chaveClaude(), lead);
      }

      const envio = await wa.enviar(lead.telefone, texto, responderam);

      if (!envio.ok) {
        campanha.ultimoErro = `${lead.nome}: ${envio.erro}`;
        campanha.erros++;
        // Limite de horário ou teto: insistir não adianta, o resto da fila
        // vai bater no mesmo muro.
        if (envio.adiavel) { campanha.parar = true; break; }
        continue;
      }

      const d2 = loadData();
      const l2 = d2.leads.find(l => l.id === id);
      (l2.mensagens = l2.mensagens || []).push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        texto, tipo: 'saida', data: new Date().toISOString()
      });

      if (diag) {
        l2.estado = diag.estado || 'aguardando';
        if (Number.isFinite(+diag.chance)) l2.chance = Math.max(0, Math.min(10, +diag.chance));
        if (diag.nota) { l2.nota_agente = diag.nota; l2.nota_agente_em = new Date().toISOString(); }
        if (diag.reuniao) l2.reuniao = diag.reuniao;
        // Conversa que pediu um responsável sai da automação e espera você.
        if (diag.passar_para_caio) { l2.agente = false; l2.estado = 'conversando'; }
      } else {
        l2.estado = 'aguardando';
        if (l2.chance == null) l2.chance = 5;
      }
      l2.atualizado_em = new Date().toISOString();
      saveData(d2);

      if (diag && diag.passar_para_caio) wa.sincronizarAutorizados();
      campanha.feitos++;

    } catch (err) {
      campanha.ultimoErro = `${lead.nome}: ${err.message}`;
      campanha.erros++;
      // Chave inválida ou sem crédito derruba tudo: não adianta seguir.
      if (/401|403|credit|invalid/i.test(err.message)) { campanha.parar = true; break; }
    }
  }

  campanha.rodando = false;
  campanha.atual = null;
}

// POST /api/agente/campanha — começa a conversar, dos com mais chance aos com menos
app.post('/api/agente/campanha', async (req, res) => {
  if (campanha.rodando) return res.status(409).json({ error: 'já está rodando' });

  if (req.body && req.body.chave) campanha.chave = String(req.body.chave).trim();
  if (!chaveClaude()) return res.status(400).json({
    error: 'falta a chave da API da Anthropic — sem ela a Helô não consegue escrever' });

  const dados = loadData();
  const geridos = (dados.leads || []).filter(l => l.agente === true && l.telefone);

  if (!geridos.length) return res.status(400).json({
    error: 'nenhum lead sob gestão do agente' });

  /* A ordem é o pedido: mais chance primeiro. Para quem ainda não conversou
     não existe `chance`, então o score faz esse papel — ele é justamente a
     estimativa de quão promissor o lead é. */
  campanha.fila = geridos
    .map(l => {
      /* Chance avaliada manda; score só entra quando ela ainda não existe.
         O teste precisa ser por "foi avaliado?", não por "é maior que zero":
         chance 0 significa que alguém olhou a conversa e concluiu que não vai
         dar — esse lead tem de ir para o fim, e não herdar o score alto que
         tinha antes de a conversa começar. */
      const avaliada = l.chance !== undefined && l.chance !== null && Number.isFinite(+l.chance);
      return { id: l.id, peso: avaliada ? +l.chance * 10 : (l.score || 0) };
    })
    .sort((a, b) => b.peso - a.peso)
    .map(x => x.id);

  rodarCampanha().catch(e => {
    campanha.rodando = false;
    campanha.ultimoErro = e.message;
  });

  res.json({ ok: true, total: campanha.fila.length });
});

// POST /api/agente/campanha/parar
app.post('/api/agente/campanha/parar', (req, res) => {
  campanha.parar = true;
  res.json({ ok: true, parando: campanha.rodando });
});

// GET /api/agente/campanha
app.get('/api/agente/campanha', (req, res) => {
  res.json({
    rodando: campanha.rodando,
    total: campanha.fila.length,
    feitos: campanha.feitos,
    erros: campanha.erros,
    atual: campanha.atual,
    ultimoErro: campanha.ultimoErro,
    temChave: !!chaveClaude(),
    modelo: helo.MODELO
  });
});

// Servir index.html na raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════════╗`);
  console.log(`║    🚀 PROSPECAPP INICIADO COM SUCESSO  ║`);
  console.log(`╠════════════════════════════════════════╣`);
  console.log(`║                                        ║`);
  console.log(`║  Abra seu navegador em:                ║`);
  console.log(`║  👉 http://localhost:${PORT}           ║`);
  console.log(`║                                        ║`);
  console.log(`║  Pressione CTRL+C para parar           ║`);
  console.log(`║                                        ║`);
  console.log(`╚════════════════════════════════════════╝\n`);
});
