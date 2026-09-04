const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;
let dataPath = path.join(app.getPath('userData'), 'dados.json');

// Criar janela principal
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    },
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile('index.html');

  // Abrir dev tools em desenvolvimento
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Criar menu
  createMenu();
}

// Menu da aplicação
function createMenu() {
  const template = [
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Sair',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Sobre',
          click: () => {
            require('electron').dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'ProspecApp',
              message: 'ProspecApp v1.0.0',
              detail: 'Seu gerenciador de prospecção de clientes'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Carregar dados
function loadData() {
  try {
    if (fs.existsSync(dataPath)) {
      const data = fs.readFileSync(dataPath, 'utf-8');
      return JSON.parse(data);
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

// IPC Handlers

// Carregar todos os leads
ipcMain.handle('load-leads', () => {
  const data = loadData();
  return data.leads || [];
});

// Adicionar novo lead
ipcMain.handle('add-lead', (event, lead) => {
  const data = loadData();
  const newLead = {
    id: Date.now(),
    ...lead,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString()
  };

  if (!data.leads) data.leads = [];
  data.leads.push(newLead);

  if (saveData(data)) {
    return newLead;
  }
  throw new Error('Erro ao salvar lead');
});

// Atualizar lead
ipcMain.handle('update-lead', (event, lead) => {
  const data = loadData();
  const index = data.leads.findIndex(l => l.id === lead.id);

  if (index !== -1) {
    data.leads[index] = {
      ...data.leads[index],
      ...lead,
      atualizado_em: new Date().toISOString()
    };

    if (saveData(data)) {
      return data.leads[index];
    }
  }
  throw new Error('Lead não encontrado');
});

// Deletar lead
ipcMain.handle('delete-lead', (event, id) => {
  const data = loadData();
  const index = data.leads.findIndex(l => l.id === id);

  if (index !== -1) {
    const deleted = data.leads.splice(index, 1);

    if (saveData(data)) {
      return deleted[0];
    }
  }
  throw new Error('Lead não encontrado');
});

// Adicionar atividade/anotação
ipcMain.handle('add-activity', (event, leadId, activity) => {
  const data = loadData();

  if (!data.activities) data.activities = [];

  const newActivity = {
    id: Date.now(),
    leadId,
    ...activity,
    criado_em: new Date().toISOString()
  };

  data.activities.push(newActivity);

  if (saveData(data)) {
    return newActivity;
  }
  throw new Error('Erro ao salvar atividade');
});

// Carregar atividades de um lead
ipcMain.handle('load-activities', (event, leadId) => {
  const data = loadData();
  return (data.activities || []).filter(a => a.leadId === leadId);
});

// Deletar atividade
ipcMain.handle('delete-activity', (event, activityId) => {
  const data = loadData();
  const index = data.activities.findIndex(a => a.id === activityId);

  if (index !== -1) {
    const deleted = data.activities.splice(index, 1);

    if (saveData(data)) {
      return deleted[0];
    }
  }
  throw new Error('Atividade não encontrada');
});

// Exportar dados
ipcMain.handle('export-data', () => {
  const data = loadData();
  const csv = generateCSV(data.leads);
  return csv;
});

// Gerar CSV
function generateCSV(leads) {
  if (!leads || leads.length === 0) {
    return 'Nenhum lead para exportar';
  }

  const headers = ['ID', 'Nome', 'Empresa', 'Telefone', 'Email', 'Categoria', 'Status', 'Observações', 'Criado em', 'Atualizado em'];
  const rows = leads.map(lead => [
    lead.id,
    lead.nome || '',
    lead.empresa || '',
    lead.telefone || '',
    lead.email || '',
    lead.categoria || '',
    lead.status || '',
    (lead.observacoes || '').replace(/"/g, '""'),
    lead.criado_em || '',
    lead.atualizado_em || ''
  ]);

  let csv = headers.map(h => `"${h}"`).join(',') + '\n';
  csv += rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

  return csv;
}

// Quando Electron finaliza de inicializar
app.on('ready', createWindow);

// Fechar quando todas as janelas estão fechadas
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Tratamento de erros
process.on('uncaughtException', (error) => {
  console.error('Erro não tratado:', error);
});
