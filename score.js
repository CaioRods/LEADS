// Calcula a chance de conversão de cada lead e grava de volta em dados.json.
// Modelo aberto de propósito: cada ponto é rastreável até um fato pesquisado.
const fs = require('fs');
const path = require('path');
/* O app empacotado lê de ~/Library/Application Support/ProspecApp, não do
   dados.json do projeto. Um script que escreve sempre no projeto faz os dois
   divergirem em silêncio — foi o que aconteceu: o score recalculado aqui
   nunca chegava ao app. Agora seguimos o mesmo arquivo que o app usa, com
   PROSPEC_DADOS podendo apontar para outro. */
const arquivo = (() => {
  if (process.env.PROSPEC_DADOS) return process.env.PROSPEC_DADOS;
  const doApp = path.join(require('os').homedir(), 'Library', 'Application Support',
                          'ProspecApp', 'dados.json');
  return require('fs').existsSync(doApp) ? doApp : path.join(__dirname, 'dados.json');
})();

/* Este arquivo tem dois usos: rodar como script (`node score.js`, que
   repontua a base inteira e imprime a tabela) e ser importado por quem
   precisa pontuar UM lead — o servidor MCP faz isso ao criar um lead novo.
   Ler o dados.json no topo quebrava o segundo uso, então a leitura desceu
   para dentro do bloco de script.                                        */

/* Onde você atende: escritório na Av. Manoel Goulart, Presidente Prudente.
   PROSPEC_BASE permite mover sem mexer no código ("lat,lon"). */
const MEU_PONTO = (() => {
  const v = (process.env.PROSPEC_BASE || '').split(',').map(Number);
  return v.length === 2 && v.every(Number.isFinite)
    ? { lat: v[0], lon: v[1] }
    : { lat: -22.1184919, lon: -51.4157624 };
})();

/* Distância em linha reta, em km. Prudente é plana e compacta o bastante
   para a linha reta ser um bom proxy do trajeto real — e é medida, ao
   contrário do palpite por nome de bairro que havia aqui antes: "Centro"
   valia +15 e "Vila Santa Helena" valia +5, sendo que as duas ficam na mesma
   avenida, a quarteirões uma da outra. */
function distanciaKm(lat, lon){
  const R = 6371;
  const rad = g => g * Math.PI / 180;
  const dLat = rad(lat - MEU_PONTO.lat);
  const dLon = rad(lon - MEU_PONTO.lon);
  const a = Math.sin(dLat/2) ** 2 +
            Math.cos(rad(MEU_PONTO.lat)) * Math.cos(rad(lat)) * Math.sin(dLon/2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const ROI = {
  restaurante: 15, loja: 15, salao_beleza: 14, bar: 13,
  oficina: 12, padaria: 11, supermercado: 9, farmacia: 7, outro: 5
};

/* Níveis 2 a 6, do mais perto ao mais longe — a interface usa este número
   para as barrinhas de proximidade, então a escala foi mantida. */
function nivelProx(l){
  if ((l.cidade || "").includes("capital")) return 6;          // São Paulo capital
  if (/rural|Espigão/i.test((l.bairro || "").trim())) return 5; // Zona rural

  if (Number.isFinite(l.lat) && Number.isFinite(l.lon)) {
    const d = distanciaKm(l.lat, l.lon);
    if (d <= 1.5) return 2;      // dá para ir a pé
    if (d <= 4)   return 3;      // qualquer hora do dia
    return 4;                    // outro canto da cidade
  }

  // Sem coordenada, cai no bairro — menos preciso, mas melhor que nada.
  const b = (l.bairro || "").trim();
  if (/^Centro$|Santa Helena/i.test(b)) return 3;
  return 4;
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

  /* 2. Ele precisa mesmo do que você vende? (0-30)

     Site ruim vale quase tanto quanto site nenhum, e por um motivo comercial:
     quem tem site ruim JÁ PAGOU por um site. Não precisa ser convencido de
     que vale a pena ter presença online — só de que dá para ser melhor. Essa
     conversa é mais curta que a de quem nunca comprou, e o orçamento já
     existe no bolso dele. Por isso 25, não 10.

     `site_qualidade` é preenchido pela verificação (subagentes ou Google
     Places); quando falta, caímos nas heurísticas antigas de texto. */
  const site = (l.site || '').toLowerCase();
  const qual = (l.site_qualidade || '').toLowerCase();

  if (site === 'nenhum' || !site)           { s += 30; m.push('nenhum site (+30)'); }
  else if (qual === 'morto')                { s += 28; m.push('site fora do ar — pagou por um e hoje não tem nada (+28)'); }
  else if (qual === 'ruim')                 { s += 25; m.push('site ruim — já paga por um, dá para fazer melhor (+25)'); }
  else if (site.includes('portal') || site.includes('goomer'))
                                            { s += 15; m.push('só plataforma alugada, sem domínio próprio (+15)'); }
  else if (site.includes('rede') || site === 'desatualizado')
                                            { s += 10; m.push('site de rede/desatualizado (+10)'); }
  else if (qual === 'bom')                  { m.push('já tem site bom (+0)'); }
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

  // 6. Proximidade do escritório (0-15)
  const prox = nivelProx(l);
  const proxPts = prox === 2 ? 15 : prox === 3 ? 10 : prox === 4 ? 5 : 0;
  if (proxPts) {
    s += proxPts;
    const km = Number.isFinite(l.lat) && Number.isFinite(l.lon)
      ? ` (${distanciaKm(l.lat, l.lon).toFixed(1)} km)` : '';
    const proxNome = {2:"a poucos minutos do escritório",
                      3:"perto do escritório",
                      4:"em Presidente Prudente"}[prox];
    m.push(`${proxNome}${km} (+${proxPts})`);
  }

  // Corte geográfico: fora da cidade não entra no ranking
  if ((l.cidade || '').includes('capital')) {
    return { score: 0, motivos: ['FORA DE ÁREA: São Paulo capital, ~570 km — não pontua'] };
  }
  return { score: Math.min(s, 100), motivos: m };
}

module.exports = { pontuar, nivelProx, ROI, distanciaKm, MEU_PONTO };

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
