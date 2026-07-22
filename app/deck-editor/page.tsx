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

      <section className="deck-editor-page__intro">
        <div className="deck-editor-page__intro-copy">
          <h1 className="deck-editor-page__title">Yu-Gi-Oh! Deck Builder</h1>
          <p className="deck-editor-page__lead">
            Build, edit, and test Yu-Gi-Oh! decks online — search the full card database, drag cards into
            your Main, Extra, and Side Decks, and stay legal with live TCG, OCG, and Genesys banlist checks.
          </p>
        </div>
      </section>

      <DeckEditorClient />

      <section className="deck-editor-page__seo" aria-label="About the deck builder">
        <div className="deck-editor-page__seo-inner">
          <h2>The free Yu-Gi-Oh! deck editor built for every duelist</h2>
          <p>
            Whether you are a casual player brewing a fun combo or a competitor tuning a tournament list, the
            YGO Omega deck maker gives you a fast, modern workspace. Filter the entire card pool by type,
            attribute, level, ATK, DEF, Pendulum scale, archetype, and more, then right-click or drag any
            card straight into your deck. The builder tracks Forbidden, Limited, and Semi-Limited cards for
            your chosen format so your list is always ready for play.
          </p>

          <h2>Frequently asked questions</h2>
          <dl className="deck-editor-page__faq">
            {FAQ.map((item) => (
              <div key={item.question} className="deck-editor-page__faq-item">
                <dt>{item.question}</dt>
                <dd>{item.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </main>
  )
}
