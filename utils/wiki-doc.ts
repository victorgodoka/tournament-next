/**
 * Block document for wiki articles: the one shape the editor writes, the API stores and the page renders.
 * The same JSON always renders the same page — there is no layout state outside it.
 * The contract, limits and endpoints are written up for the backend in docs/WIKI_BLOCKS.md.
 */
import { renderArticle } from '@utils/remark'

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

/** `left`/`right` float beside the text that follows; `wide` spans the column; `center` sits narrower. */
export type FigureAlign = 'left' | 'right' | 'center' | 'wide'

export type GalleryLayout = 'grid' | 'masonry' | 'strip'

export type CalloutTone = 'gold' | 'cyan' | 'negative'

export type WikiCardRef = { id: number; name: string; note?: string }

/** Every block carries a stable `id`: editors reorder and diff by it, and it anchors comments later. */
export type WikiBlock =
  | { id: string; type: 'text'; md: string }
  | { id: string; type: 'heading'; level: 2 | 3; text: string; anchor: string }
  | { id: string; type: 'figure'; asset: string; align: FigureAlign; caption?: string }
  | { id: string; type: 'gallery'; layout: GalleryLayout; assets: string[]; caption?: string }
  | { id: string; type: 'cards'; cards: WikiCardRef[]; caption?: string }
  | { id: string; type: 'callout'; tone: CalloutTone; title?: string; md: string }
  | { id: string; type: 'quote'; text: string; cite?: string }
  /** YouTube only. `start` in seconds. Nothing loads from YouTube until the reader presses play. */
  | { id: string; type: 'video'; videoId: string; title: string; start?: number; caption?: string }

export type WikiBlockType = WikiBlock['type']

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
}

/** Limits the server enforces (docs/WIKI_BLOCKS.md §5). The editor checks them first for readable errors. */
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
} as const

/** Palette entries, in the order the editor lists them. */
export const BLOCK_CATALOG: { type: WikiBlockType; label: string; hint: string }[] = [
  { type: 'text', label: 'Text', hint: 'Paragraphs, lists, tables and links in Markdown' },
  { type: 'heading', label: 'Heading', hint: 'Opens a section and lists it in Contents' },
  { type: 'figure', label: 'Image', hint: 'One image: floated beside the text, centred or wide' },
  { type: 'gallery', label: 'Gallery', hint: 'Grid, masonry or swipe strip, with a viewer' },
  { type: 'cards', label: 'Cards', hint: 'Card artworks that link to their card pages' },
  { type: 'callout', label: 'Callout', hint: 'A rule, a warning or a see-also box' },
  { type: 'quote', label: 'Quote', hint: 'A pull quote with its source' },
  { type: 'video', label: 'Video', hint: 'A YouTube video, loaded only on play' },
]

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
    case 'video':
      return { id, type, videoId: '', title: '' }
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
 * Headings inside code fences are left alone. The server may run the same conversion (WIKI_BLOCKS §10).
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

/** Where a wiki image may live: site paths, card arts, and the wiki's own Cloudinary folder. The server refuses anything else. */
const ALLOWED_SRC = [
  /^\/(?!\/)/,
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

/**
 * Every problem, in reading order, as copy an editor can act on. Empty means publishable.
 * The server runs the same rules; this copy only exists to fail fast.
 */
export const validateDoc = (doc: WikiDoc): string[] => {
  const problems: string[] = []
  const has = (id: string | undefined) => !!id && !!doc.assets[id]
  const md = (text: string, where: string) => {
    if (!text.trim()) problems.push(`${where} is empty.`)
    if (text.length > DOC_LIMITS.md) problems.push(`${where} is over ${DOC_LIMITS.md.toLocaleString('en-US')} characters.`)
    if (RAW_HTML.test(text)) problems.push(`${where} contains raw HTML. Use Markdown.`)
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
    if (doc.infobox.facts.some((fact) => !fact.label.trim() || !fact.value.trim())) problems.push('Every infobox fact needs a label and a value.')
  }

  const assets = Object.values(doc.assets)
  if (assets.length > DOC_LIMITS.assets) problems.push(`The library holds more than ${DOC_LIMITS.assets} images.`)
  for (const asset of assets) {
    if (!asset.alt.trim()) problems.push(`Image "${asset.id}" needs alt text.`)
    if (!isAllowedSrc(asset.src)) problems.push(`Image "${asset.id}" comes from a host the wiki can't serve.`)
  }

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
      case 'video':
        if (!YOUTUBE_ID.test(block.videoId)) problems.push(`${where} needs a YouTube link.`)
        if (!block.title.trim()) problems.push(`${where} needs a title (screen readers announce it).`)
        if (block.start !== undefined && (!Number.isInteger(block.start) || block.start < 0))
          problems.push(`${where} has an invalid start time.`)
        return
      default:
        // A new block type fails to compile here until it is handled.
        return block satisfies never
    }
  })

  if (new TextEncoder().encode(JSON.stringify(doc)).length > DOC_LIMITS.bytes) problems.push('The article is too large to save.')
  return problems
}

/**
 * Markdown blocks rendered to sanitized HTML, by block id. Runs on the server for the page and in the
 * browser for the editor preview: the same pipeline, so the preview is the page.
 */
export const renderDocHtml = async (doc: WikiDoc): Promise<Record<string, string>> => {
  const entries = await Promise.all(
    doc.blocks.flatMap((block) =>
      block.type === 'text' || block.type === 'callout' ? [renderArticle(block.md).then((html) => [block.id, html] as const)] : [],
    ),
  )
  return Object.fromEntries(entries)
}
