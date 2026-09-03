// Estado da aplicação
let allLeads = [];
let currentLead = null;

// Inicializar aplicação
document.addEventListener('DOMContentLoaded', async () => {
  await loadLeads();
  setupEventListeners();
  updateDashboard();
});

// Configurar event listeners
function setupEventListeners() {
  // Navegação
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const view = e.currentTarget.dataset.view;
      switchView(view);
    });
  });

  // Form de novo lead
  document.getElementById('leadForm').addEventListener('submit', handleAddLead);

  // Form de edição
  document.getElementById('editForm').addEventListener('submit', handleEditLead);

  // Search e Filter
  document.getElementById('searchInput').addEventListener('input', filterLeads);
  document.getElementById('filterStatus').addEventListener('change', filterLeads);

  // Modal
  document.querySelector('.modal-close').addEventListener('click', closeModal);
  document.getElementById('closeModalBtn').addEventListener('click', closeModal);
  document.getElementById('editLeadBtn').addEventListener('click', openEditModal);
  document.getElementById('deleteLeadBtn').addEventListener('click', handleDeleteLead);
  document.getElementById('addActivityBtn').addEventListener('click', handleAddActivity);

  // Export
  document.getElementById('exportBtn').addEventListener('click', exportData);

  // Fechar modal ao clicar fora
  document.getElementById('leadModal').addEventListener('click', (e) => {
    if (e.target.id === 'leadModal') closeModal();
  });

  document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target.id === 'editModal') closeEditModal();
  });
}

// Carregar leads
async function loadLeads() {
  try {
    allLeads = await window.api.loadLeads();
    renderLeads(allLeads);
  } catch (error) {
    console.error('Erro ao carregar leads:', error);
    showNotification('Erro ao carregar leads', 'error');
  }
}

// Trocar view
function switchView(viewName) {
  // Remover active de todas as views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  // Adicionar active na view selecionada
  document.getElementById(viewName).classList.add('active');
  document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

  // Limpar form se voltar para novo lead
  if (viewName === 'new-lead') {
    document.getElementById('leadForm').reset();
  }
}

// Adicionar novo lead
async function handleAddLead(e) {
  e.preventDefault();

  const formData = {
    nome: document.getElementById('nome').value,
    empresa: document.getElementById('empresa').value,
    telefone: document.getElementById('telefone').value,
    email: document.getElementById('email').value,
    categoria: document.getElementById('categoria').value,
    status: document.getElementById('status').value,
    endereco: document.getElementById('endereco').value,
    observacoes: document.getElementById('observacoes').value
  };

  try {
    const newLead = await window.api.addLead(formData);
    allLeads.push(newLead);
    showNotification('Lead adicionado com sucesso!', 'success');
    document.getElementById('leadForm').reset();
    updateDashboard();
    switchView('leads');
  } catch (error) {
    console.error('Erro ao adicionar lead:', error);
    showNotification('Erro ao adicionar lead', 'error');
  }
}

// Renderizar leads
function renderLeads(leads) {
  const container = document.getElementById('leadsList');

  if (leads.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Nenhum lead encontrado. <a href="#" onclick="switchView(\'new-lead\')">Adicione um novo!</a></p></div>';
    return;
  }

  container.innerHTML = leads.map(lead => `
    <div class="lead-card" onclick="openLeadModal(${lead.id})">
      <div class="lead-header">
        <div>
          <div class="lead-name">${lead.nome}</div>
          <div class="lead-company">${lead.empresa || 'Sem empresa'}</div>
        </div>
        <span class="badge ${lead.status}">${formatStatus(lead.status)}</span>
      </div>

      <div class="lead-info">
        ${lead.telefone ? `
          <div class="info-row">
            <span class="icon">📱</span>
            <span class="text">${formatPhone(lead.telefone)}</span>
          </div>
        ` : ''}

        ${lead.email ? `
          <div class="info-row">
            <span class="icon">✉️</span>
            <span class="text">${lead.email}</span>
          </div>
        ` : ''}

        ${lead.categoria ? `
          <div class="info-row">
            <span class="icon">🏷️</span>
            <span class="text">${formatCategory(lead.categoria)}</span>
          </div>
        ` : ''}

        ${lead.endereco ? `
          <div class="info-row">
            <span class="icon">📍</span>
            <span class="text">${lead.endereco}</span>
          </div>
        ` : ''}
      </div>

      <div class="lead-actions">
        <button class="btn btn-small btn-primary" onclick="event.stopPropagation(); openLeadModal(${lead.id})">
          Ver Detalhes
        </button>
      </div>
    </div>
  `).join('');
}

