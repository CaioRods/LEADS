# Design Spec — ProspecApp (redesign completo)

## O que é o produto

Um app de desktop local (HTML/CSS/JS + servidor Express em localhost:3000) que serve
como CRM de prospecção para **uma pessoa só**: um desenvolvedor/freelancer de sites que
mora em Regente Feijó, interior de São Paulo (região de Presidente Prudente, DDD 18).

Ele levantou 27 comércios locais que **não têm site ou têm site ruim** e vai ligar,
visitar e vender desenvolvimento web para eles. O app é a mesa de trabalho dessa operação:
onde ele vê quem falta ligar, marca o que aconteceu em cada ligação, e acompanha quantos
viraram cliente.

Não é um SaaS multi-usuário. Não tem login, não tem time, não tem nuvem. É a ferramenta
pessoal de uma pessoa fazendo cold calling em uma cidade de 20 mil habitantes.

## Público e cenário de uso

**Usuário único**, 1 pessoa, provavelmente no notebook, provavelmente com o telefone na
outra mão. Os dois momentos de uso:

1. **Sessão de ligações** (30–90 min, terça a quinta, 10h–11h30 / 15h–16h30): ele abre a
   lista, filtra "quem ainda não liguei", liga, e imediatamente registra o que aconteceu
   e muda o status. Aqui ele precisa de **densidade e velocidade** — ver muitos leads de
   uma vez, achar o telefone sem procurar, marcar o resultado em 1–2 cliques.
2. **Revisão de pipeline** (5 min, começo do dia): quantos estão em cada etapa, quem
   prometeu retorno, o que esfriou. Aqui ele precisa de **panorama**, não de detalhe.

Implicação de design: o app precisa funcionar bem **cheio de dados**, não vazio. A tela
principal com 27 linhas é o estado normal, não o estado extremo.

## Conteúdo real (usar exatamente este — nada de Lorem ipsum)

Os dados verdadeiros estão em `dados.json` na raiz do projeto. **Leia esse arquivo e use
os leads reais.** Resumo do que tem lá:

- **27 leads** no total: 24 ativos + 3 já descartados (esses 3 já têm site próprio:
  Café Malacrida, MJ Centro Automotivo, Chilli Beans)
- **16 têm telefone** confirmado; 11 não têm — e essa distinção importa muito na tela,
  porque "sem telefone" significa "não dá para ligar hoje, tem que ir lá"
- **23 não têm site nenhum**; 1 tem site desatualizado (Ponce e Filho, só página em portal
  de terceiros); 3 já têm site (os descartados)

Distribuição por categoria:
| Categoria | Qtd |
|---|---|
| Padaria / panificadora | 10 |
| Oficina automotiva | 5 |
| Restaurante | 3 |
| Salão de beleza | 3 |
| Loja (inclui imobiliária) | 2 |
| Bar | 1 |
| Supermercado | 1 |
| Farmácia | 1 |
| Outro | 1 |

Prioridade (campo `prioridade`): 12 alta, 11 média, 4 baixa.
Status (campo `status`): 24 novo, 3 descartado. Os outros status possíveis, na ordem do
funil: `novo` → `contatado` → `agendado` → `proposta` → `vendido`, com `descartado` fora
do funil.

Campos de cada lead: `nome`, `empresa`, `telefone`, `email`, `categoria`, `status`,
`endereco`, `site` (nenhum/desatualizado/domínio), `prioridade`, `observacoes`,
`criado_em`, `atualizado_em`.

Detalhe que vale destacar no design: **3 dos salões e 1 oficina ficam no bairro "Vila
Regente Feijó" em São Paulo capital, não na cidade de Regente Feijó** — é uma armadilha
de busca, e o campo `observacoes` avisa isso. Se o design conseguir sinalizar esse tipo
de alerta sem poluir, ganha ponto.

## Seções / telas que precisam existir

1. **Panorama (dashboard)** — contagem por etapa do funil, distribuição por categoria,
   e quantos ainda faltam ligar. Tem que caber acima da dobra.
2. **Lista de leads** — a tela principal, onde ele passa 90% do tempo. Busca por texto +
   filtro por status. Precisa mostrar nome, categoria, telefone, status e um jeito rápido
   de abrir o detalhe.
3. **Detalhe do lead** — todos os campos + histórico de atividades (notas com data) +
   campo para adicionar nota + ações editar/excluir.
4. **Novo lead** — formulário com os campos acima.
5. **Exportar** — botão que baixa CSV.

## Tom e temperamento

Palavras-chave: **ferramenta de trabalho, não vitrine**. Confiável. Rápido de ler.
Sóbrio sem ser sem graça. É software que uma pessoa abre todo dia de manhã — tem que
envelhecer bem, não impressionar no primeiro dia.

O que ele NÃO é: não é um dashboard de investidor, não é um app de banco, não é um
produto de startup querendo parecer grande. É honesto sobre ser uma ferramenta pessoal
de uma pessoa vendendo site em cidade pequena.

## Formato e tamanho de saída (obrigatório, os três iguais)

- **1 arquivo HTML único**, CSS inline no `<style>`, sem build, sem framework, sem CDN
- **Viewport de referência: 1440 × 900** (é o que vai ser capturado na screenshot)
- Precisa renderizar abrindo o arquivo direto no navegador (`file://`), **sem servidor** —
  então embuta os 27 leads como um array JS literal dentro do próprio HTML
- Mostrar a **tela de lista de leads populada com os leads reais** como estado inicial
  (é a tela que decide a escolha do usuário; dashboard vazio não mostra nada)

## Restrições

- **Português do Brasil** em toda a interface
- Corpo de texto ≥14px, rótulos ≥12px, contraste do texto ≥4.5:1 — sem exceção
- ❌ **Nada de emoji como ícone** (o app atual faz isso e é justamente o que estamos
  matando). Se precisar de ícone, use SVG inline ou nada.
- ❌ **Nada de card com cantos arredondados + barrinha colorida na borda esquerda** —
  é o clichê que o app atual usa
- ❌ Nada de gradiente roxo/violeta genérico (o app atual é roxo — estamos saindo disso)
- ❌ Nada de GitHub-dark padrão (#0D1117 + neon ciano/roxo)
- Fonte: use fontes de sistema ou webfont via `@font-face`/Google Fonts link — mas se
  usar link externo, garanta fallback de sistema que não quebre o layout offline

## Motivo visual (a pergunta que cada versão precisa responder)

O que é específico DESTE conteúdo e não de "um CRM qualquer"?

Pistas que valem explorar: é uma **cidade pequena e mapeável** (vários leads na mesma
rua — José Gomes tem 3); é uma **lista finita que acaba** (27, não infinitos — dá para
ver o fim); a informação mais decisiva não é o nome, é **"tem telefone ou não"** e
**"já liguei ou não"**; e o produto que ele vende é justamente **site** para quem não
tem — há uma ironia útil aí.

Não force metáfora. Mas não faça também um dashboard genérico que serviria para vender
qualquer coisa em qualquer lugar.
