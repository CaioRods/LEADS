# Direção de design aprovada — ProspecApp

**Data:** 2026-09-03
**Skill:** huashu-design (Fallback Phase 1–5, três direções obrigatórias)

## O que foi apresentado

Três versões reais em HTML, todas com os 27 leads verdadeiros de `dados.json`,
capturadas a 1440×900 e entregues ao usuário para clicar:

| # | Lógica | Arquivo | Âncora |
|---|--------|---------|--------|
| 1 | 🎲 Roleta de segundos (`10 % 20 + 1` = estilo #11) | `design-demos/01-roleta.html` | Dark Editorial — brittanychiang.com v4 |
| 2 | 🏆 Referência real premiada | `design-demos/02-referencia.html` | Attio (CRM), verificado via WebSearch |
| 3 | 🧠 Estúdio ideal | `design-demos/03-designer.html` | Edward Tufte |

Os três subagentes rodaram em paralelo, com contexto independente, sem ver o
trabalho um do outro. Entrada comum: `design-spec.md` + `dados.json`.

## Escolha do usuário

**Direção 2 — "Clara e densa (Attio)".**

Resposta literal na pergunta "Qual direção eu implemento no app de verdade?":
> `2 · Clara e densa (Attio)`

## O que define esta direção

- Fundo branco, filete de 1px como ritmo, linha de 40px → 17 leads visíveis por tela
- Primeira coluna é o ícone de telefone (cheio = dá para ligar, riscado = exige visita),
  não o nome — a informação que decide o dia
- Painel lateral de detalhe que **não** escurece a lista
- Faixa Panorama acima da dobra: funil clicável, fila de hoje, ramos, medidor de 27 traços
- Paleta derivada do conteúdo (não copiada da Attio): azulejo de fachada → terra de
  Prudente → verde de mata, sobre neutro quente de papel. Contraste mínimo medido 5,18:1
- Selo "SP capital" nos 5 leads que ficam no bairro homônimo de São Paulo
- Contador "·3" no endereço quando outros leads dividem a mesma via

## Próximo passo

Portar esta direção para o app real (`index.html` + `styles.css` + `app-web.js`),
ligada à API Express em `localhost:3000` no lugar do array embutido. Iterações a
partir daqui **não** reabrem a porta das três direções (regra da skill: iteração
dentro de direção já escolhida é isenta).

---

## Mudança de direção — 2026-09-03 (segunda rodada)

O usuário enviou uma **imagem de referência com valores exatos** e escreveu:
> "QUERO O SISTEMA NESTE ESTILO, MINIMALISTA, ESQUEÇA ESSE ATUAL"

**Direção nova: Neumorfismo / Soft UI.** Fundo #E8EAE9, sombra clara #FFFFFF e
sombra escura #0D2750 (marinho, não preto), superfícies extrudadas e afundadas.

**Isenção da porta das três direções** (regra da skill, item "usuário deste turno
disse explicitamente para ir direto"): ele não pediu opções — ele forneceu a
referência visual exata, com os valores de sombra medidos. Rodar três direções
sobre "faça exatamente isto" seria burocracia contra a intenção declarada.

Consequência assumida: a tabela densa Apple/Attio dá lugar a grade de cartões,
com modo compacto preservado para as sessões de ligação. Contraste de texto
mantido em ≥4.5:1 — o relevo é das superfícies, nunca das letras.
