/* funcionamento.js — descobre horário de funcionamento e se a empresa ainda
   existe, gravando em dados.json.

   POR QUE GOOGLE E NÃO OPENSTREETMAP
   Tentei primeiro o Overpass (OSM), que já usamos para as coordenadas.
   Medido numa amostra de 6 leads: 269 locais mapeados na região, apenas 1
   com `opening_hours`. Cobertura de 0,4% — inútil para isto. E o OSM não
   tem noção de "empresa fechou": simplesmente deixa de existir o registro,
   o que é indistinguível de nunca ter sido mapeado.

   O Google Places mantém os dois campos de que precisamos:
     businessStatus  → OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY
     regularOpeningHours → as faixas por dia da semana

   PRECISA DE UMA CHAVE. Crie em console.cloud.google.com (Places API New),
   e rode assim:
     GOOGLE_MAPS_KEY=sua-chave node funcionamento.js
     GOOGLE_MAPS_KEY=sua-chave node funcionamento.js --tudo   (refaz todos)

   O plano gratuito do Google cobre bem mais que os ~110 leads desta base.  */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

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
const CHAVE = process.env.GOOGLE_MAPS_KEY;
const refazer = process.argv.includes('--tudo');

if (!CHAVE) {
  console.error('Falta a chave. Rode:  GOOGLE_MAPS_KEY=sua-chave node funcionamento.js');
  process.exit(1);
}

const espera = ms => new Promise(r => setTimeout(r, ms));
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

function pedir(url, corpo, cabecalhos) {
  return new Promise(resolve => {
    const args = ['-s', '--max-time', '25', '-X', 'POST', url,
      '-H', 'Content-Type: application/json'];
    for (const c of cabecalhos) args.push('-H', c);
    args.push('-d', JSON.stringify(corpo));

    execFile('curl', args, { maxBuffer: 8e6 }, (err, saida) => {
      if (err) return resolve(null);
      try { resolve(JSON.parse(saida)); } catch (_) { resolve(null); }
    });
  });
}

/* Busca por texto: nome + endereço. Devolve o primeiro resultado, que para
   um nome próprio somado ao endereço é confiável o bastante. */
async function procurar(l) {
  const consulta = [l.nome, l.endereco, l.cidade, 'SP'].filter(Boolean).join(', ');

  const r = await pedir('https://places.googleapis.com/v1/places:searchText',
    { textQuery: consulta, languageCode: 'pt-BR', maxResultCount: 1 },
    [`X-Goog-Api-Key: ${CHAVE}`,
     'X-Goog-FieldMask: places.id,places.displayName,places.businessStatus,' +
     'places.regularOpeningHours,places.formattedAddress,places.websiteUri']);

  if (!r || !Array.isArray(r.places) || !r.places.length) return null;
  return r.places[0];
}

const SITUACAO = {
  OPERATIONAL:        'ativa',
  CLOSED_TEMPORARILY: 'fechada_temp',
  CLOSED_PERMANENTLY: 'fechada_permanente'
};

/* O Google devolve os períodos com dia 0=domingo e hora/minuto separados.
   Convertemos para o formato do app: { seg: [["08:00","18:00"]], ... } */
function converterHorarios(oh) {
  if (!oh || !Array.isArray(oh.periods)) return null;

  const saida = {};
  DIAS.forEach(d => saida[d] = []);

  for (const p of oh.periods) {
    const abre = p.open, fecha = p.close;
    if (!abre || typeof abre.day !== 'number') continue;

    const dia = DIAS[abre.day];
    const hh = v => String(v.hour ?? 0).padStart(2, '0') + ':' +
                    String(v.minute ?? 0).padStart(2, '0');

    // Sem `close` o Google indica funcionamento 24h.
    saida[dia].push(fecha ? [hh(abre), hh(fecha)] : ['00:00', '23:59']);
  }
  return saida;
}

(async () => {
  const dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const leads = dados.leads || [];

  const pendentes = leads.filter(l =>
    l.nome !== 'teste' && (refazer || !l.verificado_em));

  console.log(`${pendentes.length} lead(s) a verificar de ${leads.length}.\n`);
  if (!pendentes.length) return;

  let achados = 0, encerradas = 0, comHorario = 0, semResultado = 0, corrigidos = 0;

  for (let i = 0; i < pendentes.length; i++) {
    const l = pendentes[i];
    const lugar = await procurar(l);
    await espera(220);                    // folga entre chamadas

    if (!lugar) {
      l.situacao = 'desconhecida';
      l.verificado_em = new Date().toISOString();
      semResultado++;
      console.log(`[${i + 1}/${pendentes.length}] ${l.nome} → não encontrado`);
      continue;
    }

    achados++;
    l.situacao = SITUACAO[lugar.businessStatus] || 'desconhecida';
    l.google_id = lugar.id;
    l.verificado_em = new Date().toISOString();

    const horarios = converterHorarios(lugar.regularOpeningHours);
    if (horarios) { l.horarios = horarios; comHorario++; }
    if (l.situacao === 'fechada_permanente') encerradas++;

    /* O site é o campo mais pesado do score (+30 por não ter), e era o menos
       verificado: veio do diretório que originou a base e nunca foi conferido.
       Uma amostra manual já achou empresa marcada como "nenhum" que tem site
       — cada uma dessas carrega 30 pontos indevidos e sobe na fila na frente
       de lead melhor. Aqui ele passa a vir do Google, que é quem a própria
       empresa atualiza.

       Só sobrescrevemos quando o Google TEM a informação: ausência no Google
       não é prova de ausência de site, e apagar um site já conhecido por
       causa disso seria trocar um dado bom por um vazio. */
    if (lugar.websiteUri) {
      const antes = (l.site || '').trim();
      const novo = lugar.websiteUri;
      if (!antes || antes.toLowerCase() === 'nenhum') { l.site = novo; corrigidos++; }
      l.site_verificado_em = new Date().toISOString();
    } else if (!(l.site || '').trim()) {
      l.site = 'nenhum';
      l.site_verificado_em = new Date().toISOString();
    }

    const marca = l.situacao === 'ativa'
      ? (horarios ? 'ativa, com horário' : 'ativa, sem horário')
      : l.situacao;
    console.log(`[${i + 1}/${pendentes.length}] ${l.nome} → ${marca}`);

    if (i % 10 === 9) fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));
  }

  fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));

  console.log(`\nResumo: ${achados} encontrados, ${semResultado} sem resultado.`);
  console.log(`${comHorario} com horário, ${encerradas} fechadas em definitivo.`);
  if (corrigidos) console.log(`${corrigidos} tinham site sem estar registrado — ` +
    `corrigidos, e o score deles cai 30 pontos. Rode \`node score.js\` para repontuar.`);
})();
