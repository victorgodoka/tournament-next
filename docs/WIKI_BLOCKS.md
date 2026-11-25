# Wiki em blocos — contrato front ↔ back

> **Para quem é:** quem mexe no editor e na página de artigo do front.
> **Contrato com o back:** [`WIKI_API.md`](../../omega-server-v3/docs/front/WIKI_API.md) no `omega-server-v3` (§5 documento, §5.6 SEO, §6 Markdown). O servidor já aceita blocos, SEO, FAQ, hub e relacionados. Este arquivo explica como o front usa esse contrato e guarda o raciocínio por trás dele.
> **Fonte da verdade no front:** `utils/wiki-doc.ts` (tipos, limites, validação). Se este documento divergir do código, o código ganha. Os blocos `statistics-deck` e `article-preview` estão em [WIKI_EDITOR_BLOCKS.md](./WIKI_EDITOR_BLOCKS.md).

---

## 0. Resumo em 30 segundos

- Um artigo deixa de ser um Markdown só e passa a ser um **documento JSON** (`WikiDoc`): título, resumo, tags, capa, infobox, uma **lista ordenada de blocos**, uma **biblioteca de imagens** e, opcionalmente, SEO, hub e artigos relacionados.
- O editor (`/wiki/new`) monta esse JSON com drag & drop. O front **manda o JSON inteiro**; o back **valida, guarda e devolve o mesmo JSON**.
- A página pública renderiza **só** a partir do JSON. Mesmo JSON ⇒ mesma página, pixel a pixel. Não existe estado de layout fora dele.
- O Markdown não sumiu: ele vive **dentro** dos blocos `text` e `callout`, com as mesmas regras de hoje (sem HTML cru, links só `http(s)` ou caminho interno).
- Artigos antigos (só `body`) continuam funcionando: `doc: null` ⇒ o front usa o renderer de Markdown de sempre. O `/edit` deles tem um botão que converte para blocos no navegador (§10.1).
- Blocos: `text`, `heading`, `figure`, `gallery`, `cards`, `statistics-deck`, `article-preview`, `callout`, `quote`, `code`, `video`, `faq`. `statistics-deck`, `article-preview` e o atalho `[article=slug]` estão em [WIKI_EDITOR_BLOCKS.md](./WIKI_EDITOR_BLOCKS.md).
- O rascunho automático fica no navegador e não exige nada do back (§10.2).
- Dados que o doc não carrega: tópico do índice (`utils/wiki-topics.ts`), curtidas, visualizações e comentários (`/wiki/{slug}/social`, `components/omega/wiki/comments.tsx`).

---

## 1. Fluxo

```
┌──────────── Editor (/wiki/new, /wiki/{slug}/edit) ─────────────┐
│ paleta de componentes ──drag/click──▶ lista de blocos          │
│ biblioteca de imagens ◀── upload (S3, §4)                      │
│ estado = 1 objeto WikiDoc                                      │
└──────────────┬─────────────────────────────────────────────────┘
               │ POST /wiki  { doc, slug?, published? }
               │ PATCH /wiki/{slug}  { doc?, slug?, published? }
               ▼
┌──────────── API ───────────────────────────────────────────────┐
│ validateDoc (§5)  →  deriva title/body (§6)  →  grava (§7)     │
│ grava revisão com o doc inteiro                                │
└──────────────┬─────────────────────────────────────────────────┘
               │ GET /wiki/{slug}  →  { ...artigo, doc }
               ▼
┌──────────── Página (/wiki/{slug}) ─────────────────────────────┐
│ renderDocHtml(doc) → <ArticleView doc html>                    │
│ (o preview do editor usa exatamente o mesmo componente)        │
└────────────────────────────────────────────────────────────────┘
```

---

## 2. Endpoints

Todas as convenções do `WIKI_API.md` continuam valendo (erros `{ error, message }`, `Origin`, permissões `wiki.write`, rascunho = `publishedAt: null`). Só muda o que está abaixo.

### 2.1 `POST /wiki` — criar

Aceita **um de dois** corpos. Ter `doc` **e** `body` ao mesmo tempo é `400`.

