# ProspecApp

Ferramenta pessoal de prospecção: levanta comércios locais que **não têm site ou têm site
ruim**, pontua a chance de cada um fechar, e organiza as ligações e visitas.

Feito para uma pessoa só — um desenvolvedor vendendo sites em Regente Feijó, interior de
São Paulo. Sem login, sem time, sem nuvem: roda em `localhost` e guarda tudo em um JSON
no seu disco.

![estilo](https://img.shields.io/badge/estilo-soft%20UI%20%2F%20neumorfismo-E8EAE9)
![stack](https://img.shields.io/badge/stack-Express%20%2B%20HTML%2FCSS%2FJS-informational)
![sem build](https://img.shields.io/badge/build-nenhum-success)

## Como rodar

```bash
npm install
node server.js
```

Abra `http://localhost:3000`.

## O que ele faz

**Score de chance (0–100).** Cada lead é pontuado por cinco critérios, e o cálculo é
aberto — o painel mostra de onde veio cada ponto:

| Critério | Peso | Racional |
|---|---|---|
| Dá para falar hoje | 0–25 | telefone confirmado > truncado > só direct |
| Precisa do que você vende | 0–30 | sem site vale o teto; site próprio zera |
| Já acredita em digital | 0–20 | quem tem Instagram e não tem site é o mais fácil |
| Retorno da categoria | 0–15 | restaurante e imobiliária no topo; porte grande vale o teto |
| Porte e reputação | 0–10 | destaque na cidade, anos de casa, capital social |

Quem está fora da área zera, por mais bem pontuado que seja.

**Rotas de visita.** Não é um mapa geográfico e não finge ser: o projeto não tem
geocodificação, então não existe coordenada nenhuma. O desenho usa só bairro, via e número
de porta — cada via vira uma linha, os leads entram na ordem real da numeração, e o vão
entre dois pontos vira tracejado quando o salto passa de 60 números.

**Modo Chance.** Tinge cada lead pela chance de fechar: verde quem tem mais, vermelho quem
tem menos. A luminosidade fica travada, porque o relevo neumórfico depende dela.

**Modo minimalista.** Recolhe o secundário e deixa avatar, nome e score. Nada se perde.

**Proximidade.** Sem distância em km — a escada é mesma rua → mesmo bairro → Centro →
outro bairro → zona rural → fora da cidade. Você define seu bairro em *Minha localização*.

**Som.** Sintetizado com Web Audio, nenhum arquivo, com desligador na barra lateral.

## Arquivos

```
server.js      API Express + persistência em JSON
index.html     estrutura
styles.css     sistema visual (soft UI; tokens e travas de acessibilidade no topo)
app-web.js     toda a lógica de interface
score.js       recalcula os scores:  node score.js
dados.json     sua base de leads — NÃO versionada, veja abaixo
```

`main.js` e `preload.js` são de uma versão Electron anterior; a versão viva é a web.

## ⚠️ Sobre `dados.json`

**A base de leads não está neste repositório, de propósito.** Ela contém nome, telefone e
endereço de pessoas e comércios reais — inclusive microempreendedores cujo nome da empresa
é o próprio nome civil. Publicar isso em repositório público exporia dados pessoais de
terceiros sem consentimento, o que além de deselegante esbarra na LGPD.

O `.gitignore` bloqueia `dados.json`, `exemplo-dados.json` e `design-demos/` (os protótipos
têm leads embutidos no HTML).

Na primeira execução o app cria um `dados.json` vazio. O formato:

```json
{
  "leads": [
    { "id": 1, "nome": "", "empresa": "", "telefone": "", "email": "",
      "categoria": "padaria", "status": "novo", "prioridade": "media",
      "endereco": "", "bairro": "", "cidade": "", "site": "nenhum",
      "instagram": "", "facebook": "", "logo": "", "score": 0, "motivos": [] }
  ],
  "activities": []
}
```

Categorias: `padaria` `restaurante` `bar` `salao_beleza` `oficina` `farmacia` `loja`
`supermercado` `outro`. Etapas: `novo` → `contatado` → `agendado` → `proposta` →
`vendido`, mais `descartado`.

## Logos e fotos

O app não baixa foto de empresa. Instagram e Facebook bloqueiam, e o serviço de favicon do
Google só devolve ícone para quem já tem domínio — o que é justamente quem você **não** vai
prospectar. Na prática, a maioria desses comércios não tem imagem nenhuma na internet.

No lugar, cada lead ganha um monograma colorido pelo ramo. Para pôr a imagem real: abra o
lead e cole com `Ctrl+V`, arraste o arquivo sobre o avatar, ou salve em `assets/logos/<id>.png`
e informe o caminho.

Para puxar fachada automaticamente seria preciso uma chave da Google Places Photos API.

## Licença

Uso pessoal.
