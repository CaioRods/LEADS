/* geocodificar.js — descobre a coordenada de cada lead a partir do endereço.

   Usa o Nominatim (OpenStreetMap), que é gratuito mas pede duas coisas na
   política de uso: no máximo uma consulta por segundo e um User-Agent que
   identifique quem está chamando. Ambas respeitadas abaixo.

   O resultado é gravado em dados.json (lat/lon/geo_em), então isto roda uma
   vez por lead e nunca mais. Leads já resolvidos são pulados.

   Uso:  node geocodificar.js          (só os que faltam)
         node geocodificar.js --tudo   (refaz todos)                        */

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
const UA = 'ProspecApp/1.0 (uso pessoal, prospeccao local)';
const refazerTudo = process.argv.includes('--tudo');

const espera = ms => new Promise(r => setTimeout(r, ms));

function buscar(consulta){
  const url = 'https://nominatim.openstreetmap.org/search'
    + '?format=json&limit=1&countrycodes=br&q=' + encodeURIComponent(consulta);

  return new Promise(resolve => {
    execFile('curl', ['-s', '--max-time', '20', '-A', UA, url],
      { maxBuffer: 4 * 1024 * 1024 }, (err, saida) => {
        if (err) return resolve(null);
        try {
          const r = JSON.parse(saida);
          if (!Array.isArray(r) || !r.length) return resolve(null);
          resolve({ lat: +r[0].lat, lon: +r[0].lon, achado: r[0].display_name });
        } catch (_) { resolve(null); }
      });
  });
}

/* Do mais específico para o mais genérico: se a rua com número não existe no
   mapa, ainda é melhor cair no bairro do que não ter ponto nenhum. Cada nível
   registra sua própria precisão, para o mapa poder ser honesto sobre isso. */
function tentativas(l){
  const cidade = l.cidade && !/capital/i.test(l.cidade) ? l.cidade : 'Presidente Prudente';
  const uf = 'SP';
  const rua = (l.endereco || '').replace(/·.*$/, '').trim();

  const lista = [];
  if (rua) lista.push({ q: `${rua}, ${cidade}, ${uf}`, precisao: 'endereco' });
  if (l.bairro) lista.push({ q: `${l.bairro}, ${cidade}, ${uf}`, precisao: 'bairro' });
  lista.push({ q: `${cidade}, ${uf}`, precisao: 'cidade' });
  return lista;
}

(async () => {
  const dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const leads = dados.leads || [];

  const pendentes = leads.filter(l =>
    refazerTudo || !(Number.isFinite(l.lat) && Number.isFinite(l.lon)));

  console.log(`${pendentes.length} lead(s) para geocodificar de ${leads.length}.`);
  if (!pendentes.length) return;
  console.log('Uma consulta por segundo (política do Nominatim) — '
    + `estimativa: ${Math.ceil(pendentes.length * 1.1 / 60)} min.\n`);

  let ok = 0, falhou = 0;

  for (let i = 0; i < pendentes.length; i++){
    const l = pendentes[i];
    let achou = null;

    for (const t of tentativas(l)){
      const r = await buscar(t.q);
      await espera(1100);              // o limite é por consulta, não por lead
      if (r){ achou = { ...r, precisao: t.precisao }; break; }
    }

    if (achou){
      l.lat = achou.lat;
      l.lon = achou.lon;
      l.geo_precisao = achou.precisao;
      l.geo_em = new Date().toISOString();
      ok++;
    } else {
      l.geo_precisao = 'nao encontrado';
      falhou++;
    }

    const marca = achou ? achou.precisao : 'falhou';
    console.log(`[${i + 1}/${pendentes.length}] ${l.nome} → ${marca}`);

    // Grava a cada 10, para uma interrupção não jogar fora o trabalho feito.
    if (i % 10 === 9) fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));
  }

  fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));
  console.log(`\nPronto: ${ok} localizados, ${falhou} sem coordenada.`);
})();