```jsonc
// Novo: artigo em blocos
{
  "doc": { /* WikiDoc, §3 */ },
  "slug": "sky-striker",      // opcional; sem ele, slugify(doc.title) como hoje
  "published": false          // opcional; default false
}

// Legado: continua aceito
{ "title": "…", "body": "…markdown…", "slug": "…", "published": false }
```

- `title` **não** vem no corpo de um artigo em blocos: o servidor usa `doc.title.trim()`.
- `body` **não** vem: o servidor deriva (§6) para busca, índice e meta description.
- Resposta: `201` com o `Article` completo (§2.3), igual a hoje.
- `409 CONFLICT` para slug ocupado, igual a hoje.

### 2.2 `PATCH /wiki/{slug}` — editar

```jsonc
{ "doc": { /* WikiDoc */ }, "slug": "novo-slug", "published": true }  // todas as chaves opcionais, pelo menos uma
```

- `doc` é **substituído inteiro**, nunca mesclado. O editor sempre manda o documento completo.
- Mandar `doc` num artigo legado **converte** o artigo para blocos (é o caminho de migração manual). Não existe o caminho de volta pela API.
- Mandar `body`/`title` num artigo que já tem `doc` é `400` (`body/title are derived from doc`).
- Toda edição que muda `doc` grava uma revisão (§7).

### 2.3 `GET /wiki/{slug}` — ler

Resposta atual + um campo:

```jsonc
{
  "id": 12,
  "slug": "sky-striker",
  "title": "Sky Striker",             // = doc.title
  "body": "Sky Striker is an…",        // texto derivado (§6); o front não renderiza isso se houver doc
  "doc": { /* WikiDoc */ },            // null em artigo legado
  "author": { … }, "updatedBy": { … },
  "publishedAt": null, "createdAt": "…", "updatedAt": "…"
}
```

`GET /wiki` (índice) **não** precisa mandar `doc` — o índice continua leve. Opcional e útil: acrescentar `summary` (= `doc.summary`) em cada linha.

### 2.4 Revisões

- `GET /wiki/{slug}/revisions/{id}` passa a devolver `doc` também (`null` em revisão legada).
- `POST …/restore` restaura `doc` + `title` + `body` daquela revisão. Como a revisão guarda o doc inteiro **com a biblioteca de imagens**, o restore é exato.

### 2.5 Imagens — ver §4

- `POST /wiki/assets/sign` — assina um upload direto para o S3.
- `POST /wiki/assets` — registra a imagem enviada e devolve um `WikiAsset`.

---

## 3. O documento (`WikiDoc`)

```ts
type WikiDoc = {
  v: 1                              // versão do schema (§8)
  title: string                     // 1–120, trim
  summary: string                   // 0–300, texto puro
  cover?: { asset: string }         // id na biblioteca
  infobox?: {
    asset?: string                  // id na biblioteca; exclusivo com statisticsDeck
    statisticsDeck?: WikiStatisticsDeck   // ver WIKI_EDITOR_BLOCKS.md
    caption?: string                // ≤ 300
    facts: { label: string; value: string }[]   // 0–16, ambos não vazios, ≤ 300 cada
  }
  tags: string[]                    // 0–8, cada uma /^[a-z0-9]+(-[a-z0-9]+)*$/, ≤ 24
  blocks: WikiBlock[]               // 1–200, ordem = ordem na página
  assets: Record<string, WikiAsset> // 0–100, chave === asset.id
  seo?: WikiSeo                     // §3.2
  hub?: string                      // slug do artigo-hub: breadcrumb e lista do hub
  related?: string[]                // 0–6 slugs, sem repetição: "Read next"
}
```

**Por que `slug` não está no doc:** o slug é o *endereço* do artigo, não conteúdo. Fica na linha do artigo, como hoje. Isso deixa um doc ser copiado para outro artigo sem carregar a URL junto.

**Por que `assets` vai dentro do doc:** para que o doc seja autossuficiente. Uma revisão restaurada traz suas imagens exatamente como estavam (alt, crédito, ponto focal), sem nenhuma chamada extra. Blocos só referenciam imagens por **id**; editar o alt de uma imagem muda todas as aparições dela.

### 3.1 `WikiAsset`

