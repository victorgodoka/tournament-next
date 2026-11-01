/**
 * Builds the weekly wiki articles from the live statistics report and writes them to docs/wiki-pages,
 * to paste into the editor's "Load a document":
 *
 * - `yu-gi-oh-tcg-tier-list` and `yu-gi-oh-genesys-tier-list`: one fixed address each, replaced in place every
 *   week, so links and ranking add up on one page.
 * - `yu-gi-oh-meta-report-{date}`: a new article each week with only what changed on both ladders, under the
 *   TCG list as its hub.
 *
 * All their images are saved to public/wiki-images. An article never embeds the infographic route: a render takes
 * ~33 s on production, in the process that serves the site, and the wiki refuses it.
 *
 * Every number and every claim in the copy comes from the report, so a week where the leader or the tiers
 * change can't print something false. Refuses to write a doc the wiki would reject, and lists what the
 * editor's SEO panel would flag. Each run also saves a snapshot, which next week's report compares against:
 * commit it, and the images with it, and publish after they deploy. A snapshot from another season is ignored,
 * since tiers restart with the season.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/wiki-tier-list.ts [YYYY-MM-DD]
 *
 * The date defaults to today (UTC). WIKI_IMAGE_BASE=http://localhost:5173 renders the images from a dev server,
 * which spares production eight renders in a row and also covers a change to the images that isn't deployed yet.
 * Copy that reads like a judgment stays out of here: add it by hand in the editor.
 *
 * Publish in this order: Genesys, TCG, report. The server wants `hub` and `related` to exist, and each names the one before it.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { growthDays as growthWindow, intervalOf, strengthOf, type MetaEvent, type StatArchetype, type Statistics } from '@utils/statistics'
import { deckFaces, POWER_BANDS, POWER_MIN_PLAYERS, POWER_MIN_SHARE, POWER_T1_CAP, powerRanked } from '@utils/power-tier'
import { validateDoc, type WikiAsset, type WikiBlock, type WikiDoc } from '@utils/wiki-doc'
import { searchTitle, seoChecks, seoScore, titlePixels, TITLE_PX } from '@utils/wiki-seo'

/** Production on purpose: a local API has no ladder data. */
const API = 'https://godokaapi.duelistsunite.org'
const SITE = 'https://omega.duelistsunite.org'
const IMAGE_BASE = process.env.WIKI_IMAGE_BASE ?? SITE
/** The API's cap; its default of 30 rows would cut the tiers short. */
const ARCHETYPES = 100
/** The articles' shared cover: wide enough for a 1200×630 share image. */
const COVER = {
  id: 'wa-e7694119d6',
  src: 'https://res.cloudinary.com/dtmg8vjff/image/upload/wiki_assets/e7694119d6edfd945a9bf07ffa2b353e',
  width: 1920,
  height: 1008,
  alt: 'Glowing blue and purple YGO Omega emblem on a black background',
  credit: 'Duelists Unite',
}
const PAGES = 'docs/wiki-pages'
const SNAPSHOTS = `${PAGES}/snapshots`
const REPORT_IMAGES = '/wiki-images/meta-report'
const BOARD_IMAGES = '/wiki-images/tier-list'
const IMAGE_SIZES = { wide: { width: 1920, height: 1080 }, tall: { width: 1080, height: 1920 } } as const
const MIN_MATCHUP_GAMES = { TCG: 300, Genesys: 80 }
/** How far back a report's meta events reach, in season days. */
const EVENT_DAYS = 7
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** `decks` come from `powerRanked`: strongest first, and `tier` is `null` past the last band. */
type Ladder = { label: 'TCG' | 'Genesys'; prefix: 'tcg' | 'genesys'; stats: Statistics; decks: StatArchetype[] }
type Tier = 1 | 1.5 | 2 | 3 | 4
/** Last issue's tiered decks by archetype key. */
type Snapshot = {
  issue: string
  ladders: Record<Ladder['label'], { season: string; decks: Record<string, { name: string; tier: number; metaShare: number }> }>
}

const day = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number]
  return `${MONTHS[m - 1]} ${d}, ${y}`
}
const pct = (rate: number | null | undefined, digits = 1) => `${((rate ?? 0) * 100).toFixed(digits)}%`
const num = (n: number) => n.toLocaleString('en-US')
const key = (archetype: number[]) => archetype.join('+')
const name = (deck: StatArchetype) => deck.name ?? `Archetype ${key(deck.archetype)}`
const margin = (deck: StatArchetype) => (deck.ci ? ` ±${(deck.ci.margin * 100).toFixed(1)}` : '')
const points = (growth: number) => `${growth >= 0 ? '+' : '−'}${Math.abs(growth * 100).toFixed(1)}`
const and = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)
const capitalized = (sentence: string) => `${sentence[0]?.toUpperCase()}${sentence.slice(1)}`
/** Raw-HTML rule: "Maliss <P> Dormouse" is a real card name and the server refuses it. */
const cardName = (card: { id: number; name: string | null }) => (card.name ?? String(card.id)).replace(/[<>]/g, '')
const cardLink = (card: { id: number; name: string | null }) => `[${cardName(card)}](/wiki/card/${card.id})`
const tierListSlug = (ladder: Pick<Ladder, 'prefix'>) => `yu-gi-oh-${ladder.prefix}-tier-list`
const reportSlug = (issue: string) => `yu-gi-oh-meta-report-${day(issue).replace(/,/g, '').replace(/ /g, '-').toLowerCase()}`
const statisticsPath = (ladder: Ladder) => (ladder.prefix === 'tcg' ? '/statistics' : '/statistics?ladder=genesys')
const tier = (ladder: Ladder, t: Tier) => ladder.decks.filter((deck) => deck.tier === t)
const tiered = (ladder: Ladder) => ladder.decks.filter((deck) => deck.tier)
const byShare = (ladder: Ladder) => [...ladder.decks].sort((a, b) => b.metaShare - a.metaShare)
const share = (decks: StatArchetype[]) => decks.reduce((total, deck) => total + deck.metaShare, 0)
const score = (deck: StatArchetype) => pct(strengthOf(deck))
const goingFirst = (ladder: Ladder) => pct(ladder.stats.turnOrder.all.first.winRate)
/** The window `growth` covers on the server: half the season, at most 7 days. */
const growthDays = (ladder: Ladder) => growthWindow(ladder.stats.syncedDays.count)

