/* ===========================================================================
   ProspecApp — front-end (Soft UI). Tudo vem de /api/*. Sem framework, sem CDN.
=========================================================================== */


const API = {
  async req(metodo, rota, corpo){
    const opc = { method: metodo, headers: {} };
    if (corpo !== undefined){
      opc.headers["Content-Type"] = "application/json";
      opc.body = JSON.stringify(corpo);
    }
    const r = await fetch(rota, opc);
    if (!r.ok){
      let msg = `${r.status} ${r.statusText}`;
      try { const j = await r.json(); if (j && j.error) msg = j.error; } catch(_){}
      throw new Error(msg);
    }
    const ct = r.headers.get("content-type") || "";
    return ct.includes("application/json") ? r.json() : r.text();
  },
  listarLeads(){            return API.req("GET",    "/api/leads"); },
  criarLead(d){             return API.req("POST",   "/api/leads", d); },
  atualizarLead(id, d){     return API.req("PUT",    `/api/leads/${id}`, d); },
  excluirLead(id){          return API.req("DELETE", `/api/leads/${id}`); },
  listarAtividades(id){     return API.req("GET",    `/api/activities/${id}`); },
  criarAtividade(id, d){    return API.req("POST",   `/api/activities/${id}`, d); },
  excluirAtividade(id){     return API.req("DELETE", `/api/activities/${id}`); },
  exportar(){               return API.req("GET",    "/api/export"); },
  buscarImagens(q){         return API.req("GET",    "/api/imagens?q=" + encodeURIComponent(q)); },
  salvarImagem(id, url){    return API.req("POST",   "/api/salvar-imagem", { id, url }); }
};


const CATEGORIAS = {
  padaria:"Padaria", restaurante:"Restaurante", bar:"Bar",
  salao_beleza:"Salão de beleza", oficina:"Oficina", farmacia:"Farmácia",
  loja:"Loja", supermercado:"Supermercado", outro:"Outro"
};
const FUNIL  = ["novo","contatado","agendado","proposta","vendido"];
const ETAPAS = FUNIL.concat(["descartado"]);
const STATUS_NOME = { novo:"Novo", contatado:"Contatado", agendado:"Agendado",
                      proposta:"Proposta", vendido:"Vendido", descartado:"Descartado" };
const PRIO_NOME = { alta:"Alta", media:"Média", baixa:"Baixa" };

const BAIRROS_CONHECIDOS = ["Centro","Vila Nova","Jardim Matilde","Sumaré","Vila Sumaré",
  "Jardim Regina","Jardim Tênis Clube","Barra Funda","Alto da Boa Vista",
  "Distrito do Espigão","Água Grande (zona rural)"];


