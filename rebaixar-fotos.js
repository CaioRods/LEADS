/* Rebaixa as fotos a partir de foto_fonte.
   A base declarava assets/logos/<id>.<ext> mas os arquivos não existiam: a
   renumeração dos leads deixou as imagens antigas com nome de outro id, e as
   novas nunca chegaram (imagem fica fora do versionamento). As URLs de origem
   estão guardadas em foto_fonte, então dá para reconstruir tudo. */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const base = process.env.PROSPEC_DADOS
          || path.join(os.homedir(), 'AppData', 'Roaming', 'prospecapp', 'dados.json');
const dir = path.join(__dirname, 'assets', 'logos');
fs.mkdirSync(dir, { recursive: true });

const baixar = url => new Promise(r =>
  execFile('curl', ['-sL', '--max-time', '25', '-A', UA, '--max-filesize', '5000000', url],
    { encoding: 'buffer', maxBuffer: 10e6 }, (e, out) => r(e ? null : out)));

const extDe = buf => {
  const t = buf.slice(0, 4).toString('hex');
  return t.startsWith('ffd8') ? 'jpg' : t.startsWith('8950') ? 'png'
       : t.startsWith('5249') ? 'webp' : null;
};

(async () => {
  const dados = JSON.parse(fs.readFileSync(base, 'utf-8'));
  const alvos = dados.leads.filter(l => l.foto_fonte);
  console.log(`base: ${base}`);
  console.log(`${dados.leads.length} leads · ${alvos.length} com origem de foto\n`);

  let ok = 0, falhou = 0;
  for (const l of alvos) {
    // já existe em disco e confere? pula
    if (l.logo && fs.existsSync(path.join(__dirname, l.logo))) { ok++; continue; }

    const buf = await baixar(l.foto_fonte);
    if (!buf || buf.length < 1500) {
      falhou++; l.logo = '';
      console.log(`  --  ${String(l.id).padEnd(6)} ${l.nome.slice(0, 40)}`);
      continue;
    }
    const ext = extDe(buf);
    if (!ext) { falhou++; l.logo = ''; continue; }

    const rel = `assets/logos/${l.id}.${ext}`;
    fs.writeFileSync(path.join(__dirname, rel), buf);
    l.logo = rel;
    ok++;
    console.log(`  OK  ${String(l.id).padEnd(6)} ${String(Math.round(buf.length/1024)).padStart(4)}kb  ${l.nome.slice(0, 40)}`);
  }

  fs.writeFileSync(base, JSON.stringify(dados, null, 2), 'utf-8');
  console.log(`\n${ok} com foto em disco · ${falhou} sem (o cartão usa a capa do ramo)`);
})();
