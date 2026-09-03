const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Leads
  loadLeads: () => ipcRenderer.invoke('load-leads'),
  addLead: (lead) => ipcRenderer.invoke('add-lead', lead),
  updateLead: (lead) => ipcRenderer.invoke('update-lead', lead),
  deleteLead: (id) => ipcRenderer.invoke('delete-lead', id),

  // Atividades
  addActivity: (leadId, activity) => ipcRenderer.invoke('add-activity', leadId, activity),
  loadActivities: (leadId) => ipcRenderer.invoke('load-activities', leadId),
  deleteActivity: (activityId) => ipcRenderer.invoke('delete-activity', activityId),

  // Exportar
  exportData: () => ipcRenderer.invoke('export-data')
});
