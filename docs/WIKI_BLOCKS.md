# Wiki em blocos — contrato front ↔ back

> **Para quem é:** quem vai adaptar o `omega-server-v3` (módulo `wiki`) para aceitar artigos em blocos.
> **Fonte da verdade no front:** `utils/wiki-doc.ts` (tipos, limites, validação). Este documento descreve o mesmo contrato em prosa; se os dois divergirem, o código ganha e este arquivo está desatualizado.

---

## 0. Resumo em 30 segundos

- Um artigo deixa de ser um Markdown só e passa a ser um **documento JSON** (`WikiDoc`): título, resumo, tags, capa, infobox, uma **lista ordenada de blocos** e uma **biblioteca de imagens**.
- O editor (`/wiki/new`) monta esse JSON com drag & drop. O front **manda o JSON inteiro**; o back **valida, guarda e devolve o mesmo JSON**.
- A página pública renderiza **só** a partir do JSON. Mesmo JSON ⇒ mesma página, pixel a pixel. Não existe estado de layout fora dele.
- O Markdown não sumiu: ele vive **dentro** dos blocos `text` e `callout`, com as mesmas regras de hoje (sem HTML cru, links só `http(s)` ou caminho interno).
- Artigos antigos (só `body`) continuam funcionando: `doc: null` ⇒ o front usa o renderer de Markdown de sempre. O `/edit` deles tem um botão que converte para blocos no navegador (§10.1).
- Blocos: `text`, `heading`, `figure`, `gallery`, `cards`, `callout`, `quote`, `code`, `video`.
- O rascunho automático fica no navegador e não exige nada do back (§10.2).

---

## 1. Fluxo

```
┌──────────── Editor (/wiki/new, /wiki/{slug}/edit) ─────────────┐
│ paleta de componentes ──drag/click──▶ lista de blocos          │
│ biblioteca de imagens ◀── upload (Cloudinary, §4)              │
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

- `POST /wiki/assets/sign` — assina um upload direto para a Cloudinary.
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
    asset?: string                  // id na biblioteca
    caption?: string                // ≤ 300
    facts: { label: string; value: string }[]   // 0–16, ambos não vazios, ≤ 300 cada
  }
  tags: string[]                    // 0–8, cada uma /^[a-z0-9]+(-[a-z0-9]+)*$/, ≤ 24
  blocks: WikiBlock[]               // 1–200, ordem = ordem na página
  assets: Record<string, WikiAsset> // 0–100, chave === asset.id
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
| `/qualquer/caminho` (começa com uma `/`, não `//`) | arquivos em `public/` do front |
| `https://ygopro.online/assets/card-arts/{passcode}.jpg` | arte de carta |
| `https://res.cloudinary.com/{CLOUD}/image/upload/wiki_assets/{id}` | uploads da wiki (§4). O servidor deve exigir **o próprio** `CLOUD` e a pasta `wiki_assets/` |

`width`/`height` existem para a página reservar o espaço certo antes da imagem chegar (zero layout shift). Para uploads, o servidor preenche com o que a Cloudinary informar; para arte de carta é `624×624`; para caminhos locais o editor mede no navegador.

Ids que o editor gera: `card-{passcode}` para artes, `img-{8 hex}` para caminhos locais. Uploads recebem o id que o servidor devolver.

---

## 4. Upload de imagem

Mesmo desenho da capa de perfil (`profile.cloudinary.ts`): o browser sobe **direto** para a Cloudinary, mas a assinatura e a verificação ficam no backend. O backend nunca vira gargalo de banda e nunca aceita algo que não conferiu.

### 4.1 `POST /wiki/assets/sign` — `wiki.write`

Sem corpo. Resposta:

```json
{
  "uploadUrl": "https://api.cloudinary.com/v1_1/{CLOUD}/image/upload",
  "fields": {
    "allowed_formats": "jpg,jpeg,png,webp",
    "moderation": "…",
    "overwrite": "false",
    "public_id": "wiki_assets/{32 hex}",
    "timestamp": 1760000000,
    "api_key": "…",
    "signature": "…"
  }
}
```