/** The site's `win` and `loss` tokens. */
const WIN = '#4fdc8c'
const LOSS = '#ff8594'
/** Bold and coloured: `[text]{#hex}` is the wiki's Markdown for coloured text. */
const paint = (text: string, color: string) => `**[${text}]{${color}}**`
const rateCell = (deck: StatArchetype) => paint(`${pct(deck.winRate)}${margin(deck)}`, (deck.winRate ?? 0) >= 0.5 ? WIN : LOSS)

const table = (decks: StatArchetype[]) =>
  [
    '| Deck | Score | Win rate | Meta share | Players |',
    '|---|---:|---:|---:|---:|',
    ...decks.map((deck) => `| **${name(deck)}** | **${score(deck)}** | ${rateCell(deck)} | ${pct(deck.metaShare)} | ${num(deck.players)} |`),
  ].join('\n')

/** Deck names, not card names: readers look for the deck, and it dodges the raw-HTML rule. */
const tierCards = (decks: StatArchetype[]) => {
  const faces = deckFaces(decks)
  return decks.flatMap((deck) => {
    const face = faces.get(deck.archetype.join('-'))
    return face ? [{ id: face.id, name: name(deck), note: `${pct(deck.metaShare)} · ${pct(deck.winRate)} WR` }] : []
  })
}

type Size = keyof typeof IMAGE_SIZES
type ImagePair = Record<Size, WikiAsset>

/** The same image for desktop and phone, 16:9 and 9:16. */
const imagePair = (id: string, src: (size: Size) => string, alt: string): ImagePair => {
  const asset = (size: Size) => ({ id: `${id}-${size}`, src: src(size), ...IMAGE_SIZES[size], alt, credit: 'Duelists Unite' })
  return { wide: asset('wide'), tall: asset('tall') }
}

/**
 * The tier board. The date in the name is what shows the new one: the image optimizer keeps a variant for 31 days and
 * Discord and X cache by URL, so the same address would show an old board all month.
 */
const boardImages = (ladder: Ladder, issue: string) =>
  imagePair(
    `tier-board-${ladder.prefix}`,
    (size) => `${BOARD_IMAGES}/${issue}-${ladder.prefix}-${size}.jpg`,
    `${ladder.label} tier list board with ${and(tier(ladder, 1).map(name))} in Tier 1, showing each deck's win rate`,
  )

/** A dated report keeps the numbers of its week. */
const reportImages = (ladder: Ladder, issue: string) =>
  imagePair(
    `report-${ladder.prefix}`,
    (size) => `${REPORT_IMAGES}/${issue}-${ladder.prefix}-${size}.jpg`,
    `${ladder.label} meta report: the decks rising and falling fastest on the ladder for ${day(issue)}`,
  )

/** Right after the opening paragraph: the phone gets the 9:16 version, and the buttons link straight to it. */
const figure = (id: string, images: ImagePair, caption: string): WikiBlock => ({ id, type: 'figure', asset: images.wide.id, mobileAsset: images.tall.id, share: true, align: 'wide', caption })

const heading = (id: string, level: 2 | 3, text: string, anchor: string): WikiBlock => ({ id, type: 'heading', level, text, anchor })
const text = (id: string, md: string): WikiBlock => ({ id, type: 'text', md })

/** The leaders, as a sentence that holds for one Tier 1 deck or for several. */
const leaders = (ladder: Ladder) => {
  const top = tier(ladder, 1)
  const [only] = top
  if (top.length === 1 && only) return `**${name(only)}** sits alone in Tier 1 with ${pct(only.metaShare)} of the meta and a ${pct(only.winRate)} win rate.`
  return `${and(top.map((deck) => `**${name(deck)}** (${pct(deck.metaShare)} of the meta, ${pct(deck.winRate)} wins)`))} share Tier 1.`
}
const headline = (ladder: Ladder) => {
  const top = tier(ladder, 1).map(name)
  return top.length === 1 ? `${top[0]} is the only Tier 1 deck` : `${and(top)} lead Tier 1`
}

