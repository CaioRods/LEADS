/* Busca foto de cada lead e só aceita quando a URL da imagem prova que é ele.
   O critério: a URL precisa conter palavras distintivas do nome do negócio.
   Sem prova, não preenche — imagem errada num arquivo de prospecção é pior
   que imagem nenhuma. O que não passar fica para escolha manual no app. */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const arquivo = path.join(__dirname, 'dados.json');
const dir = path.join(__dirname, 'assets', 'logos');
fs.mkdirSync(dir, { recursive: true });

const sh = (args, bin) => new Promise(r =>
  execFile('curl', args, { encoding: bin ? 'buffer' : 'utf8', maxBuffer: 14e6 },
    (e, out) => r(e ? null : out)));

const slug = s => String(s).toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

const GENERICAS = new Set(['de','da','do','das','dos','e','a','o','ltda','me','epp','mei',
  'panificadora','padaria','restaurante','bar','lanchonete','pizzaria','salao','beleza',
  'oficina','mecanica','auto','drogaria','farmacia','supermercado','mercado','loja',
  'comercio','industria','grupo','centro','automotivo','imobiliaria','cafe','casa','carnes']);

/* palavras que identificam ESTE negócio e não a categoria dele */
function distintivas(nome){
  return slug(nome).split(' ').filter(w => w.length >= 4 && !GENERICAS.has(w));
}

async function candidatos(termo){
  const url = 'https://www.bing.com/images/search?q=' + encodeURIComponent(termo) + '&form=HDRSC2';
  const html = await sh(['-sL','--max-time','25','-A',UA,url]);
  if (!html) return [];
  const vistos = new Set(), out = [];
  const re = /murl&quot;:&quot;(.*?)&quot;/g;
  let m;
  while ((m = re.exec(html)) && out.length < 24){
    const u = m[1].replace(/\\u002f/g,'/').replace(/\\/g,'');
    if (!/^https?:\/\//.test(u) || !/\.(jpe?g|png|webp)(\?|$)/i.test(u)) continue;
    if (vistos.has(u)) continue;
    vistos.add(u); out.push(u);
  }
  return out;
}

/* prova = a URL da imagem carrega o nome do negócio */
function provar(url, palavras){
  const u = slug(decodeURIComponent(url));
  const achadas = palavras.filter(p => u.includes(p));
  return { n: achadas.length, quais: achadas };
}

(async () => {
  const dados = JSON.parse(fs.readFileSync(arquivo, 'utf-8'));
  const alvos = dados.leads.filter(l => !l.logo);
  console.log(`${alvos.length} leads sem imagem. Buscando…\n`);

  let ok = 0, semProva = 0;
  const pendentes = [];

  for (const l of alvos){
    const palavras = distintivas(l.nome);
    if (!palavras.length){ semProva++; pendentes.push(l.nome); continue; }

    const cidade = (l.cidade || '').includes('capital') ? 'São Paulo' : (l.cidade || 'Presidente Prudente');
    const cands = await candidatos(`${l.nome} ${cidade} SP`);

    let melhor = null;
    for (const u of cands){
      const p = provar(u, palavras);
      if (p.n >= 1 && (!melhor || p.n > melhor.p.n)) melhor = { u, p };
      if (melhor && melhor.p.n >= 2) break;
    }

    if (!melhor){
      semProva++; pendentes.push(l.nome);
      console.log(`  --  ${l.nome.slice(0,44).padEnd(46)} ${cands.length} candidatos, nenhum comprova`);
      continue;
    }

    const buf = await sh(['-sL','--max-time','25','-A',UA,'--max-filesize','4000000',melhor.u], true);
    if (!buf || buf.length < 2000){ semProva++; pendentes.push(l.nome); continue; }
    const t = buf.slice(0,4).toString('hex');
    const ext = t.startsWith('ffd8') ? 'jpg' : t.startsWith('8950') ? 'png'
              : t.startsWith('5249') ? 'webp' : null;
    if (!ext){ semProva++; pendentes.push(l.nome); continue; }

    const rel = `assets/logos/${l.id}.${ext}`;
    fs.writeFileSync(path.join(__dirname, rel), buf);
    l.logo = rel;
    l.foto_fonte = melhor.u;
    ok++;
    console.log(`  OK  ${l.nome.slice(0,44).padEnd(46)} ${String(Math.round(buf.length/1024)).padStart(4)}kb  prova: ${melhor.p.quais.join('+')}`);
  }

  fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2), 'utf-8');
  console.log(`\n${ok} com foto comprovada · ${semProva} sem prova (escolha manual no app)`);
  if (pendentes.length) console.log('\nSem foto:\n  ' + pendentes.join('\n  '));
})();