const sv = (d, t) => `<svg width="${t||17}" height="${t||17}" viewBox="0 0 24 24" fill="none" `
  + `stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const IC = {
  tel:      t => sv('<path d="M7.9 3.4 4.9 3.9c-.9.2-1.5 1-1.4 1.9.7 5.2 4.8 10 10 11.9.9.3 1.9-.1 2.3-.9l1.3-2.7"/><path d="m15.4 14.2-2.8-1.3c-.6-.3-1.3-.1-1.7.5l-.6.8"/><path d="M6.9 7.6 7.8 7c.6-.3.8-1 .6-1.6l-.5-1.3"/>', t),
  telNao:   t => sv('<path d="M7.9 3.4 4.9 3.9c-.9.2-1.5 1-1.4 1.9.7 5.2 4.8 10 10 11.9.9.3 1.9-.1 2.3-.9l1.3-2.7"/><path d="M4.2 19.8 19.8 4.2"/>', t),
  insta:    t => sv('<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M16.9 7.1h.01"/>', t),
  face:     t => sv('<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="5"/><path d="M15.2 8.2h-1.5c-1 0-1.8.8-1.8 1.8v10.4"/><path d="M9.6 12.6h4.6"/>', t),
  estrela:  t => sv('<path d="M12 3.6l2.5 5.1 5.6.8-4 3.9.9 5.6L12 16.4l-5 2.6.9-5.6-4-3.9 5.6-.8z"/>', t),
  fechar:   t => sv('<path d="M6.2 6.2 17.8 17.8"/><path d="M17.8 6.2 6.2 17.8"/>', t),
  lixo:     t => sv('<path d="M4.4 6.5h15.2"/><path d="M9.5 6.5V4.7c0-.6.5-1.1 1.1-1.1h2.8c.6 0 1.1.5 1.1 1.1v1.8"/><path d="M6.3 6.5l.8 12.4c.05.7.6 1.2 1.3 1.2h7.2c.7 0 1.25-.5 1.3-1.2l.8-12.4"/>', t),
  local:    t => sv('<path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 1 0-13 0c0 5.4 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.4"/>', t),
  aviso:    t => sv('<circle cx="12" cy="12" r="8.4"/><path d="M12 7.8v4.9"/><path d="M12 16h.01"/>', t),
  grade:    t => sv('<rect x="3.2" y="3.2" width="7.6" height="7.6" rx="2.2"/><rect x="13.2" y="3.2" width="7.6" height="7.6" rx="2.2"/><rect x="3.2" y="13.2" width="7.6" height="7.6" rx="2.2"/><rect x="13.2" y="13.2" width="7.6" height="7.6" rx="2.2"/>', t),
  linhas:   t => sv('<path d="M4 6.6h16"/><path d="M4 12h16"/><path d="M4 17.4h10"/>', t),
  wpp:      t => sv('<path d="M20.4 11.7a8.4 8.4 0 0 1-12.3 7.5L3.6 20.4l1.3-4.4a8.4 8.4 0 1 1 15.5-4.3z"/><path d="M9.1 8.4c.2-.5.5-.5.8-.5h.6c.2 0 .5 0 .7.6l.8 1.9c.1.3 0 .5-.1.7l-.5.6c-.2.2-.3.4-.1.7a7 7 0 0 0 3.1 2.7c.3.1.5.1.7-.1l.6-.7c.2-.2.4-.2.7-.1l1.8.9c.3.1.5.3.5.5v.6c0 .4-.3.8-.7 1.1-.5.3-1.1.5-1.7.4-1.6-.2-3.6-1.2-5.2-2.8s-2.6-3.6-2.8-5.2c-.1-.6.1-1.2.4-1.7z"/>', t),
  link:     t => sv('<path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7l-1.5 1.5"/><path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7l1.5-1.5"/>', t)
};

/* glifo de categoria — fundo do monograma */
const GLIFO = {
  padaria:      '<path d="M4 14.5c0-3.6 3.6-6.5 8-6.5s8 2.9 8 6.5c0 1.4-1 2.5-2.3 2.5H6.3C5 17 4 15.9 4 14.5z"/><path d="M8.6 8.6 7.4 5.9"/><path d="M12 8v-3"/><path d="M15.4 8.6l1.2-2.7"/>',
  restaurante:  '<path d="M7 3.5v7.2c0 1 .8 1.8 1.8 1.8S10.6 11.7 10.6 10.7V3.5"/><path d="M8.8 12.5V20.5"/><path d="M16.6 3.5c-1.4 0-2.5 2-2.5 4.5s1.1 3.5 2.5 3.5"/><path d="M16.6 11.5V20.5"/>',
  bar:          '<path d="M4.6 4.5h14.8L12 12.6z"/><path d="M12 12.6V19.5"/><path d="M8.4 19.5h7.2"/>',
  salao_beleza: '<circle cx="7" cy="17.5" r="2.6"/><circle cx="17" cy="17.5" r="2.6"/><path d="M8.8 15.6 18 4.2"/><path d="M15.2 15.6 6 4.2"/>',
  oficina:      '<path d="M15.6 4.6a4.6 4.6 0 0 0-5.9 5.9L4 16.2 7.8 20l5.7-5.7a4.6 4.6 0 0 0 5.9-5.9l-2.7 2.7-2.7-.7-.7-2.7z"/>',
  farmacia:     '<path d="M12 5.2v13.6"/><path d="M5.2 12h13.6"/><circle cx="12" cy="12" r="8.4"/>',
  loja:         '<path d="M3.8 9.2 5.4 4.6h13.2l1.6 4.6"/><path d="M3.8 9.2c0 1.5 1.2 2.7 2.7 2.7S9.2 10.7 9.2 9.2c0 1.5 1.2 2.7 2.8 2.7s2.8-1.2 2.8-2.7c0 1.5 1.2 2.7 2.7 2.7s2.7-1.2 2.7-2.7"/><path d="M5.4 12v7.4h13.2V12"/>',
  supermercado: '<path d="M3.4 4.2h2.4l2.2 10.4h9.4l2-7.4H6.6"/><circle cx="9.4" cy="18.6" r="1.4"/><circle cx="16.4" cy="18.6" r="1.4"/>',
  outro:        '<rect x="3.8" y="6.6" width="16.4" height="13" rx="2.4"/><path d="M8.6 6.6V5a1.4 1.4 0 0 1 1.4-1.4h4a1.4 1.4 0 0 1 1.4 1.4v1.6"/>'
};


const $  = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g,
  c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

const temTel  = l => !!(l.telefone && String(l.telefone).trim());
const semSite = l => !l.site || l.site === "nenhum";
const temInsta= l => !!(l.instagram && String(l.instagram).trim());
const temFace = l => !!(l.facebook && String(l.facebook).trim());
const instaSemSite = l => temInsta(l) && semSite(l) && l.status !== "descartado";
const capital = l => /São Paulo/.test(l.cidade || "");
const telDuvida = l => temTel(l) && /truncado|incompleto|aproximado|confirmar/i.test(l.observacoes || "");
const obsAtencao = l => /ATEN[ÇC][ÃA]O|CORRE[ÇC][ÃA]O|FORA DE [ÁA]REA|DESCARTADO/i.test(l.observacoes || "");

const scoreDe = l => Number.isFinite(+l.score) ? +l.score : 0;
const faixaDe = l => { const s = scoreDe(l); return s >= 70 ? "quente" : s >= 50 ? "morno" : "frio"; };
const FAIXA_NOME = { quente:"Quente", morno:"Morno", frio:"Frio" };

const urlInsta = l => "https://instagram.com/" + String(l.instagram).replace(/^@/,"").trim();
const urlFace  = l => { const f = String(l.facebook).trim(); return /^https?:\/\//.test(f) ? f : "https://" + f; };

const RE_VIA = /^(rua|r\.|av\.|avenida|alameda|al\.|estrada|estr\.|rodovia|rod\.|travessa|tv\.|praça|praca|largo)\s+\S/i;
function via(l){
  const p = String(l.endereco || "").split("—")[0].split(",")[0].trim().replace(/\/SP$/,"").trim();
  if (!p || !RE_VIA.test(p)) return "";
  return p + (capital(l) ? " · São Paulo" : "");
}
function viaNome(l){
  const p = String(l.endereco || "").split("—")[0].split(",")[0].trim().replace(/\/SP$/,"").trim();
  return RE_VIA.test(p) ? p : "";
}
function numeroPorta(l){
  const m = String(l.endereco || "").split("—")[0].match(/,\s*(\d+)/);
  return m ? +m[1] : null;
}
function enderecoCurto(l){
  const t = String(l.endereco || "").split("—").map(s => s.trim())
    .filter(s => s && !/^\d{5}-\d{3}$/.test(s)
              && !/^Regente Feijó\/SP$/.test(s) && !/^São Paulo\/SP$/.test(s))
    .join(" · ");
  return t || (l.bairro || "endereço não informado");
}
function dataBR(iso){
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})
       + " · " + d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
}
function iniciais(nome){
  const ig = new Set(["de","da","do","das","dos","e","a","o","com","the"]);
  const p = String(nome||"?").split(/[\s—·]+/).map(s=>s.replace(/[^\p{L}\p{N}]/gu,"")).filter(s=>s && !ig.has(s.toLowerCase()));
  if (!p.length) return "?";
  return (p.length === 1 ? p[0].slice(0,2) : p[0][0] + p[1][0]).toUpperCase();
}
/* variação determinística para a grade não parecer 42 clones */
function semente(nome){ let h = 0; for (const c of String(nome)) h = (h*31 + c.codePointAt(0)) >>> 0; return h; }

function avatarHTML(l, grande){
  const cls = grande ? "avatar-g" : "avatar";
  const t   = grande ? 34 : 28;
  const g   = GLIFO[l.categoria] || GLIFO.outro;
  const rot = (semente(l.nome) % 24) - 12;   /* leve giro no glifo de fundo */
  const img = l.logo ? `<img src="${esc(l.logo)}" alt="" onerror="this.remove()">` : "";
  return `<span class="${cls}">
    <span class="glifo" style="transform:rotate(${rot}deg)">${sv(g, t)}</span>
    <span class="iniciais">${esc(iniciais(l.nome))}</span>${img}</span>`;
}


/* Sem geocodificação: a escada é via → bairro → Centro → cidade → rural → fora. */
const PROX_NOME = { 1:"Mesma rua", 2:"Mesmo bairro", 3:"Centro", 4:"Outro bairro", 5:"Zona rural", 6:"Fora da cidade" };
function nivelProx(l){
  if (capital(l)) return 6;
  const b = (l.bairro || "").trim();
  if (/rural|Espigão/i.test(b)) return 5;
  const meuB = S.local.bairro, meuV = (S.local.via||"").trim().toLowerCase();
  if (meuV && viaNome(l).toLowerCase() === meuV) return 1;
  if (meuB && b && b === meuB) return 2;
  if (b === "Centro") return 3;
  return b ? 4 : 4;
}
function proxHTML(l){
  const n = nivelProx(l);
  const on = n <= 2 ? 3 : n <= 3 ? 2 : n <= 4 ? 1 : 0;
  const b = [1,2,3].map(i => `<i class="${i <= on ? "on" : ""}"></i>`).join("");
  return `<span class="prox n${n}" title="Proximidade por bairro e via, não por distância medida">
    <span class="barras">${b}</span>${PROX_NOME[n]}</span>`;
}


/* score 0 → vermelho (8°) · 50 → âmbar (45°) · 100 → verde (145°).
   A luminosidade nunca muda: o relevo neumórfico depende dela. */
function hueChance(l){
  const s = Math.max(0, Math.min(100, scoreDe(l)));
  return s < 50 ? 8 + (s/50)*37 : 45 + ((s-50)/50)*100;
}


/* Sintetizado na hora com Web Audio — nenhum arquivo, funciona offline.
   Timbre curto e macio, na mesma família do relevo: nada de bipe de alarme. */
const SOM = {
  ligado: localStorage.getItem("prospec.som") !== "0",
  ctx: null,
  abrir(){
    if (!this.ctx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  },
  /* nota macia: seno + passa-baixa, ataque e queda suaves */
  nota(freq, t0, dur, vol, tipo){
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = tipo || "sine";
    o.frequency.setValueAtTime(freq, t0);
    f.type = "lowpass"; f.frequency.setValueAtTime(2400, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(f); f.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },
  toca(nome){
    if (!this.ligado) return;
    const c = this.abrir(); if (!c) return;
    const t = c.currentTime;
    const N = {
      toque:   [[1180, 0, .055, .030]],
      clique:  [[760, 0, .075, .042], [1140, .012, .06, .020]],
      abre:    [[520, 0, .10, .038], [780, .045, .13, .030]],
      fecha:   [[700, 0, .09, .030], [466, .04, .12, .024]],
      feito:   [[660, 0, .13, .038], [880, .055, .15, .034], [1320, .11, .19, .022]],
      falha:   [[300, 0, .16, .046], [232, .07, .22, .038]],
      /* varredura do modo chance: sobe do grave ao agudo junto com a luz */
      chance:  [[392,0,.16,.026],[523,.055,.16,.028],[659,.11,.17,.028],[784,.165,.19,.030],[1046,.22,.28,.024]],
      chanceOff:[[880,0,.12,.024],[587,.06,.16,.024],[392,.12,.22,.022]]
    }[nome];
    if (N) N.forEach(([f, d, dur, v]) => this.nota(f, t + d, dur, v));
  },
  alterna(){
    this.ligado = !this.ligado;
    localStorage.setItem("prospec.som", this.ligado ? "1" : "0");
    if (this.ligado) this.toca("clique");
  }
};


const S = {
  leads: [], atividades: [], vias: {},
  termo: "", status: "todos", rapido: null,
  selecionado: null, visao: "leads", carregando: true,
  modo: localStorage.getItem("prospec.modo") || "cartoes",
  chance: localStorage.getItem("prospec.chance") === "1",
  minimal: localStorage.getItem("prospec.minimal") === "1",
  mapaModo: localStorage.getItem("prospec.mapaModo") === "mapas" ? "mapas" : "rotas",
  local: JSON.parse(localStorage.getItem("prospec.local") || '{"bairro":"Centro","via":""}')
};
function salvarLocal(){ localStorage.setItem("prospec.local", JSON.stringify(S.local)); }

/* O subtítulo dizia "Regente Feijó e região" independentemente do que havia
   no banco — e o levantamento inteiro é de Presidente Prudente. Agora a frase
   é lida dos dados, então ela não pode voltar a mentir se a base mudar. */
function cidadeDominante(){
  const c = {};
  S.leads.forEach(l => { const k = (l.cidade || "").trim(); if (k) c[k] = (c[k] || 0) + 1; });

  const ordenadas = Object.entries(c).sort((a, b) => b[1] - a[1]);
  if (!ordenadas.length) return "sua região";
  if (ordenadas.length === 1) return ordenadas[0][0];

  const [nome, quantos] = ordenadas[0];
  const resto = S.leads.length - quantos;
  return `${nome} +${resto} de outras cidades`;
}

function recalcularVias(){
  S.vias = {};
  S.leads.forEach(l => { const v = via(l); if (v) S.vias[v] = (S.vias[v]||0) + 1; });
}
function filtrados(){
  const t = S.termo.trim().toLowerCase();
  let r = S.leads.filter(l => {
    if (S.status !== "todos" && l.status !== S.status) return false;
    if (S.rapido === "ligar"   && !(temTel(l) && l.status === "novo")) return false;
    if (S.rapido === "visitar" && (temTel(l) || l.status === "descartado")) return false;
    if (S.rapido === "insta"   && !instaSemSite(l)) return false;
    if (S.rapido === "capital" && !capital(l)) return false;
    if (S.rapido === "perto"   && nivelProx(l) > 3) return false;
    if (["quente","morno","frio"].includes(S.rapido) && faixaDe(l) !== S.rapido) return false;
    if (!t) return true;
    return [l.nome,l.empresa,l.telefone,l.email,l.endereco,l.bairro,l.observacoes,l.site,
            l.instagram,l.facebook,CATEGORIAS[l.categoria],STATUS_NOME[l.status]]
      .join(" ").toLowerCase().includes(t);
  });
  if (S.rapido === "perto") r = r.slice().sort((a,b) => nivelProx(a) - nivelProx(b) || scoreDe(b) - scoreDe(a));
  return r;
}


let avisoT = null;
function aviso(texto, falha){
  clearTimeout(avisoT);
  SOM.toca(falha ? "falha" : "feito");
  $("#avisos").innerHTML = `<div class="aviso ${falha?"falha":""}" role="status">${esc(texto)}</div>`;
  avisoT = setTimeout(() => { $("#avisos").innerHTML = ""; }, falha ? 5200 : 2600);
}


/* A cortina some assim que há o que mostrar — inclusive quando a API falha,
   senão o erro ficaria escondido atrás dela para sempre. Um tempo mínimo de
   tela evita o pisca-pisca feio quando a resposta volta em 30ms. */
const SPLASH_MIN = 550;
const splashNasceu = Date.now();

function fecharSplash(){
  const el = document.getElementById("splash");
  if (!el || el.classList.contains("saindo")) return;

  const espera = Math.max(0, SPLASH_MIN - (Date.now() - splashNasceu));
  setTimeout(() => {
    el.classList.add("saindo");
    setTimeout(() => el.remove(), 460);   // fora do DOM: não é estado do app
  }, espera);
}

/* Skeleton em vez de "Carregando…": mostra a FORMA do que vem, então quando
   os dados chegam nada salta de lugar. O número de peças acompanha o que
   costuma caber na tela. */
function skeletonCartoes(n = 6){
  return `<div class="grade-cartoes">${Array.from({length:n}, (_, i) => `
    <div class="sk-cartao" style="--atraso:${i*45}ms">
      <div class="sk-topo">
        <div class="sk sk-avatar"></div>
        <div class="sk-linhas">
          <div class="sk sk-l longa"></div>
          <div class="sk sk-l curta"></div>
        </div>
      </div>
      <div class="sk sk-l media"></div>
      <div class="sk sk-l longa"></div>
    </div>`).join("")}</div>`;
}

function skeletonLista(n = 8){
  return `<div class="sk-lista">${Array.from({length:n}, (_, i) => `
    <div class="sk-fila" style="--atraso:${i*40}ms">
      <div class="sk sk-avatar" style="width:38px;height:38px;border-radius:12px"></div>
      <div class="sk-linhas">
        <div class="sk sk-l media"></div>
        <div class="sk sk-l curta"></div>
      </div>
    </div>`).join("")}</div>`;
}

/* `fundo` = atualizar sem espetáculo. Apagar a lista para escrever
   "Carregando…" só faz sentido na primeira vez; depois de adicionar ou
   excluir alguém, isso pisca a tela inteira e faz uma operação de 7ms
   parecer lenta. */
async function carregar(fundo){
  const area = $("#areaLeads");

  if (!fundo){
    S.carregando = true;
    if (area) area.innerHTML = skeletonCartoes();
  }

  try {
    S.leads = await API.listarLeads();
    recalcularVias();
    fecharSplash();
    S.carregando = false;
    render();
  } catch (e){
    S.carregando = false;
    fecharSplash();
    if (area){
      area.innerHTML = `<div class="vazio">Não consegui falar com a API em <code>/api/leads</code>.<br>
        ${esc(e.message)} — confira se o servidor está rodando em localhost:3000.<br><br>
        <button id="tentarDeNovo">Tentar de novo</button></div>`;
      const b = $("#tentarDeNovo"); if (b) b.onclick = carregar;
    }
    aviso("Falha ao carregar leads: " + e.message, true);
  }
}


function faixaPanorama(){
  const c = s => S.leads.filter(l => l.status === s).length;
  const ativos = S.leads.filter(l => l.status !== "descartado");
  const podeLigar = S.leads.filter(l => temTel(l) && l.status === "novo").length;
  const visita = ativos.filter(l => !temTel(l)).length;
  const tocados = ativos.filter(l => l.status !== "novo").length;

  const etapas = ETAPAS.map(s => {
    const n = c(s), on = S.status === s;
    const cl = ["etapa", n===0?"vazia":"", s==="vendido"&&n>0?"destaque":""].filter(Boolean).join(" ");
    return `<button class="${cl}" data-etapa="${s}" aria-pressed="${on}">
      <span class="n">${n}</span><span class="t">${STATUS_NOME[s]}</span></button>`;
  }).join("");

  const cats = {};
  ativos.forEach(l => { const k = CATEGORIAS[l.categoria]||"Outro"; cats[k]=(cats[k]||0)+1; });
  const ord = Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  const tot = ativos.length || 1;
  const ramos = ord.map(([k,v]) => `<i style="flex:${v}" title="${esc(k)}: ${v}"></i>`).join("");
  const legenda = ord.slice(0,3).map(([k,v])=>`<b>${esc(k)}</b> ${v}`).join(" · ")
    + (ord.length>3 ? ` · +${ord.length-3} categorias` : "");

  const medidor = ativos.map(l =>
    `<i class="${l.status!=="novo"?"feito":""}" title="${esc(l.nome)}"></i>`).join("")
    + S.leads.filter(l=>l.status==="descartado").map(()=>`<i class="fora"></i>`).join("");

  $("#faixaPanorama").innerHTML = `
    <div class="bloco"><span class="rotulo">Funil</span><div class="funil">${etapas}</div></div>
    <div class="bloco"><span class="rotulo">Fila de hoje</span>
      <div class="fila">
        <button class="pode" data-rapido="ligar" aria-pressed="${S.rapido==="ligar"}">
          <span class="n">${podeLigar}</span><span class="t">dá para ligar</span></button>
        <button data-rapido="visitar" aria-pressed="${S.rapido==="visitar"}">
          <span class="n">${visita}</span><span class="t">exigem visita</span></button>
      </div></div>
    <div class="bloco"><span class="rotulo">Ramos</span>
      <div class="ramos">${ramos}</div><p class="ramos-legenda">${legenda}</p></div>
    <div class="bloco esgota"><span class="rotulo">A lista acaba</span>
      <div class="medidor">${medidor}</div>
      <p><b>${ativos.length - tocados}</b> dos ${ativos.length} ativos ainda não foram tocados.</p></div>`;
}


function barraFiltros(){
  const cont = s => s==="todos" ? S.leads.length : S.leads.filter(l=>l.status===s).length;
  const seg = ["todos"].concat(ETAPAS).map(s => `
    <button data-etapa="${s}" aria-pressed="${S.status===s}">
      ${s==="todos"?"Todos":STATUS_NOME[s]} <span class="c">${cont(s)}</span></button>`).join("");

  const nQ = S.leads.filter(l=>l.status!=="descartado"&&faixaDe(l)==="quente").length;
  const nM = S.leads.filter(l=>l.status!=="descartado"&&faixaDe(l)==="morno").length;
  const nF = S.leads.filter(l=>l.status!=="descartado"&&faixaDe(l)==="frio").length;
  const nI = S.leads.filter(instaSemSite).length;
  const nP = S.leads.filter(l=>l.status!=="descartado"&&nivelProx(l)<=3).length;

  const chip = (id,txt,n) => `<button class="chip" data-rapido="${id}" aria-pressed="${S.rapido===id}">${txt} <span class="c">${n}</span></button>`;

  $("#barraFiltros").innerHTML = `
    <div class="grupo">${seg}</div>
    ${chip("quente","Quente",nQ)}${chip("morno","Morno",nM)}${chip("frio","Frio",nF)}
    ${chip("insta","Instagram sem site",nI)}
    ${chip("perto","Perto de mim",nP)}
    <button class="chip sempre ${S.chance?"chance-on":""}" id="btnChance" aria-pressed="${S.chance}"
      title="Tinge cada lead pela chance de fechar">
      <span class="ponto"></span> Chance</button>
    ${S.chance ? `<span class="chance-legenda"><span class="esc"></span>menos chance → mais chance</span>` : ""}
    ${(S.rapido||S.status!=="todos"||S.termo) ? `<button class="limpar" id="limparF">limpar filtros</button>` : ""}
    <button class="chave" id="btnMinimal" aria-pressed="${S.minimal}"
      title="Esconde o secundário; tudo continua a um clique no lead">
      <span class="trilhoc"><span class="bolinha"></span></span> Modo minimalista</button>
    <div class="grupo direita-modo">
      <button data-modo="cartoes" aria-pressed="${S.modo==="cartoes"}">${IC.grade(15)} Cartões</button>
      <button data-modo="lista" aria-pressed="${S.modo==="lista"}">${IC.linhas(15)} Lista</button>
    </div>`;
  const g = $(".direita-modo"); if (g) g.style.marginLeft = "auto";
}


function scoreHTML(l, curto){
  const s = scoreDe(l), f = faixaDe(l);
  return `<span class="score f-${f} ${l.confianca==="verificar"?"verificar":""}"
      title="${l.confianca==="verificar"?"Dado ainda não confirmado":"Score de chance"}">
    <span class="num">${s}</span>
    <span class="lado">
      ${curto?"":`<span class="faixa">${FAIXA_NOME[f]}</span>`}
      <span class="trilho"><i style="width:${Math.max(3,s)}%"></i></span>
    </span></span>`;
}
function seloHTML(l){
  const i = FUNIL.indexOf(l.status);
  const t = FUNIL.map((_,k) => `<i class="${k<i?"feito":k===i?"agora":""}"></i>`).join("");
  return `<span class="selo s-${l.status}"><span class="trilha">${t}</span>${STATUS_NOME[l.status]}</span>`;
}
function telHTML(l){
  if (!temTel(l)) return `<span class="sem-tel">exige visita</span>`;
  return `<span class="tel ${telDuvida(l)?"duvida":""}">${esc(l.telefone)}</span>`;
}
function redesHTML(l){
  let h = "";
  if (temInsta(l)) h += `<a href="${esc(urlInsta(l))}" target="_blank" rel="noopener"
      class="${instaSemSite(l)?"destaque":""}" title="Abrir ${esc(l.instagram)}"
      onclick="event.stopPropagation()">${IC.insta(15)}</a>`;
  if (temFace(l)) h += `<a href="${esc(urlFace(l))}" target="_blank" rel="noopener"
      title="Abrir Facebook" onclick="event.stopPropagation()">${IC.face(15)}</a>`;
  return h ? `<span class="redes-mini">${h}</span>` : "";
}


function cartao(l, i){
  const v = via(l), n = v ? S.vias[v] : 0;
  const est = `--h:${{padaria:38,restaurante:22,bar:310,salao_beleza:348,oficina:232,
    farmacia:158,loja:190,supermercado:62,outro:250}[l.categoria] ?? 250};`
    + `--hc:${hueChance(l).toFixed(0)};--atraso:${Math.min(i||0,23)*26}ms`;
  return `<button class="cartao cat-${l.categoria} ${l.status==="descartado"?"descartado":""}"
      data-id="${l.id}" style="${est}" aria-selected="${S.selecionado===l.id}">
    <span class="cartao-topo">
      ${avatarHTML(l)}
      <span class="cartao-id">
        <span class="cartao-nome">${esc(l.nome)}</span>
        <span class="cartao-cat">${esc(CATEGORIAS[l.categoria]||"—")}${l.avaliacao?" · "+IC.estrela(12):""}</span>
      </span>
      ${scoreHTML(l)}
    </span>
    <span class="cartao-linha">
      <span class="pocinho ${temTel(l)?"ok":""}">${temTel(l)?IC.tel(15):IC.telNao(15)}</span>
      ${telHTML(l)}
    </span>
    <span class="cartao-linha">
      <span class="pocinho">${IC.local(15)}</span>
      <span class="txt">${esc(enderecoCurto(l))}${n>1?` · ${n} na via`:""}</span>
    </span>
    <span class="cartao-pe" data-resumo="${esc(STATUS_NOME[l.status])} · ${temTel(l)?"tem telefone":"exige visita"}">${seloHTML(l)}${proxHTML(l)}${redesHTML(l)}</span>
  </button>`;
}

function linha(l, i){
  const v = via(l), n = v ? S.vias[v] : 0;
  const est = `--h:${{padaria:38,restaurante:22,bar:310,salao_beleza:348,oficina:232,
    farmacia:158,loja:190,supermercado:62,outro:250}[l.categoria] ?? 250};`
    + `--hc:${hueChance(l).toFixed(0)};--atraso:${Math.min(i||0,25)*16}ms`;
  const sinais = [ instaSemSite(l)?`<span class="oportunidade" title="Instagram sem site">${IC.insta(14)}</span>`:"",
                   l.avaliacao?`<span title="${esc(l.avaliacao)}">${IC.estrela(14)}</span>`:"",
                   obsAtencao(l)?`<span title="Ver observações">${IC.aviso(14)}</span>`:"" ].join("");
  return `<button class="linha cat-${l.categoria}" data-id="${l.id}" style="${est}"
      aria-selected="${S.selecionado===l.id}">
    <span class="pocinho ${temTel(l)?"ok":""}">${temTel(l)?IC.tel(14):IC.telNao(14)}</span>
    ${scoreHTML(l,true)}
    <span class="nome-cel"><span class="nome">${esc(l.nome)}</span><span class="sinais">${sinais}</span></span>
    <span class="cat">${esc(CATEGORIAS[l.categoria]||"—")}</span>
    <span>${telHTML(l)}</span>
    <span class="cat">${esc(enderecoCurto(l))}${n>1?` · ${n}`:""}</span>
    <span>${proxHTML(l)}</span>
    <span>${seloHTML(l)}</span>
  </button>`;
}

function renderLeads(){
  const lista = filtrados();
  const area = $("#areaLeads");
  if (!lista.length){
    area.innerHTML = `<div class="vazio">Nenhum lead com esses filtros.<br><br>
      <button id="limparVazio">limpar filtros</button></div>`;
    const b = $("#limparVazio");
    if (b) b.onclick = () => { S.termo=""; S.status="todos"; S.rapido=null; $("#busca").value=""; render(); };
    return;
  }
  if (S.modo === "cartoes"){
    area.innerHTML = `<div class="grade-cartoes">${lista.map((l,i)=>cartao(l,i)).join("")}</div>
      <p class="fim-lista">${lista.length} de ${S.leads.length} — fim da lista, não há página 2.</p>`;
  } else {
    area.innerHTML = `<div class="lista">
      <div class="linha cabeca"><span></span><span>Score</span><span>Lead</span><span>Categoria</span>
        <span>Telefone</span><span>Onde fica</span><span>Proximidade</span><span>Etapa</span></div>
      <div class="corpo">${lista.map((l,i)=>linha(l,i)).join("")}</div></div>
      <p class="fim-lista">${lista.length} de ${S.leads.length} — fim da lista, não há página 2.</p>`;
  }
  /* Clicar num lead já selecionado o solta; clicar em outro transfere a
     seleção. Assim o cartão afundado marca onde você parou, mesmo com o
     painel fechado — antes a marca sumia junto com o painel. */
  area.querySelectorAll("[data-id]").forEach(el => el.onclick = () => {
    const id = +el.dataset.id;
    // Clicar de novo no mesmo lead solta — com o painel aberto ou fechado.
    if (S.selecionado === id){
      S.selecionado = null;
      if (document.querySelector(".painel")) return fecharPainel(true);
      SOM.toca("fecha");
      marcarSelecao();             // solta sem remontar a lista
      return;
    }
    abrirPainel(id);
  });
}


function renderPanorama(){
  const ativos = S.leads.filter(l => l.status !== "descartado");
  const barra = (rot, val, max, q) => `<div class="barra-linha">
    <span class="nm">${esc(rot)}</span>
    <span class="tr"><i class="${q?"q":""}" style="width:${Math.round(val/max*100)}%"></i></span>
    <span class="vl">${val}</span></div>`;

  const cats = {}; ativos.forEach(l=>{const k=CATEGORIAS[l.categoria]||"Outro";cats[k]=(cats[k]||0)+1});
  const mc = Math.max(...Object.values(cats),1);
  const bairros = {}; ativos.forEach(l=>{const k=l.bairro||"não identificado";bairros[k]=(bairros[k]||0)+1});
  const mb = Math.max(...Object.values(bairros),1);
  const faixas = { Quente:0, Morno:0, Frio:0 };
  ativos.forEach(l => faixas[FAIXA_NOME[faixaDe(l)]]++);
  const canal = {
    "Telefone confirmado": ativos.filter(l=>temTel(l)&&!telDuvida(l)).length,
    "Telefone a confirmar": ativos.filter(telDuvida).length,
    "Só Instagram": ativos.filter(l=>!temTel(l)&&temInsta(l)).length,
    "Só Facebook": ativos.filter(l=>!temTel(l)&&!temInsta(l)&&temFace(l)).length,
    "Sem canal": ativos.filter(l=>!temTel(l)&&!temInsta(l)&&!temFace(l)).length
  };
  const mCanal = Math.max(...Object.values(canal),1);

  $("#visaoPanorama").innerHTML = `<div class="pan-grade">
    <div class="caixa"><header><span class="rotulo">Chance de conversão</span></header>
      <div class="conteudo">${Object.entries(faixas).map(([k,v])=>barra(k,v,ativos.length,k==="Quente")).join("")}</div></div>
    <div class="caixa"><header><span class="rotulo">Como falar com eles</span></header>
      <div class="conteudo">${Object.entries(canal).map(([k,v])=>barra(k,v,mCanal,k==="Telefone confirmado")).join("")}</div></div>
    <div class="caixa"><header><span class="rotulo">Ramos</span></header>
      <div class="conteudo">${Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([k,v])=>barra(k,v,mc)).join("")}</div></div>
    <div class="caixa"><header><span class="rotulo">Bairros</span></header>
      <div class="conteudo">${Object.entries(bairros).sort((a,b)=>b[1]-a[1]).map(([k,v])=>barra(k,v,mb)).join("")}</div></div>
  </div>`;
}


function renderRotas(){
  const ativos = S.leads.filter(l => l.status !== "descartado");
  const grupos = {};
  ativos.forEach(l => { const v = via(l); if (v) (grupos[v] = grupos[v] || []).push(l); });
  const rotas = Object.entries(grupos).filter(([,v]) => v.length > 1)
    .sort((a,b) => b[1].length - a[1].length);

  const emRota = new Set(); rotas.forEach(([,v]) => v.forEach(l => emRota.add(l.id)));
  const soNaVia = ativos.filter(l => via(l) && !emRota.has(l.id)).length;
  const semVia  = ativos.filter(l => !via(l)).length;
  const semBairro = ativos.filter(l => !l.bairro).length;

  const svgRota = (nome, leads) => {
    const com = leads.filter(l => numeroPorta(l) != null).sort((a,b)=>numeroPorta(a)-numeroPorta(b));
    const sem = leads.filter(l => numeroPorta(l) == null);
    const W = 1040, esq = 30, dir = W - 30, Y = 64;
    if (!com.length) return "";
    const nums = com.map(numeroPorta);
    const passo = (dir - esq) / Math.max(com.length - 1, 1);
    const pts = com.map((l,i) => ({ l, x: esq + i*passo, n: nums[i] }));
    let seg = "";
    for (let i=0;i<pts.length-1;i++){
      const salto = pts[i+1].n - pts[i].n;
      const largo = salto > 60;
      seg += `<line class="${largo?"via-gap":"via-linha"}" x1="${pts[i].x}" y1="${Y}" x2="${pts[i+1].x}" y2="${Y}"/>`;
      if (largo) seg += `<text class="porta" x="${(pts[i].x+pts[i+1].x)/2}" y="${Y-9}" text-anchor="middle">+${salto}</text>`;
    }
    const nos = pts.map(p => {
      const alto = p.l.status !== "novo";
      const corte = Math.max(10, Math.floor(passo/7.2));
      const rot = p.l.nome.length > corte ? p.l.nome.slice(0,corte-1)+"…" : p.l.nome;
      return `<g class="no" data-id="${p.l.id}">
        <line class="haste" x1="${p.x}" y1="${Y}" x2="${p.x}" y2="${Y-26}"/>
        <circle class="bola" cx="${p.x}" cy="${Y}" r="5"
          fill="${faixaDe(p.l)==="quente"?"var(--acento)":"var(--tinta-2)"}"
          opacity="${alto?.45:1}"/>
        <text class="rotulo-lead ${alto?"suave":""}" x="${p.x}" y="${Y-32}" text-anchor="middle">${esc(rot)}</text>
        <text class="porta" x="${p.x}" y="${Y+19}" text-anchor="middle">nº ${p.n}</text></g>`;
    }).join("");
    const juntos = pts.filter((p,i)=> i>0 && p.n - pts[i-1].n <= 60).length + (pts.length>1?1:0);
    return `<div class="rota">
      <div class="rota-cab"><h3>${esc(nome)}</h3>
        <span class="qt">${leads.length} leads</span>
        <span class="spread">nº ${nums[0]} ao ${nums[nums.length-1]}${juntos>=2?` · ${juntos} a poucos passos um do outro`:""}${sem.length?` · ${sem.length} sem número`:""}</span></div>
      <svg viewBox="0 0 ${W} 92" preserveAspectRatio="xMidYMid meet">${seg}${nos}</svg></div>`;
  };

  const bairros = {};
  ativos.forEach(l => { const k = l.bairro || ""; (bairros[k] = bairros[k] || []).push(l); });
  const blocosBairro = Object.entries(bairros).sort((a,b)=>b[1].length-a[1].length).map(([k,v]) => {
    const q = v.filter(l=>faixaDe(l)==="quente").length;
    return `<div class="bairro">
      <span class="bairro-nome ${k?"":"indef"}">${esc(k || "bairro não identificado")}</span>
      <span class="bairro-qt">${v.length} lead${v.length>1?"s":""} · ${q} quente${q!==1?"s":""}</span>
      <span class="bairro-blocos">${v.map(l=>`<button data-id="${l.id}" title="${esc(l.nome)}"
        class="b-${faixaDe(l)}"></button>`).join("")}</span></div>`;
  }).join("");

  const desc = S.leads.filter(l => l.status === "descartado");
  const locais = desc.filter(l => !capital(l)), fora = desc.filter(capital);

  $("#visaoMapa").innerHTML = interruptorMapa() + `
    <div class="mapa-topo">
      <h2>Rotas de visita</h2>
      <p>Isto não é um mapa geográfico: é o desenho da caminhada. Usa bairro, via e
      número de porta — cada via vira uma linha, os leads entram na ordem real da
      numeração, e o vão entre dois pontos vira tracejado quando o salto passa de 60
      números, ou seja, quando deixa de ser a mesma esquina. Para ver a posição real
      de cada um no mundo, troque para <b>Mapa</b> no interruptor acima.</p>
    </div>
    <div class="mapa-grade">
      <div class="caixa">
        <header><span class="rotulo">Vias com mais de um lead — ${rotas.length} rotas, ${emRota.size} leads numa caminhada</span></header>
        ${rotas.map(([n,v]) => svgRota(n,v)).join("")}
      </div>
      <div class="caixa">
        <header><span class="rotulo">Concentração por bairro</span></header>
        <div class="bairros">${blocosBairro}</div>
      </div>
      <div class="caixa">
        <header><span class="rotulo">Fora de agrupamento — o que o mapa não consegue posicionar</span></header>
        <div class="fora">
          <div><b>${soNaVia}</b>leads sozinhos na própria via</div>
          <div><b>${semVia}</b>sem logradouro no endereço</div>
          <div><b>${semBairro}</b>sem bairro identificado</div>
          <div><b>${emRota.size}</b>encaixam numa rota a pé</div>
        </div>
      </div>
      <div class="caixa">
        <header><span class="rotulo">Descartados — e a armadilha de busca que explica ${fora.length} deles</span></header>
        <div class="distancia"><div class="eixo">
          <div class="polo"><h4>Regente Feijó/SP · ${locais.length}</h4><ul>
            ${locais.map(l=>`<li><button data-id="${l.id}">${esc(l.nome)}</button></li>`).join("")}</ul></div>
          <div class="vao"><span class="tracejado"></span><span>≈ 570 km</span></div>
          <div class="polo"><h4>Vila Regente Feijó · SP capital · ${fora.length}</h4><ul>
            ${fora.map(l=>`<li><button data-id="${l.id}">${esc(l.nome)}</button></li>`).join("")}</ul></div>
        </div></div>
      </div>
    </div>`;

  $("#visaoMapa").querySelectorAll("[data-id]").forEach(el =>
    el.onclick = () => abrirPainel(+el.dataset.id));
  ligarInterruptorMapa();
}


/* Interruptor Rotas | Mapa. Duas leituras do mesmo conjunto: uma é a ordem da
   caminhada (via e numeração), a outra é a posição real no mundo. */
function interruptorMapa(){
  const em = S.mapaModo === "mapas";
  return `<div class="mapa-troca" role="tablist">
    <button role="tab" data-mapa="rotas" aria-selected="${!em}">Rotas</button>
    <button role="tab" data-mapa="mapas" aria-selected="${em}">Mapa</button>
  </div>`;
}

function ligarInterruptorMapa(){
  document.querySelectorAll("[data-mapa]").forEach(b => b.onclick = () => {
    if (S.mapaModo === b.dataset.mapa) return;
    S.mapaModo = b.dataset.mapa;
    localStorage.setItem("prospec.mapaModo", S.mapaModo);
    SOM.toca("clique");
    render();
  });
}

function renderMapa(){
  if (S.mapaModo === "mapas") renderMapaReal();
  else renderRotas();
}


/* Marca a seleção mexendo SÓ no atributo dos cartões já na tela.
   Duas razões para não chamar render() aqui:
   1. abrirPainel nunca redesenhava a lista, então o cartão só ficava afundado
      no próximo render — na prática, nunca. Era esse o bug.
   2. Redesenhar a lista inteira para trocar um atributo remonta os 109
      cartões e reinicia as animações de entrada: a tela inteira "recarrega"
      à vista, que é justamente o que incomodava ao desselecionar. */
function marcarSelecao(){
  document.querySelectorAll("#areaLeads [data-id]").forEach(el => {
    const eu = String(el.dataset.id) === String(S.selecionado);
    el.setAttribute("aria-selected", eu ? "true" : "false");
  });
}

async function abrirPainel(id){
  const l = S.leads.find(x => x.id === id);
  if (!l) return;
  const jaAberto = !!document.querySelector(".painel");
  S.selecionado = id;
  marcarSelecao();                 // o cartão afunda no instante do clique
  if (!jaAberto) SOM.toca("abre");
  try { S.atividades = await API.listarAtividades(id); } catch(_){ S.atividades = []; }

  const campo = (dt, dd, cls) => dd ? `<div class="campo"><dt>${dt}</dt><dd class="${cls||""}">${dd}</dd></div>` : "";
  const v = via(l), nv = v ? S.vias[v] : 0;

  const motivos = Array.isArray(l.motivos) && l.motivos.length ? `
    <div class="secao"><span class="rotulo">Como o score foi formado</span>
      <ul class="motivos">${l.motivos.map(m => {
        const mm = String(m).match(/^(.*?)\s*\(\+(\d+)\)$/);
        return mm ? `<li><span class="pts">+${mm[2]}</span><span>${esc(mm[1])}</span></li>`
                  : `<li><span class="pts neg">—</span><span>${esc(m)}</span></li>`;
      }).join("")}
      <li class="total"><span class="pts">${scoreDe(l)}</span><span>total · ${FAIXA_NOME[faixaDe(l)]}</span></li>
      </ul></div>` : "";

  const hist = S.atividades.length ? `<ul class="hist">${
    S.atividades.slice().sort((a,b)=>new Date(b.criado_em)-new Date(a.criado_em)).map(a =>
    `<li><span class="txt"><span class="quando">${dataBR(a.criado_em)}</span>
      <span class="oque">${esc(a.nota)}</span></span>
      <button class="apagar" data-atv="${a.id}" title="Apagar">${IC.lixo(13)}</button></li>`).join("")}</ul>`
    : `<p class="hist-vazio">Nenhuma interação registrada ainda. A primeira nota costuma ser o resultado da primeira ligação.</p>`;

  $("#camadas").innerHTML = `
    <div class="veu" id="veu"></div>
    <aside class="painel" role="dialog" aria-label="Detalhe do lead">
      <div class="painel-topo">
        <div class="painel-cab">
          ${avatarHTML(l, true)}
          <div style="flex:1;min-width:0"><h2>${esc(l.nome)}</h2>
            ${l.empresa && l.empresa !== l.nome ? `<p class="empresa">${esc(l.empresa)}</p>` : ""}</div>
          <button class="fechar" id="fecharPainel" title="Fechar">${IC.fechar(14)}</button>
        </div>
        <div class="painel-resumo">${scoreHTML(l)}${seloHTML(l)}${proxHTML(l)}</div>
        <div class="painel-acoes">
          ${temTel(l)?`<a class="botao" href="tel:${esc(String(l.telefone).replace(/\D/g,""))}">${IC.tel(15)} Ligar</a>`:""}
          ${temTel(l)?`<a class="botao" href="${esc(linkWhatsApp(l.telefone))}" target="_blank" rel="noopener">${IC.wpp(15)} WhatsApp</a>`:""}
          ${temInsta(l)?`<a class="botao" href="${esc(urlInsta(l))}" target="_blank" rel="noopener">${IC.insta(15)} Instagram</a>`:""}
          ${temFace(l)?`<a class="botao" href="${esc(urlFace(l))}" target="_blank" rel="noopener">${IC.face(15)} Facebook</a>`:""}
          <button class="botao" id="editarLead">Editar</button>
          <button class="botao" id="excluirLead">${IC.lixo(14)} Excluir</button>
        </div>
      </div>

      <div class="painel-corpo">
        <div class="secao"><span class="rotulo">Contato e local</span><dl class="poco">
          ${campo("Telefone", temTel(l) ? esc(l.telefone) + (telDuvida(l)?' <span class="suave">· confirmar ao discar</span>':"") : '<span class="suave">sem número — exige visita</span>', "mono")}
          ${campo("E-mail", l.email ? esc(l.email) : "")}
          ${campo("Endereço", esc(l.endereco || "não informado") + (nv>1?` <span class="suave">· ${nv} leads nesta via</span>`:""))}
          ${campo("Bairro", esc(l.bairro || "") + (capital(l)?' <span class="suave">· São Paulo capital</span>':""))}
          ${campo("Categoria", esc(CATEGORIAS[l.categoria]||"—"))}
          ${campo("Prioridade", esc(PRIO_NOME[l.prioridade]||"—"))}
        </dl></div>

        <div class="secao"><span class="rotulo">Presença digital</span><dl class="poco">
          ${campo("Site", semSite(l) ? '<span class="suave">nenhum — é o que você vende</span>' : esc(l.site))}
          ${campo("Instagram", temInsta(l) ? esc(l.instagram) : '<span class="suave">não encontrado</span>')}
          ${campo("Facebook", temFace(l) ? esc(l.facebook) : '<span class="suave">não encontrado</span>')}
          ${campo("Avaliação", l.avaliacao ? esc(l.avaliacao) : "")}
          ${campo("Fundação", l.fundacao ? esc(l.fundacao) : "")}
          ${campo("CNPJ", l.cnpj ? esc(l.cnpj) : "", "mono")}
          ${campo("Fonte", l.fonte ? esc(l.fonte) + (l.confianca==="verificar"?' <span class="suave">· a confirmar</span>':"") : "")}
        </dl></div>

        <div class="secao"><span class="rotulo">Logo ou foto</span>
          <div class="logo-campo">
            <input id="campoLogo" value="${esc(l.logo||"")}" placeholder="assets/logos/${l.id}.png ou https://…">
            <button class="botao" id="salvarLogo">Salvar</button>
            <button class="botao botao-forte" id="buscarImg">Buscar foto</button>
          </div>
          ${l.foto_fonte ? `<p class="dica">Foto encontrada na busca. <a href="${esc(l.foto_fonte)}"
            target="_blank" rel="noopener">ver origem</a></p>` : ""}
          <p class="dica">Cole uma imagem com Ctrl+V ou arraste o arquivo sobre o avatar.
          ${temInsta(l)?"Também dá para abrir o Instagram acima e copiar a foto de lá.":""}</p>
        </div>

        ${l.observacoes ? `<div class="secao"><span class="rotulo">Observações</span>
          <p class="obs ${obsAtencao(l)?"atencao":""}">${esc(l.observacoes)}</p></div>` : ""}

        ${motivos}

        <div class="secao"><span class="rotulo">Histórico</span>${hist}</div>
      </div>

      <div class="painel-pe">
        <textarea id="novaNota" placeholder="O que aconteceu? Ex.: liguei, falei com o dono, pediu para retornar sexta."></textarea>
        <div class="pe-acoes">
          <select class="suave pq" id="novoStatus">
            ${ETAPAS.map(s=>`<option value="${s}" ${s===l.status?"selected":""}>${STATUS_NOME[s]}</option>`).join("")}
          </select>
          <button class="botao botao-forte" id="salvarNota">Registrar</button>
        </div>
      </div>
    </aside>`;

  /* Envolvidos numa seta de propósito: ligados direto, o handler receberia o
     objeto de evento como argumento `soltar` — que é truthy — e a seleção era
     descartada em todo fechamento. Era esse o motivo de o cartão não
     continuar afundado. */
  $("#veu").onclick = () => fecharPainel();
  $("#fecharPainel").onclick = () => fecharPainel();
  $("#editarLead").onclick = () => abrirForm(l);
  $("#excluirLead").onclick = async () => {
    if (!confirm(`Excluir "${l.nome}"? Isso não volta.`)) return;
    try {
      await API.excluirLead(l.id);
      // Tira da lista local e desenha UMA vez. Antes eram dois render()
      // completos (um do fecharPainel, outro do carregar) e a lista piscava.
      S.leads = S.leads.filter(x => String(x.id) !== String(l.id));
      fecharPainel(true);          // o lead sumiu: não há o que continuar marcando
      aviso("Lead excluído.");
      carregar(true);          // reconcilia com o servidor, sem piscar
    }
    catch(e){ aviso("Não consegui excluir: " + e.message, true); }
  };
  $("#salvarLogo").onclick = () => salvarLogo(l.id, $("#campoLogo").value.trim());
  $("#buscarImg").onclick = () => escolherFoto(l);
  $("#salvarNota").onclick = () => registrar(l);
  $("#camadas").querySelectorAll("[data-atv]").forEach(b => b.onclick = async () => {
    try { await API.excluirAtividade(+b.dataset.atv); abrirPainel(l.id); aviso("Nota apagada."); }
    catch(e){ aviso("Não consegui apagar: " + e.message, true); }
  });
  ligarDropLogo(l);
  render();
}
/* Fechar o painel NÃO solta o lead: o cartão continua afundado, marcando
   onde você estava. Solta-se clicando nele de novo, ou escolhendo outro.
   `soltar` existe para os poucos casos em que a seleção deixa de fazer
   sentido — por exemplo quando o lead é excluído. */
function fecharPainel(soltar){
  SOM.toca("fecha");
  const painel = $(".painel");
  const idAoFechar = S.selecionado;

  const encerrar = () => {
    $("#camadas").innerHTML = "";

    S.selecionado = soltar ? null : S.selecionado;

    // Só remonta a lista quando ela realmente mudou (exclusão). Soltar a
    // seleção é troca de atributo, não motivo para redesenhar 109 cartões.
    if (soltar && !S.leads.some(l => String(l.id) === String(idAoFechar))) render();
    else marcarSelecao();
  };

  if (painel) {
    painel.classList.add("saindo");
    setTimeout(encerrar, 300);   // casa com a duração de painel-sai
  } else {
    encerrar();
  }
}

async function salvarLogo(id, valor){
  try { await API.atualizarLead(id, { logo: valor });
    const l = S.leads.find(x=>x.id===id); if (l) l.logo = valor;
    aviso(valor ? "Imagem salva." : "Imagem removida."); abrirPainel(id);
  } catch(e){ aviso("Não consegui salvar: " + e.message, true); }
}

function abrirForm(lead){
  const l = lead || {};
  const novo = !lead;
  const inp = (id,rot,val,ph,tipo) => `<div class="form-campo"><label for="${id}">${rot}</label>
    <input id="${id}" type="${tipo||"text"}" value="${esc(val||"")}" placeholder="${esc(ph||"")}"></div>`;
  const sel = (id,rot,opts,val) => `<div class="form-campo"><label for="${id}">${rot}</label>
    <select id="${id}">${opts.map(([v,t])=>`<option value="${v}" ${v===val?"selected":""}>${t}</option>`).join("")}</select></div>`;

  $("#camadas").innerHTML = `<div class="veu escuro" id="veu"></div>
    <div class="modal" role="dialog" aria-label="${novo?"Novo lead":"Editar lead"}">
      <div class="modal-topo"><h2>${novo?"Novo lead":"Editar lead"}</h2>
        <button class="fechar" id="fecharForm">${IC.fechar(14)}</button></div>
      <div class="modal-corpo">
        ${inp("fNome","Nome *",l.nome,"Nome do comércio")}
        ${inp("fEmpresa","Razão social",l.empresa)}
        ${inp("fTel","Telefone",l.telefone,"(18) 99999-9999")}
        ${inp("fEmail","E-mail",l.email,"","email")}
        ${sel("fCat","Categoria",Object.entries(CATEGORIAS),l.categoria||"outro")}
        ${sel("fStatus","Etapa",ETAPAS.map(s=>[s,STATUS_NOME[s]]),l.status||"novo")}
        ${sel("fPrio","Prioridade",Object.entries(PRIO_NOME),l.prioridade||"media")}
        ${inp("fBairro","Bairro",l.bairro,"Centro")}
        ${inp("fEnd","Endereço",l.endereco,"Rua Exemplo, 123 — Bairro, Regente Feijó/SP")}
        ${inp("fSite","Site",l.site||"nenhum","nenhum")}
        ${inp("fInsta","Instagram",l.instagram,"@perfil")}
        ${inp("fFace","Facebook",l.facebook,"facebook.com/pagina")}
        <div class="form-campo largo"><label for="fObs">Observações</label>
          <textarea id="fObs">${esc(l.observacoes||"")}</textarea></div>
      </div>
      <div class="modal-pe"><span class="erro" id="formErro"></span>
        <button class="botao" id="cancelarForm">Cancelar</button>
        <button class="botao botao-forte" id="salvarForm">${novo?"Adicionar":"Salvar"}</button></div>
    </div>`;

  const fechar = () => { $("#camadas").innerHTML=""; if (S.selecionado) abrirPainel(S.selecionado); else render(); };
  $("#veu").onclick = fechar; $("#fecharForm").onclick = fechar; $("#cancelarForm").onclick = fechar;
  $("#salvarForm").onclick = async () => {
    const d = {
      nome: $("#fNome").value.trim(), empresa: $("#fEmpresa").value.trim(),
      telefone: $("#fTel").value.trim(), email: $("#fEmail").value.trim(),
      categoria: $("#fCat").value, status: $("#fStatus").value, prioridade: $("#fPrio").value,
      bairro: $("#fBairro").value.trim(), endereco: $("#fEnd").value.trim(),
      site: $("#fSite").value.trim() || "nenhum",
      instagram: $("#fInsta").value.trim(), facebook: $("#fFace").value.trim(),
      observacoes: $("#fObs").value.trim()
    };
    if (!d.nome) return $("#formErro").textContent = "O nome é obrigatório.";
    if (!d.cidade) d.cidade = /São Paulo\/SP/.test(d.endereco) ? "São Paulo (capital)" : "Regente Feijó";
    try {
      if (novo) await API.criarLead(d); else await API.atualizarLead(l.id, d);
      $("#camadas").innerHTML = "";
      await carregar(true);     // sem apagar a lista e reescrever "Carregando…"
      aviso(novo ? "Lead adicionado." : "Lead atualizado.");
      if (!novo) abrirPainel(l.id);
    } catch(e){ $("#formErro").textContent = "Não consegui salvar: " + e.message; }
  };
  setTimeout(()=>{ const f=$("#fNome"); if(f) f.focus(); }, 40);
}


function abrirLocal(){
  $("#camadas").innerHTML = `<div class="veu escuro" id="veu"></div>
    <div class="modal" style="width:520px" role="dialog" aria-label="Minha localização">
      <div class="modal-topo"><h2>Minha localização</h2>
        <button class="fechar" id="fecharLocal">${IC.fechar(14)}</button></div>
      <div class="modal-corpo">
        <div class="form-campo largo"><label for="lBairro">Seu bairro</label>
          <select id="lBairro">${BAIRROS_CONHECIDOS.map(b=>
            `<option value="${esc(b)}" ${b===S.local.bairro?"selected":""}>${esc(b)}</option>`).join("")}</select></div>
        <div class="form-campo largo"><label for="lVia">Sua rua (opcional)</label>
          <input id="lVia" value="${esc(S.local.via||"")}" placeholder="Av. Regente Feijó">
          <span class="aj">Se preencher, os leads na mesma rua sobem para o topo da proximidade.</span></div>
        <div class="form-campo largo">
          <p class="dica">Isto ordena por <b>proximidade de bairro e via</b>, não por distância medida.
          O app não tem as coordenadas dos leads, então não inventa quilometragem — a escada é
          mesma rua → mesmo bairro → Centro → outro bairro → zona rural → fora da cidade.</p></div>
      </div>
      <div class="modal-pe">
        <button class="botao" id="cancelarLocal">Cancelar</button>
        <button class="botao botao-forte" id="salvarLocalBtn">Salvar</button></div>
    </div>`;
  const fechar = () => { $("#camadas").innerHTML=""; render(); };
  $("#veu").onclick = fechar; $("#fecharLocal").onclick = fechar; $("#cancelarLocal").onclick = fechar;
  $("#salvarLocalBtn").onclick = () => {
    S.local = { bairro: $("#lBairro").value, via: $("#lVia").value.trim() };
    salvarLocal(); fechar(); aviso("Localização salva: " + S.local.bairro);
  };
}


function render(){
  document.querySelector(".app").classList.toggle("chance", S.chance);
  document.querySelector(".app").classList.toggle("minimal", S.minimal);
  const bs = $("#navSom");
  if (bs){ bs.classList.toggle("ativo", SOM.ligado);
           $("#somEstado").textContent = SOM.ligado ? "on" : "off"; }
  $("#navContLeads").textContent = S.carregando ? "—" : S.leads.length;
  const ativos = S.leads.filter(l => l.status !== "descartado");
  const podeLigar = S.leads.filter(l => temTel(l) && l.status === "novo").length;
  $("#peLocal").innerHTML = `Você em <b>${esc(S.local.bairro)}</b>${S.local.via?` · ${esc(S.local.via)}`:""}`;
  $("#peFila").textContent = S.carregando ? "Carregando…"
    : `${podeLigar} para ligar hoje · ${ativos.filter(l=>!temTel(l)).length} exigem visita.`;

  document.querySelectorAll("[data-visao]").forEach(b =>
    b.setAttribute("aria-current", b.dataset.visao === S.visao ? "page" : "false"));

  $("#visaoLeads").classList.toggle("ocultar", S.visao !== "leads");
  $("#visaoPanorama").classList.toggle("ocultar", S.visao !== "panorama");
  $("#visaoMapa").classList.toggle("ocultar", S.visao !== "mapa");

  const titulos = { leads:"Leads", panorama:"Panorama", mapa:"Rotas de visita" };
  $("#tituloVisao").textContent = titulos[S.visao];
  $("#subTitulo").textContent = S.carregando ? "Carregando da API…"
    : `${S.leads.length} levantados em ${cidadeDominante()} · ${ativos.length} ativos`;

  if (S.carregando) return;
  if (S.visao === "leads"){ faixaPanorama(); barraFiltros(); renderLeads(); ligarFiltros(); }
  if (S.visao === "panorama") renderPanorama();
  if (S.visao === "mapa") renderMapa();
}

function ligarFiltros(){
  document.querySelectorAll("[data-etapa]").forEach(b => b.onclick = () => {
    S.status = (S.status === b.dataset.etapa) ? "todos" : b.dataset.etapa;
    SOM.toca("toque"); render();
  });
  document.querySelectorAll("[data-rapido]").forEach(b => b.onclick = () => {
    S.rapido = (S.rapido === b.dataset.rapido) ? null : b.dataset.rapido;
    SOM.toca("toque"); render();
  });
  document.querySelectorAll("[data-modo]").forEach(b => b.onclick = () => {
    S.modo = b.dataset.modo; localStorage.setItem("prospec.modo", S.modo);
    SOM.toca("clique"); render();
  });
  const bc = $("#btnChance");
  if (bc) bc.onclick = () => {
    S.chance = !S.chance;
    localStorage.setItem("prospec.chance", S.chance ? "1" : "0");
    SOM.toca(S.chance ? "chance" : "chanceOff");
    if (S.chance) varrer();
    document.querySelector(".app").classList.toggle("chance", S.chance);
  document.querySelector(".app").classList.toggle("minimal", S.minimal);
    render();
  };
  const bm = $("#btnMinimal");
  if (bm) bm.onclick = () => {
    S.minimal = !S.minimal;
    localStorage.setItem("prospec.minimal", S.minimal ? "1" : "0");
    SOM.toca(S.minimal ? "fecha" : "abre");
    const app = document.querySelector(".app");
    if (!S.minimal){ app.classList.add("saindo-minimal");
      setTimeout(()=>app.classList.remove("saindo-minimal"), 500); }
    render();
  };
  const lp = $("#limparF");
  if (lp) lp.onclick = () => {
    S.termo=""; S.status="todos"; S.rapido=null; $("#busca").value="";
    SOM.toca("clique"); render();
  };
}

/* faixa de luz que atravessa a tela quando o modo Chance liga */
function varrer(){
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const v = document.createElement("div");
  v.className = "varredura";
  document.body.appendChild(v);
  setTimeout(() => v.remove(), 760);
}


document.querySelectorAll("[data-visao]").forEach(b =>
  b.onclick = () => { S.visao = b.dataset.visao; SOM.toca("clique"); render(); });
$("#navNovo").onclick = () => { SOM.toca("abre"); abrirForm(null); };
$("#btnNovo").onclick = () => { SOM.toca("abre"); abrirForm(null); };
$("#navLocal").onclick = () => { SOM.toca("abre"); abrirLocal(); };
$("#navSom").onclick = () => { SOM.alterna(); render();
  aviso(SOM.ligado ? "Som ligado." : "Som desligado."); };
$("#navExportar").onclick = async () => {
  try {
    const csv = await API.exportar();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿"+csv], { type:"text/csv;charset=utf-8;" }));
    a.download = `leads_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    aviso("CSV exportado.");
  } catch(e){ aviso("Falha ao exportar: " + e.message, true); }
};
// A busca vale também na aba WhatsApp: antes ela só redesenhava a visão de
// leads, então digitar com a aba aberta não fazia absolutamente nada.
$("#busca").oninput = e => {
  S.termo = e.target.value;
  if (S.visao === "leads" || S.visao === "whatsapp") render();
};
document.addEventListener("keydown", e => {
  if (e.key === "/" && document.activeElement !== $("#busca")){ e.preventDefault(); $("#busca").focus(); }
  if (e.key === "Escape"){
    if (fecharPrevia()) return;                     /* fecha só a camada de cima */
    // Esc fecha, mas não solta o lead — mesma regra do X e do véu.
    if ($(".painel")) return fecharPainel();
    if ($(".modal")) { $("#camadas").innerHTML = ""; render(); }
  }
});

