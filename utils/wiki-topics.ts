/** The wiki index's four topics. Everything here is the index's reading of an article, not part of its doc. */
export type WikiTopic = 'start' | 'meta' | 'formats' | 'support'

type TopicCopy = {
  label: string
  /** On the filter chips, where the full label doesn't fit. */
  chip: string
  blurb: string
  phoneBlurb: string
}

export const WIKI_TOPICS: Record<WikiTopic, TopicCopy> = {
  start: {
    label: 'Getting started',
    chip: 'Getting started',
    blurb: 'Install the client, learn the duel screen and go online.',
    phoneBlurb: 'Install, learn the duel screen, go online.',
  },
  meta: {
    label: 'Meta & tier lists',
    chip: 'Meta',
    blurb: 'What wins on the ranked ladders, read from real matches.',
    phoneBlurb: 'What wins on the ranked ladders.',
  },
  formats: {
    label: 'Formats & rules',
    chip: 'Formats',
    blurb: 'Card pools, banlists and how Omega scripts rulings.',
    phoneBlurb: 'Card pools, banlists and rulings.',
  },
  support: {
    label: 'Support',
    chip: 'Support',
    blurb: 'Fix crashes, find answers and report bugs.',
    phoneBlurb: 'Fix crashes and report bugs.',
  },
}

export const TOPIC_IDS = Object.keys(WIKI_TOPICS) as WikiTopic[]

export const isWikiTopic = (value: string | undefined): value is WikiTopic => !!value && Object.hasOwn(WIKI_TOPICS, value)

// Preserve established editorial assignments. New articles fall back to their index title/summary
// until the API exposes editorial topics; no extra article-body requests are needed.
const TOPIC_BY_SLUG: Record<string, WikiTopic> = {
  'omega-install-guide': 'start',
  'beginner-s-guide-to-ygo-omega': 'start',
  'ygo-omega-wiki': 'start',
  'yu-gi-oh-tcg-tier-list': 'meta',
  'yu-gi-oh-genesys-tier-list': 'meta',
  'best-number-for-umbral-horror': 'meta',
  'yu-gi-oh-formats': 'formats',
  'ygo-omega-troubleshooting-guide': 'support',
  'ygo-omega-faq': 'support',
  'bug-reports-how-to-report-a-ygo-omega-bug': 'support',
}

/** Weekly reports get a new dated address, so they go by prefix. */
export const META_REPORT_PREFIX = 'yu-gi-oh-meta-report-'

type TopicArticle = { slug: string; title?: string; summary?: string }

/** Specific tasks win over broad deck/meta words. Unrecognized content remains in All. */
const TOPIC_PATTERNS: [WikiTopic, RegExp][] = [
  ['support', /\b(troubleshoot\w*|crash\w*|bug reports?|report (?:a )?bug|faq|support|solucionar|erro|erros)\b/i],
  ['start', /\b(install\w*|installation|getting started|beginner\w*|first duel|instala\w*|iniciantes?)\b/i],
  ['formats', /\b(formats?|rules?|rulings?|banlists?|forbidden|limited list|regras?|formatos?)\b/i],
  ['meta', /\b(meta|tier lists?|decks?|archetypes?|combos?|matchups?|competitive|estrat[eé]gias?)\b/i],
]

export const topicOf = (article: string | TopicArticle): WikiTopic | undefined => {
  const { slug, title = '', summary = '' } = typeof article === 'string' ? { slug: article } : article
  if (Object.hasOwn(TOPIC_BY_SLUG, slug)) return TOPIC_BY_SLUG[slug]
  if (slug.startsWith(META_REPORT_PREFIX)) return 'meta'
  // A focused title is stronger evidence than a summary mentioning several other tasks.
  for (const text of [title, summary, slug.replaceAll('-', ' ')]) {
    const match = TOPIC_PATTERNS.find(([, pattern]) => pattern.test(text))
    if (match) return match[0]
  }
}
