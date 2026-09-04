const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

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
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: 'ProspecApp',
    backgroundColor: '#E8EAE9',
    show: false
  });

  mainWindow.webContents.backgroundColor = '#ffffff';
  
  // Carregar URL direto
  mainWindow.loadURL('http://localhost:3000');
  
  // Abrir dev tools em caso de erro
  mainWindow.webContents.on('crashed', () => {
    mainWindow.webContents.openDevTools();
  });

  // Com show:false a janela só aparece quando há o que mostrar — evita o
  // retângulo branco piscando antes da página carregar.
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Sair',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit()
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
      label: 'Desenvolvimento',
      submenu: [
        {
          label: 'Ferramentas do desenvolvedor',
          accelerator: 'F12',
          click: () => mainWindow && mainWindow.webContents.toggleDevTools()
        }
      ]
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Sobre',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'ProspecApp',
              message: 'ProspecApp v1.0.0',
              detail: 'Gerenciador de prospecção de clientes.\n\nTodos os dados em dados.json no seu disco.'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/* O servidor roda DENTRO deste processo, não como um `node` separado.

   Antes era `spawn('node', [.../server.js])`, e no app empacotado isso
   quebrava com ENOTDIR: __dirname aponta para dentro do app.asar, que é um
   arquivo compactado e não uma pasta — não há como um processo externo
   abrir um caminho lá dentro. E dependia de haver um `node` instalado na
   máquina de quem usa, o que não se pode assumir.

   O processo principal do Electron já É Node, então basta exigir o módulo.
   O trabalho pesado (WhatsApp) continua em processo separado, que é o que
   de fato precisava de isolamento. */
/* O banco vive dentro do app.asar (somente leitura). Na primeira execução
   copiamos para a pasta de dados do usuário, e é lá que o app grava daí em
   diante — assim as edições sobrevivem a uma atualização do app. */
function prepararBanco() {
  const fs = require('fs');
  const destino = path.join(app.getPath('userData'), 'dados.json');

  if (!fs.existsSync(destino)) {
    try {
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.copyFileSync(path.join(__dirname, 'dados.json'), destino);
      console.log('[Electron] Banco copiado para', destino);
    } catch (err) {
      console.error('[Electron] Não consegui preparar o banco:', err.message);
      return;
    }
  }
  process.env.PROSPEC_DADOS = destino;
}

function startServer() {
  console.log('[Electron] Subindo o servidor Express no processo principal…');
  prepararBanco();
  try {
    require('./server.js');
  } catch (err) {
    console.error('[Electron] O servidor não subiu:', err);
    const { dialog } = require('electron');
    dialog.showErrorBox('ProspecApp',
      'Não consegui iniciar o servidor interno.\n\n' + err.message);
  }
}

app.on('ready', () => {
  /* No macOS a opção `icon` da BrowserWindow não muda o ícone do Dock — só
     app.dock.setIcon faz isso. Sem esta chamada o app aparecia com o ícone
     genérico do Electron enquanto rodava a partir do código-fonte. */
  if (process.platform === 'darwin' && app.dock) {
    try { app.dock.setIcon(path.join(__dirname, 'assets', 'icon-512.png')); }
    catch (err) { console.error('[Electron] ícone do Dock:', err.message); }
  }

  startServer();
  // Rodando no mesmo processo, o listen é praticamente imediato; a espera
  // curta só garante que a porta já aceita conexões antes do loadURL.
  setTimeout(createWindow, 600);
});

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

// Nada a encerrar: o servidor vive neste mesmo processo e as conversas são
// gravadas em disco a cada mensagem registrada.
