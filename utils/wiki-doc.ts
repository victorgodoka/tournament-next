/**
 * Block document for wiki articles: the one shape the editor writes, the API stores and the page renders.
 * The same JSON always renders the same page — there is no layout state outside it.
 * The contract, limits and endpoints are in omega-server-v3 WIKI_API.md §5.
 */
import type { ReactNode } from 'react'
import { cardsByIds } from '@utils/cards'
import { renderArticle, renderCode } from '@utils/remark'
import type { WikiCard } from '@utils/wiki'

/** Bump on any breaking change to a block; the reader migrates old docs up before rendering. */
export const WIKI_DOC_VERSION = 1

/** An uploaded (or linked) image. Width/height are recorded at upload, so layout never shifts. */
export type WikiAsset = {
  id: string
  src: string
  width: number
  height: number
  /** Required: an image without alt text is not publishable. */
  alt: string
  credit?: string
  /** 0–100 on each axis: which part survives when the image is cropped to fit a slot. */
  focal?: { x: number; y: number }
}

/**
 * The credits the image picker offers. A new upload starts on Duelists Unite; the other two are the
 * Yu-Gi-Oh! lines (the original manga, the later anime series). Any other credit is typed in by hand.
 */
export const WIKI_CREDITS: readonly string[] = ['Duelists Unite', '©1996 KAZUKI TAKAHASHI', '©2020 Studio Dice/SHUEISHA, TV TOKYO, KONAMI']

/** `left`/`right` float beside the text that follows; `wide` spans the column; `center` sits narrower. */
export type FigureAlign = 'left' | 'right' | 'center' | 'wide'

export type GalleryLayout = 'grid' | 'masonry' | 'strip'

export type CalloutTone = 'gold' | 'cyan' | 'negative'

/** Where a short last row of cards sits. */
export type CardsAlign = 'left' | 'center' | 'right'

export type WikiCardRef = { id: number; name: string; note?: string }

/** What a code block can be coloured as, in the order the editor lists them. `text` stays plain. */
export const CODE_LANGUAGES = {
  bash: 'Bash',
  powershell: 'PowerShell',
  cmd: 'CMD',
  json: 'JSON',
  lua: 'Lua',
  sql: 'SQL',
  text: 'Plain',
} as const

export type CodeLanguage = keyof typeof CODE_LANGUAGES

/** Every block carries a stable `id`: editors reorder and diff by it, and it anchors comments later. */
export type WikiBlock =
  | { id: string; type: 'text'; md: string }
  | { id: string; type: 'heading'; level: 2 | 3; text: string; anchor: string }
  /** `mobileAsset` replaces `asset` under 640px. `share` puts share buttons over the image, pointing at this figure. */
  | { id: string; type: 'figure'; asset: string; align: FigureAlign; caption?: string; mobileAsset?: string; share?: boolean }
  | { id: string; type: 'gallery'; layout: GalleryLayout; assets: string[]; caption?: string }
  /** `perRow` 2–6 from 640px (absent = 4; phones show 2). `align` absent = `left`. */
  | { id: string; type: 'cards'; cards: WikiCardRef[]; perRow?: number; align?: CardsAlign; caption?: string }
  | { id: string; type: 'callout'; tone: CalloutTone; title?: string; md: string }
  | { id: string; type: 'quote'; text: string; cite?: string }
  /** Literal text, never Markdown: `<` and backticks are fine here. */
  | { id: string; type: 'code'; lang: CodeLanguage; code: string; caption?: string }
  /**
   * YouTube only. `start` in seconds. Nothing loads from YouTube until the reader presses play.
   * `uploadDate` (`YYYY-MM-DD`) is the day it went up on YouTube: without it there is no video rich result.
   */
  | { id: string; type: 'video'; videoId: string; title: string; start?: number; caption?: string; uploadDate?: string }
  /** Questions in plain text, answers in Markdown. The server merges every FAQ block into one FAQPage. */
  | { id: string; type: 'faq'; items: WikiFaqItem[] }

type WikiFaqItem = { q: string; md: string }

export type WikiBlockType = WikiBlock['type']