const leaderNote = (ladder: Ladder) => {
  const [first] = ladder.decks
  if (!first) return ''
  const growth = first.growth ?? 0
  return `${name(first)} has the best score on the ladder, with ${pct(first.winRate)} wins over ${num(first.games)} deck-games. It wins ${pct(first.turnOrder.first.winRate)} going first and ${pct(first.turnOrder.second.winRate)} going second. Its share ${growth >= 0 ? 'rose' : 'fell'} ${Math.abs(growth * 100).toFixed(1)} points over the last ${growthDays(ladder)} days.`
}

const spreadNote = (decks: StatArchetype[]) => {
  const byRate = [...decks].sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
  const high = byRate[0]
  const low = byRate.at(-1)
  if (!high || !low || high === low) return ''
  return `Win rates here run from ${pct(low.winRate)} (${name(low)}) to ${pct(high.winRate)} (${name(high)}).`
}

/** Art for the tiers short enough to show it; a cards block holds 12 at most, and an empty one is invalid. */
const tierBlocks = (ladder: Ladder, t: Tier, note: string, art = true): WikiBlock[] => {
  const decks = tier(ladder, t)
  if (!decks.length) return []
  const id = `${ladder.prefix}-${String(t).replace('.', '-')}`
  const cards = art && decks.length <= 12 ? tierCards(decks) : []
  return [
    heading(`h-${id}`, 3, `${ladder.label} Tier ${t}`, `tier-${String(t).replace('.', '-')}`),
    ...(cards.length ? [{ id: `cards-${id}`, type: 'cards', cards, ...(t === 1 ? { caption: "Share of the meta and win rate. Art is the deck's most used card." } : {}) } as const] : []),
    text(id, [table(decks), note].filter(Boolean).join('\n\n')),
  ]
}

const ladderBlocks = (ladder: Ladder): WikiBlock[] => {
  const { stats, label, prefix } = ladder
  const primer = label === 'Genesys' ? ' New to the format? The [format primer](/wiki/yu-gi-oh-formats) explains the 100-point rule.' : ''
  return [
    heading(`h-${prefix}`, 2, `${label} tiers`, 'tiers'),
    text(
      `${prefix}-intro`,
      `The ${label} ladder is ${stats.syncedDays.count} days into the ${stats.season.label.split(' ')[0]} season, with ${num(stats.totals.matches)} matches from ${num(stats.totals.players)} players. The most played deck, ${name(byShare(ladder)[0] as StatArchetype)}, holds ${pct(byShare(ladder)[0]?.metaShare)} of the meta, and the ${tiered(ladder).length} decks in these tiers cover ${pct(share(tiered(ladder)), 0)} of it.${primer}`,
    ),
    ...tierBlocks(ladder, 1, leaderNote(ladder)),
    ...tierBlocks(ladder, 1.5, spreadNote(tier(ladder, 1.5))),
    ...tierBlocks(ladder, 2, spreadNote(tier(ladder, 2))),
    ...tierBlocks(ladder, 3, ''),
    ...tierBlocks(ladder, 4, '', false),
  ]
}

/** Decks by growth, biggest first. Every listed deck: one can move a lot before it earns a tier. */
const risers = (ladder: Ladder) => ladder.decks.filter((deck) => (deck.growth ?? 0) > 0).sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0))
const fallers = (ladder: Ladder) => ladder.decks.filter((deck) => (deck.growth ?? 0) < 0).sort((a, b) => (a.growth ?? 0) - (b.growth ?? 0))

/** Strong and rarely played: the top tiers, least played first. */
const underplayed = (ladder: Ladder) =>
  [...ladder.decks]
    .filter((deck) => deck.tier && deck.tier <= 2)
    .sort((a, b) => a.metaShare - b.metaShare)
    .slice(0, 3)

/** Popular without the results: among the ten most played, the ones below Tier 2. */
const overplayed = (ladder: Ladder) =>
  byShare(ladder)
    .slice(0, 10)
    .filter((deck) => !deck.tier || deck.tier >= 3)
    .slice(0, 3)

/** Only matchups whose whole 95% interval sits on one side of 50%: the rest are noise. */
const bestAndWorst = (ladder: Ladder, deck: StatArchetype) => {
  const byKey = new Map(ladder.decks.map((d) => [key(d.archetype), d]))
  const seen = ladder.stats.matchups
    .filter((m) => {
      const opponent = byKey.get(key(m.opponent))
      return key(m.archetype) === key(deck.archetype) && !!opponent?.tier && opponent.tier <= 3 && m.games >= MIN_MATCHUP_GAMES[ladder.label] && m.winRate != null && !!intervalOf(m)
    })
    .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
  const cell = (m?: (typeof seen)[number]) => {
    const opponent = m && byKey.get(key(m.opponent))
    return m && opponent ? `${name(opponent)}, ${pct(m.winRate)} (${num(m.games)} games)` : null
  }
  return { best: cell(seen.find((m) => (intervalOf(m)?.lower ?? 0) > 0.5)), worst: cell([...seen].reverse().find((m) => (intervalOf(m)?.upper ?? 1) < 0.5)) }
}

const matchupTable = (ladder: Ladder, decks: StatArchetype[]) => {
  const rows = decks.map((deck) => {
    const { best, worst } = bestAndWorst(ladder, deck)
    return `| **${name(deck)}** | ${best ? paint(best, WIN) : 'None clear'} | ${worst ? paint(worst, LOSS) : 'None clear'} |`
  })
  return ['| Deck | Best matchup | Worst matchup |', '|---|---|---|', ...rows].join('\n')
}

