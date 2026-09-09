# Prospecção pelo Claude (MCP)

O `mcp-server.js` expõe o ProspecApp ao Claude. Com ele conectado, você pede
"ache oficinas em Regente Feijó sem site" e o Claude pesquisa, verifica e grava
os leads aqui — já pontuados pelo mesmo `score.js` que a interface usa.

## Instalar

### Claude Code

Já está configurado: o `.mcp.json` na raiz do projeto é lido automaticamente
quando você abre o Claude Code dentro da pasta `LEADS`. Na primeira vez ele
pede aprovação. Para conferir se subiu, use `/mcp`.

Para usar de qualquer pasta, e não só de dentro do projeto:

```bash
claude mcp add prospecapp --scope user -- node /Users/caiorodrigues/Projects/LEADS/mcp-server.js
```

### Claude Desktop

Edite `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "prospecapp": {
      "command": "node",
      "args": ["/Users/caiorodrigues/Projects/LEADS/mcp-server.js"]
    }
  }
}
```

Feche e abra o Claude Desktop.

## De onde vêm os dados

O `dados.json` tem potencialmente dois escritores: este servidor e o app. Dois
processos gravando o arquivo inteiro se atropelam — quem salvar por último apaga
o que o outro acabou de escrever.

Para nunca haver dois, o MCP fala **HTTP com o servidor do app** sempre que ele
está no ar, e só toca o arquivo direto quando não está. A ferramenta `panorama`
diz qual caminho está em uso.

Com o app **fechado**, ele escreve no arquivo — preferindo
`~/Library/Application Support/ProspecApp/dados.json` quando existe, porque é
esse o arquivo que o app empacotado lê, e não o `dados.json` do projeto.

`registrar_conversa` é a única que **exige o app aberto**.

## As ferramentas

| Ferramenta | Para quê |
|---|---|
| `panorama` | Estado da base: quantos leads, faixas de score, bairros e categorias já cobertos. Chame primeiro, para achar a lacuna. |
| `listar_leads` | Lista com filtros (sem site, bairro, categoria, score, status, estado). |
| `verificar_duplicado` | Diz se uma empresa já está na base, antes de gastar pesquisa nela. |
| `criar_lead` | Adiciona e pontua. Recusa duplicata por telefone ou por nome+cidade. |
| `atualizar_lead` | Corrige dados, move no funil, move no quadro de conversas, marca a chance. Repontua quando o campo alterado afeta o score. |
| `registrar_conversa` | Grava mensagem no histórico. Não envia nada pelo WhatsApp. |

## O agente prospectador

Cole isto no Claude para começar uma rodada:

> Você vai prospectar clientes para mim. Eu faço sites, landing pages e
> sistemas sob medida, e atendo Presidente Prudente e região.
>
> Comece chamando `panorama` para ver o que já tenho e onde há lacuna.
>
> Depois pesquise na web empresas que ainda não estão na base. Priorize
> **quem não tem site** — é o maior sinal de oportunidade e o que mais pesa
> no meu score (+30). Para cada empresa, antes de gravar, verifique de fato:
> se tem site, o telefone com DDD, o endereço e o bairro. Um lead sem esses
> campos entra com score baixo e some no fim da fila mesmo sendo bom alvo.
>
> Use `verificar_duplicado` antes de pesquisar a fundo, para não gastar tempo
> com quem já está lá. Grave com `criar_lead`, preenchendo `fonte` com onde
> encontrou.
>
> Ao terminar, me diga quantos criou, o score médio e quais são os três
> melhores alvos, com o motivo.

Duas coisas que valem ajustar nesse texto conforme o uso: a **categoria** (peça
um ramo específico se quiser foco, como "só oficinas e autopeças") e o
**recorte geográfico** (o score já favorece Regente Feijó e Centro, mas o
Claude não sabe disso a menos que você diga).

## O que ele não faz

Não envia mensagem por WhatsApp — nem este servidor nem o app fazem isso desde
que o WhatsApp Web saiu. `registrar_conversa` só grava no histórico; o envio
continua sendo você abrindo o WhatsApp pelo botão do app.

Não valida se a empresa existe ou está aberta. Para isso é o `funcionamento.js`,
que consulta o Google Places e precisa de chave.

---

# O agente conversando por WhatsApp