```ts
type WikiAsset = {
  id: string          // /^[A-Za-z0-9_-]{1,40}$/, único no doc
  src: string         // ver allowlist abaixo
  width: number       // inteiro > 0 — medido na origem, nunca digitado
  height: number      // inteiro > 0
  alt: string         // obrigatório, 1–200 (acessibilidade: sem alt, não publica)
  credit?: string     // ≤ 300
  focal?: { x: number; y: number }   // 0–100 inteiros; o ponto que sobrevive a um recorte
}
```

**Allowlist de `src`** (qualquer outra coisa é `400`):

| Padrão | Uso |
|---|---|
| `/caminho/arquivo.{png,jpg,jpeg,webp,avif,gif}` (começa com uma `/`, não `//`, sem `?` nem `#`) | arquivos em `public/` do front. Uma rota do site não é arquivo: o otimizador de imagem a executaria para cada leitor (a infográfica leva ~33 s em produção) |
| `https://ygopro.online/assets/card-arts/…` | arte de carta |
| `{S3_PUBLIC_URL}/wiki_assets/{id}` | uploads da wiki (§4). O servidor exige **a própria** base (`S3_PUBLIC_URL`, no front `NEXT_PUBLIC_UPLOADS_URL`) e a pasta `wiki_assets/` |

`width`/`height` existem para a página reservar o espaço certo antes da imagem chegar (zero layout shift). Para uploads, o servidor preenche com o que leu do próprio arquivo; para arte de carta é `624×624`; para caminhos locais o editor mede no navegador.

Ids que o editor gera: `card-{passcode}` para artes, `img-{8 hex}` para caminhos locais. Uploads recebem o id que o servidor devolver.

`credit` tem três sugestões prontas (`WIKI_CREDITS`): Duelists Unite, a linha do mangá e a da série. Qualquer outro crédito se digita.

### 3.2 `seo`, `hub` e `related`

Todas as chaves de `seo` são opcionais e `""` conta como ausente. O servidor monta o `<head>` publicado a partir delas (`WIKI_API.md` §5.6); o front só edita e confere.

| Campo | Regra |
|---|---|
| `seo.title` | ≤ 70, texto puro. Sem ele vale `doc.title` |
| `seo.description` | ≤ 160, texto puro. Sem ela vale `doc.summary` |
| `seo.keyword` | ≤ 60. Palavra-chave de foco: o doc guarda, o `<head>` não a publica, mas o doc é público |
| `seo.keywords` | ≤ 5, cada uma 1–60, sem repetição (maiúsculas não contam) |
| `seo.image` | id na biblioteca, no mínimo 1200×630. Sem ele vale a capa, depois a imagem do infobox |
| `seo.noindex` | rascunho já sai `noindex`, com ou sem a marca |
| `seo.canonical` | `/caminho` ou `https://…`, ≤ 500, sem espaços |
| `seo.schema` | `Article` (padrão), `HowTo`, `DefinedTerm` ou `CollectionPage` |
| `hub` | slug do hub, ≤ 80 |
| `related` | até 6 slugs |

O servidor confere que `hub` e `related` apontam para artigos que existem. A aba SEO do editor (`SeoTab.tsx`, `SeoRail.tsx`, regras em `utils/wiki-seo.ts`) mostra a prévia da busca e uma lista de checagens (`fix`, `warn`, `pass`). A caixa de publicação (`PublishDialog.tsx`) separa o que o servidor recusa (`validateDoc` e o endereço, que desligam o botão) do que só prejudica o ranking. Essas checagens orientam quem edita; só `validateDoc` bloqueia um salvamento.

---

## 4. Upload de imagem

Mesmo desenho da capa de perfil (`storage.ts` na API): o browser sobe **direto** para o S3 (presigned POST), mas a assinatura e a verificação ficam no backend. O backend nunca vira gargalo de banda e nunca aceita algo que não conferiu.

### 4.1 `POST /wiki/assets/sign` — `wiki.write`

Corpo `{ "contentType": "image/jpeg" | "image/png" }`. Resposta:

```json
{
  "uploadUrl": "https://{bucket}.s3.{region}.amazonaws.com/",
  "fields": {
    "key": "incoming/wiki_assets/{32 hex}",
    "Content-Type": "image/jpeg",
    "Policy": "…",
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": "…",
    "X-Amz-Date": "…",
    "X-Amz-Signature": "…"
  },
  "key": "wiki_assets/{32 hex}"
}
```