const staples = (ladder: Ladder) => ladder.stats.mostUsed.main.slice(0, 4).map((card) => ({ id: card.id, name: cardName(card), note: `in ${pct(card.popularity)} of decks` }))

const tierName = (deck: StatArchetype) => (deck.tier ? `in Tier ${deck.tier}` : 'outside the tiers')

/** A pair from this week, so the answer always has a true example. */
const tierVsPopularity = (ladder: Ladder) => {
  const popular = overplayed(ladder)[0]
  const rare = underplayed(ladder)[0]
  if (!popular || !rare) return 'No. Tiers follow results, so a popular deck gets no credit for being played.'
  return `No. Tiers follow results. ${name(popular)} holds ${pct(popular.metaShare)} of the meta and sits ${tierName(popular)}, while ${name(rare)} holds ${pct(rare.metaShare)} and sits ${tierName(rare)}.`
}

const bands = [
  `| Tier 1 | Up to ${POWER_BANDS[0] * 100}, the best ${POWER_T1_CAP} decks only |`,
  `| Tier 1.5 | Up to ${POWER_BANDS[0] * 100}, every other deck |`,
  ...POWER_BANDS.slice(1).map((limit, i) => `| Tier ${i + 2} | ${POWER_BANDS[i]! * 100} to ${limit * 100} |`),
].join('\n')

