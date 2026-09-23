import Link from 'next/link'
import { notFound } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { CardArt } from '@omega/card-art'
import {
  AsideBlock,
  Callout,
  FactRows,
  GHOST_ACTION,
  LINK,
  Prose,
  SourceBlock,
  Tile,
  TileGrid,
  TonePill,
  WIKI_ASIDE,
  WIKI_PAD,
  WikiBar,
  WikiSection,
  WikiTable,
} from '@omega/wiki'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { buttonClasses } from '@ui/button'
import { Chip } from '@ui/chip'
import { SITE_URL } from '@utils/config'
import { CARD_ART_URL } from '@utils/const'
import { jsonLd, metaDescription, pageMetadata } from '@utils/metadata'
import {
  ATTRIBUTE_COLOR,
  getBanlists,
  getCard,
  legalityRows,
  levelLabel,
  releaseDate,
  statLabel,
  tcgDebut,
  titleCase,
  type WikiCard,
} from '@utils/wiki'

type CardRouteProps = { params: Promise<{ id: string }> }

const EXTRA_DECK = ['fusion', 'synchro', 'xyz', 'link']

const isExtraDeck = (card: WikiCard) => card.monsterTypes.some((type) => EXTRA_DECK.includes(type))

/** The type line as the card prints it: `Spellcaster / Effect`, `Quick-Play Spell`. */
const typeLine = (card: WikiCard) =>
  card.kind === 'monster'
    ? [card.race, ...card.monsterTypes].filter((part): part is string => !!part).map(titleCase).join(' / ')
    : card.humanReadableCardType

/** The tiles under the title. Spells and traps have no stats, so they get their own pair. */
const statTiles = (card: WikiCard) => {
  if (card.kind !== 'monster') {
    return [
      { label: 'Card type', value: titleCase(card.kind), className: 'text-gold' },
      { label: 'Property', value: card.spellTrapType ? titleCase(card.spellTrapType) : 'Normal', className: 'text-ink' },
    ]
  }

  return [
    {
      label: 'Attribute',
      value: card.attribute ? titleCase(card.attribute) : '-',
      className: (card.attribute && ATTRIBUTE_COLOR[card.attribute]) ?? 'text-ink',
    },
    { label: levelLabel(card), value: statLabel(card.level), className: 'text-gold' },
    { label: 'ATK', value: statLabel(card.atk), className: 'text-ink' },
    // A Link monster has no DEF and must never show one; its arrows are the stat that replaces it.
    card.monsterTypes.includes('link')
      ? { label: 'Markers', value: String(card.linkMarkers.length), className: 'text-ink' }
      : { label: 'DEF', value: statLabel(card.def), className: 'text-ink' },
  ]
}

const quickFacts = (card: WikiCard) => [
  { label: 'Passcode', value: String(card.id) },
  { label: 'Card type', value: card.humanReadableCardType },
  ...(card.kind === 'monster' ? [{ label: 'Type line', value: typeLine(card) }] : []),
  ...(card.attribute ? [{ label: 'Attribute', value: card.attribute.toUpperCase() }] : []),
  ...(card.level !== null ? [{ label: levelLabel(card), value: String(card.level) }] : []),
  ...(card.kind === 'monster'
    ? [{
        label: card.def === null ? 'ATK' : 'ATK / DEF',
        value: card.def === null ? statLabel(card.atk) : `${statLabel(card.atk)} / ${statLabel(card.def)}`,
      }]
    : []),
  ...(card.scale !== null ? [{ label: 'Pendulum scale', value: String(card.scale) }] : []),
  { label: 'Deck', value: isExtraDeck(card) ? 'Extra' : 'Main' },
  { label: 'Alt artworks', value: card.alternateArts.length ? String(card.alternateArts.length) : 'None' },
  { label: 'Errata', value: card.erratas.length ? String(card.erratas.length) : 'None' },
  { label: 'Treated as', value: card.ruleId ? String(card.ruleId) : 'Itself' },
]

export async function generateMetadata({ params }: CardRouteProps) {
  const { id } = await params
  const card = await getCard(id)

  if (!card) return pageMetadata({ title: 'Card not found', path: `/wiki/card/${id}`, noIndex: true })

  return pageMetadata({
    title: card.name,
    // An alternate artwork is the same card: its page points search at the original print.
    path: `/wiki/card/${card.alias || card.id}`,
    description: metaDescription(`${card.humanReadableCardType}. ${card.description}`),
    images: [{ url: CARD_ART_URL(card.id), alt: `${card.name} artwork` }],
  })
}