export type WikiSchema = 'Article' | 'HowTo' | 'DefinedTerm' | 'CollectionPage'

/** Every key optional; `""` counts as absent. The server derives the published head from these (WIKI_API §5.6). */
export type WikiSeo = {
  title?: string
  description?: string
  /** Focus keyword. Stored, never published — but the doc is public, so it isn't secret. */
  keyword?: string
  keywords?: string[]
  /** Asset id, at least 1200×630. */
  image?: string
  noindex?: boolean
  canonical?: string
  schema?: WikiSchema
}

export type WikiInfobox = { asset?: string; caption?: string; facts: { label: string; value: string }[] }

/** The article's content. The slug is not in here: it is the article's address, not its content. */
export type WikiDoc = {
  v: typeof WIKI_DOC_VERSION
  title: string
  /** Plain text. Feeds the lead paragraph, the meta description and the index row. */
  summary: string
  cover?: { asset: string }
  infobox?: WikiInfobox
  tags: string[]
  blocks: WikiBlock[]
  /** Every image the doc uses, by id. Stored with the doc, so a revision restores its images too. */
  assets: Record<string, WikiAsset>
  seo?: WikiSeo
  /** Slug of the hub article: the breadcrumb and the hub's list. Resolved into `links.hub` on read. */
  hub?: string
  /** Up to 6 slugs, shown as "Read next". */
  related?: string[]
}

/** Limits the server enforces (WIKI_API.md §5.3). The editor checks them first for readable errors. */
export const DOC_LIMITS = {
  title: 120,
  summary: 300,
  tags: 8,
  tag: 24,
  blocks: 200,
  md: 20_000,
  short: 300,
  facts: 16,
  galleryMin: 2,
  galleryMax: 24,
  cards: 12,
  assets: 100,
  bytes: 256_000,
  slug: 80,
  seoTitle: 70,
  seoDescription: 160,
  keyword: 60,
  keywords: 5,
  canonical: 500,
  related: 6,
  faqItems: 20,
  faqMd: 5_000,
  /** The smallest share image the server accepts for `seo.image`. */
  shareWidth: 1200,
  shareHeight: 630,
} as const

/** Palette entries, in the order the editor lists them. */
export const BLOCK_CATALOG: { type: WikiBlockType; label: string; hint: string }[] = [
  { type: 'text', label: 'Text', hint: 'Markdown' },
  { type: 'heading', label: 'Heading', hint: 'H2 · H3' },
  { type: 'figure', label: 'Image', hint: 'Float · wide' },
  { type: 'gallery', label: 'Gallery', hint: '2–24 images' },
  { type: 'cards', label: 'Cards', hint: 'Card links' },
  { type: 'callout', label: 'Callout', hint: 'Rule · warning' },
  { type: 'quote', label: 'Quote', hint: 'With source' },
  { type: 'code', label: 'Code', hint: 'Coloured by language' },
  { type: 'video', label: 'Video', hint: 'YouTube' },
  { type: 'faq', label: 'FAQ', hint: 'Questions → FAQPage' },
]

const SCHEMAS: readonly WikiSchema[] = ['Article', 'HowTo', 'DefinedTerm', 'CollectionPage']

export const emptyBlock = (type: WikiBlockType, id: string): WikiBlock => {
  switch (type) {
    case 'text':
      return { id, type, md: '' }
    case 'heading':
      return { id, type, level: 2, text: '', anchor: '' }
    case 'figure':
      return { id, type, asset: '', align: 'right' }
    case 'gallery':
      return { id, type, layout: 'grid', assets: [] }
    case 'cards':
      return { id, type, cards: [] }
    case 'callout':
      return { id, type, tone: 'gold', md: '' }
    case 'quote':
      return { id, type, text: '' }
    case 'code':
      return { id, type, lang: 'bash', code: '' }
    case 'video':
      return { id, type, videoId: '', title: '' }
    case 'faq':
      return { id, type, items: [{ q: '', md: '' }] }
  }
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

/**
 * A YouTube link (watch, youtu.be, shorts, embed, live) or a bare id → `{ videoId, start? }`.
 * `null` when it isn't one. `t=90`, `t=1m30s` and `start=90` all become seconds.
 */
export const parseYouTube = (input: string): { videoId: string; start?: number } | null => {
  const text = input.trim()
  if (YOUTUBE_ID.test(text)) return { videoId: text }
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '')
  const id =
    host === 'youtu.be'
      ? url.pathname.slice(1)
      : host === 'youtube.com' || host === 'youtube-nocookie.com'
        ? (url.searchParams.get('v') ?? url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] ?? '')
        : ''
  if (!YOUTUBE_ID.test(id)) return null

  const t = url.searchParams.get('t') ?? url.searchParams.get('start')
  const match = t?.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/)
  const start = match ? Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0) : 0
  return start > 0 ? { videoId: id, start } : { videoId: id }
}

