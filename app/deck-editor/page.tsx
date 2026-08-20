import type { Metadata } from 'next'
import { pageMetadata } from '@lib/page-metadata'
import { SITE_NAME, SITE_URL } from '@lib/site-config'
import DeckEditorClient from './deck-editor.client'
import { FAQ, SEO_KEYWORDS } from './deck-editor.const'
import './deck-editor.styles.css'

const TITLE = 'Yu-Gi-Oh! Deck Builder — TCG, OCG & Genesys Deck Editor'
const DESCRIPTION =
  'Free online Yu-Gi-Oh! deck builder and deck editor. Search every card, build Main, Extra, and Side Decks, and validate against the TCG, OCG, and Genesys banlists in real time.'

export const metadata: Metadata = {
  ...pageMetadata({ title: TITLE, path: '/deck-editor', description: DESCRIPTION }),
  keywords: SEO_KEYWORDS,
}

/** WebApplication + FAQ structured data — the FAQ doubles as answer-engine
 * (AEO) fodder and is rendered as visible copy below the editor. */
function jsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: 'Yu-Gi-Oh! Deck Builder',
        alternateName: 'YGO Omega Deck Editor',
        url: `${SITE_URL}/deck-editor`,
        applicationCategory: 'GameApplication',
        operatingSystem: 'Web',
        description: DESCRIPTION,
        featureList: [
          'TCG, OCG and Genesys formats',
          'Real-time banlist validation',
          'Main, Extra and Side deck building',
          'YDKE / YDK / Omega export and import',
        ],
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        publisher: { '@type': 'Organization', name: 'Duelists Unite', url: SITE_URL },
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Deck Builder', item: `${SITE_URL}/deck-editor` },
        ],
      },
    ],
  }
}

export default function DeckEditorPage() {
  return (
    <main className="deck-editor-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }}
      />

      <DeckEditorClient />
    </main>
  )
}