const CardRoute = async ({ params }: CardRouteProps) => {
  const { id } = await params
  const [card, banlists] = await Promise.all([getCard(id), getBanlists()])
  if (!card) notFound()

  const legality = legalityRows(card, banlists)
  const genesys = banlists.find((list) => list.pointCap !== null)
  const debut = tcgDebut(card)
  const translations = [
    { label: 'Português', value: card.i18n.pt },
    { label: '日本語', value: card.i18n.jp },
  ].filter((entry) => !!entry.value)

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-clip bg-surface-000 pt-16">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Omega Wiki', item: `${SITE_URL}/wiki` },
              { '@type': 'ListItem', position: 2, name: card.name, item: `${SITE_URL}/wiki/card/${card.alias || card.id}` },
            ],
          })}
        />
        <WikiBar section="Cards" placeholder="Search cards by name or part of one" link={{ label: 'Articles', to: '/wiki' }} />

        <div className="grid flex-1 border-b border-line-strong lg:grid-cols-[minmax(0,1fr)_23.25rem]">
          <article className="min-w-0 lg:border-r lg:border-line">
            <header className={twMerge('border-b border-line pt-9 pb-6.5', WIKI_PAD)}>
              <p className="text-ink-muted signal">
                Card page · passcode {card.id}
              </p>
              <h1 className="mt-3 text-ink display-1">{card.name}</h1>

              {card.alias ? (
                <Prose>
                  This is an alternate artwork.{' '}
                  <Link href={`/wiki/card/${card.alias}`} className={LINK}>See the original print</Link>{' '}for the
                  canonical page.
                </Prose>
              ) : null}

              <TileGrid className={card.kind === 'monster' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'}>
                {statTiles(card).map(({ label, value, className }) => (
                  <Tile key={label} label={label}>
                    <p className={twMerge('mt-1.75 font-display text-2xl uppercase', className)}>{value}</p>
                  </Tile>
                ))}
              </TileGrid>

              <p className="mt-3.5 text-ink-muted mono-note">
                {card.kind === 'monster'
                  ? `[ ${typeLine(card)} ] · ${card.humanReadableCardType} · ${isExtraDeck(card) ? 'Extra' : 'Main'} Deck`
                  : `${card.humanReadableCardType} · Main Deck`}
              </p>
            </header>

            <WikiSection index="01" title="Card text">
              <div className="mt-4 border border-line bg-surface-100 p-5.5">
                <p className="whitespace-pre-line text-ink body">{card.description}</p>
              </div>
              <p className="mt-2.5 text-ink-muted mono-note">
                English text as printed. The card database markup is stripped before display.
              </p>
            </WikiSection>

            {translations.length ? (
              <WikiSection index="02" title="Other languages">
                <div className="mt-4 grid gap-px bg-line sm:grid-cols-2">
                  {translations.map(({ label, value }) => (
                    <div key={label} className="bg-surface-000 px-4.5 py-4">
                      <p className="text-ink-muted signal-sm">{label}</p>
                      <p className="mt-2 text-ink body font-bold">{value?.name}</p>
                      <p className="mt-2 whitespace-pre-line text-ink-dim caption">{value?.desc}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2.5 text-ink-muted mono-note">
                  Search and filters run on the English text only.
                </p>
              </WikiSection>
            ) : null}

            <WikiSection index="03" title="Legality">
              {legality.length ? (
                <>
                  <WikiTable
                    template="1.4fr 1fr 1fr"
                    columns={['List', 'Status', 'Copies']}
                    rows={legality.map((row) => ({
                      key: row.list,
                      cells: [
                        <span key="list" className="min-w-0 text-sm font-bold text-ink">{row.list}</span>,
                        <TonePill key="status" tone={row.tone}>{row.status}</TonePill>,
                        <span key="copies" className="text-ink-dim mono-data">{row.copies}</span>,
                      ],
                    }))}
                  />
                  <Prose className="text-ink-muted caption">
                    Genesys prices cards against a {genesys?.pointCap ?? 100}-point deck cap instead of capping copies,
                    and bans {genesys?.bannedTypes.map(titleCase).join(' and ') || 'whole card types'} monsters outright.
                    A card with no points entry is free; a banned type is unplayable at any price.
                  </Prose>
                </>
              ) : (
                <Callout>
                  The banlist service did not answer, so this card&apos;s legality is not shown. Nothing about the card
                  itself changed. Reload in a moment.
                </Callout>
              )}
            </WikiSection>

            <WikiSection index="04" title="Errata history">
              {card.erratas.length ? (
                <div className="mt-4 flex flex-col gap-3">
                  {card.erratas.map((errata) => (
                    <div key={errata.id} className="border border-line p-4.5">
                      <p className="text-gold signal">
                        {errata.date ? releaseDate(errata.date) : 'Date unknown'} · passcode {errata.id}
                      </p>
                      <p className="mt-2.5 text-ink-dim body-sm">{errata.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <Callout>
                  No errata recorded. The printed text above is the only wording this card has had, so its TCG release
                  date is also its debut.
                </Callout>
              )}
            </WikiSection>

            <WikiSection index="05" title="Releases">
              <TileGrid className="sm:grid-cols-2">
                <Tile label="OCG debut">
                  <p className="mt-2 text-ink display-6">{releaseDate(card.released.ocg)}</p>
                </Tile>
                <Tile label="TCG debut">
                  <p className="mt-2 text-ink display-6">{releaseDate(debut)}</p>
                </Tile>
              </TileGrid>
              {debut && debut !== card.released.tcg ? (
                <Prose className="text-ink-muted caption">
                  The current wording shipped {releaseDate(card.released.tcg)}; the debut above is the date of the oldest
                  text in the errata history.
                </Prose>
              ) : null}
            </WikiSection>

            <WikiSection index="06" title="Archetypes and support" className="border-b-0">
              {card.archetypes.length || card.supports.length ? (
                <>
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    {card.archetypes.map((archetype) => (
                      <Chip key={`is-${archetype}`} tone="gold" className="px-3 py-2">
                        Member · {archetype}
                      </Chip>
                    ))}
                    {card.supports.map((archetype) => (
                      <Chip key={`supports-${archetype}`} tone="indigo" className="px-3 py-2">
                        Supports · {archetype}
                      </Chip>
                    ))}
                  </div>
                  <Prose className="text-sm">
                    Membership is read two ways at once: cards whose name carries the archetype, and cards the database
                    tags into it. Both are counted here, which is what a player means by &ldquo;the{' '}
                    {card.archetypes[0] ?? card.supports[0]}{' '}cards&rdquo;.
                  </Prose>
                </>
              ) : (
                <Prose>This card belongs to no archetype and supports none.</Prose>
              )}
            </WikiSection>
          </article>

          <aside className={twMerge(WIKI_ASIDE, 'border-t border-line lg:border-t-0')}>
            <CardArt
              art={{ id: card.id, name: card.name }}
              sizes="(min-width: 1024px) 23.25rem, 100vw"
              priority
              className="aspect-square border-b border-line"
            >
              <span className="absolute bottom-0 left-0 bg-surface-000 px-2.5 py-1.5 text-ink-muted signal">
                Artwork 1 of {card.alternateArts.length + 1}
              </span>
            </CardArt>

            <AsideBlock label="Quick facts">
              <FactRows facts={quickFacts(card)} />
            </AsideBlock>

            <AsideBlock label="Play it">
              <div className="mt-2.75 flex flex-col gap-2.25">
                <Link
                  href="/deck-editor"
                  className={twMerge(buttonClasses({ size: 'sm' }), 'min-h-10.5 w-full')}
                >
                  Add to deck
                </Link>
                <Link href="/wiki" className={GHOST_ACTION}>Read the wiki overview</Link>
              </div>
            </AsideBlock>

            <SourceBlock
              endpoints={[`GET /cards/${card.id}`, 'GET /banlists']}
              synced="Card data syncs once a day from the game database. This page revalidates hourly."
            />

            <AsideBlock label="See also">
              <div className="mt-2.5 flex flex-col gap-2 text-sm">
                {card.alternateArts.slice(0, 6).map((alternate) => (
                  <Link key={alternate} href={`/wiki/card/${alternate}`} className={LINK}>
                    {card.name}, artwork {alternate}
                  </Link>
                ))}
                {card.ruleId ? (
                  <Link href={`/wiki/card/${card.ruleId}`} className={LINK}>Always treated as {card.ruleId}</Link>
                ) : null}
                <Link href="/wiki" className={LINK}>Welcome to the Omega Wiki</Link>
              </div>
            </AsideBlock>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  )
}

export default CardRoute