/**
 * A legacy Markdown article as a block doc: `#`/`##` become H2 blocks, `###` H3, and everything
 * between stays Markdown in text blocks. The page reads the same; it is just editable in blocks now.
 * Headings inside code fences are left alone.
 */
export const docFromMarkdown = (title: string, body: string): WikiDoc => {
  const blocks: WikiBlock[] = []
  const anchors = new Set<string>()
  let text: string[] = []
  let fenced = false

  const flush = () => {
    const md = text.join('\n').trim()
    if (md) blocks.push({ id: `b${blocks.length + 1}`, type: 'text', md })
    text = []
  }

  for (const line of body.split(/\r?\n/)) {
    if (/^\s{0,3}(```|~~~)/.test(line)) fenced = !fenced
    const heading = fenced ? null : line.match(/^\s{0,3}(#{1,3})\s+(.+?)\s*#*\s*$/)
    if (!heading?.[1] || !heading[2]) {
      text.push(line)
      continue
    }
    flush()
    const words = heading[2]
    // Same anchor twice gets a counter, so the doc stays valid.
    const base = toAnchor(words) || `section-${blocks.length + 1}`
    let anchor = base
    for (let n = 2; anchors.has(anchor); n++) anchor = `${base}-${n}`
    anchors.add(anchor)
    blocks.push({ id: `b${blocks.length + 1}`, type: 'heading', level: heading[1].length === 3 ? 3 : 2, text: words, anchor })
  }
  flush()

  return { ...emptyDoc(), title, blocks }
}

export const emptyDoc = (): WikiDoc => ({ v: WIKI_DOC_VERSION, title: '', summary: '', tags: [], blocks: [], assets: {} })

/** `Sky Striker: History!` → `sky-striker-history`. Same rule as article slugs. */
export const toAnchor = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

/** Table of contents, straight from the heading blocks. */
export const outline = (doc: WikiDoc) => doc.blocks.flatMap((block) => (block.type === 'heading' ? [block] : []))

/**
 * Where a wiki image may live: files in `public/`, card arts, and the wiki's own Cloudinary folder. The server refuses
 * anything else. A route of this site is not a file: the image optimiser would run it for readers, and
 * `/statistics/infographic/*` takes ~33 s on production, in the process that serves the site.
 */
const ALLOWED_SRC = [
  /^\/(?!\/)[^?#]*\.(?:png|jpe?g|webp|avif|gif)$/i,
  /^https:\/\/ygopro\.online\/assets\/card-arts\//,
  /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/wiki_assets\//,
]

export const isAllowedSrc = (src: string) => ALLOWED_SRC.some((pattern) => pattern.test(src))

const CLOUDINARY_UPLOAD = '/image/upload/'

/**
 * `src` (and `unoptimized`) for `<Image>`. Cloudinary resizes and picks the format on its own CDN,
 * like profile covers, so its images skip Next's optimiser; `width` is the widest the slot paints.
 */
export const imageSource = (asset: WikiAsset, width: number) =>
  asset.src.startsWith('https://res.cloudinary.com/')
    ? { src: asset.src.replace(CLOUDINARY_UPLOAD, `${CLOUDINARY_UPLOAD}f_auto,q_auto,w_${width},c_limit/`), unoptimized: true }
    : { src: asset.src }

const ANCHOR = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const RAW_HTML = /<[a-zA-Z/!]/
const CANONICAL = /^(\/(?!\/)\S*|https:\/\/\S+)$/
/** The day YouTube went live; nothing can have been uploaded before it. */
const FIRST_UPLOAD = '2005-04-23'

/** A wiki address: lowercase words joined by single hyphens, at most 80 characters. */
export const isSlug = (slug: string) => ANCHOR.test(slug) && slug.length <= DOC_LIMITS.slug

/** `YYYY-MM-DD` that is a real date, from YouTube's first day to today (UTC, one day of slack). */
export const isUploadDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
  return value >= FIRST_UPLOAD && value <= tomorrow
}

export const isShareSize = (asset: WikiAsset) => asset.width >= DOC_LIMITS.shareWidth && asset.height >= DOC_LIMITS.shareHeight

/**
 * The 1200:630 rectangle the server cuts for og:image, in the asset's own pixels: the largest one that
 * fits, centred on `focal` (centre when absent) and pushed back inside near the edges (WIKI_API §5.6).
 */
export const shareCrop = (asset: WikiAsset) => {
  const ratio = DOC_LIMITS.shareWidth / DOC_LIMITS.shareHeight
  const w = Math.min(asset.width, asset.height * ratio)
  const h = w / ratio
  const fx = ((asset.focal?.x ?? 50) / 100) * asset.width
  const fy = ((asset.focal?.y ?? 50) / 100) * asset.height
  const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max)
  return { x: clamp(fx - w / 2, asset.width - w), y: clamp(fy - h / 2, asset.height - h), w, h }
}

/** The image og:image falls back through: `seo.image`, then the cover, then the infobox image. */
export const shareAsset = (doc: WikiDoc): WikiAsset | undefined => {
  const id = doc.seo?.image || doc.cover?.asset || doc.infobox?.asset
  return id ? doc.assets[id] : undefined
}

/**
 * Every problem, in reading order, as copy an editor can act on. Empty means publishable.
 * The server runs the same rules; this copy only exists to fail fast.
 */
export const validateDoc = (doc: WikiDoc): string[] => {
  const problems: string[] = []
  const has = (id: string | undefined) => !!id && !!doc.assets[id]
  const md = (text: string, where: string, max: number = DOC_LIMITS.md) => {
    if (!text.trim()) problems.push(`${where} is empty.`)
    if (text.length > max) problems.push(`${where} is over ${max.toLocaleString('en-US')} characters.`)
    if (RAW_HTML.test(text)) problems.push(`${where} contains raw HTML. Use Markdown.`)
  }
  const plain = (text: string | undefined, where: string, max: number) => {
    if (!text) return
    if (text.length > max) problems.push(`Keep the ${where} under ${max} characters.`)
    if (RAW_HTML.test(text)) problems.push(`The ${where} contains raw HTML.`)
  }

  if (!doc.title.trim()) problems.push('Give the article a title.')
  if (doc.title.length > DOC_LIMITS.title) problems.push(`Keep the title under ${DOC_LIMITS.title} characters.`)
  if (doc.summary.length > DOC_LIMITS.summary) problems.push(`Keep the summary under ${DOC_LIMITS.summary} characters.`)
  if (doc.tags.length > DOC_LIMITS.tags) problems.push(`Use at most ${DOC_LIMITS.tags} tags.`)
  if (new Set(doc.tags).size !== doc.tags.length) problems.push('A tag appears twice.')
  for (const tag of doc.tags) {
    if (!ANCHOR.test(tag) || tag.length > DOC_LIMITS.tag) problems.push(`Tag "${tag}" must be lowercase words joined by hyphens.`)
  }
  if (doc.cover && !has(doc.cover.asset)) problems.push('The cover image is missing from the library.')
  if (doc.infobox) {
    if (doc.infobox.asset && !has(doc.infobox.asset)) problems.push('The infobox image is missing from the library.')
    if (doc.infobox.facts.length > DOC_LIMITS.facts) problems.push(`The infobox has more than ${DOC_LIMITS.facts} facts.`)
    // A fact's values are its lines, so an empty line is an empty value.
    if (doc.infobox.facts.some((fact) => !fact.label.trim() || fact.value.split('\n').some((value) => !value.trim())))
      problems.push('Every infobox fact needs a label, and none of its values can be empty.')
  }

  const assets = Object.values(doc.assets)
  if (assets.length > DOC_LIMITS.assets) problems.push(`The library holds more than ${DOC_LIMITS.assets} images.`)
  for (const asset of assets) {
    if (!asset.alt.trim()) problems.push(`Image "${asset.id}" needs alt text.`)
    plain(asset.credit, `credit of image "${asset.id}"`, DOC_LIMITS.short)
    if (!isAllowedSrc(asset.src)) problems.push(`Image "${asset.id}" comes from a host the wiki can't serve.`)
  }

  const seo = doc.seo
  if (seo) {
    plain(seo.title, 'SEO title', DOC_LIMITS.seoTitle)
    plain(seo.description, 'meta description', DOC_LIMITS.seoDescription)
    plain(seo.keyword, 'focus keyword', DOC_LIMITS.keyword)
    const keywords = seo.keywords ?? []
    if (keywords.length > DOC_LIMITS.keywords) problems.push(`Use at most ${DOC_LIMITS.keywords} secondary keywords.`)
    if (keywords.some((keyword) => !keyword.trim() || keyword.length > DOC_LIMITS.keyword))
      problems.push(`Secondary keywords must be 1–${DOC_LIMITS.keyword} characters.`)
    if (new Set(keywords.map((keyword) => keyword.toLowerCase())).size !== keywords.length)
      problems.push('A secondary keyword appears twice.')
    if (seo.image) {
      const image = doc.assets[seo.image]
      if (!image) problems.push('The share image is missing from the library.')
      else if (!isShareSize(image))
        problems.push(`The share image must be at least ${DOC_LIMITS.shareWidth}×${DOC_LIMITS.shareHeight} (it is ${image.width}×${image.height}).`)
    }
    if (seo.canonical && (seo.canonical.length > DOC_LIMITS.canonical || !CANONICAL.test(seo.canonical)))
      problems.push('The canonical URL must be a /path or an https address, with no spaces.')
    if (seo.schema && !SCHEMAS.includes(seo.schema)) problems.push('Pick a page type.')
  }
  if (doc.hub !== undefined && !isSlug(doc.hub)) problems.push('The hub must be an article address.')
  const related = doc.related ?? []
  if (related.length > DOC_LIMITS.related) problems.push(`Use at most ${DOC_LIMITS.related} related articles.`)
  if (related.some((slug) => !isSlug(slug))) problems.push('Every related article must be an article address.')
  if (new Set(related).size !== related.length) problems.push('A related article appears twice.')

  if (!doc.blocks.length) problems.push('The article has no blocks yet.')
  if (doc.blocks.length > DOC_LIMITS.blocks) problems.push(`Use at most ${DOC_LIMITS.blocks} blocks.`)

  const anchors = new Set<string>()
  doc.blocks.forEach((block, i) => {
    const where = `Block ${i + 1} (${block.type})`
    switch (block.type) {
      case 'text':
        return md(block.md, where)
      case 'callout':
        return md(block.md, where)
      case 'heading':
        if (!block.text.trim()) problems.push(`${where} has no text.`)
        if (!ANCHOR.test(block.anchor)) problems.push(`${where} needs an anchor of lowercase words joined by hyphens.`)
        if (anchors.has(block.anchor)) problems.push(`${where} repeats the anchor "${block.anchor}".`)
        anchors.add(block.anchor)
        return
      case 'figure':
        if (!has(block.asset)) problems.push(`${where} has no image.`)
        if (block.mobileAsset && !has(block.mobileAsset)) problems.push(`${where} has a mobile image that isn't in the library.`)
        return
      case 'gallery':
        if (block.assets.length < DOC_LIMITS.galleryMin || block.assets.length > DOC_LIMITS.galleryMax)
          problems.push(`${where} needs ${DOC_LIMITS.galleryMin}–${DOC_LIMITS.galleryMax} images.`)
        if (!block.assets.every(has)) problems.push(`${where} uses an image that isn't in the library.`)
        return
      case 'cards':
        if (!block.cards.length || block.cards.length > DOC_LIMITS.cards) problems.push(`${where} needs 1–${DOC_LIMITS.cards} cards.`)
        if (block.cards.some((card) => !Number.isInteger(card.id) || card.id <= 0 || !card.name.trim()))
          problems.push(`${where} has a card without a passcode or a name.`)
        return
      case 'quote':
        if (!block.text.trim()) problems.push(`${where} has no text.`)
        return
      case 'code':
        if (!block.code.trim()) problems.push(`${where} has no code.`)
        if (block.code.length > DOC_LIMITS.md) problems.push(`${where} is over ${DOC_LIMITS.md.toLocaleString('en-US')} characters.`)
        if (!(block.lang in CODE_LANGUAGES)) problems.push(`${where} needs a language.`)
        plain(block.caption, `${where} caption`, DOC_LIMITS.short)
        return
      case 'video':
        if (!YOUTUBE_ID.test(block.videoId)) problems.push(`${where} needs a YouTube link.`)
        if (!block.title.trim()) problems.push(`${where} needs a title (screen readers announce it).`)
        if (block.start !== undefined && (!Number.isInteger(block.start) || block.start < 0))
          problems.push(`${where} has an invalid start time.`)
        if (block.uploadDate !== undefined && !isUploadDate(block.uploadDate))
          problems.push(`${where} has an upload date that isn't a real day between ${FIRST_UPLOAD} and today.`)
        return
      case 'faq':
        if (!block.items.length || block.items.length > DOC_LIMITS.faqItems)
          problems.push(`${where} needs 1–${DOC_LIMITS.faqItems} questions.`)
        block.items.forEach((item, j) => {
          if (!item.q.trim()) problems.push(`${where}, question ${j + 1} is empty.`)
          plain(item.q, `${where}, question ${j + 1}`, DOC_LIMITS.short)
          md(item.md, `${where}, answer ${j + 1}`, DOC_LIMITS.faqMd)
        })
        return
      default:
        // A new block type fails to compile here until it is handled.
        return block satisfies never
    }
  })

  if (new TextEncoder().encode(JSON.stringify(doc)).length > DOC_LIMITS.bytes) problems.push('The article is too large to save.')
  return problems
}

/** Rendered Markdown by block id (FAQ answers by `faqKey`): React nodes, never HTML strings. */
export type DocHtml = Record<string, ReactNode>

/** `html` key of one FAQ answer. */
export const faqKey = (blockId: string, index: number) => `${blockId}:${index}`

/** `[card:ID]` in wiki Markdown: the card's name, linking to its wiki page. */
const CARD_TAG = /\[card:(\d+)\]/g

/**
 * Markdown blocks rendered to sanitized HTML, by block id (FAQ answers by `faqKey`). Runs on the server for the page and in the
 * browser for the editor preview: the same pipeline, so the preview is the page.
 * Card names for `[card:ID]` come from one lookup per doc; an unknown passcode (or a failed lookup) shows the passcode.
 */
export const renderDocHtml = async (doc: WikiDoc): Promise<DocHtml> => {
  const sources = doc.blocks.flatMap((block) =>
    block.type === 'text' || block.type === 'callout'
      ? [[block.id, block.md] as const]
      : block.type === 'faq'
        ? block.items.map((item, i) => [faqKey(block.id, i), item.md] as const)
        : [],
  )
  const ids = sources.flatMap(([, md]) => [...md.matchAll(CARD_TAG)].map((match) => Number(match[1])))
  const cards = ids.length ? await cardsByIds(ids).catch(() => new Map<number, WikiCard>()) : new Map<number, WikiCard>()
  const linkCards = (md: string) =>
    md.replace(CARD_TAG, (_, id: string) => `[${(cards.get(Number(id))?.name ?? id).replace(/[\\[\]*_`]/g, '\\$&')}](/wiki/card/${id})`)

  const entries = await Promise.all([
    ...sources.map(([key, md]) => renderArticle(linkCards(md)).then((html) => [key, html] as const)),
    ...doc.blocks.flatMap((block) => (block.type === 'code' ? [renderCode(block.code, block.lang).then((html) => [block.id, html] as const)] : [])),
  ])
  return Object.fromEntries(entries)
}