- `public_id` novo a cada assinatura + `overwrite=false`: ninguém troca uma imagem já aprovada re-subindo no mesmo id.
- Sem `gif` (moderação lê um frame só) e sem `svg` (script embutido) — mesma regra da capa.
- `503` se a Cloudinary não estiver configurada (o editor mostra "Couldn't reach the wiki").

### 4.2 Browser → Cloudinary

O front faz `POST uploadUrl` multipart com todos os `fields` + `file`. Nada aqui passa pela API.

### 4.3 `POST /wiki/assets` — `wiki.write`

```json
{ "publicId": "wiki_assets/9f2c…", "alt": "Sky Striker Ace - Raye mid-flight" }
```

O servidor:

1. confere o formato do `publicId` (`^wiki_assets/[0-9a-f]{32}$`);
2. **pergunta à própria Cloudinary** (Admin API) se o recurso existe e se a moderação aprovou — o client não atesta nada;
3. lê `width`/`height` da resposta da Cloudinary;
4. grava uma linha em `wiki_assets` (§7) com quem enviou;
5. devolve o `WikiAsset`:

```json
{
  "id": "wa-9f2c1b0e7a",
  "src": "https://res.cloudinary.com/{CLOUD}/image/upload/wiki_assets/9f2c…",
  "width": 1920,
  "height": 1080,
  "alt": "Sky Striker Ace - Raye mid-flight"
}
```

`src` vai **sem transformação**. O front acrescenta `f_auto,q_auto,w_{n},c_limit` conforme o tamanho em que pinta cada imagem (`imageSource` em `utils/wiki-doc.ts`), igual `coverUrl` faz com as capas. Essas imagens não passam pelo otimizador do Next.

Erros: `400` (publicId torto, alt vazio), `404` (não existe na Cloudinary), `422` ou `400` (moderação reprovou/pendente — escolha um e documente no `WIKI_API.md`).

### 4.4 Limpeza (pode ficar para depois)