const buildTierList = (ladder: Ladder, other: Ladder, issue: string): WikiDoc => {
  const { label, prefix, stats } = ladder
  const issueDay = day(issue)
  const leader = ladder.decks[0]
  if (!leader) throw new Error(`The ${label} ladder came back with no decks.`)
  const art = `card-${leader.face?.id}`
  const dataDay = day(stats.syncedDays.last ?? issue)
  const board = boardImages(ladder, issue)
  const live = statisticsPath(ladder)

  const blocks: WikiBlock[] = [
    text('intro', `This Yu-Gi-Oh! ${label} tier list ranks the strongest decks on the YGO Omega ${label} ladder by their results, using data through ${dataDay}. ${leaders(ladder)}`),
    figure('board', board, `The ${label} tier list at a glance`),
    text(
      'intro-more',
      `A tier here measures **how well a deck wins**, not how much it is played, and a small sample can't lift a deck to the top. For what moved this week, read the [latest meta report](/wiki/${reportSlug(issue)}); for the other ladder, the [${other.label} tier list](/wiki/${tierListSlug(other)}); for the numbers as they change, the [live statistics page](${live}).`,
    ),
    heading('h-glance', 2, `Yu-Gi-Oh! ${label} tier list at a glance`, 'at-a-glance'),
    text(
      'glance',
      [
        '| | |',
        '|---|---|',
        `| Tier 1 | ${tier(ladder, 1).map(name).join(', ')} |`,
        `| Tier 1.5 | ${tier(ladder, 1.5).map(name).join(', ') || 'None'} |`,
        `| Tier 2 | ${tier(ladder, 2).map(name).join(', ') || 'None'} |`,
        `| Decks in the tiers | ${tiered(ladder).length} |`,
        `| Matches counted | ${num(stats.totals.matches)} |`,
        `| Players | ${num(stats.totals.players)} |`,
        `| Going first wins | ${goingFirst(ladder)} |`,
        `| Season opened | ${day(stats.season.startsAt)} |`,
      ].join('\n'),
    ),

    ...ladderBlocks(ladder),

    heading('h-sleepers', 2, 'Which decks are underplayed and overplayed?', 'underplayed-decks'),
    text(
      'sleepers',
      `Popularity and results don't always agree. The underplayed decks reach Tier 2 or better on a small share of the meta, though the people playing them may be specialists, so treat them as leads to test. The overplayed decks are among the ten most played without reaching Tier 2.\n\n- **Underplayed:** ${and(underplayed(ladder).map((deck) => `${name(deck)} (${pct(deck.metaShare)} of the meta, ${pct(deck.winRate)} wins)`)) || 'None this week'}\n- **Overplayed:** ${and(overplayed(ladder).map((deck) => `${name(deck)} (${pct(deck.metaShare)} of the meta, ${pct(deck.winRate)} wins)`)) || 'None this week'}`,
    ),

    heading('h-matchups', 2, 'What beats the top decks?', 'matchups'),
    text(
      'matchups',
      `Best and worst matchup for each top deck against Tiers 1 to 3. A matchup is listed only when its whole 95% confidence interval sits on one side of 50%, with at least ${MIN_MATCHUP_GAMES[label]} games.\n\n${matchupTable(ladder, ladder.decks.slice(0, 6))}`,
    ),

    heading('h-staples', 2, 'Most played generic cards', 'most-played-cards'),
    text('staples', `Generic Main Deck cards seen across at least two archetypes, by share of deck-games. ${capitalized(stats.mostUsed.main.slice(0, 2).map((card) => `${cardLink(card)} shows up in ${pct(card.popularity)} of decks`).join(', and '))}.`),
    { id: 'cards-staples', type: 'cards', cards: staples(ladder), caption: `${label} ladder` },

    heading('h-method', 2, 'How this tier list works', 'methodology'),
    text(
      'method',
      `Every number comes from ranked matches played on [YGO Omega](/wiki/ygo-omega-wiki), the same data behind our [statistics page](${live}). Nothing is voted on or picked by hand.\n\nThese are **power tiers**: they rank results, and the statistics page shows the same tiers.\n\n**Each deck gets a score, the Wilson lower bound of its win rate.** That is the low end of the range its true win rate is likely in, so a deck needs both a good record and enough games to score well: 60% over 500 games scores below 58% over 5,000. A tier is how far a deck's score sits below the best deck on the ladder:\n\n| Tier | Points below the best score |\n|---|---|\n${bands}\n\nThe best deck is always Tier 1. Decks past the last band stay outside the tiers. A deck needs at least ${POWER_MIN_SHARE * 100}% of the meta and ${POWER_MIN_PLAYERS} players to be ranked at all, because the score corrects for few games, not for few pilots.\n\n- **Meta share** is the deck's share of deck-games. Each game counts once per player, and mirror matches count.\n- **Win rate** leaves mirror matches out, because a mirror always wins exactly half. The ± is its 95% confidence interval.\n- **Decks** are grouped by the archetypes they run, so a hybrid counts apart from pure builds.`,
    ),
    {
      id: 'limits',
      type: 'callout',
      tone: 'cyan',
      title: "What this list can't tell you",
      md: 'This is ladder play on a simulator, not tournament results. Players of every level are in it, and a deck played mostly by specialists can score above what it would do in most hands. It shows what wins on the ladder, which is not always what wins a premier event.',
    },

    heading('h-faq', 2, 'Frequently asked questions', 'faq'),
    {
      id: 'faq',
      type: 'faq',
      items: [
        {
          q: `What is the best ${label} deck right now?`,
          md: `${name(leader)}, with a ${pct(leader.winRate)} win rate at ${pct(leader.metaShare)} of the meta. It has the strongest win rate once sample size is counted.`,
        },
        { q: 'Is this tier list based on tournament results?', md: 'No. It comes from ranked ladder matches on YGO Omega. That gives a far larger sample than tournaments, but it reflects ladder play, not premier events.' },
        {
          q: 'How are the tiers decided?',
          md: `By score: the Wilson lower bound of a deck's win rate, which rewards a good record over many games. Tiers 1 to 4 are up to ${POWER_BANDS.map((limit) => limit * 100).join(', ')} points below the best deck. Tier 1 holds ${POWER_T1_CAP} decks at most, and any other deck that close goes to Tier 1.5. Decks under ${POWER_MIN_SHARE * 100}% of the meta or ${POWER_MIN_PLAYERS} players aren't ranked.`,
        },
        { q: 'Does a popular deck get a higher tier?', md: tierVsPopularity(ladder) },
        { q: 'How much does going first matter?', md: `Going first wins ${goingFirst(ladder)} of games on the ${label} ladder.` },
        { q: 'How often is the tier list updated?', md: `Every week, on this same page. Each week also gets its own [meta report](/wiki/${reportSlug(issue)}), and the [statistics page](${live}) shows the current numbers between updates.` },
        { q: 'Where can I see decklists for these decks?', md: `The [statistics page](${live}) has sample decklists, card usage and full matchup tables for each deck.` },
      ],
    },
  ]

  return {
    v: 1,
    // No date: the editor builds a new article's address from the title, and this one must stay fixed.
    title: `Yu-Gi-Oh! ${label} Tier List`,
    summary: `The Yu-Gi-Oh! ${label} tier list, updated ${issueDay}: ${headline(ladder)}. Ranked from ${num(stats.totals.matches)} YGO Omega ladder matches.`,
    cover: { asset: COVER.id },
    infobox: {
      ...(leader.face ? { asset: art, caption: `${cardName(leader.face)}, the most used card of the top deck` } : {}),
      facts: [
        { label: 'Updated', value: issueDay },
        { label: 'Data through', value: dataDay },
        { label: 'Tier 1', value: tier(ladder, 1).map(name).join('\n') },
        { label: 'Matches', value: num(stats.totals.matches) },
        { label: 'Players', value: num(stats.totals.players) },
        { label: 'Source', value: `YGO Omega ${label} ladder` },
        { label: 'Updates', value: 'Weekly' },
      ],
    },
    tags: ['tier-list', 'meta-report', prefix, 'deck-rankings'],
    blocks,
    assets: {
      [COVER.id]: COVER,
      [board.wide.id]: board.wide,
      [board.tall.id]: board.tall,
      ...(leader.face
        ? {
            [art]: {
              id: art,
              src: `https://ygopro.online/assets/card-arts/${leader.face.id}.jpg`,
              width: 624,
              height: 624,
              alt: `${cardName(leader.face)} card art, the most used card of the ${name(leader)} deck`,
            },
          }
        : {}),
    },
    seo: {
      // The month, not the day: the title shouldn't churn every week. Short, so Genesys and "| YGO Omega" fit in September too.
      title: `Yu-Gi-Oh! ${label} Tier List ${issueDay.replace(/ \d+,/, '').replace(/^(\w{3})\w*/, '$1')}: Best Decks`,
      description: `Yu-Gi-Oh! ${label} tier list, updated ${issueDay}: ${name(leader)} leads, ranked from ${num(stats.totals.matches)} ladder matches by win rate and sample size.`,
      keyword: `Yu-Gi-Oh! ${label} tier list`,
      keywords: ['yugioh tier list', `yugioh ${prefix} tier list`, `best ${prefix} decks`, 'yugioh meta'],
      image: board.wide.id,
      schema: 'Article',
    },
    hub: 'ygo-omega-wiki',
    // The Genesys list names no other tier list: it goes up first, and `related` must already exist.
    related: [...(prefix === 'tcg' ? [tierListSlug(other)] : []), 'yu-gi-oh-formats', 'beginner-s-guide-to-ygo-omega'],
  }
}

