/* atualizar-app.js — troca o código dentro do ProspecApp já instalado.

   Reconstruir com o electron-builder leva minutos, quase todos gastos
   baixando o Electron, comprimindo o .zip e montando o .dmg — nada disso
   muda quando só o código do app mudou. Aqui reempacotamos apenas o
   app.asar e o colocamos no lugar. Leva segundos.

   Uso:  node atualizar-app.js            (atualiza dist/mac/ProspecApp.app)
         node atualizar-app.js /Applications/ProspecApp.app

   Quando usar o build completo: ao mudar dependências nativas, o ícone, a
   versão, ou para gerar um .dmg novo para distribuir.                     */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ARQUIVOS = [
  'main.js', 'preload.js', 'server.js', 'index.html', 'styles.css',
  'app-web.js', 'score.js', 'buscar-fotos.js', 'geocodificar.js',
  'wa-worker.js', 'wa-ponte.js', 'package.json', 'dados.json'
];

const alvo = process.argv[2] || path.join(__dirname, 'dist', 'mac', 'ProspecApp.app');
const recursos = path.join(alvo, 'Contents', 'Resources');

if (!fs.existsSync(recursos)) {
  console.error(`Não achei o app em ${alvo}`);
  console.error('Rode `npx electron-builder --mac` uma vez antes.');
  process.exit(1);
}

/* A área de montagem é reaproveitada entre execuções. Copiar os 209 MB de
   node_modules toda vez levava 45s; eles só mudam quando o package.json
   muda, então guardamos e reusamos. Assim uma atualização de código vira
   questão de segundos. */
const temp = path.join(__dirname, '.cache-atualizacao');
fs.mkdirSync(temp, { recursive: true });

const selo = path.join(temp, '.selo-deps');
const assinatura = fs.statSync(path.join(__dirname, 'package.json')).mtimeMs.toString();
const depsValidas = fs.existsSync(selo) && fs.readFileSync(selo, 'utf8') === assinatura
                    && fs.existsSync(path.join(temp, 'node_modules'));

console.log('Montando o pacote…');
for (const f of ARQUIVOS) {
  if (fs.existsSync(path.join(__dirname, f))) {
    fs.copyFileSync(path.join(__dirname, f), path.join(temp, f));
  }
}

// assets é pequeno e muda com o ícone: sempre atualiza
fs.rmSync(path.join(temp, 'assets'), { recursive: true, force: true });
fs.cpSync(path.join(__dirname, 'assets'), path.join(temp, 'assets'), { recursive: true });

if (depsValidas) {
  console.log('Dependências reaproveitadas do cache.');
} else {
  console.log('Copiando dependências (só desta vez)…');
  fs.rmSync(path.join(temp, 'node_modules'), { recursive: true, force: true });
  fs.cpSync(path.join(__dirname, 'node_modules'), path.join(temp, 'node_modules'),
            { recursive: true });
  fs.writeFileSync(selo, assinatura);
}

/* O worker e o Puppeteer precisam existir como arquivos de verdade, fora do
   asar — é a mesma lista de asarUnpack do package.json. */
/* O worker é aberto por fork(), que não enxerga dentro do asar; a baileys
   traz binário nativo. Os dois precisam existir como arquivos de verdade. */
const forcarFora = ['wa-worker.js', 'node_modules/sharp', 'node_modules/@img',
                    'node_modules/baileys'];

console.log('Empacotando o app.asar…');
execFileSync('npx', ['asar', 'pack', temp, path.join(recursos, 'app.asar'),
  '--unpack-dir', '{' + forcarFora.join(',') + '}'],
  { stdio: 'inherit', cwd: __dirname });

console.log(`\nPronto. ${path.basename(alvo)} atualizado.`);
console.log('Feche e abra o app para ver as mudanças.');
