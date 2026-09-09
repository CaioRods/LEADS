/* disparar-helo.js — envia as mensagens da Helô, uma a uma.

   As mensagens estão em helo-mensagens.json. Abra e leia antes de rodar: são
   empresas reais, e cada linha ali vira uma mensagem no WhatsApp delas.

   Cada envio passa pelas travas do worker — só leads sob gestão, teto de 25
   por dia, horário comercial, e espaçamento sorteado de 45 a 180 segundos
   entre mensagens. Por isso isto leva de 8 a 30 minutos para 10 leads, e é
   assim de propósito: rajada em intervalo fixo é o padrão que mais denuncia
   automação.

   O ProspecApp precisa estar aberto e o WhatsApp conectado.

   Uso:  node disparar-helo.js
   Parar no meio: Ctrl+C. O que já saiu fica em helo-envio.log.            */

const msgs = require('./helo-mensagens.json');
const fs = require('fs');
const log = './helo-envio.log';

const anota = t => {
  const linha = new Date().toLocaleTimeString('pt-BR') + '  ' + t;
  console.log(linha);
  fs.appendFileSync(log, linha + '\n');
};

(async () => {
  let ok = 0, falhou = 0;
  anota(`começando: ${msgs.length} mensagens na fila`);

  for (const m of msgs) {
    try {
      const r = await fetch('http://localhost:3000/api/agente/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id, texto: m.texto })
      });
      const j = await r.json().catch(() => ({}));

      if (r.ok) {
        ok++;
        anota(`OK    ${m.nome} (${ok}/${msgs.length})`);
      } else {
        falhou++;
        anota(`FALHA ${m.nome}: ${j.error || r.status}`);
        // 429 é teto diário ou fora de horário: o resto da fila bateria no
        // mesmo muro, então parar aqui evita uma sequência de erros iguais.
        if (r.status === 429) { anota('PARANDO: ' + j.error); break; }
      }
    } catch (e) {
      falhou++;
      anota(`ERRO  ${m.nome}: ${e.message}`);
    }
  }

  anota(`terminou: ${ok} enviadas, ${falhou} falharam`);
  if (ok) anota('acompanhe as respostas na aba Estados do ProspecApp');
})();