carregar();

// ===== WHATSAPP INTEGRATION =====

// Adicionar ao objeto API
API.obterStatusWhatsApp = () => API.req("GET", "/api/whatsapp/status");
API.enviarMensagemWPP = (numero, mensagem) => API.req("POST", "/api/whatsapp/enviar", { numero, mensagem });
API.obterConversa = (numero) => API.req("GET", `/api/whatsapp/conversa/${numero}`);
API.obterConversas = () => API.req("GET", "/api/whatsapp/conversas");

// Estado do WhatsApp
let estadoWPP = {
  conectado: false,
  conversas: {},
  conversaAtual: null,
  carregando: true
};

async function inicializarWhatsApp() {
  try {
    const status = await API.obterStatusWhatsApp();
    estadoWPP.conectado = status.conectado;
    
    if (status.conectado) {
      const conversas = await API.obterConversas();
      estadoWPP.conversas = conversas || {};
    }
    
    estadoWPP.carregando = false;
    
    // Ligar listener no botão
    const btnWPP = document.getElementById("navWhatsApp");
    if (btnWPP) {
      btnWPP.onclick = () => {
        S.visao = "whatsapp";
        SOM.toca("clique");
        render();
      };
    }
    
    renderizarWhatsApp();
  } catch (err) {
    console.error("Erro ao inicializar WhatsApp:", err);
    estadoWPP.carregando = false;
    aviso("Erro ao conectar com WhatsApp", true);
  }
}

