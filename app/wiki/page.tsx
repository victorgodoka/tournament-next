import Link from 'next/link'
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
import { pageMetadata } from '@utils/metadata'
import { getBanlists, titleCase } from '@utils/wiki'

export const metadata = pageMetadata({
  title: 'Omega Wiki',
  path: '/wiki',
  description:
    'Card pages, formats, banlists and client rules for YGO Omega, written by Duelists Unite contributors and read straight off the card database.',
})

/* The article itself is placeholder copy: there is no wiki backend yet, so everything below is
   written by hand. The one exception is the banlist table, which the card API already answers for
   — mocking it would only let it drift out of date. */

const TOC = [
  { num: '01', label: 'What is in here', href: '#s1' },
  { num: '02', label: 'Card pages', href: '#s2' },
  { num: '03', label: 'Formats and banlists', href: '#s3' },
  { num: '04', label: 'Searching', href: '#s4' },
  { num: '05', label: 'Editing and contributing', href: '#s5' },
  { num: '06', label: 'References', href: '#s6' },
]

const SHELVES = [
  {
    title: 'Cards',
    body: 'One page per card: printed text, Portuguese and Japanese wordings, every list that restricts it, the errata history, and the archetypes it belongs to or supports.',
  },
  {
    title: 'Formats and banlists',
    body: 'What TCG, OCG, WCS and Genesys each restrict, how the two families of list differ, and which list the ranked ladder actually reads.',
  },
  {
    title: 'Rules and rulings',
    body: 'Where Omega scripts a card the way the OCG resolves it and the TCG does not, and which of the two the format you queued is using.',
  },
  {
    title: 'The client',
    body: 'Deck editor, matchmaking, tournament registration and replays: what the buttons do, and what the server checks before it lets a deck into a queue.',
  },
]

/** Sample cards, picked to show the shapes a card page has to handle. */
const GALLERY = [
  { id: 72270339, name: 'Diabellstar the Black Witch', note: 'Limited, no errata' },
  { id: 14558127, name: 'Ash Blossom & Joyous Spring', note: 'Priced on Genesys' },
  { id: 26202165, name: 'Sangan', note: 'Errata history' },
  { id: 46986414, name: 'Dark Magician', note: '19 alternate artworks' },
  { id: 89631139, name: 'Blue-Eyes White Dragon', note: 'Normal Monster' },
]

const TABS = ['Article', 'Discussion', 'History']

const RELATED = [
  { label: 'Diabellstar the Black Witch', to: '/wiki/card/72270339' },
  { label: 'Sangan', to: '/wiki/card/26202165' },
  { label: 'Deck editor', to: '/deck-editor' },
  { label: 'Tournaments', to: '/tournaments' },
]