- A assinatura fixa key, Content-Type e no máximo 10 MB, e vence em 5 min.
- O arquivo cai em `incoming/`, privado. Só a API copia para a key pública, depois de conferir: re-subir com a mesma assinatura não troca uma imagem já aprovada.
- Só jpg/png: o Rekognition não lê webp, `gif` seria moderado por um frame só e `svg` carrega script — mesma regra da capa.
- `503` se o S3 não estiver configurado (o editor mostra "Couldn't reach the wiki").

### 4.2 Browser → S3

O front faz `POST uploadUrl` multipart com todos os `fields` e o `file` **por último** (o S3 ignora campo depois do arquivo). Resposta `204`. Nada aqui passa pela API.

### 4.3 `POST /wiki/assets` — `wiki.write`

```json
{ "publicId": "wiki_assets/9f2c…", "alt": "Sky Striker Ace - Raye mid-flight" }
```

O servidor:

1. confere o formato do `publicId` (`^wiki_assets/[0-9a-f]{32}$`);
2. **lê o próprio objeto** em `incoming/`: confere pelos bytes que é jpg/png e passa pelo Rekognition — o client não atesta nada. Reprovado é apagado;
3. lê `width`/`height` do cabeçalho do arquivo e copia o objeto para a key pública;
4. grava uma linha em `wiki_assets` (§7) com quem enviou;
5. devolve o `WikiAsset`:

```json
{
  "id": "wa-9f2c1b0e7a",
  "src": "{S3_PUBLIC_URL}/wiki_assets/9f2c…",
  "width": 1920,
  "height": 1080,
  "alt": "Sky Striker Ace - Raye mid-flight"
}
```

`src` é o arquivo original. O otimizador do Next redimensiona e escolhe o formato (`next.config.ts` libera só as pastas públicas do bucket), igual às capas.

Erros: `400` (publicId torto, alt vazio), `404` (upload não existe ou a assinatura venceu), `422` (não é jpg/png ou a moderação reprovou).

### 4.4 Limpeza (pode ficar para depois)

Uma imagem enviada e nunca usada em nenhum `doc` (atual ou de revisão) é lixo. Um job periódico pode apagar do S3 os `wiki_assets` com mais de 7 dias que não aparecem em nenhum doc. **Nunca** apague uma imagem que alguma revisão ainda referencia: o restore depende dela. Upload assinado e nunca registrado fica em `incoming/`, que a regra de lifecycle do bucket apaga em 1 dia.

---

## 5. Validação — o que o servidor **tem** que recusar

O front roda `validateDoc` antes de salvar, mas isso é só para mensagens legíveis. **O servidor é a fronteira de confiança**: tudo abaixo precisa ser checado de novo lá. Falha ⇒ `400 BAD_REQUEST` com `message` apontando o caminho (`doc.blocks[3].md: must not contain raw HTML`).

### 5.1 Forma (strict)

- `doc` é objeto; `v === 1`.
- **Chaves desconhecidas são recusadas** — no doc, em cada bloco e em cada asset. Isso impede front e back de derivarem em silêncio.
- **`type` desconhecido é recusado.** Um bloco novo exige deploy do back antes (ou junto) do front.
- Tamanho total de `JSON.stringify(doc)` ≤ **256 000 bytes** (UTF-8).

### 5.2 Limites

| Campo | Regra |
|---|---|
| `title` | trim, 1–120 |
| `summary` | 0–300, sem HTML |
| `tags` | 0–8; cada uma `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 24; sem repetição |
| `blocks` | 1–200 |
| `block.id` | `^[A-Za-z0-9_-]{1,40}$`, único no doc |
| `assets` | 0–100; chave === `asset.id` |
| textos curtos (`caption`, `title` de callout, `text`/`cite` de quote, `label`/`value` de fact, `credit`) | ≤ 300, sem HTML |
| Markdown (`md` de text/callout) | 1–20 000, **mesmas regras do `validateBody` atual**: sem HTML cru e todo link passa em `safeLink` |
| resposta de FAQ (`items[].md`) | 1–5 000, mesmas regras de Markdown |
| `seo`, `hub`, `related` | §3.2 |

### 5.3 Referências

- Todo id de imagem usado em `cover.asset`, `infobox.asset`, `figure.asset` e `gallery.assets[]` **existe** em `doc.assets`.
- `heading.anchor` segue `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 60, e é **único** entre os headings.
- `cards[].id` é inteiro positivo (passcode). Conferir se a carta existe é opcional; o nome fica gravado no doc para a página não depender da API de cartas.
- Todo `asset.src` passa na allowlist (§3.1).