/* A aba é montada sobre os SEUS leads, não sobre os contatos do WhatsApp.
   Motivo: getChats() da biblioteca está quebrado contra o WhatsApp Web atual
   (erro "r", persistente em 5 tentativas). E, de todo modo, a pergunta que
   interessa aqui é "com quais leads eu estou falando", não "todos os meus
   contatos". Mensagens recebidas chegam pelo evento 'message', que não usa a
   API quebrada, então a conversa se monta sozinha conforme as coisas chegam. */

const numeroDoLead = l => String(l.telefone || "").replace(/\D/g, "").slice(-11);

/* wa.me quer o número com código do país e sem sinais. Fixos de Prudente têm
   10 dígitos e celulares 11 — os dois viram 55 + número. */
function linkWhatsApp(numero, texto){
  const n = String(numero).replace(/\D/g, "").slice(-11);
  const url = "https://wa.me/55" + n;
  return texto ? url + "?text=" + encodeURIComponent(texto) : url;
}

/* Usa o MESMO filtrados() da visão de leads: mesma ordem, mesmos filtros
   rápidos, mesma busca. Antes esta aba tinha ordenação própria (quem
   respondeu primeiro), e o mesmo lead aparecia em posições diferentes nas
   duas telas — o que torna impossível confiar na posição. */