Uma imagem enviada e nunca usada em nenhum `doc` (atual ou de revisão) é lixo. Um job periódico pode apagar da Cloudinary os `wiki_assets` com mais de 7 dias que não aparecem em nenhum doc. **Nunca** apague uma imagem que alguma revisão ainda referencia: o restore depende dela.

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
| `figure` | `asset`, `align: 'left' \| 'right' \| 'center' \| 'wide'`, `caption?` | `asset` existe |
| `gallery` | `layout: 'grid' \| 'masonry' \| 'strip'`, `assets: string[]`, `caption?` | 2–24 ids, todos existem; ordem = ordem de exibição |
| `cards` | `cards: { id, name, note? }[]`, `caption?` | 1–12 cartas; `name` 1–300 |
| `callout` | `tone: 'gold' \| 'cyan' \| 'negative'`, `title?`, `md` | Markdown, §5.2 |
| `quote` | `text`, `cite?` | `text` 1–300 |
| `code` | `lang: 'bash' \| 'powershell' \| 'cmd' \| 'json' \| 'lua' \| 'sql' \| 'text'`, `code`, `caption?` | `code` 1–20 000, texto literal: `<` e crases são permitidos, nada ali é Markdown nem HTML |
| `video` | `videoId`, `title`, `start?`, `caption?` | `videoId` `^[A-Za-z0-9_-]{11}$` (só YouTube); `title` 1–300 (é o nome acessível do player); `start` inteiro ≥ 0, em segundos |

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
  { "id": "b8", "type": "video", "videoId": "fzwWvs-6FEs", "title": "Sky Striker Deck Profile", "start": 90, "caption": "Deck profile" }
]
```

`scripts/check-wiki-doc.ts` tem as asserções que o validador do back deve reproduzir (âncora repetida, imagem inexistente, host estranho, alt vazio e vídeo sem id/título recusados; conversão de Markdown gera um doc válido).

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
- **Upload** nunca é confiado ao client: assinatura com `public_id` fixo e verificação na Cloudinary antes de registrar.
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

## 11. Checklist do backend

- [ ] `wiki.validation.ts`: `validateDoc(value)` estrito (§5), reutilizando `validateBody`/`safeLink` para cada Markdown.
- [ ] `POST /wiki`: aceitar `{ doc, slug?, published? }`; derivar `title`/`body` (§6); `400` se vier `doc` + `body`.
- [ ] `PATCH /wiki/{slug}`: aceitar `doc`; substituir inteiro; `400` para `title`/`body` em artigo com `doc`.
- [ ] `GET /wiki/{slug}` e revisões: incluir `doc`.
- [ ] Restore: restaurar `doc` junto.
- [ ] Migração SQL (§7).
- [ ] `POST /wiki/assets/sign` e `POST /wiki/assets` (§4), reaproveitando `sign`/`admin` de `profile.cloudinary.ts` com pasta `wiki_assets/`.
- [ ] Bloco `video` no validador (§5.4): id de 11 caracteres, `title` obrigatório, `start` inteiro ≥ 0.
- [ ] Testes: os casos recusados de `scripts/check-wiki-doc.ts` dão `400`.
- [ ] (Opcional) Backfill ou restore convertendo Markdown com as regras de §10.1.
- [ ] Atualizar `docs/front/WIKI_API.md` (§4.2, §4.6, §4.7 e seção nova de assets).

---

## 12. Mapa do front

| Arquivo | Papel |
|---|---|
| `utils/wiki-doc.ts` | Tipos, `DOC_LIMITS`, `BLOCK_CATALOG`, `validateDoc`, `renderDocHtml`, `imageSource`, allowlist, `parseYouTube`, `docFromMarkdown` |
| `utils/articles.ts` | `createArticle`/`updateArticle` (aceitam doc), `uploadWikiAsset` (fluxo §4) |
| `utils/types.ts` | `Article.doc`, `DocArticleDraft`, `DocArticlePatch` |
| `components/omega/wiki/article-view.tsx` | A página inteira a partir de um doc (capa, blocos, infobox, sumário) |
| `components/omega/wiki/blocks.tsx` | Um `case` por tipo de bloco |
| `components/omega/wiki/lightbox.tsx` | Galeria + visualizador (`<dialog>` nativo) |
| `components/omega/wiki/video.tsx` | YouTube que só carrega no play |
| `app/wiki/editor/DocEditor.tsx` | Editor: paleta, drag & drop, página, preview, JSON, rascunho local, salvar |
| `app/wiki/editor/LegacyEditor.tsx` | Formulário Markdown antigo + botão "Convert to blocks" |
| `app/wiki/editor/fields.tsx` | Campos de cada bloco |
| `app/wiki/editor/AssetLibrary.tsx` | Biblioteca: upload, arte por passcode, caminho local, alt, crédito, ponto focal |
| `scripts/check-wiki-doc.ts` | Auto-checagem do contrato (`npx tsx --tsconfig tsconfig.json scripts/check-wiki-doc.ts`) |

### Adicionar um bloco novo (receita)

1. Back: aceitar o novo `type` no validador (e deployar).
2. `utils/wiki-doc.ts`: variante em `WikiBlock`, entrada em `BLOCK_CATALOG`, `emptyBlock`, regra em `validateDoc` (e em `renderDocHtml` se tiver Markdown).
3. `components/omega/wiki/blocks.tsx`: o `case` que renderiza.
4. `app/wiki/editor/fields.tsx`: o `case` com os campos e o resumo em `blockSummary`.
5. Este documento: §5.4.

Todo `switch` sobre `block.type` termina em `default: return block satisfies never`: o TypeScript **não compila** enquanto o tipo novo não for tratado em `emptyBlock`, `validateDoc`, no renderer, nos campos e no resumo.