### 5.4 Blocos

| `type` | Campos | Regras |
|---|---|---|
| `text` | `md` | Markdown, §5.2 |
| `heading` | `level: 2 \| 3`, `text`, `anchor` | `text` 1–300; `anchor` único |
| `figure` | `asset`, `align: 'left' \| 'right' \| 'center' \| 'wide'`, `caption?`, `mobileAsset?`, `share?` | `asset` e `mobileAsset` existem na biblioteca. `mobileAsset` substitui `asset` abaixo de 640px. `share: true` põe botões de compartilhar sobre a imagem, apontando para esta figura |
| `gallery` | `layout: 'grid' \| 'masonry' \| 'strip'`, `assets: string[]`, `caption?` | 2–24 ids, todos existem; ordem = ordem de exibição |
| `cards` | `cards: { id, name, note? }[]`, `perRow?`, `align?: 'left' \| 'center' \| 'right'`, `caption?` | 1–12 cartas; `name` 1–300; `perRow` 2–6 a partir de 640px (ausente = 4; celular mostra 2); `align` posiciona a última linha incompleta (ausente = `left`) |
| `statistics-deck` | `deck: { key, name, ladder, faces }`, `caption?` | ver [WIKI_EDITOR_BLOCKS.md](./WIKI_EDITOR_BLOCKS.md) |
| `article-preview` | `slug` | ver [WIKI_EDITOR_BLOCKS.md](./WIKI_EDITOR_BLOCKS.md) |
| `callout` | `tone: 'gold' \| 'cyan' \| 'negative'`, `title?`, `md` | Markdown, §5.2 |
| `quote` | `text`, `cite?` | `text` 1–300 |
| `code` | `lang: 'bash' \| 'powershell' \| 'cmd' \| 'json' \| 'lua' \| 'sql' \| 'text'`, `code`, `caption?` | `code` 1–20 000, texto literal: `<` e crases são permitidos, nada ali é Markdown nem HTML |
| `video` | `videoId`, `title`, `start?`, `caption?`, `uploadDate?` | `videoId` `^[A-Za-z0-9_-]{11}$` (só YouTube); `title` 1–300 (é o nome acessível do player); `start` inteiro ≥ 0, em segundos; `uploadDate` `YYYY-MM-DD`, dia real entre 2005-04-23 e hoje (UTC, um dia de folga). Sem ela o servidor não gera o resultado rico de vídeo |
| `faq` | `items: { q, md }[]` | 1–20 itens; `q` texto puro 1–300; `md` Markdown 1–5 000. O servidor junta todos os blocos FAQ do artigo num único `FAQPage` |

**Sobre o `video`:** o doc guarda só o **id**, nunca a URL. O editor aceita qualquer link (`watch?v=`, `youtu.be/`, `shorts/`, `embed/`, com `t=1m30s` ou `start=90`) e extrai id e início com `parseYouTube`. A página mostra a miniatura (`i.ytimg.com/vi/{id}/hqdefault.jpg`) e só cria o iframe `youtube-nocookie.com/embed/{id}` quando o leitor aperta play. Até esse clique, nada de script, cookie ou player do YouTube carrega. Se um dia houver CSP, ela precisa liberar `frame-src https://www.youtube-nocookie.com` e `img-src https://i.ytimg.com`.

Exemplo de cada um:

```json
[
  { "id": "b1", "type": "text", "md": "**Sky Striker** is an archetype…" },
  { "id": "b2", "type": "heading", "level": 2, "text": "History", "anchor": "history" },
  { "id": "b3", "type": "figure", "asset": "card-63166095", "align": "right", "caption": "Engage!" },
  { "id": "b4", "type": "gallery", "layout": "grid", "assets": ["card-26077387", "card-63288573"], "caption": "The Aces" },
  { "id": "b5", "type": "cards", "cards": [{ "id": 26077387, "name": "Sky Striker Ace - Raye", "note": "Main Deck" }] },
  { "id": "b6", "type": "callout", "tone": "gold", "title": "Rule to remember", "md": "Links sit in the **Extra** Monster Zone." },
  { "id": "b7", "type": "quote", "text": "You play the card your opponent just did.", "cite": "Omega community" },
  { "id": "b8", "type": "video", "videoId": "fzwWvs-6FEs", "title": "Sky Striker Deck Profile", "start": 90, "caption": "Deck profile", "uploadDate": "2024-05-01" },
  { "id": "b9", "type": "faq", "items": [{ "q": "How many Engage?", "md": "Three, **always**." }] }
]
```