function leadsComTelefone(){
  const conversas = estadoWPP.conversas || {};

  return filtrados()
    .filter(l => temTel(l) && l.status !== "descartado")
    .map(l => {
      const num  = numeroDoLead(l);
      const msgs = conversas[num] || [];
      return {
        lead: l,
        numero: num,
        msgs,
        ultima: msgs.length ? msgs[msgs.length - 1] : null,
        respondeu: msgs.some(m => m.tipo === "entrada"),
        jaFalou: msgs.some(m => m.tipo === "saida") || jaContatado(l)
      };
    });
}

/* "Já mandei mensagem para este?" — o histórico do WhatsApp é só metade da
   resposta, porque só guardamos o que passou pelo app. A outra metade está no
   funil: um lead que saiu de "novo" já foi abordado de alguma forma. */
const jaContatado = l => l.status && l.status !== "novo";

function renderizarWhatsApp() {
  if (S.visao !== "whatsapp") return;

  const painel = document.getElementById("painelWhatsApp");
  if (!painel) return;

  if (!estadoWPP.conectado){
    painel.innerHTML = `<div class="wpp-vazio">
      <div>
        <h2>WhatsApp não conectado</h2>
        <p>Escaneie o QR code com seu telefone para conectar.</p>
        <div id="wppQr" style="margin-top:22px"></div>
      </div>
    </div>`;
    carregarQrWPP();
    return;
  }

  if (S.carregando || !S.leads.length){
    painel.innerHTML = `<div class="wpp-grade"><div class="wpp-lista">${
      skeletonLista()}</div><div class="wpp-vazio" style="flex:1"></div></div>`;
    return;
  }

  const itens = leadsComTelefone();
  const atual = estadoWPP.conversaAtual;
  const emFoco = itens.find(i => i.numero === atual);
  const respondendo = itens.filter(i => i.respondeu).length;

  painel.innerHTML = `<div class="wpp-grade">
    <div class="wpp-lista">
      <div class="wpp-cabeca">
        <button class="chip sempre ${S.chance ? "chance-on" : ""}" id="wppChance"
                aria-pressed="${S.chance}" title="Colorir por chance de fechar">
          <span class="ponto"></span> Chance
        </button>
        ${S.chance ? `<span class="wpp-escala"></span>` : ""}
        ${S.termo
          ? `<b>${itens.length}</b> ${itens.length === 1 ? "resultado" : "resultados"} para "${esc(S.termo)}"`
          : respondendo
            ? `<b>${respondendo}</b> ${respondendo === 1 ? "lead respondeu" : "leads responderam"}`
            : "Nenhum lead respondeu ainda"}
      </div>

      ${itens.length === 0 ? `<p class="wpp-nada">Nada encontrado.</p>` : ""}

      ${itens.map((i, k) => `
        <div class="wpp-conversa" data-numero="${esc(i.numero)}"
             aria-selected="${atual === i.numero}"
             style="--hc:${hueChance(i.lead).toFixed(0)};--atraso:${Math.min(k,25)*16}ms">
          ${avatarHTML(i.lead)}
          <span class="wpp-txt">
            <b>${esc(i.lead.nome || i.lead.empresa)}</b>
            <span>${i.ultima ? esc(i.ultima.texto).slice(0, 38) : esc(i.lead.telefone)}</span>
          </span>
          ${i.respondeu ? `<em class="wpp-marca">respondeu</em>`
            : i.jaFalou ? `<em class="wpp-marca fria">já falei</em>` : ""}
        </div>`).join("")}
    </div>

    ${emFoco ? fichaWhatsApp(emFoco)
             : `<div class="wpp-vazio" style="flex:1">Escolha um lead para conversar</div>`}
  </div>`;

  painel.querySelectorAll("[data-numero]").forEach(el =>
    el.onclick = () => abrirConversaWPP(el.dataset.numero));

  // Mesmo comportamento do botão da visão de leads: alterna, guarda a
  // escolha e dispara a varredura de luz.
  const bc = $("#wppChance");
  if (bc) bc.onclick = () => {
    S.chance = !S.chance;
    localStorage.setItem("prospec.chance", S.chance ? "1" : "0");
    SOM.toca(S.chance ? "chance" : "chanceOff");
    if (S.chance) varrer();
    document.querySelector(".app").classList.toggle("chance", S.chance);
    renderizarWhatsApp();
  };

  if (!emFoco) return;

  pintarMensagensWPP(emFoco.msgs);

  /* O envio abre o WhatsApp com a conversa e o texto prontos, em vez de sair
     pela biblioteca. Motivo medido, não preferência: o whatsapp-web.js perdeu
     o acesso ao Store do WhatsApp Web (diagnóstico: zero chaves), então o
     sendMessage devolve undefined e não dá para saber se a mensagem saiu. */
  const enviar = () => {
    const campo = $("#inputMsg");
    const texto = campo.value.trim();
    if (!texto) return;

    window.open(linkWhatsApp(emFoco.numero, texto), "_blank", "noopener");
    campo.value = "";
    aviso("WhatsApp aberto com a mensagem pronta.");
  };

  $("#btnEnviarMsg").onclick = enviar;
  $("#inputMsg").onkeydown = e => {
    if (e.key === "Enter" && !e.shiftKey){ e.preventDefault(); enviar(); }
  };

  const verLead = $("#wppVerLead");
  if (verLead) verLead.onclick = () => { S.visao = "leads"; render(); abrirPainel(emFoco.lead.id); };
}

