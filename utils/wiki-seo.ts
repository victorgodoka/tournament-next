/**
 * Editor-side SEO checks for a wiki doc. Everything here is advice computed from the doc in the browser;
 * what the server refuses lives in `validateDoc` (blockers). The published head comes from the server's
 * `article.seo`, never from here (REVISAO_WIKI §2.4, §2.9).
 */
import { DOC_LIMITS, isShareSize, outline, shareAsset, toAnchor, type WikiAsset, type WikiBlock, type WikiDoc } from './wiki-doc'

export const SITE_NAME = 'YGO Omega'
/** Where a desktop result cuts the title, and roughly where it cuts the snippet. */
export const TITLE_PX = 580
export const SNIPPET_CHARS = 155

/** `fix` hurts ranking or sharing now, `warn` is worth a look, `pass` is fine. */
export type SeoLevel = 'fix' | 'warn' | 'pass'

/** Where a check's link goes: a side panel, the header, or one block by id. */
export type SeoTarget = 'seo' | 'library' | 'header' | { block: string }

export type SeoCheck = {
  id: string
  level: SeoLevel
  text: string
  /** Short form for the block row it is about. */
  hint?: string
  block?: string
  go?: { label: string; to: SeoTarget }
}

/** Lowercase, accents folded: "Sky Striker" and "sky striker" are the same search. */
const fold = (text: string) => text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()

export const hasKeyword = (text: string | undefined, keyword: string) => !!keyword && !!text && fold(text).includes(fold(keyword))

