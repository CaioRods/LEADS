#!/usr/bin/env node
/* mcp-server.js — expõe o ProspecApp ao Claude via MCP.

   Serve para delegar a prospecção: você pede ao Claude "ache padarias em
   Regente Feijó sem site", ele pesquisa na web e grava os leads aqui pelas
   ferramentas abaixo, já pontuados pelo mesmo score.js que a interface usa.

   DE ONDE VÊM OS DADOS
   O dados.json tem potencialmente dois escritores: este servidor e o app.
   Dois processos escrevendo o arquivo inteiro se atropelam — quem salvar por
   último apaga o que o outro acabou de gravar. Para nunca haver dois, aqui
   falamos HTTP com o servidor do app sempre que ele estiver no ar, e só
   tocamos o arquivo direto quando ele não responde. A ferramenta `panorama`
   informa qual caminho está em uso.

   INSTALAR: veja MCP.md                                                    */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { z } = require('zod');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { pontuar } = require('./score.js');

const PORTA = process.env.PROSPEC_PORTA || 3000;
const BASE = `http://localhost:${PORTA}`;

/* Sem o servidor no ar, precisamos achar o arquivo certo. O app empacotado
   grava numa cópia em Application Support, não no dados.json do projeto —
   escrever no do projeto seria gravar num arquivo que o app não lê. */
function arquivoLocal() {
  if (process.env.PROSPEC_DADOS) return process.env.PROSPEC_DADOS;

  const doApp = path.join(os.homedir(), 'Library', 'Application Support',
                          'ProspecApp', 'dados.json');
  if (fs.existsSync(doApp)) return doApp;

  return path.join(__dirname, 'dados.json');
}

