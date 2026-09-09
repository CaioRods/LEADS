// Calcula a chance de conversão de cada lead e grava de volta em dados.json.
// Modelo aberto de propósito: cada ponto é rastreável até um fato pesquisado.
const fs = require('fs');
const path = require('path');
const arquivo = path.join(__dirname, 'dados.json');

/* Este arquivo tem dois usos: rodar como script (`node score.js`, que
   repontua a base inteira e imprime a tabela) e ser importado por quem
   precisa pontuar UM lead — o servidor MCP faz isso ao criar um lead novo.
   Ler o dados.json no topo quebrava o segundo uso, então a leitura desceu
   para dentro do bloco de script.                                        */

// Localização do vendedor: Regente Feijó
const MEU_BAIRRO = "Centro";
const MEU_BAIRRO_ALT = "";

const ROI = {
  restaurante: 15, loja: 15, salao_beleza: 14, bar: 13,
  oficina: 12, padaria: 11, supermercado: 9, farmacia: 7, outro: 5
};

function nivelProx(l){
  const b = (l.bairro || "").trim();
  if ((l.cidade || "").includes("capital")) return 6;  // São Paulo capital
  if (/rural|Espigão/i.test(b)) return 5;               // Zona rural
  if (b === MEU_BAIRRO || b === MEU_BAIRRO_ALT) return 2;  // Mesmo bairro
  if (b === "Centro") return 3;                         // Centro (próximo)
  return b ? 4 : 4;                                      // Outro bairro
}

function pontuar(l) {
  const m = [];
  let s = 0;

  // 1. Dá para falar com ele hoje? (0-25)
  const truncado = /^\(\d{2}\) \d{5}-\d{3}$/.test(l.telefone || '');
  if (l.telefone && !truncado) { s += 25; m.push('telefone confirmado (+25)'); }
  else if (truncado)           { s += 13; m.push('telefone truncado, confirmar ao discar (+13)'); }
  else if (l.instagram)        { s += 15; m.push('sem telefone, mas dá para chamar no direct (+15)'); }
  else if (l.facebook)         { s += 12; m.push('sem telefone, mas tem Facebook (+12)'); }
  else                         { m.push('sem canal de contato (+0)'); }

  // 2. Ele precisa mesmo do que você vende? (0-30)
  const site = (l.site || '').toLowerCase();
  if (site === 'nenhum')                    { s += 30; m.push('nenhum site (+30)'); }
  else if (site.includes('portal') || site.includes('goomer'))
                                            { s += 15; m.push('só plataforma alugada, sem domínio próprio (+15)'); }
  else if (site.includes('rede') || site === 'desatualizado')
                                            { s += 10; m.push('site de rede/desatualizado (+10)'); }
  else                                      { m.push('já tem site próprio (+0)'); }

  // 3. Já acredita em presença digital? (0-20) — melhor previsor de conversa fácil
  if (l.instagram)    { s += 20; m.push('Instagram ativo: já investe em presença (+20)'); }
  else if (l.facebook){ s += 13; m.push('tem Facebook (+13)'); }
  else                { s += 4;  m.push('nenhuma rede encontrada (+4)'); }

  // 4. O que um site faz por essa categoria — porte grande vale o teto (0-15)
  const roi = l.porte === 'grande' ? 15 : (ROI[l.categoria] ?? 5);
  s += roi;
  m.push(l.porte === 'grande'
    ? `empresa de grande porte, ticket alto (+${roi})`
    : `retorno da categoria ${l.categoria} (+${roi})`);

  // 5. Porte e reputação (0-10)
  const anos = l.fundacao ? 2026 - parseInt(l.fundacao, 10) : 0;
  if (l.porte === 'grande')
                       { s += 10; m.push('uma das maiores empresas da cidade (+10)'); }
  else if (/1º lugar|1o lugar|4,6|4,7|4,8|4,9|5\/5/.test(l.avaliacao || ''))
                       { s += 10; m.push('destaque de reputação na cidade (+10)'); }
  else if (anos >= 15) { s += 7;  m.push(`${anos} anos de casa (+7)`); }
  else if (l.cnpj)     { s += 5;  m.push('empresa formalizada, CNPJ conhecido (+5)'); }
  else                 { s += 2;  m.push('porte não confirmado (+2)'); }

  // 6. Proximidade de Regente Feijó (0-15) — novo critério
  const prox = nivelProx(l);
  const proxPts = prox === 2 ? 15 : prox === 3 ? 10 : prox === 4 ? 5 : 0;
  if (proxPts) {
    s += proxPts;
    const proxNome = {2:"mesmo bairro",3:"Centro próximo",4:"outro bairro"}[prox];
    m.push(`${proxNome} de Regente Feijó (+${proxPts})`);
  }

  // Corte geográfico: fora da cidade não entra no ranking
  if ((l.cidade || '').includes('capital')) {
    return { score: 0, motivos: ['FORA DE ÁREA: São Paulo capital, ~570 km — não pontua'] };
  }
  return { score: Math.min(s, 100), motivos: m };
}

module.exports = { pontuar, nivelProx, ROI };

if (require.main === module) {
  const dados = JSON.parse(fs.readFileSync(arquivo, 'utf-8'));

  dados.leads.forEach(l => {
    const { score, motivos } = pontuar(l);
    l.score = score;
    l.motivos = motivos;
  });

  // Ordena por: status ativo → score descrescente → proximidade
  const ordem = { novo: 0, contatado: 1, agendado: 2, proposta: 3, vendido: 4, descartado: 9 };
  dados.leads.sort((a, b) =>
    (ordem[a.status] ?? 5) - (ordem[b.status] ?? 5) ||
    b.score - a.score ||
    nivelProx(a) - nivelProx(b) ||
    a.nome.localeCompare(b.nome, 'pt-BR')
  );

  fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2), 'utf-8');

  const ativos = dados.leads.filter(l => l.status !== 'descartado');
  const faixa = n => n >= 70 ? 'QUENTE' : n >= 50 ? 'MORNO' : 'FRIO';
  console.log(`${dados.leads.length} leads · ${ativos.length} ativos\n`);
  console.log('POS  SCORE  FAIXA    LEAD                                      TELEFONE          REDE');
  console.log('─'.repeat(100));
  ativos.forEach((l, i) => {
    const rede = l.instagram || (l.facebook ? 'Facebook' : '—');
    console.log(
      String(i + 1).padStart(3) + '  ' +
      String(l.score).padStart(5) + '  ' +
      faixa(l.score).padEnd(8) +
      l.nome.slice(0, 40).padEnd(42) +
      (l.telefone || '—').padEnd(18) +
      rede.slice(0, 24)
    );
  });
  const q = ativos.filter(l => l.score >= 70).length;
  const mo = ativos.filter(l => l.score >= 50 && l.score < 70).length;
  console.log(`\nQUENTES (≥70): ${q}   MORNOS (50-69): ${mo}   FRIOS (<50): ${ativos.length - q - mo}`);

}