// Abrir modal de detalhes
async function openLeadModal(leadId) {
  currentLead = allLeads.find(l => l.id === leadId);

  if (!currentLead) return;

  // Preencher informações
  document.getElementById('detailNome').textContent = currentLead.nome;
  document.getElementById('detailEmpresa').textContent = currentLead.empresa || 'N/A';
  document.getElementById('detailTelefone').textContent = formatPhone(currentLead.telefone) || 'N/A';
  document.getElementById('detailEmail').textContent = currentLead.email || 'N/A';
  document.getElementById('detailCategoria').textContent = formatCategory(currentLead.categoria) || 'N/A';
  document.getElementById('detailStatus').textContent = formatStatus(currentLead.status);
  document.getElementById('detailStatus').className = `value badge ${currentLead.status}`;
  document.getElementById('detailEndereco').textContent = currentLead.endereco || 'N/A';
  document.getElementById('detailObservacoes').textContent = currentLead.observacoes || 'Sem observações';

  // Carregar atividades
  await loadActivities(leadId);

  // Abrir modal
  document.getElementById('leadModal').classList.add('active');
}

// Fechar modal
function closeModal() {
  document.getElementById('leadModal').classList.remove('active');
  currentLead = null;
}

// Carregar atividades
async function loadActivities(leadId) {
  try {
    const activities = await window.api.loadActivities(leadId);
    const container = document.getElementById('activitiesList');

    if (activities.length === 0) {
      container.innerHTML = '<p style="color: var(--text-secondary); font-size: 13px;">Nenhuma atividade registrada</p>';
      return;
    }

    container.innerHTML = activities
      .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))
      .map(activity => `
        <div class="activity-item">
          <div>
            <div class="activity-text">${activity.nota}</div>
            <div class="activity-date">${formatDate(activity.criado_em)}</div>
          </div>
          <button class="activity-delete" onclick="deleteActivity(${activity.id})" title="Deletar">🗑️</button>
        </div>
      `).join('');
  } catch (error) {
    console.error('Erro ao carregar atividades:', error);
  }
}

// Adicionar atividade
async function handleAddActivity() {
  const input = document.getElementById('activityInput');
  const nota = input.value.trim();

  if (!nota) {
    showNotification('Escreva uma nota', 'warning');
    return;
  }

  try {
    await window.api.addActivity(currentLead.id, { nota });
    input.value = '';
    await loadActivities(currentLead.id);
    showNotification('Atividade adicionada!', 'success');
  } catch (error) {
    console.error('Erro ao adicionar atividade:', error);
    showNotification('Erro ao adicionar atividade', 'error');
  }
}

// Deletar atividade
async function deleteActivity(activityId) {
  if (!confirm('Tem certeza?')) return;

  try {
    await window.api.deleteActivity(activityId);
    await loadActivities(currentLead.id);
    showNotification('Atividade deletada!', 'success');
  } catch (error) {
    console.error('Erro ao deletar atividade:', error);
    showNotification('Erro ao deletar atividade', 'error');
  }
}

// Abrir modal de edição
function openEditModal() {
  document.getElementById('editId').value = currentLead.id;
  document.getElementById('editNome').value = currentLead.nome;
  document.getElementById('editEmpresa').value = currentLead.empresa || '';
  document.getElementById('editTelefone').value = currentLead.telefone || '';
  document.getElementById('editEmail').value = currentLead.email || '';
  document.getElementById('editCategoria').value = currentLead.categoria || '';
  document.getElementById('editStatus').value = currentLead.status || 'novo';
  document.getElementById('editEndereco').value = currentLead.endereco || '';
  document.getElementById('editObservacoes').value = currentLead.observacoes || '';

  closeModal();
  document.getElementById('editModal').classList.add('active');
}

// Fechar modal de edição
function closeEditModal() {
  document.getElementById('editModal').classList.remove('active');
}

// Editar lead
async function handleEditLead(e) {
  e.preventDefault();

  const updatedLead = {
    id: parseInt(document.getElementById('editId').value),
    nome: document.getElementById('editNome').value,
    empresa: document.getElementById('editEmpresa').value,
    telefone: document.getElementById('editTelefone').value,
    email: document.getElementById('editEmail').value,
    categoria: document.getElementById('editCategoria').value,
    status: document.getElementById('editStatus').value,
    endereco: document.getElementById('editEndereco').value,
    observacoes: document.getElementById('editObservacoes').value
  };

  try {
    await window.api.updateLead(updatedLead);
    await loadLeads();
    updateDashboard();
    closeEditModal();
    showNotification('Lead atualizado com sucesso!', 'success');
  } catch (error) {
    console.error('Erro ao atualizar lead:', error);
    showNotification('Erro ao atualizar lead', 'error');
  }
}