const movementTable = (decks: StatArchetype[]) =>
  [
    '| Deck | Tier | Season share | Change | Win rate |',
    '|---|---:|---:|---:|---:|',
    ...decks.map(
      (deck) => `| **${name(deck)}** | ${deck.tier ?? '—'} | ${pct(deck.metaShare)} | ${paint(points(deck.growth ?? 0), (deck.growth ?? 0) >= 0 ? WIN : LOSS)} | ${rateCell(deck)} |`,
    ),
  ].join('\n')

const EVENT_LABEL: Record<MetaEvent['kind'], string> = {
  shareRise: 'Meta share up',
  shareDrop: 'Meta share down',
  winRateRise: 'Win rate up',
  winRateDrop: 'Win rate down',
}

/** The API's own significant shifts, newest first. */
const eventRows = (ladder: Ladder) => {
  const from = ladder.stats.syncedDays.count - EVENT_DAYS
  return (ladder.stats.metaEvents ?? [])
    .filter((event) => event.name && event.day > from)
    .sort((a, b) => b.day - a.day)
    .slice(0, 6)
    .map((event) => {
      const shift = paint(EVENT_LABEL[event.kind], event.kind.endsWith('Rise') ? WIN : LOSS)
      return `| ${ladder.label} | **${event.name}** | ${shift} | ${pct(event.from)} | ${pct(event.to)} | ${num(event.games)} |`
    })
}

/** `null` without a comparable issue: no snapshot yet, or the season changed under it. */
const tierChanges = (ladder: Ladder, previous: Snapshot | null) => {
  const before = previous?.ladders[ladder.label]
  if (!before || before.season !== ladder.stats.season.code) return null
  const now = new Map(ladder.decks.map((deck) => [key(deck.archetype), deck]))
  const label = (tier?: number | null) => (tier ? `Tier ${tier}` : 'Unranked')
  const keys = new Set([...Object.keys(before.decks), ...tiered(ladder).map((deck) => key(deck.archetype))])
  return [...keys].flatMap((id) => {
    const was = before.decks[id]
    const is = now.get(id)
    if ((was?.tier ?? null) === (is?.tier ?? null)) return []
    const shown = was?.name ?? (is ? name(is) : id)
    // Tier 1 is the top: a lower number is a climb, and leaving the tiers is the bottom.
    const rank = (tier?: number | null) => tier || 5
    return [`| ${ladder.label} | **${shown}** | ${label(was?.tier)} | ${paint(label(is?.tier), rank(is?.tier) < rank(was?.tier) ? WIN : LOSS)} |`]
  })
}

/** The fastest riser with what a reader needs to try it. This is what makes each report more than a table. */
const spotlight = (ladder: Ladder): WikiBlock[] => {
  const deck = risers(ladder)[0]
  if (!deck) return []
  const id = `spotlight-${ladder.prefix}`
  const { best, worst } = bestAndWorst(ladder, deck)
  const generic = (deck.staples ?? []).slice(0, 3).map(cardLink)
  const lines = [
    `${name(deck)} gained ${Math.abs((deck.growth ?? 0) * 100).toFixed(1)} points of meta share over the last ${growthDays(ladder)} days, the most on the ladder, for ${pct(deck.metaShare)} of the season so far. It wins ${pct(deck.winRate)}${margin(deck)} overall: ${pct(deck.turnOrder.first.winRate)} going first and ${pct(deck.turnOrder.second.winRate)} going second.`,
    best ? `- **Best matchup:** ${best}` : '',
    worst ? `- **Worst matchup:** ${worst}` : '',
    generic.length ? `- **Most used generic cards:** ${and(generic)}` : '',
  ]
  const cards = deck.cards.slice(0, 4).map((card) => ({ id: card.id, name: cardName(card), note: `in ${pct(card.inclusion, 0)} of lists` }))
  return [
    heading(`h-${id}`, 3, `${ladder.label}: ${name(deck)}`, id),
    text(id, lines.filter(Boolean).join('\n')),
    ...(cards.length ? [{ id: `cards-${id}`, type: 'cards', cards, caption: `Most included cards in ${name(deck)}` } as const] : []),
  ]
}