/** Markdown down to its words: link targets, images and syntax marks go. */
export const plainText = (md: string) =>
  md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\{#[0-9a-fA-F]{3,6}\}/g, '$1')
    .replace(/[`*_#>|~]/g, ' ')

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu

export const countWords = (text: string) => text.match(WORD)?.length ?? 0

/** Every piece of reading text in page order. */
const blockText = (block: WikiBlock): string => {
  switch (block.type) {
    case 'text':
      return plainText(block.md)
    case 'callout':
      return `${block.title ?? ''} ${plainText(block.md)}`
    case 'heading':
    case 'quote':
      return block.text
    case 'faq':
      return block.items.map((item) => `${item.q} ${plainText(item.md)}`).join(' ')
    case 'figure':
    case 'gallery':
    case 'cards':
    case 'code':
      return block.caption ?? ''
    case 'video':
      return block.caption ?? ''
  }
}

export const docWords = (doc: WikiDoc) => countWords([doc.summary, ...doc.blocks.map(blockText)].join(' '))

/** `[text](/wiki/…)` and every other site path in the Markdown. */
export const internalLinks = (doc: WikiDoc) => {
  let count = 0
  for (const block of doc.blocks) {
    const texts = block.type === 'text' || block.type === 'callout' ? [block.md] : block.type === 'faq' ? block.items.map((item) => item.md) : []
    for (const md of texts) count += md.match(/\]\(\/(?!\/)[^)\s]*\)/g)?.length ?? 0
  }
  return count
}

/**
 * Width of a title in Google's desktop result (Arial 20px), by character class.
 * ponytail: per-class averages, within ~5% on Latin text; measure with a canvas if it ever matters more.
 */
export const titlePixels = (text: string) => {
  let px = 0
  for (const char of text) {
    if (/[ijlf.,:;'|!I]/.test(char)) px += 5.5
    else if (char === ' ') px += 5.6
    else if (/[mwMW@]/.test(char)) px += 16.5
    else if (/[A-Z]/.test(char)) px += 13
    else if (/[rt()\-]/.test(char)) px += 6.7
    else px += 10.6
  }
  return Math.round(px)
}

/** What a search result shows. Empty SEO fields fall back the way the server does it. */
export const searchTitle = (doc: WikiDoc) => `${doc.seo?.title?.trim() || doc.title.trim() || 'Untitled'} | ${SITE_NAME}`
export const searchDescription = (doc: WikiDoc) => doc.seo?.description?.trim() || doc.summary.trim()

/** Cut where a result cuts it, at a word, with an ellipsis. */
export const clip = (text: string, max = SNIPPET_CHARS) =>
  text.length <= max ? text : `${text.slice(0, max).replace(/\s+\S*$/, '')} …`

/** The alt text the card-art search writes: "{name} artwork". Readers learn nothing from it. */
export const isDefaultAlt = (asset: WikiAsset) => / artwork$/.test(asset.alt.trim())

/** Every asset id the doc points at. */
export const usedAssets = (doc: WikiDoc) => {
  const ids = new Set<string>()
  if (doc.cover) ids.add(doc.cover.asset)
  if (doc.infobox?.asset) ids.add(doc.infobox.asset)
  if (doc.seo?.image) ids.add(doc.seo.image)
  for (const block of doc.blocks) {
    if (block.type === 'figure') {
      ids.add(block.asset)
      if (block.mobileAsset) ids.add(block.mobileAsset)
    }
    if (block.type === 'gallery') block.assets.forEach((id) => ids.add(id))
  }
  return ids
}

const blockNo = (doc: WikiDoc, id: string) => String(doc.blocks.findIndex((block) => block.id === id) + 1).padStart(2, '0')

type SeoContext = {
  slug: string
  /** Published children of this article (`links.children`), when known. */
  children?: number
}

/** Every check, in the order the panel lists them. */
export const seoChecks = (doc: WikiDoc, { slug, children }: SeoContext): SeoCheck[] => {
  const checks: SeoCheck[] = []
  const add = (check: SeoCheck) => checks.push(check)
  const keyword = doc.seo?.keyword?.trim() ?? ''
  const title = searchTitle(doc)
  const description = searchDescription(doc)
  const headings = outline(doc)
  const h2s = headings.filter((heading) => heading.level === 2)
  const words = docWords(doc)
  const links = internalLinks(doc)
  const share = shareAsset(doc)
  const used = usedAssets(doc)
  const assets = Object.values(doc.assets).filter((asset) => used.has(asset.id))

  // Search appearance
  const px = titlePixels(title)
  add(
    px > TITLE_PX
      ? { id: 'title-width', level: 'warn', text: `The title runs to ${px} px; search cuts it at about ${TITLE_PX}.`, go: { label: 'Write an SEO title →', to: 'seo' } }
      : { id: 'title-width', level: 'pass', text: `Title is ${(doc.seo?.title?.trim() || doc.title.trim()).length} characters` },
  )
  if (!description)
    add({ id: 'description', level: 'warn', text: 'No summary or meta description: search picks a random sentence.', go: { label: 'Write a meta description →', to: 'seo' } })
  else if (description.length > SNIPPET_CHARS)
    add({
      id: 'description',
      level: 'warn',
      text: `The ${doc.seo?.description?.trim() ? 'meta description' : 'summary'} runs to ${description.length} characters; search cuts it at about ${SNIPPET_CHARS}.`,
      go: { label: 'Write a meta description →', to: 'seo' },
    })
  else add({ id: 'description', level: 'pass', text: `Meta description is ${description.length} characters` })

  // Focus keyword
  if (!keyword) {
    add({ id: 'keyword', level: 'warn', text: 'No focus keyword: set the search this page should answer.', go: { label: 'Set a focus keyword →', to: 'seo' } })
  } else {
    const firstText = doc.blocks.find((block) => block.type === 'text')
    const where = [
      hasKeyword(doc.title, keyword) || hasKeyword(doc.seo?.title, keyword) ? 'title' : '',
      hasKeyword(description, keyword) ? 'summary' : '',
      slug.includes(toAnchor(keyword)) ? 'address' : '',
    ]
    const missing = ['title', 'summary', 'address'].filter((part) => !where.includes(part))
    add(
      missing.length
        ? { id: 'keyword-head', level: 'warn', text: `“${keyword}” is missing from the ${missing.join(', ')}.`, go: { label: 'Article header →', to: 'header' } }
        : { id: 'keyword-head', level: 'pass', text: 'Focus keyword in title, summary and address' },
    )
    if (firstText) {
      const found = firstText.type === 'text' && hasKeyword(plainText(firstText.md), keyword)
      add(
        found
          ? { id: 'keyword-intro', level: 'pass', text: 'Focus keyword in the first paragraph', hint: '✓ Focus keyword in first paragraph', block: firstText.id }
          : {
              id: 'keyword-intro',
              level: 'warn',
              text: `The first paragraph doesn't mention “${keyword}”.`,
              hint: '! No focus keyword in first paragraph',
              block: firstText.id,
              go: { label: `Go to block ${blockNo(doc, firstText.id)} →`, to: { block: firstText.id } },
            },
      )
    }
    const firstH2 = h2s[0]
    if (firstH2)
      add(
        h2s.some((heading) => hasKeyword(heading.text, keyword))
          ? { id: 'keyword-h2', level: 'pass', text: 'An H2 mentions the focus keyword' }
          : {
              id: 'keyword-h2',
              level: 'warn',
              text: `No H2 mentions “${keyword}”. Section titles tell search what each part answers.`,
              hint: '! No focus keyword in any H2',
              block: firstH2.id,
              go: { label: `Go to block ${blockNo(doc, firstH2.id)} →`, to: { block: firstH2.id } },
            },
      )
  }

  // Structure
  const firstHeading = headings[0]
  add(
    firstHeading?.level === 3
      ? {
          id: 'order',
          level: 'warn',
          text: 'An H3 comes before any H2. Open the section with an H2.',
          block: firstHeading.id,
          go: { label: `Go to block ${blockNo(doc, firstHeading.id)} →`, to: { block: firstHeading.id } },
        }
      : { id: 'order', level: 'pass', text: 'Headings in order, anchors unique' },
  )
  add(
    words < 300
      ? { id: 'words', level: 'warn', text: `Only ${words.toLocaleString('en-US')} words. Pages under 300 rarely rank.` }
      : { id: 'words', level: 'pass', text: `${words.toLocaleString('en-US')} words` },
  )
  for (const block of doc.blocks) {
    const long = block.type === 'text' ? countWords(plainText(block.md)) : 0
    if (long > 400)
      add({
        id: `long-${block.id}`,
        level: 'warn',
        text: `Block ${blockNo(doc, block.id)} is ${long} words with no subheading. Split it with an H3.`,
        hint: '! Long block, split it',
        block: block.id,
        go: { label: `Go to block ${blockNo(doc, block.id)} →`, to: { block: block.id } },
      })
  }
  const schema = doc.seo?.schema ?? 'Article'
  if (schema === 'HowTo' && !h2s.length)
    add({ id: 'howto', level: 'warn', text: 'Page type Steps needs an H2 per step; without one it falls back to Article.', go: { label: 'SEO tab →', to: 'seo' } })
  if (schema === 'CollectionPage' && children === 0)
    add({ id: 'collection', level: 'warn', text: 'Page type Hub, but no published article names this one as its hub yet.', go: { label: 'SEO tab →', to: 'seo' } })

  // Links
  add(
    links
      ? { id: 'links', level: 'pass', text: `${links} internal link${links === 1 ? '' : 's'}` }
      : { id: 'links', level: 'warn', text: 'No links to other wiki pages in the text.' },
  )
  add(
    doc.hub || doc.related?.length
      ? { id: 'orphan', level: 'pass', text: 'In a hub or linked as related' }
      : { id: 'orphan', level: 'fix', text: 'No hub and no related articles: nothing on the site may link here.', go: { label: 'Pick a hub →', to: 'seo' } },
  )

  // Images and media
  add(
    share && isShareSize(share)
      ? { id: 'share', level: 'pass', text: `Share image is ${share.width} px wide.` }
      : {
          id: 'share',
          level: 'fix',
          text: share
            ? `The ${doc.seo?.image ? 'share image' : doc.cover ? 'cover' : 'infobox image'} is ${share.width} px wide. Link previews on Discord and X want ${DOC_LIMITS.shareWidth} × ${DOC_LIMITS.shareHeight}.`
            : `No share image. Link previews on Discord and X want ${DOC_LIMITS.shareWidth} × ${DOC_LIMITS.shareHeight}.`,
          go: { label: 'Pick a share image →', to: 'seo' },
        },
  )
  const defaults = assets.filter(isDefaultAlt)
  add(
    defaults.length
      ? {
          id: 'alt',
          level: 'warn',
          text: `${defaults.length} image${defaults.length === 1 ? ' still uses' : 's still use'} the default “… artwork” alt text.`,
          go: { label: 'Open Library →', to: 'library' },
        }
      : { id: 'alt', level: 'pass', text: 'Every image has its own alt text' },
  )
  for (const block of doc.blocks) {
    if (block.type === 'video' && block.videoId && !block.uploadDate)
      add({
        id: `video-${block.id}`,
        level: 'warn',
        text: `Video in block ${blockNo(doc, block.id)} has no upload date, so it gets no video rich result.`,
        hint: '! No upload date',
        block: block.id,
        go: { label: `Go to block ${blockNo(doc, block.id)} →`, to: { block: block.id } },
      })
  }

  if (doc.seo?.noindex) add({ id: 'noindex', level: 'warn', text: 'Search engines are told not to index this page.', go: { label: 'SEO tab →', to: 'seo' } })
  return checks
}

/** Pass counts in full, a warning a third, a fix nothing. */
export const seoScore = (checks: SeoCheck[]) => {
  if (!checks.length) return 0
  const points = checks.reduce((sum, check) => sum + (check.level === 'pass' ? 1 : check.level === 'warn' ? 1 / 3 : 0), 0)
  return Math.round((points / checks.length) * 100)
}
