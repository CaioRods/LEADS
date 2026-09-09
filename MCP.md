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