// Deletar lead
async function handleDeleteLead() {
  if (!confirm('Tem certeza que deseja deletar este lead?')) return;

  try {
    await window.api.deleteLead(currentLead.id);
    await loadLeads();
    updateDashboard();
    closeModal();
    showNotification('Lead deletado!', 'success');
  } catch (error) {
    console.error('Erro ao deletar lead:', error);
    showNotification('Erro ao deletar lead', 'error');
  }
}

// Filtrar leads
function filterLeads() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const statusFilter = document.getElementById('filterStatus').value;

  const filtered = allLeads.filter(lead => {
    const matchSearch = !searchTerm ||
      lead.nome.toLowerCase().includes(searchTerm) ||
      (lead.empresa && lead.empresa.toLowerCase().includes(searchTerm)) ||
      (lead.telefone && lead.telefone.includes(searchTerm)) ||
      (lead.email && lead.email.toLowerCase().includes(searchTerm));

    const matchStatus = !statusFilter || lead.status === statusFilter;

    return matchSearch && matchStatus;
  });

  renderLeads(filtered);
}

// Atualizar dashboard
function updateDashboard() {
  // Total
  document.getElementById('totalLeads').textContent = allLeads.length;

  // Por status
  const statuses = {
    novo: 0,
    contatado: 0,
    agendado: 0,
    proposta: 0,
    vendido: 0,
    descartado: 0
  };

  allLeads.forEach(lead => {
    if (statuses.hasOwnProperty(lead.status)) {
      statuses[lead.status]++;
    }
  });

  document.getElementById('statusNovo').textContent = statuses.novo;
  document.getElementById('statusContatado').textContent = statuses.contatado;
  document.getElementById('statusAgendado').textContent = statuses.agendado;
  document.getElementById('statusProposta').textContent = statuses.proposta;
  document.getElementById('statusVendido').textContent = statuses.vendido;

  // Gráfico por categoria
  updateCategoryChart();
}

// Atualizar gráfico de categorias
function updateCategoryChart() {
  const categories = {};

  allLeads.forEach(lead => {
    const cat = lead.categoria || 'outro';
    categories[cat] = (categories[cat] || 0) + 1;
  });

  const chartContainer = document.getElementById('categoryChart');
  const maxValue = Math.max(...Object.values(categories), 1);

  chartContainer.innerHTML = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([category, count]) => `
      <div class="chart-item">
        <div class="chart-bar">
          <div class="chart-fill" style="height: ${(count / maxValue) * 100}%"></div>
        </div>
        <div class="chart-label">${formatCategory(category)}</div>
        <div class="chart-value">${count}</div>
      </div>
    `).join('');
}

// Exportar dados
async function exportData() {
  try {
    const csv = await window.api.exportData();

    // Criar blob e download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `leads_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('Dados exportados com sucesso!', 'success');
  } catch (error) {
    console.error('Erro ao exportar:', error);
    showNotification('Erro ao exportar dados', 'error');
  }
}

// Formatação

function formatPhone(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
}

function formatStatus(status) {
  const statuses = {
    novo: 'Novo',
    contatado: 'Contatado',
    agendado: 'Agendado',
    proposta: 'Em Proposta',
    vendido: 'Vendido',
    descartado: 'Descartado'
  };
  return statuses[status] || status;
}

function formatCategory(category) {
  const categories = {
    padaria: '🥖 Padaria',
    restaurante: '🍽️ Restaurante',
    bar: '🍺 Bar',
    salao_beleza: '💅 Salão de Beleza',
    oficina: '🔧 Oficina Automotiva',
    farmacia: '💊 Farmácia',
    loja: '🏪 Loja',
    supermercado: '🛒 Supermercado',
    outro: '📦 Outro'
  };
  return categories[category] || category;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateOnly = date.toDateString();
  const todayOnly = today.toDateString();
  const yesterdayOnly = yesterday.toDateString();

  if (dateOnly === todayOnly) {
    return `Hoje ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  } else if (dateOnly === yesterdayOnly) {
    return `Ontem ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    return date.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' });
  }
}

// Notificações
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 20px;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#f59e0b'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 2000;
    animation: slideIn 0.3s ease;
    font-weight: 500;
  `;

  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// CSS para notificações
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
  }
`;
document.head.appendChild(style);