/* A ficha existe para uma coisa: você saber com quem está falando ANTES de
   escrever. Foto, ramo, onde fica, o que já rolou e o gancho da abordagem. */
function fichaWhatsApp(i){
  const l = i.lead;

  const historico = i.msgs.length
    ? `${i.msgs.length} ${i.msgs.length === 1 ? "mensagem" : "mensagens"}`
    : i.jaFalou ? "já abordado, sem conversa no app" : "nunca conversado";

  const gancho = semSite(l)
    ? "Sem site — é exatamente o que você vende."
    : "Já tem site: ofereça reforma, landing page ou sistema.";

  return `<div id="chatArea" style="--hc:${hueChance(l).toFixed(0)}">
    <div class="chat-cabeca">
      ${avatarHTML(l, true)}
      <span class="chat-quem">
        <b>${esc(l.nome || l.empresa)}</b>
        <span>${esc(l.telefone)} · ${esc(CATEGORIAS[l.categoria] || "Outro")}</span>
      </span>
      <button class="botao" id="wppVerLead">Ver lead</button>
    </div>

    <div class="wpp-ficha">
      <div class="wpp-ficha-topo">
        ${scoreHTML(l)}${seloHTML(l)}${proxHTML(l)}
      </div>

      <dl class="wpp-dados">
        <div><dt>Onde</dt><dd>${esc(l.endereco || "endereço não informado")}${
          l.bairro ? ` · ${esc(l.bairro)}` : ""}</dd></div>
        <div><dt>Site</dt><dd>${semSite(l)
          ? `<span class="wpp-sem">nenhum</span>`
          : `<a href="${esc(l.site)}" target="_blank" rel="noopener">${esc(l.site)}</a>`}</dd></div>
        ${temInsta(l) ? `<div><dt>Instagram</dt>
          <dd><a href="${esc(urlInsta(l))}" target="_blank" rel="noopener">@${
            esc(String(l.instagram).replace(/^@/,""))}</a></dd></div>` : ""}
        <div><dt>Conversa</dt><dd>${esc(historico)}</dd></div>
        ${l.observacoes ? `<div><dt>Anotações</dt>
          <dd>${esc(l.observacoes)}</dd></div>` : ""}
      </dl>

      <p class="wpp-gancho">${esc(gancho)}</p>
    </div>

    <div id="mensagensArea"></div>

    <div class="chat-rodape">
      <textarea id="inputMsg" placeholder="Escreva sua mensagem…"></textarea>
      <button class="botao botao-forte" id="btnEnviarMsg">Abrir no WhatsApp</button>
    </div>
    <p class="chat-nota">O envio abre o WhatsApp com a mensagem pronta.
      As respostas voltam para cá.</p>
  </div>`;
}

