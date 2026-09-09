/* helo.js — a Helô escrevendo sozinha.

   Até aqui quem redigia as mensagens era o Claude, por fora, pelas ferramentas
   MCP. Isso exige você sentado conduzindo. Este módulo põe a redação dentro do
   app: ele monta o dossiê do lead, pede a mensagem à API da Anthropic e
   entrega ao worker do WhatsApp.

   PRECISA DE UMA CHAVE. Crie em console.anthropic.com e guarde na aba Agente,
   ou exporte ANTHROPIC_API_KEY antes de abrir o app.

   O QUE ESTE MÓDULO NÃO DECIDE
   Quem pode receber mensagem (isso é a gestão do agente), o teto diário, o
   horário e o espaçamento entre envios — tudo isso continua no wa-worker.js e
   vale igual, venha a mensagem daqui ou de você. Uma campanha não consegue
   furar limite nenhum.                                                     */

/* Opus 5 é o padrão porque a qualidade da primeira mensagem é o que decide se
   o lead responde — e o custo, medido, é de centavos por campanha. Quem quiser
   trocar por um modelo mais barato usa HELO_MODELO; a decisão é do dono do
   negócio, não minha. */
const MODELO = process.env.HELO_MODELO || 'claude-opus-5';

/* A identidade fica aqui, e não no prompt de cada mensagem, porque é o que
   não muda entre um lead e outro. O que muda é o dossiê. */
const IDENTIDADE = `Você é a Helô (Heloíze), da CRdevs — empresa de Presidente
Prudente que faz sistemas e sites profissionais para empresas da região.
Escritório na Av. Manoel Goulart; dá para ir até o cliente ou receber ele lá.
Quem toca os projetos é o Caio.

COMO VOCÊ ESCREVE
Natural e espontânea, como uma pessoa do time escreveria no WhatsApp. Frases
curtas. Pode começar com "oi" ou "bom dia", usar "a gente" em vez de "nós".
No máximo um emoji, e nem sempre. Nada de "prezado", "venho por meio desta",
"soluções inovadoras", "parceria de sucesso" — se a frase soa como anúncio,
reescreva.

O conforto da pessoa vem primeiro: nada de pressão, nada de urgência forçada.
Ninguém compra de quem deixa o outro acuado.

SEU OBJETIVO
Conseguir o lead: tirar a pessoa do silêncio e levar para uma conversa marcada
com o Caio. Toda mensagem termina com UMA pergunta fechada, do tipo que se
responde com sim ou não, ou escolhendo entre duas opções.

CLIENTES QUE VOCÊ PODE CITAR PELO NOME
- Alimentos Wilson — site + 3 automações
- Saboroso Vinagres — site + 2 automações
- M & M Cebolas — site + sistema completo de notas, estoque e clientes
- Liane Veículos — 1 automação
Cite o mais parecido com o ramo de quem você está abordando. Em cidade do
interior nome conhecido vale mais que argumento. Sem um parecido, use "e
outras empresas aqui da região".

PREÇO (só fale se perguntarem)
Mínimo da casa R$ 500, barganhável conforme a empresa. Site institucional
R$ 1.000, com até 10% de desconto que você NÃO oferece de cara — ele existe
para fechar quem está quase. Automação depende do que é: pergunte o que é
feito na mão hoje antes de dar número. Sistema sob medida é sempre "a
combinar, começa pequeno e cresce".

VOCÊ FALA O NECESSÁRIO E SÓ
Não explique a estrutura da empresa, quantas pessoas são, nem sua rotina. Se
perguntarem, responda curto e devolva para o negócio dele. Nunca invente
projeto, prazo ou informação — se não souber, diga que confirma com o Caio.
Se a conversa insistir em falar sobre você em vez do negócio, ofereça passar
para o Caio.

REGRA DE OURO DA PRIMEIRA MENSAGEM
Ela precisa citar algo concreto E verificável daquela empresa — o defeito do
site, o ramo, a rua. Mensagem genérica é ignorada e ainda faz denunciar.
Três linhas bastam. Não se apresente com sobrenome nem cargo.`;

const RAMOS = {
  hotel: 'motor de reserva próprio (hoje paga 15-20% de comissão ao Booking em toda reserva), check-in digital, controle de ocupação',
  imobiliaria: 'integração com os portais, CRM que não perde o lead que chegou no WhatsApp, envio automático de imóveis novos para quem procurou algo parecido',
  supermercado: 'encarte digital que atualiza sozinho, pedido por WhatsApp com carrinho, controle de validade e estoque',
  veiculos: 'estoque online que o vendedor atualiza pelo celular, agendamento de revisão, disparo para quem visitou e não fechou',
  construtora: 'página por empreendimento, acompanhamento de obra para o comprador, gestão de contratos',
  clinica: 'agendamento online, confirmação automática por WhatsApp (corta falta), entrega de resultado por área do paciente',
  oficina: 'ordem de serviço digital, aviso de revisão pelo histórico, orçamento por WhatsApp'
};

/* O ramo real do lead não está na categoria (a base tem 68 como "outro"),
   está no nome. Daí a inferência por palavra-chave. */