const buildReport = (tcg: Ladder, genesys: Ladder, issue: string, previous: Snapshot | null): WikiDoc => {
  const issueDay = day(issue)
  const lead = (ladder: Ladder) => risers(ladder)[0]
  const rising = (ladder: Ladder) => {
    const deck = lead(ladder)
    return deck ? `${name(deck)} rose fastest in ${ladder.label}` : `no ${ladder.label} deck gained share`
  }
  const events = [...eventRows(tcg), ...eventRows(genesys)]
  const changes = [tierChanges(tcg, previous), tierChanges(genesys, previous)]
  const compared = changes.some((rows) => rows !== null)
  const changed = changes.flatMap((rows) => rows ?? [])
  const tcgImages = reportImages(tcg, issue)
  const genesysImages = reportImages(genesys, issue)
  const tierLinks = `the [TCG tier list](/wiki/${tierListSlug(tcg)}) and the [Genesys tier list](/wiki/${tierListSlug(genesys)})`
  const ladderMoves = (ladder: Ladder): WikiBlock[] => [
    heading(`h-moves-${ladder.prefix}`, 3, `${ladder.label} movers`, `${ladder.prefix}-movers`),
    text(
      `moves-${ladder.prefix}`,
      [`Over the last ${growthDays(ladder)} days, against the ${growthDays(ladder)} before.`, risers(ladder).length ? `**Rising**\n\n${movementTable(risers(ladder).slice(0, 5))}` : '', fallers(ladder).length ? `**Falling**\n\n${movementTable(fallers(ladder).slice(0, 5))}` : '']
        .filter(Boolean)
        .join('\n\n'),
    ),
  ]

  const blocks: WikiBlock[] = [
    text('intro', `This Yu-Gi-Oh! meta report covers what moved on the YGO Omega ranked ladders, using data through ${day(tcg.stats.syncedDays.last ?? issue)}. ${capitalized(rising(tcg))}, and ${rising(genesys)}.`),
    figure('report-board-tcg', tcgImages, `TCG movers for ${issueDay}`),
    figure('report-board-genesys', genesysImages, `Genesys movers for ${issueDay}`),
    text('intro-more', `For where every deck stands, see ${tierLinks}. This report only covers the changes.`),
    heading('h-moves', 2, 'Yu-Gi-Oh! meta report: which decks moved?', 'which-decks-moved'),
    text('moves', 'Change compares meta share over the latest days with the same span before them, in percentage points. Season share, tier and win rate cover the whole season, so a deck can rise fast from a small base.'),
    ...ladderMoves(tcg),
    ...ladderMoves(genesys),
    ...(compared
      ? [
          heading('h-tiers', 2, `Tier changes since ${day(previous?.issue ?? issue)}`, 'tier-changes'),
          text('tiers', changed.length ? ['| Ladder | Deck | Last issue | Now |', '|---|---|---|---|', ...changed].join('\n') : 'No deck changed tier since the last issue.'),
        ]
      : []),
    heading('h-events', 2, 'Biggest shifts in the numbers', 'biggest-shifts'),
    text(
      'events',
      `A shift is listed when a deck's meta share moves at least 2 points, or its win rate at least 5, between two blocks of days with 200 or more games each and the two intervals don't overlap.\n\n${events.length ? ['| Ladder | Deck | Shift | From | To | Games |', '|---|---|---|---:|---:|---:|', ...events].join('\n') : `No deck crossed that bar in the last ${EVENT_DAYS} days.`}`,
    ),
    ...(lead(tcg) || lead(genesys) ? [heading('h-spotlight', 2, 'Decks to watch', 'decks-to-watch'), ...spotlight(tcg), ...spotlight(genesys)] : []),
    {
      id: 'limits',
      type: 'callout',
      tone: 'cyan',
      title: 'Where these numbers come from',
      md: `Ranked matches on YGO Omega, not tournament results. Seasons run per ladder, so TCG and Genesys cover different dates. [How the tiers work](/wiki/${tierListSlug(tcg)}#methodology).`,
    },
    heading('h-faq', 2, 'Frequently asked questions', 'faq'),
    {
      id: 'faq',
      type: 'faq',
      items: [
        { q: `What changed in the Yu-Gi-Oh! meta this week?`, md: `${capitalized(rising(tcg))}, and ${rising(genesys)}. The tables above list every top mover.` },
        { q: 'What is the difference between this report and the tier lists?', md: `${capitalized(tierLinks)} rank every deck and are updated in place. This report is a dated record of what moved that week.` },
        { q: 'How often is the meta report published?', md: 'Every week, with data from the ranked ladders up to the day before.' },
      ],
    },
  ]

  return {
    v: 1,
    title: `Yu-Gi-Oh! Meta Report: ${issueDay}`,
    summary: `The Yu-Gi-Oh! meta report for ${issueDay}: ${rising(tcg)}, and ${rising(genesys)}. What moved on the YGO Omega ranked ladders this week.`,
    cover: { asset: COVER.id },
    infobox: {
      facts: [
        { label: 'Issue', value: issueDay },
        { label: 'Data through', value: day(tcg.stats.syncedDays.last ?? issue) },
        { label: 'TCG riser', value: lead(tcg) ? name(lead(tcg) as StatArchetype) : 'None' },
        { label: 'Genesys riser', value: lead(genesys) ? name(lead(genesys) as StatArchetype) : 'None' },
        { label: 'Source', value: 'YGO Omega ranked ladders' },
      ],
    },
    tags: ['meta-report', 'tcg', 'genesys', 'deck-trends'],
    blocks,
    assets: {
      [COVER.id]: COVER,
      [tcgImages.wide.id]: tcgImages.wide,
      [tcgImages.tall.id]: tcgImages.tall,
      [genesysImages.wide.id]: genesysImages.wide,
      [genesysImages.tall.id]: genesysImages.tall,
    },
    seo: {
      title: `Yu-Gi-Oh! Meta Report ${issueDay.replace(/^(\w{3})\w* /, '$1 ')}: What Moved`,
      // Deck names vary too much in length to fit here: the summary carries them.
      description: `Yu-Gi-Oh! meta report for ${issueDay}: the decks rising and falling on the TCG and Genesys ladders, with win rates and decks to watch.`,
      keyword: 'Yu-Gi-Oh! meta report',
      keywords: ['yugioh meta report', 'yugioh meta this week', 'rising yugioh decks'],
      image: tcgImages.wide.id,
      schema: 'Article',
    },
    hub: tierListSlug(tcg),
    related: [tierListSlug(genesys), ...(previous ? [reportSlug(previous.issue)] : ['yu-gi-oh-formats'])],
  }
}