const WikiPage = async () => {
  const banlists = await getBanlists()
  const genesys = banlists.filter((list) => list.pointCap !== null)
  const copyLists = banlists.filter((list) => list.pointCap === null)

  const facts = [
    { label: 'Type', value: 'Reference' },
    { label: 'Card pages', value: '14,600+' },
    { label: 'Banlists', value: banlists.length ? String(banlists.length) : 'Unavailable' },
    { label: 'Languages', value: 'EN · PT · JP' },
    { label: 'Data source', value: 'Omega card API' },
    { label: 'Card sync', value: 'Daily' },
    { label: 'Article text', value: 'Placeholder' },
  ]

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-hidden bg-surface-000 pt-16">
        <WikiBar section="Overview" placeholder="Search cards by name or part of one" link={{ label: 'Cards', to: '/wiki/card/72270339' }} />

        <div className={twMerge('flex flex-wrap items-center gap-x-5.5 gap-y-4 border-b border-line py-3.5', WIKI_PAD)}>
          <div className="flex gap-px bg-line">
            {TABS.map((tab, i) => (
              <span
                key={tab}
                aria-current={i === 0 ? 'page' : undefined}
                aria-disabled={i ? true : undefined}
                title={i ? 'Not available yet' : undefined}
                className={twMerge(
                  'flex min-h-9.5 items-center px-4 font-mono text-[10px] font-bold tracking-[.14em] uppercase',
                  i ? 'bg-surface-000 text-ink-muted opacity-60' : 'bg-ink text-surface-000',
                )}
              >
                {tab}
              </span>
            ))}
          </div>
          <span className="flex-1" />
          <span className="font-mono text-[10px] tracking-[.12em] text-ink-muted uppercase">
            Revision 1 · placeholder text, no editors yet
          </span>
        </div>

        <div className="grid flex-1 border-b border-line-strong lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[14.5rem_minmax(0,1fr)_21.25rem]">
          <nav
            aria-label="Contents"
            className="hidden self-start border-r border-line py-6.5 pr-4.5 pl-11 xl:sticky xl:top-16 xl:block xl:max-h-dvh xl:overflow-y-auto"
          >
            <p className="text-ink-muted signal-sm">Contents</p>
            <div className="mt-3 flex flex-col">
              {TOC.map(({ num, label, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex gap-2.25 border-b border-line py-1.75 text-[13px] leading-snug text-ink-dim hover:text-gold"
                >
                  <span className="shrink-0 font-mono text-[10px] text-ink-muted">{num}</span>
                  <span>{label}</span>
                </Link>
              ))}
            </div>
            <p className="mt-4.5 font-mono text-[10px] leading-relaxed tracking-[.06em] text-ink-muted">
              Card pages are generated from the Omega card API. Article text is written by hand.
            </p>
          </nav>

          <article className="min-w-0 lg:border-r lg:border-line">
            <header className={twMerge('border-b border-line pt-9 pb-6.5', WIKI_PAD)}>
              <p className="font-mono text-[10px] tracking-[.24em] text-ink-muted uppercase">Wiki · Overview</p>
              <h1 className="mt-3 text-[40px] leading-[.94] text-ink uppercase md:text-[54px]">
                Welcome to the Omega Wiki
              </h1>
              <p className="mt-4 max-w-[64ch] text-lg leading-relaxed text-ink">
                Everything Omega knows about a card, a format or the client, on one page each. Card pages are generated
                from the same database the game engine reads, so what the wiki tells you a card does is what the engine
                will do with it.
              </p>
              <Prose className="max-w-[64ch]">
                The wiki is open: anyone in the Duelists Unite Discord can propose an edit, and the article text is
                CC BY-SA. Card text and artwork stay Konami&apos;s.
              </Prose>
            </header>

            <WikiSection id="s1" index="01" title="What is in here">
              <Prose>
                Four shelves. Card pages are generated; the rest is written by contributors and reviewed before it
                lands.
              </Prose>
              <div className="mt-5 grid gap-px bg-line sm:grid-cols-2">
                {SHELVES.map(({ title, body }) => (
                  <div key={title} className="bg-surface-000 px-4.5 py-4.5">
                    <h3 className="text-gold display-6">{title}</h3>
                    <p className="mt-2.5 text-ink-dim body-sm">{body}</p>
                  </div>
                ))}
              </div>
              <Callout>
                Only the card pages are live today. The format, rules and client articles are still being written, so
                every link to one lands back here for now.
              </Callout>
            </WikiSection>

            <WikiSection id="s2" index="02" title="Card pages">
              <Prose>
                A card page opens with the printed English text, then its other-language wordings, then a legality table
                covering every list the API serves, including the ones the card is free on, which the card data itself
                leaves out. Below that sit the errata history, the release dates per region, and the archetypes the card
                belongs to or supports.
              </Prose>
              <div className="mt-5 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
                {GALLERY.map((card) => (
                  <Link
                    key={card.id}
                    href={`/wiki/card/${card.id}`}
                    className="group block border border-line hover:border-gold"
                  >
                    <CardArt art={card} sizes="(min-width: 1024px) 10rem, 40vw" className="aspect-square" />
                    <span className="block px-2.75 py-2.5 group-hover:bg-surface-300">
                      <span className="block text-[13px] leading-snug font-bold text-ink">{card.name}</span>
                      <span className="mt-1 block font-mono text-[10px] text-ink-muted">{card.note}</span>
                    </span>
                  </Link>
                ))}
              </div>
              <Callout>
                A blank Genesys row means free <em>or</em>{' '}unplayable, never one on its own: Genesys bans Pendulum and
                Link monsters by type, and a type ban is not a points entry. Card pages resolve that for you and say
                &ldquo;banned type&rdquo; outright.
              </Callout>
            </WikiSection>

            <WikiSection id="s3" index="03" title="Formats and banlists">
              <Prose>
                Two families of list, and they do not work the same way. TCG, OCG and WCS cap how many copies of a card
                a deck may hold. Genesys caps nothing: it gives cards a point value and the deck a budget, so an
                expensive card limits itself.
              </Prose>

              {banlists.length ? (
                <>
                  <WikiTable
                    template="1.3fr .6fr .9fr 1.2fr"
                    columns={['List', 'Id', 'Restricts by', 'Cards listed']}
                    rows={banlists.map((list) => ({
                      key: String(list.id),
                      cells: [
                        <span key="name" className="min-w-0 text-sm font-bold text-ink">{list.name}</span>,
                        <span key="id" className="font-mono text-[13px] text-ink-muted">{list.id}</span>,
                        <TonePill key="mode" tone={list.pointCap === null ? 'indigo' : 'cyan'}>
                          {list.pointCap === null ? 'Copies' : 'Points'}
                        </TonePill>,
                        <span key="cards" className="font-mono text-[13px] text-ink-dim">
                          {list.cards.toLocaleString('en')} {list.pointCap === null ? 'restricted' : 'priced'}
                        </span>,
                      ],
                    }))}
                  />
                  <TileGrid className="grid-cols-2 lg:grid-cols-3">
                    <Tile label="Genesys deck cap">
                      <p className="mt-2 text-gold display-3">{genesys[0]?.pointCap ?? 100}</p>
                      <p className="mt-1 text-[13px] text-ink-dim">points per deck, side deck included</p>
                    </Tile>
                    <Tile label="Copy-limit lists">
                      <p className="mt-2 text-ink display-3">{copyLists.length}</p>
                      <p className="mt-1 text-[13px] text-ink-dim">
                        {copyLists.map((list) => list.format.toUpperCase()).join(', ') || 'None'}
                      </p>
                    </Tile>
                    <Tile label="Banned on Genesys">
                      <p className="mt-2 text-cyan display-3">
                        {genesys[0]?.bannedTypes.length ?? 0}
                      </p>
                      <p className="mt-1 text-[13px] text-ink-dim">
                        card types: {genesys[0]?.bannedTypes.map(titleCase).join(', ') || 'none'}
                      </p>
                    </Tile>
                  </TileGrid>
                  <Prose className="text-[13px] text-ink-muted">
                    A list&apos;s id is stable, but the banlist behind it changes whenever a new one is published; the
                    date in the name is what tells you which revision you are reading.
                  </Prose>
                </>
              ) : (
                <Callout>The banlist service did not answer, so the list table is missing. Reload in a moment.</Callout>
              )}
            </WikiSection>

            <WikiSection id="s4" index="04" title="Searching">
              <Prose>
                The bar at the top of every wiki page matches card names as you type and links straight to the card
                page. It waits for you to stop typing before it asks the server, which is also what makes the result
                come back from cache.
              </Prose>
              <Prose>
                Passcodes work as addresses too: <code className="font-mono text-[13px] text-gold">/wiki/card/72270339</code>{' '}
                opens Diabellstar, and an alternate artwork&apos;s passcode opens that specific print with a link back to
                the original. Full-text search over card effects lives in the{' '}
                <Link href="/deck-editor" className={LINK}>deck editor</Link>, where you can pair it with the format
                filters.
              </Prose>
            </WikiSection>

            <WikiSection id="s5" index="05" title="Editing and contributing">
              <Prose>
                Article text is community-written. Corrections go through the Duelists Unite Discord, and a page shows
                its revision count and contributors in the sidebar once the edit history is wired up. Card pages are not
                editable: they are read from the card database, so a wrong value there is an upstream fix, not a wiki
                one.
              </Prose>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Link
                  href="https://discord.gg/duelistsunite"
                  className={buttonClasses({ size: 'sm' })}
                >
                  Report an error
                </Link>
                <Link href="/wiki/card/72270339" className={GHOST_ACTION}>See a card page</Link>
              </div>
            </WikiSection>

            <WikiSection id="s6" index="06" title="References" className="border-b-0">
              <ol className="mt-4 flex list-decimal flex-col gap-2.25 pl-5.5">
                <li className="text-sm leading-relaxed text-ink-dim">
                  Omega card API: <code className="font-mono text-xs text-gold">GET /cards/&#123;id&#125;</code>,
                  the source of every card page.
                </li>
                <li className="text-sm leading-relaxed text-ink-dim">
                  Omega card API: <code className="font-mono text-xs text-gold">GET /banlists</code>, the list
                  table above.
                </li>
                <li className="text-sm leading-relaxed text-ink-dim">
                  Duelists Unite tournament service, for ranked and event configuration.
                </li>
              </ol>
            </WikiSection>
          </article>

          <aside className={twMerge(WIKI_ASIDE, 'border-t border-line lg:border-t-0')}>
            <AsideBlock label="Wiki summary" className="bg-ground-gold">
              <h2 className="mt-2.5 text-ink display-5">Omega Wiki</h2>
              <p className="mt-2 text-[13px] leading-snug text-ink-dim">
                Card database, formats and client reference for YGO Omega.
              </p>
            </AsideBlock>

            <AsideBlock label="Quick facts">
              <FactRows facts={facts} />
            </AsideBlock>

            <AsideBlock label="Start here">
              <div className="mt-2.5 flex flex-col gap-2 text-sm">
                {RELATED.map(({ label, to }) => (
                  <Link key={to} href={to} className={LINK}>{label}</Link>
                ))}
              </div>
            </AsideBlock>

            <SourceBlock
              endpoints={['GET /banlists']}
              synced="The list table is live. Everything else on this page is placeholder text."
            />

            <AsideBlock label="This page">
              <div className="mt-2.75 flex flex-col gap-2.25">
                <Link href="https://discord.gg/duelistsunite" className={GHOST_ACTION}>Suggest an edit</Link>
                <Link href="/wiki/card/72270339" className={GHOST_ACTION}>Browse cards</Link>
              </div>
              <p className="mt-3 font-mono text-[10px] leading-relaxed tracking-[.04em] text-ink-muted">
                Created 15 Sep 2026 · 1 revision · no contributors yet
              </p>
            </AsideBlock>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  )
}

export default WikiPage