/* Mensagens que chegam entram pelo evento 'message' do worker, então basta
   reperguntar de tempos em tempos enquanto a aba está aberta. */
let convTimer = null;

function acompanharConversas(){
  clearInterval(convTimer);

  convTimer = setInterval(async () => {
    if (S.visao !== "whatsapp" || !estadoWPP.conectado){
      clearInterval(convTimer);
      return;
    }
    try {
      const novas = await API.obterConversas();
      if (JSON.stringify(novas) === JSON.stringify(estadoWPP.conversas)) return;
      estadoWPP.conversas = novas;
      renderizarWhatsApp();
    } catch (_) {}
  }, 5000);
}

let qrTimer = null;

async function carregarQrWPP(){
  clearInterval(qrTimer);

  let tentativas = 0;
  let qrMostrado = null;   // evita repintar a imagem a cada 3s sem necessidade

  const busca = async () => {
    const alvo = $("#wppQr");
    if (!alvo || S.visao !== "whatsapp"){ clearInterval(qrTimer); return; }

    let r;
    try { r = await API.req("GET", "/api/whatsapp/qr"); }
    catch (_) {
      alvo.innerHTML = `<p>Servidor fora do ar.</p>`;
      clearInterval(qrTimer);
      return;
    }

    // Conectou enquanto esperávamos: sai da tela de QR.
    if (r && r.conectado){
      clearInterval(qrTimer);
      estadoWPP.conectado = true;
      estadoWPP.conversas = await API.obterConversas().catch(() => ({}));
      renderizarWhatsApp();
      return;
    }

    // NÃO paramos de buscar ao achar o QR: o WhatsApp troca de código a cada
    // ~20s, e um QR velho na tela simplesmente não escaneia. Seguimos pedindo
    // e trocamos a imagem quando ela muda; só paramos quando a sessão conecta.
    if (r && r.qr){
      if (r.qr !== qrMostrado){
        qrMostrado = r.qr;
        alvo.innerHTML = `<img src="${r.qr}" alt="QR code do WhatsApp"
                               width="240" height="240"
                               style="border-radius:12px;background:#fff;padding:8px">`;
      }
      tentativas = 0;   // enquanto há QR válido, não corre o relógio de falha
      return;
    }

    if (r && r.desligado){
      clearInterval(qrTimer);
      alvo.innerHTML = `<p>WhatsApp desligado neste servidor (WPP=0).<br>
        Reinicie com <code>node server.js</code> para conectar.</p>`;
      return;
    }

    // Sem imagem mas com o texto do QR: dá para gerar o código em qualquer
    // leitor, então mostramos em vez de travar a tela.
    if (r && !r.qr && r.texto){
      clearInterval(qrTimer);
      alvo.innerHTML = `<p>Não consegui desenhar a imagem do QR.
        Código para colar num gerador:</p>
        <textarea readonly rows="3"
          style="width:100%;max-width:420px;margin-top:10px;font:12px var(--mono)"
        >${esc(r.texto)}</textarea>`;
      return;
    }

    if (r && r.erro){
      clearInterval(qrTimer);
      alvo.innerHTML = `<p>${esc(r.erro)}</p>`;
      return;
    }

    tentativas++;
    alvo.innerHTML = `<p>Abrindo o WhatsApp… (${tentativas})</p>`;

    if (tentativas > 40){          // ~2 min
      clearInterval(qrTimer);
      alvo.innerHTML = `<p>O WhatsApp não respondeu. Veja o terminal do servidor.</p>`;
    }
  };

  await busca();
  qrTimer = setInterval(busca, 3000);
}