`utils/wiki-doc.test.ts` testa a allowlist de `src` (`isAllowedSrc`) e `renderDocHtml`. **Nenhum teste cobre `validateDoc` nem `docFromMarkdown`** (âncora repetida, imagem inexistente, alt vazio, vídeo sem id ou título e a conversão de Markdown). O script `scripts/check-wiki-doc.ts`, que fazia essas asserções, foi removido. `scripts/wiki-tier-list.ts` chama `validateDoc` e recusa gravar um doc inválido, mas isso não substitui testes.

### 5.5 O que **não** é validado

- Ordem "bonita" dos blocos (um float seguido de outro float é permitido).
- Se o ponto focal faz sentido.
- Se o texto do Markdown é bom. :)

---

## 6. Campos derivados

Com `doc`, o servidor **calcula** as colunas que já existem, para nada que lê `title`/`body` hoje quebrar (índice, busca, meta description, painel):

- `title` = `doc.title.trim()`
- `body` = projeção em texto puro, em ordem:
  1. `doc.summary`
  2. para cada bloco: `text.md` e `callout.md` (com `title`) com a sintaxe Markdown removida; `heading.text`; `quote.text` + `cite`; `figure.caption`; `gallery.caption`; nomes das `cards`; `video.title` + `caption`
  3. partes separadas por `\n\n`, truncado em 100 000 caracteres

  Essa projeção **não é renderizada** — serve para `ILIKE`/full‑text e para artigos que ainda consultam `body`. Um `strip` simples (tirar `#*_>\`[]()` e URLs) basta.

A regra "body 1–100 000" da tabela continua valendo. Um doc só de imagens pode projetar texto vazio: nesse caso use o `title` como `body`.

---

## 7. Banco (Postgres, sugestão)

```sql
-- Artigo em blocos: doc e a fonte; title/body passam a ser derivados quando doc existe.
ALTER TABLE wiki_articles ADD COLUMN IF NOT EXISTS doc jsonb;

-- Revisao guarda o doc inteiro (com a biblioteca de imagens), entao o restore e exato.
ALTER TABLE wiki_revisions ADD COLUMN IF NOT EXISTS doc jsonb;

-- Toda imagem enviada, para auditoria e limpeza (§4.4). O doc guarda uma copia do WikiAsset;
-- esta tabela nao e consultada para renderizar.
CREATE TABLE IF NOT EXISTS wiki_assets (
  id          text PRIMARY KEY,                 -- ex.: wa-9f2c1b0e7a
  public_id   text NOT NULL UNIQUE,             -- wiki_assets/{32 hex}
  width       integer NOT NULL CHECK (width > 0),
  height      integer NOT NULL CHECK (height > 0),
  uploaded_by text NOT NULL REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Tags no indice sem varrer o jsonb (opcional, quando existir filtro por tag):
CREATE INDEX IF NOT EXISTS wiki_articles_tags_idx ON wiki_articles USING gin ((doc -> 'tags'));
```

- `doc` é gravado **como veio depois da validação** (mesmo JSON, só normalizado: `title` com trim, chaves opcionais vazias removidas). O front depende de receber de volta exatamente o que mandou.
- Não normalize blocos em tabelas próprias: o doc é lido e escrito sempre inteiro, é pequeno (≤ 256 KB) e versionado por revisão. `jsonb` é o formato certo.

---

## 8. Versionamento (`v`)

- Hoje `v = 1`.
- Mudança **compatível** (bloco novo, campo opcional novo): continua `v = 1`. O back aprende o campo primeiro, o front passa a mandar depois.
- Mudança **incompatível** (renomear campo, mudar significado): `v = 2`, e uma função `migrate(doc)` que sobe v1 → v2. O servidor aplica na leitura (ou num backfill) e **nunca** devolve um doc mais antigo que a versão atual. Revisões antigas também passam pela migração ao serem lidas/restauradas.