Existe um segundo canal, além do prompt de prospecção: o agente pode **mandar
mensagem de verdade e ler as respostas**. Isso usa a Baileys, que fala o
protocolo do WhatsApp direto — sem Chromium, ao contrário do whatsapp-web.js
que tivemos de arrancar.

## O isolamento

A regra que governa tudo: **o agente só enxerga quem está sob gestão dele.**
Uma conversa entra nesse conjunto por ação sua, na aba Agente do app. Fora
dela, nada existe para o agente — nem contatos pessoais, nem clientes atuais,
nem grupos, nem status, nem listas de transmissão. Mensagem de número não
autorizado é descartada antes de ser lida, e não fica registrada em lugar
nenhum.

A checagem acontece em duas camadas independentes: no servidor, que recusa
enviar para lead não gerido, e dentro do worker, que recusa de novo mesmo
recebendo a ordem. A segunda existe para que um bug na primeira não vire
mensagem para a pessoa errada.

No worker, o isolamento é a **primeira** coisa avaliada — antes até de checar
se há conexão. Duas razões: uma trava que protege terceiros não pode depender
de nenhum outro estado ter dado certo; e assim ela é verificável sem uma
sessão real de WhatsApp — uma trava que não se testa é uma trava em que não
se confia.

## Os limites, e por que existem

Banimento de número não vem de "ser automatizado". Vem de volume, de
insistência e de horário. Os tetos abaixo protegem o seu número — que é o
mesmo do portfólio, por onde seus clientes atuais falam com você:

| Limite | Padrão | Variável |
|---|---|---|
| Abordagens novas por dia | 25 | `WA_MAX_DIA` |
| Espera entre envios | 45 a 180s, sorteada | `WA_MIN_S`, `WA_MAX_S` |
| Horário | 9h às 18h | `WA_HORA_INI`, `WA_HORA_FIM` |
| Fim de semana | bloqueado | `WA_FIM_DE_SEMANA=1` libera |

**Responder quem escreveu para você não conta no teto** — responder é o
comportamento que menos gera denúncia, e limitá-lo seria punir o único caso
em que a conversa está indo bem.

Os limites são impostos no worker, não na camada que o agente controla: ele
não consegue pedir para exceder. Se um envio for recusado por limite, a
resposta diz qual foi — não tente contornar, é a proteção funcionando.

## Conectar

Abra a aba **Agente** no ProspecApp e escaneie o QR com WhatsApp → Aparelhos
conectados → Conectar aparelho. A sessão fica em
`~/Library/Application Support/ProspecApp/wa-agente` e sobrevive a reinícios.

O worker vive junto com o app: **com o ProspecApp fechado, nada é recebido.**
Ao reabrir, a Baileys sincroniza o que chegou no intervalo.

## Ferramentas novas

| Ferramenta | Para quê |
|---|---|
| `agente_estado` | Conectado? Quanto já saiu hoje? Quem está sob gestão? |
| `agente_gestao` | Inclui ou tira um lead. É a trava — peça confirmação antes de ativar em lote. |
| `agente_enviar` | Envia de verdade. Recusa se o lead não está sob gestão, se estourou o teto ou se está fora de horário. |
| `agente_conversas` | Histórico dos leads geridos, marcando quem respondeu. |

## Prompt do agente de conversa

> Cuide das conversas dos leads que estão sob gestão do agente.
>
> Comece por `agente_estado` para ver se há conexão e quanto cabe hoje, e
> `agente_conversas` para ver o que já foi trocado.
>
> **Responda quem respondeu.** Leia o que a pessoa escreveu e continue a
> conversa como eu continuaria: curto, direto, sem parecer robô. Se ela
> demonstrar interesse, marque `chance` alta e me avise para eu assumir. Se
> disser que não quer, agradeça, marque `estado: nao_deu_certo` e **tire da
> gestão** com `agente_gestao` — nunca mais mande nada.
>
> **Não insista com quem não respondeu.** Reabordagem é o que mais gera
> denúncia. Se passou uma semana sem resposta, marque `nao_deu_certo` e tire
> da gestão, em vez de mandar de novo.
>
> Para abordagem nova, use `agente_enviar` só com quem eu já incluí. Escreva
> citando algo concreto do negócio — a rua, o ramo, o fato de não ter site —
> e termine com uma pergunta fechada. Três linhas bastam.
>
> No fim, me diga quem respondeu, quem virou oportunidade e quem você tirou
> da gestão.
