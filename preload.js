/* preload.js — a ponte entre a página e o processo principal do Electron.

   Antes este arquivo expunha uma API inteira de leads e atividades por IPC
   (load-leads, add-lead, delete-activity…) cujos handlers nunca existiram no
   main.js: eram restos de um desenho anterior, em que o app falaria por IPC
   em vez de HTTP. Qualquer chamada àquilo rejeitava em silêncio. A página
   sempre usou a API HTTP do servidor local, então foi tudo removido.

   Sobra o que de fato precisa cruzar a fronteira: abrir um endereço fora do
   app. Isso não pode partir da página — o Electron bloqueia window.open e
   transformaria um link numa janela interna sem barra de endereço.          */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('prospec', {
  /* Entrega a URL ao sistema operacional. Devolve true se o processo
     principal aceitou, para a página saber se precisa tentar o plano B. */
  abrirFora: (url) => ipcRenderer.invoke('abrir-fora', url),

  // Permite à página saber que está dentro do app, e não num navegador.
  noApp: true,

  /* Barra de título desenhada pela página. A janela não tem moldura do
     sistema, então minimizar/maximizar/fechar precisam vir por aqui. */
  janela: {
    minimizar: () => ipcRenderer.invoke('janela:minimizar'),
    maximizar: () => ipcRenderer.invoke('janela:maximizar'),
    fechar:    () => ipcRenderer.invoke('janela:fechar'),
    consultar: () => ipcRenderer.invoke('janela:consultar'),
    /* foco e maximizada mudam por fora da página (clique na barra de tarefas,
       atalho do sistema), então o principal avisa em vez de a página perguntar. */
    aoMudar: (fn) => ipcRenderer.on('janela:estado', (_e, estado) => fn(estado))
  }
});
