const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 64, 128, 256, 512, 1024];
const assetDir = path.join(__dirname, 'assets');

// SVG com estilo soft UI (neumorfismo)
const svg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#e8eaf6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#f3e5f5;stop-opacity:1" />
    </linearGradient>
    
    <filter id="softShadow">
      <feGaussianBlur in="SourceGraphic" stdDeviation="20"/>
      <feOffset dx="-15" dy="-15" result="offsetblur"/>
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.3"/>
      </feComponentTransfer>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <filter id="softHighlight">
      <feGaussianBlur in="SourceGraphic" stdDeviation="20"/>
      <feOffset dx="15" dy="15" result="offsetblur"/>
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.2"/>
      </feComponentTransfer>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="1024" height="1024" fill="url(#bgGrad)"/>
  
  <!-- Sombra soft (neumorfismo) -->
  <circle cx="512" cy="512" r="380" fill="#8892c1" opacity="0.06" filter="url(#softShadow)"/>
  
  <!-- Círculo principal (soft UI) -->
  <circle cx="512" cy="512" r="380" fill="#f5f7fa" opacity="0.8" filter="url(#softHighlight)"/>
  <circle cx="512" cy="512" r="370" fill="#ffffff"/>
  
  <!-- Símbolo: mira/alvo (prospecção local) -->
  <g transform="translate(512, 512)">
    <!-- Círculos concêntricos com gradiente -->
    <defs>
      <radialGradient id="targetGrad">
        <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
      </radialGradient>
    </defs>
    
    <!-- Anel externo -->
    <circle cx="0" cy="0" r="220" fill="none" stroke="url(#targetGrad)" stroke-width="24" opacity="0.9"/>
    
    <!-- Anel médio -->
    <circle cx="0" cy="0" r="150" fill="none" stroke="url(#targetGrad)" stroke-width="18" opacity="0.7"/>
    
    <!-- Anel interno -->
    <circle cx="0" cy="0" r="80" fill="none" stroke="url(#targetGrad)" stroke-width="14" opacity="0.5"/>
    
    <!-- Ponto central -->
    <circle cx="0" cy="0" r="28" fill="url(#targetGrad)"/>
    
    <!-- Pinos de localização (4 pontos cardinais) -->
    <g stroke="url(#targetGrad)" stroke-width="16" stroke-linecap="round">
      <line x1="0" y1="-260" x2="0" y2="-340" opacity="0.8"/>
      <line x1="260" y1="0" x2="340" y2="0" opacity="0.8"/>
      <line x1="0" y1="260" x2="0" y2="340" opacity="0.8"/>
      <line x1="-260" y1="0" x2="-340" y2="0" opacity="0.8"/>
    </g>
  </g>
  
  <!-- Texto: PROSPEC (subtil) -->
  <text x="512" y="800" font-size="96" font-weight="700" text-anchor="middle" 
        fill="#667eea" opacity="0.7" font-family="system-ui, -apple-system, sans-serif"
        letter-spacing="-2">PROSPEC</text>
</svg>`;

async function createIcons() {
  console.log('Criando ícones em múltiplos tamanhos...\n');
  
  for (const size of sizes) {
    const filename = size === 1024 ? 'icon.png' : `icon-${size}x${size}.png`;
    const filepath = path.join(assetDir, filename);
    
    try {
      await sharp(Buffer.from(svg))
        .resize(size, size, { fit: 'contain', background: { r: 245, g: 247, b: 250, alpha: 1 } })
        .png()
        .toFile(filepath);
      
      console.log(`✓ ${filename}`);
    } catch (err) {
      console.error(`✗ ${filename}:`, err.message);
    }
  }
  
  // Criar ICNS para macOS
  try {
    const pngPath = path.join(assetDir, 'icon.png');
    const icnsPath = path.join(assetDir, 'icon.icns');
    
    // Se tiver ImageMagick/sips disponível, converter
    const { execSync } = require('child_process');
    try {
      execSync(`sips -s format icns ${pngPath} --out ${icnsPath}`, { stdio: 'ignore' });
      console.log(`✓ icon.icns (macOS)`);
    } catch {
      console.log(`⚠ icon.icns não criado (requer sips/ImageMagick)`);
    }
  } catch (err) {
    console.log(`⚠ macOS icon skipped: ${err.message}`);
  }
  
  console.log('\n✅ Ícones criados!');
}

createIcons().catch(console.error);