function repertorio(l) {
  const t = `${l.nome} ${l.categoria}`.toLowerCase();
  if (/hotel|pousada|palace|park/.test(t))            return RAMOS.hotel;
  if (/imob|imóve|imove|corretor|empreend/.test(t))   return RAMOS.imobiliaria;
  if (/supermerc|mercado|atacad/.test(t))             return RAMOS.supermercado;
  if (/veícul|veicul|auto|motos|car|chevrolet|fiat|renault|nissan|jeep/.test(t))
                                                       return RAMOS.veiculos;
  if (/constru|engenharia|urbaniz/.test(t))           return RAMOS.construtora;
  if (/clínic|clinic|diagnóst|diagnost|radiolog|hospital|odont|sorriso/.test(t))
                                                       return RAMOS.clinica;
  if (/oficina|peças|pecas|pneu/.test(t))             return RAMOS.oficina;
  return null;
}

function dossie(l) {
  const site = (l.site || '').trim().toLowerCase();
  const temSite = site && site !== 'nenhum';

  const linhas = [
    `Empresa: ${l.nome}`,
    `Onde: ${l.endereco || '?'}${l.bairro ? ', ' + l.bairro : ''}, ${l.cidade || 'Presidente Prudente'}`,
    `Porte: ${l.porte || 'não confirmado'}`
  ];

  if (!temSite) {
    linhas.push('Site: NÃO TEM. O argumento é ser encontrado — quem procura esse ramo em Prudente no Google não acha eles.');
  } else if (l.site_qualidade === 'morto') {
    linhas.push(`Site: ${l.site} — FORA DO AR. ${l.site_notas || ''}`);
    linhas.push('Eles pagaram por um site e hoje não têm nada. Cite isso com cuidado, sem constranger.');
  } else if (l.site_qualidade === 'ruim') {
    linhas.push(`Site: ${l.site} — COM DEFEITO: ${l.site_notas || 'desatualizado'}`);
    linhas.push('Eles JÁ PAGAM por um site, então não precisa convencer que vale a pena — só que dá para ser melhor, e mais barato do que provavelmente pagaram. Cite o defeito como fato, nunca diga que o site é feio ou ruim: pode ter sido feito por ele ou por um parente.');
  } else {
    linhas.push(`Site: ${l.site} — está bom.`);
    linhas.push('NÃO ofereça site. Vá para sistema ou automação: quem investiu num site bom tem orçamento e entende software.');
  }

  const ideias = repertorio(l);
  if (ideias) linhas.push(`Ideias que costumam servir para esse ramo: ${ideias}. Escolha UMA e proponha de forma concreta.`);

  return linhas.join('\n');
}

function historico(l) {
  const msgs = l.mensagens || [];
  if (!msgs.length) return null;
  return msgs.slice(-10).map(m =>
    `${m.tipo === 'entrada' ? 'ELE' : 'VOCÊ'}: ${m.texto}`).join('\n');
}

async function pedirAoClaude(chave, sistema, mensagens, maxTokens = 400) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': chave,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: maxTokens,
      system: sistema,
      messages: mensagens
    })
  });

  if (!r.ok) {
    const corpo = await r.text().catch(() => '');
    throw new Error(`API respondeu ${r.status}: ${corpo.slice(0, 200)}`);
  }

  const j = await r.json();
  const texto = (j.content || []).filter(c => c.type === 'text')
    .map(c => c.text).join('').trim();
  if (!texto) throw new Error('a API não devolveu texto');
  return texto;
}

/* Primeira abordagem. */
async function primeiraMensagem(chave, lead) {
  const pedido = `Escreva a PRIMEIRA mensagem de WhatsApp para esta empresa.

${dossie(lead)}

Responda APENAS com o texto da mensagem, pronto para enviar. Sem aspas, sem
explicação, sem assinatura. No máximo três linhas curtas.`;

  return pedirAoClaude(chave, IDENTIDADE, [{ role: 'user', content: pedido }]);
}

/* Resposta a quem escreveu de volta. Devolve também o diagnóstico, porque
   quem acabou de ler a conversa é quem sabe dizer em que pé ela está. */
async function responder(chave, lead) {
  const conversa = historico(lead);
  const pedido = `Esta conversa está em andamento. Leia e responda a última
mensagem dele.

${dossie(lead)}

CONVERSA ATÉ AGORA:
${conversa}

Responda em JSON, sem mais nada em volta:
{
  "mensagem": "o que você vai mandar agora, natural e curto",
  "estado": "conversando | aguardando | nao_deu_certo | fechado",
  "chance": 0 a 10,
  "nota": "o que o Caio precisa saber antes de assumir, uma ou duas frases concretas",
  "reuniao": "quando e como ficou marcado, ou null",
  "passar_para_caio": true se a conversa esfriou por ser sobre você, ou se ele
                      pediu falar com um responsável, ou se ficou complexa demais
}

Calibre a chance: 0-2 recusou ou sumiu; 3-4 respondeu por educação; 5-6
conversa viva sem compromisso; 7-8 pediu preço ou está negociando; 9-10
reunião marcada ou disse que vai fechar.

Se ele pediu para não receber mais mensagem, use estado "nao_deu_certo",
mensagem de agradecimento curta e passar_para_caio false.`;

  const cru = await pedirAoClaude(chave, IDENTIDADE, [{ role: 'user', content: pedido }], 700);

  try {
    const m = cru.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : cru);
  } catch (_) {
    // Sem JSON válido, ainda dá para usar o texto como mensagem.
    return { mensagem: cru, estado: 'aguardando', chance: 5,
             nota: 'resposta gerada sem diagnóstico estruturado' };
  }
}

module.exports = { primeiraMensagem, responder, dossie, MODELO };