async function servidorNoAr() {
  try {
    const r = await fetch(`${BASE}/api/leads`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch (_) { return false; }
}

async function lerTudo() {
  if (await servidorNoAr()) {
    const leads = await (await fetch(`${BASE}/api/leads`)).json();
    return { leads, via: 'servidor do app (HTTP)' };
  }
  const arq = arquivoLocal();
  const d = JSON.parse(fs.readFileSync(arq, 'utf-8'));
  return { leads: d.leads || [], via: `arquivo ${arq}` };
}

/* Escrever pelo arquivo é o caminho de exceção: relê, altera e grava, para a
   janela entre ler e escrever ser a menor possível. */
function gravarNoArquivo(mudar) {
  const arq = arquivoLocal();
  const d = JSON.parse(fs.readFileSync(arq, 'utf-8'));
  if (!d.leads) d.leads = [];
  const r = mudar(d);
  fs.writeFileSync(arq, JSON.stringify(d, null, 2), 'utf-8');
  return r;
}

// ---------------------------------------------------------------- utilidades

const semAcento = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const chaveNome = s => semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const soDigitos = s => String(s || '').replace(/\D/g, '');
const fone11 = s => soDigitos(s).slice(-11);

const temSite = l => {
  const s = String(l.site || '').trim().toLowerCase();
  return !!s && s !== 'nenhum' && s !== 'não' && s !== 'nao' && s !== '-';
};

/* Duas empresas com o mesmo telefone são a mesma empresa. Nome igual na mesma
   cidade também, mesmo com telefone diferente (filial cadastrada duas vezes,
   ou o mesmo lugar com dois números). Devolve o lead existente ou null. */
function acharDuplicado(leads, novo) {
  const f = fone11(novo.telefone);
  if (f.length >= 10) {
    const porFone = leads.find(l => fone11(l.telefone) === f);
    if (porFone) return { lead: porFone, motivo: 'mesmo telefone' };
  }

  const n = chaveNome(novo.nome);
  if (n.length >= 4) {
    const porNome = leads.find(l =>
      chaveNome(l.nome) === n &&
      chaveNome(l.cidade) === chaveNome(novo.cidade || 'Presidente Prudente'));
    if (porNome) return { lead: porNome, motivo: 'mesmo nome na mesma cidade' };
  }
  return null;
}

const texto = t => ({ content: [{ type: 'text', text: t }] });
const erro  = t => ({ content: [{ type: 'text', text: t }], isError: true });

const resumo = l =>
  `#${l.id} · ${l.nome} · score ${l.score ?? '?'} · ${l.status || 'novo'}` +
  (l.estado ? ` · ${l.estado}` : '') +
  ` · ${l.telefone || 'sem telefone'} · ${l.bairro || '?'}, ${l.cidade || '?'}` +
  ` · site: ${temSite(l) ? l.site : 'nenhum'}`;

// ------------------------------------------------------------------ servidor

const server = new McpServer(
  { name: 'prospecapp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

const CATEGORIAS = ['restaurante', 'loja', 'salao_beleza', 'bar', 'oficina',
                    'padaria', 'supermercado', 'farmacia', 'outro'];

server.registerTool('panorama', {
  title: 'Panorama da base',
  description: 'Estado geral da base de leads: quantos existem, quantos por ' +
    'faixa de score, quantos sem site, quais bairros e categorias já cobertos. ' +
    'Chame ANTES de prospectar, para saber onde há lacuna e não repetir trabalho.',
  inputSchema: {}
}, async () => {
  const { leads, via } = await lerTudo();
  const ativos = leads.filter(l => l.status !== 'descartado');

  const conta = (f) => ativos.filter(f).length;
  const grupos = (campo) => {
    const m = {};
    ativos.forEach(l => { const k = l[campo] || '—'; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };

  return texto([
    `Fonte dos dados: ${via}`,
    ``,
    `${leads.length} leads (${ativos.length} ativos, ${leads.length - ativos.length} descartados)`,
    `Quentes (score ≥70): ${conta(l => l.score >= 70)}   ` +
    `Mornos (50-69): ${conta(l => l.score >= 50 && l.score < 70)}   ` +
    `Frios (<50): ${conta(l => l.score < 50)}`,
    `Sem site: ${conta(l => !temSite(l))}   Com telefone: ${conta(l => fone11(l.telefone).length >= 10)}`,
    `Em conversa: ${conta(l => l.estado)}   Nunca abordados: ${conta(l => !l.estado && l.status === 'novo')}`,
    ``,
    `Cidades: ${grupos('cidade').map(([k, n]) => `${k} (${n})`).join(', ')}`,
    ``,
    `Categorias: ${grupos('categoria').map(([k, n]) => `${k} (${n})`).join(', ')}`,
    ``,
    `Bairros: ${grupos('bairro').slice(0, 25).map(([k, n]) => `${k} (${n})`).join(', ')}`
  ].join('\n'));
});

server.registerTool('listar_leads', {
  title: 'Listar leads',
  description: 'Lista leads com filtros. Use para ver o que já existe antes ' +
    'de prospectar, ou para escolher quem abordar hoje.',
  inputSchema: {
    busca:     z.string().optional().describe('texto em nome, telefone, rua ou bairro'),
    cidade:    z.string().optional(),
    bairro:    z.string().optional(),
    categoria: z.enum(CATEGORIAS).optional(),
    sem_site:  z.boolean().optional().describe('só os que não têm site — os melhores alvos'),
    score_min: z.number().optional(),
    status:    z.enum(['novo','contatado','agendado','proposta','vendido','descartado']).optional(),
    estado:    z.enum(['conversando','aguardando','nao_deu_certo','fechado']).optional(),
    limite:    z.number().optional().describe('padrão 30')
  }
}, async (a) => {
  const { leads } = await lerTudo();
  const t = (a.busca || '').toLowerCase();

  let r = leads.filter(l => {
    if (t && ![l.nome, l.empresa, l.telefone, l.endereco, l.bairro]
          .some(c => String(c || '').toLowerCase().includes(t))) return false;
    if (a.cidade    && chaveNome(l.cidade)  !== chaveNome(a.cidade))  return false;
    if (a.bairro    && chaveNome(l.bairro)  !== chaveNome(a.bairro))  return false;
    if (a.categoria && l.categoria !== a.categoria) return false;
    if (a.sem_site  && temSite(l)) return false;
    if (a.score_min != null && (l.score ?? 0) < a.score_min) return false;
    if (a.status    && l.status !== a.status) return false;
    if (a.estado    && l.estado !== a.estado) return false;
    return true;
  }).sort((x, y) => (y.score ?? 0) - (x.score ?? 0));

  const total = r.length;
  r = r.slice(0, a.limite || 30);

  if (!total) return texto('Nenhum lead com esses filtros.');
  return texto(`${total} lead(s), mostrando ${r.length}:\n\n` +
               r.map(resumo).join('\n'));
});

server.registerTool('verificar_duplicado', {
  title: 'Verificar se já existe',
  description: 'Diz se um lead já está na base, por telefone ou por nome+cidade. ' +
    'Chame antes de criar quando estiver prospectando em lote — criar_lead já ' +
    'recusa duplicatas, mas verificar antes evita trabalho perdido.',
  inputSchema: {
    nome:     z.string(),
    telefone: z.string().optional(),
    cidade:   z.string().optional()
  }
}, async (a) => {
  const { leads } = await lerTudo();
  const d = acharDuplicado(leads, a);
  return texto(d
    ? `JÁ EXISTE (${d.motivo}):\n${resumo(d.lead)}`
    : `Não está na base. Pode criar.`);
});

server.registerTool('criar_lead', {
  title: 'Criar lead',
  description:
    'Adiciona um lead novo e devolve o score calculado. Recusa duplicatas ' +
    '(mesmo telefone, ou mesmo nome na mesma cidade).\n\n' +
    'O QUE MAIS PESA NO SCORE, em ordem: não ter site (+30) é o maior sinal, ' +
    'porque é exatamente o que se vende; telefone confirmado (+25); porte da ' +
    'empresa; e proximidade de Regente Feijó/Centro. Então pesquise ANTES se a ' +
    'empresa tem site e telefone — um lead sem esses campos entra com score ' +
    'baixo e some no fim da fila, mesmo sendo um bom alvo.\n\n' +
    'Preencha `fonte` com onde você achou (ex.: "Google Maps", "Instagram"), ' +
    'para depois dar para auditar de onde veio a base.',
  inputSchema: {
    nome:      z.string().describe('nome da empresa como ela se apresenta'),
    telefone:  z.string().optional().describe('com DDD, ex.: (18) 3311-5003'),
    categoria: z.enum(CATEGORIAS).describe('ramo; use "outro" se nenhum servir'),
    endereco:  z.string().optional().describe('rua e número'),
    bairro:    z.string().optional(),
    cidade:    z.string().optional().describe('padrão: Presidente Prudente'),
    site:      z.string().optional().describe('a URL, ou "nenhum" se não tem — ' +
                 'este campo vale +30 no score, então verifique de verdade'),
    instagram: z.string().optional(),
    facebook:  z.string().optional(),
    email:     z.string().optional(),
    porte:     z.enum(['pequeno','medio','grande']).optional(),
    fonte:     z.string().optional().describe('onde você encontrou esta empresa'),
    notas:     z.string().optional().describe('qualquer coisa útil na abordagem')
  }
}, async (a) => {
  const { leads } = await lerTudo();

  const dup = acharDuplicado(leads, a);
  if (dup) return erro(`Não criei — já existe (${dup.motivo}):\n${resumo(dup.lead)}`);

  const lead = {
    nome: a.nome,
    empresa: a.nome,
    telefone: a.telefone || '',
    email: a.email || '',
    categoria: a.categoria,
    status: 'novo',
    prioridade: 'media',
    endereco: a.endereco || '',
    bairro: a.bairro || '',
    cidade: a.cidade || 'Presidente Prudente',
    site: a.site || 'nenhum',
    instagram: a.instagram || '',
    facebook: a.facebook || '',
    logo: '',
    porte: a.porte || 'pequeno',
    fonte: a.fonte || 'prospecção via Claude',
    notas: a.notas || ''
  };

  const { score, motivos } = pontuar(lead);
  lead.score = score;
  lead.motivos = motivos;

  let criado;
  if (await servidorNoAr()) {
    const r = await fetch(`${BASE}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead)
    });
    if (!r.ok) return erro(`O servidor recusou: ${r.status}`);
    criado = await r.json();
  } else {
    criado = gravarNoArquivo(d => {
      const novo = { id: Date.now(), ...lead,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString() };
      d.leads.push(novo);
      return novo;
    });
  }

  return texto(`Criado.\n${resumo(criado)}\n\nComo o score foi formado:\n` +
               motivos.map(m => `  · ${m}`).join('\n'));
});

server.registerTool('atualizar_lead', {
  title: 'Atualizar lead',
  description: 'Muda campos de um lead existente. Serve para corrigir dados ' +
    'que você descobriu depois, mover no funil (status), mover no quadro de ' +
    'conversas (estado) ou registrar a chance de fechar (0 a 10).',
  inputSchema: {
    id:     z.number().describe('id do lead, como aparece em listar_leads'),
    nome:      z.string().optional(),
    telefone:  z.string().optional(),
    site:      z.string().optional(),
    instagram: z.string().optional(),
    endereco:  z.string().optional(),
    bairro:    z.string().optional(),
    porte:     z.enum(['pequeno','medio','grande']).optional(),
    status: z.enum(['novo','contatado','agendado','proposta','vendido','descartado']).optional(),
    estado: z.enum(['conversando','aguardando','nao_deu_certo','fechado']).optional()
              .describe('quadro de conversas; leads com estado somem da fila de Leads'),
    chance: z.number().min(0).max(10).optional().describe('chance de fechar, 0 a 10'),
    notas:  z.string().optional()
  }
}, async (a) => {
  const { id, ...campos } = a;
  const mudancas = Object.fromEntries(
    Object.entries(campos).filter(([, v]) => v !== undefined));

  if (!Object.keys(mudancas).length) return erro('Nada para mudar.');

  const { leads } = await lerTudo();
  const atual = leads.find(l => l.id === id);
  if (!atual) return erro(`Não achei lead #${id}.`);

  /* Campos que alimentam o score precisam repontuar, senão o lead fica com um
     número que não corresponde mais aos próprios dados. */
  const mexeNoScore = ['telefone','site','instagram','facebook','bairro','cidade','porte','categoria'];
  const juntos = { ...atual, ...mudancas };
  if (mexeNoScore.some(c => c in mudancas)) {
    const { score, motivos } = pontuar(juntos);
    mudancas.score = score;
    mudancas.motivos = motivos;
  }

  if (await servidorNoAr()) {
    const r = await fetch(`${BASE}/api/leads/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mudancas)
    });
    if (!r.ok) return erro(`O servidor recusou: ${r.status}`);
    return texto(`Atualizado.\n${resumo(await r.json())}`);
  }

  const salvo = gravarNoArquivo(d => {
    const i = d.leads.findIndex(l => l.id === id);
    d.leads[i] = { ...d.leads[i], ...mudancas, atualizado_em: new Date().toISOString() };
    return d.leads[i];
  });
  return texto(`Atualizado.\n${resumo(salvo)}`);
});

server.registerTool('registrar_conversa', {
  title: 'Registrar mensagem',
  description: 'Grava uma mensagem no histórico do lead. `saida` é o que você ' +
    'mandou, `entrada` o que ele respondeu. Não envia nada pelo WhatsApp — ' +
    'só registra, para o histórico ficar completo no app.',
  inputSchema: {
    id:    z.number(),
    texto: z.string(),
    tipo:  z.enum(['saida','entrada']).optional().describe('padrão: saida')
  }
}, async (a) => {
  if (!await servidorNoAr())
    return erro('Isto precisa do ProspecApp aberto (o servidor local não respondeu).');

  const r = await fetch(`${BASE}/api/leads/${a.id}/mensagens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto: a.texto, tipo: a.tipo || 'saida' })
  });
  if (!r.ok) return erro(`O servidor recusou: ${r.status}`);
  return texto('Mensagem registrada.');
});

// ------------------------------------------------- conversa real, pelo WhatsApp

/* Estas quatro ferramentas mexem no mundo: mandam mensagem de verdade para
   empresas de verdade. O isolamento vive no worker (wa-worker.js), não aqui:
   mesmo que o agente peça para escrever a um número qualquer, só sai se o
   lead estiver sob gestão. A checagem é dupla de propósito.                */

server.registerTool('agente_estado', {
  title: 'Estado do WhatsApp do agente',
  description: 'Diz se o WhatsApp do agente está conectado, quantas abordagens ' +
    'já saíram hoje, quanto ainda cabe no teto, e QUAIS leads estão sob gestão. ' +
    'Chame antes de tentar conversar — sem conexão nada sai, e o teto diário ' +
    'existe para o número não ser banido.',
  inputSchema: {}
}, async () => {
  if (!await servidorNoAr())
    return erro('O ProspecApp precisa estar aberto — é ele que mantém a conexão.');

  const e = await (await fetch(`${BASE}/api/agente/estado`)).json();

  if (!e.conectado) {
    return texto([
      'WhatsApp do agente: DESCONECTADO.',
      e.qr ? 'Há um QR code esperando — abra a aba do agente no ProspecApp e escaneie.'
           : (e.erro || 'Aguardando conexão.'),
      '',
      `Leads sob gestão: ${e.sobGestao.length}`
    ].join('\n'));
  }

  const lim = e.limites || {};
  return texto([
    `WhatsApp do agente: CONECTADO${e.numero ? ' como ' + e.numero : ''}.`,
    `Abordagens hoje: ${e.enviadasHoje}/${lim.abordagensPorDia ?? '?'}` +
      ` · horário permitido ${lim.horaInicio ?? '?'}h-${lim.horaFim ?? '?'}h` +
      (lim.diasUteis ? ', só dias úteis' : ''),
    '',
    `Leads sob gestão (${e.sobGestao.length}) — o agente só fala com estes:`,
    ...e.sobGestao.map(l => `  #${l.id} · ${l.nome} · ${l.telefone}` +
                            (l.estado ? ` · ${l.estado}` : ''))
  ].join('\n'));
});

server.registerTool('agente_gestao', {
  title: 'Colocar ou tirar lead da gestão do agente',
  description:
    'Define quais leads o agente pode conversar. Esta é a trava de segurança: ' +
    'o agente NÃO vê nem responde nenhuma conversa fora desta lista — nem ' +
    'família, nem amigos, nem clientes atuais, nem grupos. Uma conversa só ' +
    'entra no radar dele depois de você colocar o lead aqui.\n\n' +
    'Peça confirmação ao usuário antes de ativar em lote: cada lead ativado é ' +
    'uma empresa real que vai receber mensagem.',
  inputSchema: {
    id:    z.number().describe('id do lead'),
    ativo: z.boolean().describe('true coloca sob gestão, false retira')
  }
}, async (a) => {
  if (!await servidorNoAr()) return erro('O ProspecApp precisa estar aberto.');

  const r = await fetch(`${BASE}/api/agente/gestao`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: a.id, ativo: a.ativo })
  });
  if (!r.ok) return erro((await r.json()).error || `erro ${r.status}`);

  const j = await r.json();
  return texto(j.agente
    ? `${j.nome} agora está sob gestão do agente — pode receber mensagem.`
    : `${j.nome} saiu da gestão. O agente não vai mais falar nem ouvir este número.`);
});

server.registerTool('agente_enviar', {
  title: 'Enviar mensagem pelo WhatsApp',
  description:
    'Envia DE VERDADE, pelo WhatsApp, para um lead sob gestão. Não é rascunho.\n\n' +
    'Escreva como uma pessoa escreveria: curto (três linhas bastam), citando ' +
    'algo concreto do negócio dele — a rua, o ramo, o fato de não ter site — e ' +
    'terminando com UMA pergunta fechada, do tipo que se responde com sim ou ' +
    'não. Mensagem longa e genérica é o que faz denunciar.\n\n' +
    'Pode ser recusado por teto diário, horário ou fim de semana: isso protege ' +
    'o número, então não tente contornar. Se recusar, aguarde e avise o usuário.',
  inputSchema: {
    id:    z.number().describe('id do lead, que precisa estar sob gestão'),
    texto: z.string().describe('a mensagem, como você a mandaria de fato')
  }
}, async (a) => {
  if (!await servidorNoAr()) return erro('O ProspecApp precisa estar aberto.');

  const r = await fetch(`${BASE}/api/agente/enviar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: a.id, texto: a.texto })
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 429) return erro(`Não enviei: ${j.error}. Isto é um limite ` +
      'de proteção do número, não um erro — espere a janela abrir.');
    return erro(`Não enviei: ${j.error || r.status}`);
  }

  return texto(`Enviada. O lead passou para "aguardando".` +
    (j.enviadasHoje != null ? ` Abordagens hoje: ${j.enviadasHoje}.` : ''));
});

server.registerTool('agente_conversas', {
  title: 'Ver conversas do agente',
  description:
    'Mostra o histórico das conversas dos leads sob gestão, com quem respondeu ' +
    'e quem ainda não. Use para decidir o próximo passo: responder quem falou, ' +
    'e deixar em paz quem não falou.\n\n' +
    'Não insista com quem não respondeu. Reabordagem é o que mais gera denúncia ' +
    'e banimento — se não respondeu, o certo é marcar como nao_deu_certo depois ' +
    'de um tempo, não mandar de novo.',
  inputSchema: {
    apenas_com_resposta: z.boolean().optional()
      .describe('true mostra só quem respondeu — normalmente é o que interessa')
  }
}, async (a) => {
  const { leads } = await lerTudo();
  const geridos = leads.filter(l => l.agente === true);

  if (!geridos.length)
    return texto('Nenhum lead sob gestão do agente ainda. Use agente_gestao para incluir.');

  const linhas = geridos.map(l => {
    const msgs = l.mensagens || [];
    const respondeu = msgs.some(m => m.tipo === 'entrada');
    if (a.apenas_com_resposta && !respondeu) return null;

    const hist = msgs.slice(-6).map(m =>
      `      ${m.tipo === 'entrada' ? '← ELE' : '→ VOCÊ'}: ${m.texto.slice(0, 160)}`);

    return [
      `#${l.id} · ${l.nome} · ${l.estado || 'sem estado'}` +
        (respondeu ? ' · RESPONDEU' : ' · sem resposta ainda'),
      ...(hist.length ? hist : ['      (nada trocado)'])
    ].join('\n');
  }).filter(Boolean);

  if (!linhas.length) return texto('Ninguém respondeu ainda.');
  return texto(linhas.join('\n\n'));
});

async function principal() {
  await server.connect(new StdioServerTransport());
  // stderr, nunca stdout: o stdout é o canal do protocolo MCP.
  console.error('ProspecApp MCP no ar.');
}

principal().catch(e => { console.error('Falhei ao subir:', e); process.exit(1); });