const snapshotOf = (issue: string, ladders: Ladder[]): Snapshot => {
  const of = (ladder: Ladder) => ({
    season: ladder.stats.season.code,
    decks: Object.fromEntries(tiered(ladder).map((deck) => [key(deck.archetype), { name: name(deck), tier: deck.tier ?? 0, metaShare: deck.metaShare }])),
  })
  const [tcg, genesys] = ladders as [Ladder, Ladder]
  return { issue, ladders: { TCG: of(tcg), Genesys: of(genesys) } }
}

/** The newest snapshot before this issue, so a rerun of the same week never compares against itself. */
const previousSnapshot = (issue: string): Snapshot | null => {
  if (!existsSync(SNAPSHOTS)) return null
  const latest = readdirSync(SNAPSHOTS)
    .map((file) => file.replace(/\.json$/, ''))
    .filter((date) => date < issue)
    .sort()
    .at(-1)
  return latest ? (JSON.parse(readFileSync(`${SNAPSHOTS}/${latest}.json`, 'utf8')) as Snapshot) : null
}

const load = async (label: Ladder['label'], prefix: Ladder['prefix']): Promise<Ladder> => {
  const res = await fetch(`${API}/statistics?ladder=${prefix}&archetypes=${ARCHETYPES}`)
  if (!res.ok) throw new Error(`GET /statistics?ladder=${prefix} failed with ${res.status}`)
  const stats = (await res.json()) as Statistics
  return { label, prefix, stats, decks: powerRanked(stats.archetypes) }
}

/** JPG: these images stay in git forever, and at this quality they weigh a fifth of the PNG. One at a time: the route's queue is short. */
const saveImages = async (ladders: Ladder[], issue: string) => {
  const sections = [['tier-list', BOARD_IMAGES, boardImages], ['meta-report', REPORT_IMAGES, reportImages]] as const
  for (const [section, folder, images] of sections) {
    mkdirSync(`public${folder}`, { recursive: true })
    for (const ladder of ladders) {
      for (const size of Object.keys(IMAGE_SIZES) as Size[]) {
        const url = `${IMAGE_BASE}/statistics/infographic/${section}?ladder=${ladder.prefix}&size=${size}`
        const res = await fetch(url)
        if (!res.ok) throw new Error(`GET ${url} failed with ${res.status}. Not deployed yet? WIKI_IMAGE_BASE points at a dev server.`)
        await sharp(Buffer.from(await res.arrayBuffer()))
          .jpeg({ quality: 88, mozjpeg: true })
          .toFile(`public${images(ladder, issue)[size].src}`)
      }
    }
  }
}

const main = async () => {
  const issue = process.argv[2] ?? new Date().toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issue)) throw new Error('The date must be YYYY-MM-DD.')

  const [tcg, genesys] = await Promise.all([load('TCG', 'tcg'), load('Genesys', 'genesys')])
  const articles = [
    { slug: tierListSlug(genesys), doc: buildTierList(genesys, tcg, issue) },
    { slug: tierListSlug(tcg), doc: buildTierList(tcg, genesys, issue) },
    { slug: reportSlug(issue), doc: buildReport(tcg, genesys, issue, previousSnapshot(issue)) },
  ]

  // All or none: a report must never go out pointing at a tier list that failed.
  for (const { slug, doc } of articles) {
    const problems = validateDoc(doc)
    if (problems.length) throw new Error(`The wiki would refuse ${slug}:\n- ${problems.join('\n- ')}`)
  }
  await saveImages([tcg, genesys], issue)

  for (const { slug, doc } of articles) {
    const path = `${PAGES}/${slug}.json`
    writeFileSync(path, `${JSON.stringify({ slug, published: false, doc }, null, 2)}\n`)
    const checks = seoChecks(doc, { slug })
    console.log(`${path}\nSEO ${seoScore(checks)}/100, title ${titlePixels(searchTitle(doc))}/${TITLE_PX} px`)
    for (const check of checks.filter((c) => c.level !== 'pass')) console.log(`${check.level}: ${check.text}`)
  }

  mkdirSync(SNAPSHOTS, { recursive: true })
  writeFileSync(`${SNAPSHOTS}/${issue}.json`, `${JSON.stringify(snapshotOf(issue, [tcg, genesys]), null, 2)}\n`)

  console.log(`\nImages saved to public${BOARD_IMAGES} and public${REPORT_IMAGES}: commit them and publish after they deploy. The posts use the same files.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
