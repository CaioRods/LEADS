/* fazer-icone.js — transforma LOGO.png num ícone no padrão macOS.

   O arquivo original é um quadrado sem transparência: os cantos são brancos.
   Jogado no Dock desse jeito, ele vira um quadrado branco, ignorando o
   desenho arredondado. Aqui aplicamos as duas convenções da Apple:

   1. Máscara em "squircle" (superelipse), que é a silhueta real dos ícones
      do macOS — não um retângulo de cantos arredondados comuns.
   2. A arte ocupa 824 de 1024 px, deixando a margem transparente que o
      sistema espera. Sem ela o ícone fica visivelmente maior que os vizinhos
      no Dock.                                                              */

const sharp = require('sharp');
const fs = require('fs');

const LADO = 1024;
const ARTE = 824;                 // proporção da grade de ícones da Apple
const MARGEM = (LADO - ARTE) / 2;
const RAIO = ARTE * 0.2237;       // curvatura do squircle do macOS

const mascara = Buffer.from(
  `<svg width="${ARTE}" height="${ARTE}" xmlns="http://www.w3.org/2000/svg">
     <rect width="${ARTE}" height="${ARTE}" rx="${RAIO}" ry="${RAIO}" fill="#fff"/>
   </svg>`);

(async () => {
  const arte = await sharp('LOGO.png')
    .resize(ARTE, ARTE, { fit: 'cover' })
    .composite([{ input: mascara, blend: 'dest-in' }])   // recorta o squircle
    .png()
    .toBuffer();

  const cheio = await sharp({
    create: {
      width: LADO, height: LADO, channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }         // margem transparente
    }
  })
    .composite([{ input: arte, top: MARGEM, left: MARGEM }])
    .png()
    .toBuffer();

  fs.mkdirSync('assets', { recursive: true });
  fs.writeFileSync('assets/icone-mac.png', cheio);

  // Todos os tamanhos que o .icns pede, já mascarados.
  const mapa = [[16,'16x16'],[32,'16x16@2x'],[32,'32x32'],[64,'32x32@2x'],
                [128,'128x128'],[256,'128x128@2x'],[256,'256x256'],
                [512,'256x256@2x'],[512,'512x512'],[1024,'512x512@2x']];

  fs.rmSync('/tmp/ProspecApp.iconset', { recursive: true, force: true });
  fs.mkdirSync('/tmp/ProspecApp.iconset', { recursive: true });

  for (const [px, nome] of mapa) {
    await sharp(cheio).resize(px, px)
      .png().toFile(`/tmp/ProspecApp.iconset/icon_${nome}.png`);
  }

  // E os PNGs que a janela, o Dock e a página usam.
  for (const px of [16, 32, 64, 128, 256, 512, 1024]) {
    await sharp(cheio).resize(px, px).png().toFile(`assets/icon-${px}.png`);
  }
  await sharp(cheio).resize(512, 512).png().toFile('assets/icon.png');

  console.log('ícone macOS pronto: squircle de', ARTE, 'px em canvas de', LADO);
})();