function abrirConversaWPP(numero) {
  estadoWPP.conversaAtual = numero;
  renderizarWhatsApp();
}

function pintarMensagensWPP(msgs){
  const area = $("#mensagensArea");
  if (!area) return;
  area.innerHTML = (msgs || []).map(m => `
    <div class="msg ${m.tipo === "saida" ? "saida" : "entrada"}">
      <div class="balao">
        ${esc(m.texto)}
        <div class="hora">${new Date(m.data)
          .toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}</div>
      </div>
    </div>`).join("");
  area.scrollTop = area.scrollHeight;
}

async function carregarMensagensWPP(numero) {
  try { pintarMensagensWPP(await API.obterConversa(numero)); }
  catch (_) {}
}

// Inicializar WhatsApp quando a página carregar
setTimeout(inicializarWhatsApp, 1000);

// Adicionar WhatsApp ao render()
const renderOriginal = render;
render = function() {
  renderOriginal.apply(this, arguments);
  
  // Ocultar/mostrar visões
  const VISOES = { leads:"visaoLeads", panorama:"visaoPanorama",
                   mapa:"visaoMapa", whatsapp:"visaoWhatsApp" };
  Object.keys(VISOES).forEach(v => {
    const el = document.getElementById(VISOES[v]);
    if (el) el.classList.toggle("ocultar", S.visao !== v);
  });

  if (S.visao === "whatsapp") {
    const comTel = S.leads.filter(l => temTel(l) && l.status !== "descartado").length;

    $("#tituloVisao").textContent = "WhatsApp";
    $("#subTitulo").textContent = estadoWPP.conectado
      ? `${comTel} leads com telefone`
      : "Aguardando conexão";

    renderizarWhatsApp();
    if (estadoWPP.conectado) acompanharConversas();
  }
};



/* ===== TEMA — claro é o padrão; escuro só quando o usuário liga ===== */

const TEMA = {
  get atual(){ return localStorage.getItem("prospec.tema") === "dark" ? "dark" : "light"; },

  aplica(t){
    const escuro = t === "dark";
    document.documentElement.setAttribute("data-theme", escuro ? "dark" : "light");
    localStorage.setItem("prospec.tema", escuro ? "dark" : "light");
    const m = $("#temaEstado");
    if (m) m.textContent = escuro ? "escuro" : "claro";
  },

  alterna(){
    TEMA.aplica(TEMA.atual === "dark" ? "light" : "dark");
    // O mapa tem seu próprio conjunto de tiles por tema.
    if (typeof desenharTiles === "function") desenharTiles();
  }
};

TEMA.aplica(TEMA.atual);

document.addEventListener("DOMContentLoaded", () => {
  TEMA.aplica(TEMA.atual);
  const b = $("#navTema");
  if (b) b.onclick = () => { SOM.toca("clique"); TEMA.alterna(); };
});

/* ===== MAPA REAL (Leaflet + tiles do OpenStreetMap) =====
   As coordenadas vêm de dados.json, gravadas uma vez por `node geocodificar.js`.
   Nada é geocodificado aqui na tela: seria uma consulta externa por lead a
   cada abertura, e o Nominatim limita a uma por segundo. */

let mapaLeaflet = null;
let mapaCamada  = null;

const temCoord = l => Number.isFinite(l.lat) && Number.isFinite(l.lon);

function renderMapaReal(){
  const ativos = S.leads.filter(l => l.status !== "descartado");
  const comCoord = ativos.filter(temCoord);
  const semCoord = ativos.filter(l => !temCoord(l));

  const precisos = comCoord.filter(l => l.geo_precisao === "endereco").length;
  const aprox    = comCoord.length - precisos;

  $("#visaoMapa").innerHTML = interruptorMapa() + `
    <div class="mapa-topo">
      <h2>Mapa</h2>
      <p>Posição real de cada lead, geocodificada a partir do endereço pelo
      OpenStreetMap. <b>${precisos}</b> localizados na porta exata e
      <b>${aprox}</b> apenas no bairro ou centro da cidade — estes aparecem com
      contorno tracejado, porque a coordenada é aproximada e seria desonesto
      desenhá-los como se fossem precisos.${semCoord.length
        ? ` <b>${semCoord.length}</b> sem endereço utilizável ficaram de fora.` : ""}</p>
    </div>

    <div class="mapa-caixa">
      <div id="mapaReal"></div>
      <div class="mapa-legenda">
        <span><i class="pin quente"></i>Quente</span>
        <span><i class="pin morno"></i>Morno</span>
        <span><i class="pin frio"></i>Frio</span>
        <span><i class="pin aprox"></i>Posição aproximada</span>
      </div>
    </div>`;

  ligarInterruptorMapa();

  if (typeof L === "undefined"){
    $("#mapaReal").innerHTML = `<p class="mapa-erro">A biblioteca do mapa não carregou.</p>`;
    return;
  }
  if (!comCoord.length){
    $("#mapaReal").innerHTML = `<p class="mapa-erro">Nenhum lead tem coordenada ainda.
      Rode <code>node geocodificar.js</code> na pasta do projeto.</p>`;
    return;
  }

  // O mapa é recriado a cada render da visão; o container é novo toda vez.
  if (mapaLeaflet){ mapaLeaflet.remove(); mapaLeaflet = null; }

  mapaLeaflet = L.map("mapaReal", { scrollWheelZoom: true, attributionControl: true });

  /* Tiles neutros em vez do OSM padrão: o mapa colorido brigava com o cinza
     do app — verde de mata, azul de água, rodovia vermelha, tudo saturado ao
     lado de uma interface sem cor. O Carto tem duas variantes de mesma
     geometria, uma clara e uma escura, então o mapa acompanha o tema em vez
     de ser um retângulo alheio no meio da tela. */
  desenharTiles();

  mapaCamada = L.layerGroup().addTo(mapaLeaflet);

  comCoord.forEach(l => {
    const faixa = faixaDe(l);
    const aproximado = l.geo_precisao !== "endereco";

    const marca = L.divIcon({
      className: "",
      html: `<span class="pin ${faixa} ${aproximado ? "aprox" : ""}"></span>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    L.marker([l.lat, l.lon], { icon: marca, title: l.nome })
      .addTo(mapaCamada)
      .bindPopup(popupLead(l, aproximado))
      .on("popupopen", e => {
        const b = e.popup.getElement().querySelector("[data-abrir]");
        if (b) b.onclick = () => abrirPainel(+b.dataset.abrir);
      });
  });

  // Enquadra todos os pontos, com uma folga para os pinos não colarem na borda.
  const limites = L.latLngBounds(comCoord.map(l => [l.lat, l.lon]));
  mapaLeaflet.fitBounds(limites, { padding: [42, 42], maxZoom: 16 });

  // O Leaflet mede o container na criação; se a aba abriu com ele oculto ou
  // em transição, a medida sai errada e o mapa aparece cortado.
  setTimeout(() => mapaLeaflet && mapaLeaflet.invalidateSize(), 220);
}

/* Trocar de tema troca o conjunto de tiles. Guardamos a camada para poder
   remover a anterior — sem isso as duas ficariam empilhadas. */
let mapaTiles = null;

function desenharTiles(){
  if (!mapaLeaflet) return;
  if (mapaTiles) mapaLeaflet.removeLayer(mapaTiles);

  /* OSM padrão. Tentei os basemaps do Carto, que nascem neutros, mas eles
     passaram a exigir chave de API e estampam "API KEY REQUIRED" sobre o
     mapa. O OSM não pede chave; o ajuste de tema vai por filtro CSS
     (ver .leaflet-tile-pane em styles.css). */
  mapaTiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; colaboradores do OpenStreetMap'
  }).addTo(mapaLeaflet);
}

function popupLead(l, aproximado){
  return `<div class="mapa-pop">
    <b>${esc(l.nome)}</b>
    <span class="cat">${esc(CATEGORIAS[l.categoria] || "Outro")} · score ${scoreDe(l)}</span>
    <span>${esc(l.endereco || "endereço não informado")}${l.bairro ? ` · ${esc(l.bairro)}` : ""}</span>
    ${temTel(l) ? `<span>${esc(l.telefone)}</span>` : ""}
    ${aproximado ? `<span class="aviso-aprox">posição aproximada (${esc(l.geo_precisao || "?")})</span>` : ""}
    <button class="botao" data-abrir="${l.id}">Ver lead</button>
  </div>`;
}
