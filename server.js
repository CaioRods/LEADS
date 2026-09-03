const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3000;
const dataPath = path.join(__dirname, 'dados.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

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
