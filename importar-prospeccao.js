/* importar-prospeccao.js — traz para a base os leads achados por prospecção.

   POR QUE ESTE SCRIPT EXISTE
   Os 109 leads originais vieram todos do diretório Prudente Empresas, que
   lista empresa formalizada de porte médio e grande: 78 médias, 28 grandes,
   nenhuma pequena. Empresa desse tamanho tem site — daí a base ter virado uma
   lista de quem NÃO precisa do que se vende. Zero padarias, restaurantes,
   oficinas ou salões, que são justamente as categorias de maior retorno no
   próprio score.

   Este script importa leads de outra origem: comércio de bairro, achado por
   busca, com o site já verificado na hora da coleta.

   Uso:  node importar-prospeccao.js arquivo1.txt arquivo2.txt ...
   Formato de cada linha:
     nome|telefone|endereço|bairro|site ou SEM|observação                    */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { pontuar } = require('./score.js');

const arquivo = process.env.PROSPEC_DADOS || (() => {
  const doApp = path.join(os.homedir(), 'Library', 'Application Support',
                          'ProspecApp', 'dados.json');
  return fs.existsSync(doApp) ? doApp : path.join(__dirname, 'dados.json');
})();

const soDigitos = s => String(s || '').replace(/\D/g, '');
const fone11 = s => soDigitos(s).slice(-11);
const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const chaveNome = s => semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/* A categoria sai do nome, porque quem coletou não preencheu esse campo — e
   ela vale pontos no score (o retorno esperado por ramo). */
function categorizar(nome) {
  const n = nome.toLowerCase();
  if (/padaria|panific|confeit|doceria|bolo/.test(n))        return 'padaria';
  if (/restaurante|pizzar|lanchon|hamburg|churrasc|self.?service|marmit/.test(n))
                                                              return 'restaurante';
  if (/bar\b|choper|pub|boteco|adega/.test(n))                return 'bar';
  if (/oficina|auto.?pe|borrach|funilar|lava.?r|auto.?el|auto.?center|pneu/.test(n))
                                                              return 'oficina';
  if (/sal[ãa]o|barbear|est[ée]tica|unha|cabelo|beleza|spa\b/.test(n))
                                                              return 'salao_beleza';
  if (/mercad|merceari|empório|emporio|hortifr|açougue|acougue/.test(n))
                                                              return 'supermercado';
  if (/farm[áa]cia|drogar/.test(n))                           return 'farmacia';
  return 'loja';
}

/* Sem porte declarado, "pequeno" é a suposição honesta: foi assim que estes
   leads foram procurados. Chutar médio inflaria o score deles. */
const PORTE = 'pequeno';

function ler(caminho) {
  return fs.readFileSync(caminho, 'utf8').split('\n')
    .map(l => l.trim()).filter(Boolean)
    .map(linha => {
      const p = linha.split('|').map(x => x.trim());
      if (p.length < 5) return null;
      const [nome, telefone, endereco, bairro, site, obs] = p;
      if (!nome || fone11(telefone).length < 10) return null;
      return { nome, telefone, endereco, bairro,
               site: (site && site.toUpperCase() !== 'SEM') ? site : 'nenhum',
               obs: obs || '' };
    }).filter(Boolean);
}

const dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
dados.leads = dados.leads || [];

let novos = 0, duplicados = 0, semSite = 0;
const arquivos = process.argv.slice(2);
if (!arquivos.length) {
  console.error('Uso: node importar-prospeccao.js arquivo1.txt [arquivo2.txt ...]');
  process.exit(1);
}

for (const caminho of arquivos) {
  for (const bruto of ler(caminho)) {
    // Dedup pela mesma regra do MCP: telefone, ou nome na mesma cidade.
    const f = fone11(bruto.telefone);
    const n = chaveNome(bruto.nome);
    const jaTem = dados.leads.find(l =>
      fone11(l.telefone) === f ||
      (chaveNome(l.nome) === n && chaveNome(l.cidade) === chaveNome('Presidente Prudente')));

    if (jaTem) { duplicados++; continue; }

    const lead = {
      id: Date.now() + novos,
      nome: bruto.nome,
      empresa: bruto.nome,
      telefone: bruto.telefone,
      email: '',
      categoria: categorizar(bruto.nome),
      status: 'novo',
      prioridade: 'media',
      endereco: bruto.endereco || '',
      bairro: bruto.bairro || '',
      cidade: 'Presidente Prudente',
      site: bruto.site,
      site_qualidade: bruto.site === 'nenhum' ? 'nenhum' : '?',
      site_notas: bruto.obs,
      site_verificado_em: new Date().toISOString(),
      instagram: '', facebook: '', logo: '',
      porte: PORTE,
      fonte: 'prospecção por busca · comércio de bairro',
      notas: bruto.obs,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString()
    };

    const { score, motivos } = pontuar(lead);
    lead.score = score;
    lead.motivos = motivos;

    dados.leads.push(lead);
    novos++;
    if (lead.site === 'nenhum') semSite++;
  }
}

fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));
console.log(`${novos} leads novos (${semSite} sem site) · ${duplicados} já existiam`);
console.log(`Base agora: ${dados.leads.length} leads`);
console.log('\nRode `node score.js` para reordenar, e `node geocodificar.js` para o mapa.');