---

## 9. Segurança — por que o desenho é assim

- **Nenhum HTML atravessa a fronteira.** O front transforma Markdown em HTML **na hora de renderizar** (`renderDocHtml` → remark + `rehype-sanitize`). O servidor recusar HTML cru é a primeira parede; o sanitizer é a segunda.
- **Nenhuma URL de imagem arbitrária.** A allowlist de `src` impede que um editor faça a página carregar imagens de terceiros (tracking, conteúdo trocado depois) e impede o otimizador do Next de virar proxy aberto.
- **Links** seguem o `safeLink` atual: só `http(s)` e caminho interno. Nada de `javascript:`.
- **Upload** nunca é confiado ao client: assinatura com key, tipo e tamanho fixos, e a API lê o arquivo (bytes + Rekognition) antes de publicar.
- **Tamanho**: 256 KB por doc e 200 blocos seguram abuso e mantêm o render rápido.

---

## 10. Compatibilidade com o que existe

| Situação | Comportamento |
|---|---|
| Artigo legado (`doc = null`) | Página usa o renderer de Markdown de sempre; `/edit` abre o formulário antigo **com um botão "Convert to blocks"**. |
| Artigo em blocos | Página usa `ArticleView`; `/edit` abre o editor de blocos. |
| Converter legado → blocos | **Feito no front.** O botão roda `docFromMarkdown(title, body)` no navegador e abre o editor já com o resultado. Nada muda no servidor até o editor salvar, e aí é um `PATCH { doc }` normal (§2.2), que grava revisão como qualquer edição. |
| Revisão legada num artigo convertido | Restore traz `body` sem `doc` ⇒ artigo volta a ser legado. Aceitável; alternativa é o servidor rodar a mesma conversão (§10.1) no restore. |

### 10.1 A conversão (`docFromMarkdown`)

Regras, para o back poder reproduzir se quiser converter em massa (um backfill) ou no restore:

1. Percorre o `body` linha a linha, controlando cercas de código (` ``` ` / `~~~`): nada dentro delas é interpretado.
2. Linha `#`, `##` ou `###` (fora de cerca) fecha o texto acumulado e vira um bloco `heading`: `#` e `##` → `level: 2`, `###` → `level: 3`. `####` em diante continua dentro do Markdown.
3. `anchor = toAnchor(texto)` (minúsculas, acentos removidos, não-alfanumérico vira `-`, máx. 60). Âncora repetida ganha `-2`, `-3`…; texto sem letras vira `section-{n}`.
4. Todo o resto entre headings vira um bloco `text` com o Markdown original, sem mexer (`trim` nas pontas; trechos vazios não viram bloco).
5. Ids `b1`, `b2`, … em ordem. `summary: ""`, `tags: []`, `assets: {}`, sem capa nem infobox.

O resultado sempre passa em `validateDoc` (desde que o Markdown original já passava nas regras de hoje) e a página fica visualmente igual. Imagens `![](...)` continuam dentro do Markdown: virar `figure` exigiria medir largura e altura, então fica a cargo do editor humano.

### 10.2 Rascunho automático (só front, nada muda no back)

O editor grava o trabalho **no navegador** (`localStorage`, chave `wiki-draft:{slug}` ou `wiki-draft:new`) meio segundo depois de cada mudança. Ao abrir o editor de novo com um rascunho diferente do salvo, ele oferece **Restore / Discard**. Se o artigo foi salvo por alguém depois que o rascunho começou (`updatedAt` mudou), o aviso diz que restaurar sobrescreve essas mudanças. O rascunho é apagado ao salvar com sucesso.

Isso protege contra aba fechada, crash e sessão expirada, mas não sincroniza entre dispositivos. Se um dia isso for necessário, o caminho é salvar como rascunho no servidor (`published: false`, que já existe), não inventar outro armazenamento.

---

## 11. Estado do back

O `omega-server-v3` já implementa tudo o que este contrato pede: `validateDoc` estrito (`wiki.doc.ts`), `doc` em criação, edição, leitura e revisões, restauração exata, a migração SQL, o fluxo de upload em duas chamadas, o bloco `video`, o bloco `faq`, `seo`, `hub` e `related`, mais curtidas, visualizações e comentários. A lista de endpoints, os códigos de erro e as sequências de chamada ficam em `omega-server-v3/docs/front/WIKI_API.md`. Mantenha um bloco novo ali primeiro: o servidor recusa `type` desconhecido.

Falta o backfill opcional que converte artigos legados com as regras de §10.1. Hoje a conversão só acontece quando alguém aperta **Convert to blocks**.

---

## 12. Mapa do front

| Arquivo | Papel |
|---|---|
| `utils/wiki-doc.ts` | Tipos, `DOC_LIMITS`, `BLOCK_CATALOG`, `emptyBlock`, `validateDoc`, `renderDocHtml`, allowlist de `src` (`isAllowedSrc`), `parseYouTube`, `docFromMarkdown`, `shareCrop` |
| `utils/wiki-seo.ts` | Checagens de SEO (`seoChecks`, `seoScore`), título e descrição como a busca os mostra |
| `utils/wiki-topics.ts` | Os quatro tópicos do índice e a regra que classifica cada artigo |
| `utils/wiki-statistics-deck.ts`, `utils/wiki-article-preview.ts` | Dados dos blocos `statistics-deck` e `article-preview` |
| `utils/articles.ts` | `createArticle`/`updateArticle` (aceitam doc), `uploadWikiAsset` (fluxo §4), editores, curtidas e comentários |
| `utils/types.ts` | `Article.doc`, `DocArticleDraft`, `DocArticlePatch` |
| `components/omega/wiki/article-view.tsx` | A página inteira a partir de um doc (capa, blocos, infobox, sumário) |
| `components/omega/wiki/blocks.tsx` | Um `case` por tipo de bloco |
| `components/omega/wiki/lightbox.tsx` | Galeria + visualizador (`<dialog>` nativo) |
| `components/omega/wiki/video.tsx` | YouTube que só carrega no play |
| `components/omega/wiki/code-block.tsx` | Bloco de código com cores por linguagem |
| `components/omega/wiki/statistics-deck.tsx`, `article-preview.tsx` | Renderização dos dois blocos de WIKI_EDITOR_BLOCKS.md |
| `components/omega/wiki/comments.tsx`, `share-buttons.tsx` | Comentários e botões de compartilhar |
| `app/wiki/page.tsx`, `app/wiki/ad-breaks.ts` | Índice com filtro por tópico; `adAfter` põe um banner a cada 12 linhas, nunca depois da última |
| `app/wiki/editor/DocEditor.tsx` | Editor: abas Outline e Add block, drag & drop, página, preview, JSON, rascunho local, salvar |
| `app/wiki/editor/SeoTab.tsx`, `SeoRail.tsx`, `PublishDialog.tsx` | Aba SEO, prévia da busca e confirmação de publicação |
| `app/wiki/editor/HistoryRail.tsx` | Revisões e restauração dentro do editor |
| `app/wiki/editor/LegacyEditor.tsx` | Formulário Markdown antigo + botão "Convert to blocks" |
| `app/wiki/editor/fields.tsx` | Campos de cada bloco e `blockSummary` |
| `app/wiki/editor/AssetLibrary.tsx` | Biblioteca: upload, arte por passcode, caminho local, alt, crédito, ponto focal |
| `app/wiki/panel/` | Painel de editores (promover e rebaixar) |
| `scripts/wiki-tier-list.ts` | Gera as páginas semanais em `docs/wiki-pages/` (`pnpm tierlist`) |

### Adicionar um bloco novo (receita)

1. Back: aceitar o novo `type` no validador (e deployar).
2. `utils/wiki-doc.ts`: variante em `WikiBlock`, entrada em `BLOCK_CATALOG`, `emptyBlock`, regra em `validateDoc` (e em `renderDocHtml` se tiver Markdown).
3. `components/omega/wiki/blocks.tsx`: o `case` que renderiza.
4. `app/wiki/editor/fields.tsx`: o `case` com os campos e o resumo em `blockSummary`.
5. Este documento: §5.4.

Todo `switch` sobre `block.type` termina em `default: return block satisfies never`: o TypeScript **não compila** enquanto o tipo novo não for tratado em `emptyBlock`, `validateDoc`, no renderer, nos campos e no resumo.
