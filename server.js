const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const whatsapp = require('./whatsapp-module');
const app = express();
const PORT = 3000;
/* No app empacotado o dados.json fica dentro do app.asar, que é somente
   leitura: salvar um lead falharia. O Electron passa por PROSPEC_DADOS um
   caminho gravável na pasta do usuário. Rodando pelo terminal, segue o
   arquivo do projeto. */
const dataPath = process.env.PROSPEC_DADOS || path.join(__dirname, 'dados.json');

// Middleware
app.use(cors());
app.use(express.json());
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
  const { id, url } = req.body || {};
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

// ===== ENDPOINTS WHATSAPP =====

// GET /api/whatsapp/status - Retorna status de conexão
app.get('/api/whatsapp/status', (req, res) => {
  res.json({ 
    conectado: whatsapp.isConnected(),
    timestamp: new Date().toISOString()
  });
});

// POST /api/whatsapp/enviar - Envia mensagem
app.post('/api/whatsapp/enviar', async (req, res) => {
  const { numero, mensagem } = req.body;
  
  if (!numero || !mensagem) {
    return res.status(400).json({ error: 'numero e mensagem são obrigatórios' });
  }

  try {
    const resultado = await whatsapp.enviarMensagem(numero, mensagem);
    res.json({ sucesso: true, resultado });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/whatsapp/conversa/:numero - Retorna conversa de um número
app.get('/api/whatsapp/conversa/:numero', (req, res) => {
  const conversa = whatsapp.obterConversa(req.params.numero);
  res.json(conversa);
});

// GET /api/whatsapp/conversas - Retorna todas as conversas
app.get('/api/whatsapp/conversas', (req, res) => {
  res.json(whatsapp.obterConversas());
});

// GET /api/whatsapp/diagnostico - o que a biblioteca conseguiu injetar
app.get('/api/whatsapp/diagnostico', async (req, res) => {
  try { res.json(await whatsapp.diagnosticar()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/whatsapp/qr - QR code (data URL) enquanto não há sessão.
// Diz também por que ele pode não existir, para a tela não ficar mentindo
// "gerando…" quando na verdade o WhatsApp nem foi ligado.
app.get('/api/whatsapp/qr', (req, res) => {
  res.json({
    qr: whatsapp.obterQr(),
    texto: whatsapp.obterQrTexto(),
    conectado: whatsapp.isConnected(),
    desligado: process.env.WPP === '0',
    erro: whatsapp.obterErro()
  });
});


// Inicializar WhatsApp em background. WPP=0 sobe o servidor sem o WhatsApp
// (útil para mexer no front sem esperar o Chromium).
setImmediate(() => {
  if (process.env.WPP === '0') {
    console.log('WhatsApp desligado (WPP=0).');
    return;
  }
  try {
    console.log('Inicializando WhatsApp em background...');
    whatsapp.initWhatsApp((conectado) => {
      console.log(`WhatsApp: ${conectado ? 'conectado' : 'desconectado'}`);
    });
  } catch (err) {
    console.error('Erro ao inicializar WhatsApp:', err.message);
  }
});

