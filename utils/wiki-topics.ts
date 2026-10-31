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

// ponytail: `GET /wiki` returns no tags, so topics are this slug list. A new article has no topic, and stays
// under All, until it is added here. Read `tags` from the index once the API sends them.
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

export const topicOf = (slug: string): WikiTopic | undefined =>
  slug.startsWith(META_REPORT_PREFIX) ? 'meta' : TOPIC_BY_SLUG[slug]
