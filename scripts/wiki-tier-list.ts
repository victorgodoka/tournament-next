/**
 * Builds the two weekly wiki articles from the live statistics report and writes them to docs/wiki-pages,
 * to paste into the editor's "Load a document":
 *
 * - `yu-gi-oh-tier-list`: one fixed address, replaced in place every week, so links and ranking add up on one page.
 * - `yu-gi-oh-meta-report-{date}`: a new article each week with only what changed, under the tier list as its hub.
 *
 * Every number and every claim in the copy comes from the report, so a week where the leader or the tiers
 * change can't print something false. Refuses to write a doc the wiki would reject, and lists what the
 * editor's SEO panel would flag. Each run also saves a snapshot, which next week's report compares against:
 * commit it. A snapshot from another season is ignored, since tiers restart with the season.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/wiki-tier-list.ts [YYYY-MM-DD]
 *
 * The date defaults to today (UTC). Copy that reads like a judgment stays out of here: add it by hand in the editor.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { MetaEvent, Statistics, StatArchetype } from '@utils/statistics'
import { validateDoc, type WikiBlock, type WikiDoc } from '@utils/wiki-doc'
import { searchTitle, seoChecks, seoScore, titlePixels, TITLE_PX } from '@utils/wiki-seo'

/** Production on purpose: a local API has no ladder data. */
const API = 'https://godokaapi.duelistsunite.org'
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
const TIER_LIST_SLUG = 'yu-gi-oh-tier-list'
const PAGES = 'docs/wiki-pages'
const SNAPSHOTS = `${PAGES}/snapshots`
const MIN_MATCHUP_GAMES = { TCG: 300, Genesys: 80 }
/** How far back a report's meta events reach, in season days. */
const EVENT_DAYS = 7
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

type Ladder = { label: 'TCG' | 'Genesys'; prefix: 'tcg' | 'genesys'; stats: Statistics; decks: StatArchetype[] }
type Tier = 1 | 2 | 3 | 4
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
/** Raw-HTML rule: "Maliss <P> Dormouse" is a real card name and the server refuses it. */
const cardName = (card: { id: number; name: string | null }) => (card.name ?? String(card.id)).replace(/[<>]/g, '')
const cardLink = (card: { id: number; name: string | null }) => `[${cardName(card)}](/wiki/card/${card.id})`
const reportSlug = (issue: string) => `yu-gi-oh-meta-report-${day(issue).replace(/,/g, '').replace(/ /g, '-').toLowerCase()}`
const tier = (ladder: Ladder, t: Tier) => ladder.decks.filter((deck) => deck.tier === t)
const tiered = (ladder: Ladder) => ladder.decks.filter((deck) => deck.tier)
const goingFirst = (ladder: Ladder) => pct(ladder.stats.turnOrder.all.first.winRate)
/** The window `growth` covers on the server: half the season, at most 7 days. */
const growthDays = (ladder: Ladder) => Math.min(7, Math.max(1, Math.floor(ladder.stats.syncedDays.count / 2)))

const table = (decks: StatArchetype[]) =>
  [
    '| Deck | Meta share | Win rate | Deck-games | Players |',
    '|---|---:|---:|---:|---:|',
    ...decks.map((deck) => `| ${name(deck)} | ${pct(deck.metaShare)} | ${pct(deck.winRate)}${margin(deck)} | ${num(deck.games)} | ${num(deck.players)} |`),
  ].join('\n')

/** Deck names, not card names: readers look for the deck, and it dodges the raw-HTML rule. One art per block: the list keys by id. */
const tierCards = (decks: StatArchetype[]) => {
  const seen = new Set<number>()
  return decks.flatMap((deck) => {
    if (!deck.face || seen.has(deck.face.id)) return []
    seen.add(deck.face.id)
    return [{ id: deck.face.id, name: name(deck), note: `${pct(deck.metaShare)} · ${pct(deck.winRate)} WR` }]
  })
}

const heading = (id: string, level: 2 | 3, text: string, anchor: string): WikiBlock => ({ id, type: 'heading', level, text, anchor })
const text = (id: string, md: string): WikiBlock => ({ id, type: 'text', md })

/** The leaders, as a sentence that holds for one Tier 1 deck or for several. */
const leaders = (ladder: Ladder) => {
  const top = tier(ladder, 1)
  const [only] = top
  if (top.length === 1 && only) return `**${name(only)}** sits alone in ${ladder.label} Tier 1 with ${pct(only.metaShare)} of the meta and a ${pct(only.winRate)} win rate.`
  return `${and(top.map((deck) => `**${name(deck)}** (${pct(deck.metaShare)}, ${pct(deck.winRate)})`))} share ${ladder.label} Tier 1.`
}
const headline = (ladder: Ladder) => {
  const top = tier(ladder, 1).map(name)
  return top.length === 1 ? `${top[0]} is the only ${ladder.label} Tier 1 deck` : `${and(top)} lead ${ladder.label}`
}

const leaderNote = (ladder: Ladder) => {
  const [first, second] = ladder.decks
  if (!first) return ''
  const lead = second ? `${name(first)} holds ${(first.metaShare / second.metaShare).toFixed(1)} times the share of the next deck and wins ${pct(first.winRate)}.` : ''
  const growth = first.growth ?? 0
  return `${lead} It wins ${pct(first.turnOrder.first.winRate)} going first and ${pct(first.turnOrder.second.winRate)} going second. Its share ${growth >= 0 ? 'rose' : 'fell'} ${Math.abs(growth * 100).toFixed(1)} points over the last ${growthDays(ladder)} days.`
}

const spreadNote = (decks: StatArchetype[]) => {
  const byRate = [...decks].sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
  const high = byRate[0]
  const low = byRate.at(-1)
  if (!high || !low || high === low) return ''
  const losing = decks.filter((deck) => (deck.winRate ?? 0) < 0.5).map(name)
  const tail = losing.length ? ` ${and(losing)} ${losing.length === 1 ? 'is' : 'are'} here on popularity, winning under half of ${losing.length === 1 ? 'its' : 'their'} games.` : ''
  return `Win rates here run from ${pct(low.winRate)} (${name(low)}) to ${pct(high.winRate)} (${name(high)}).${tail}`
}

/** Art for the tiers short enough to show it; a cards block holds 12 at most, and an empty one is invalid. */
const tierBlocks = (ladder: Ladder, t: Tier, note: string, art = true): WikiBlock[] => {
  const decks = tier(ladder, t)
  if (!decks.length) return []
  const id = `${ladder.prefix}-${t}`
  const cards = art && decks.length <= 12 ? tierCards(decks) : []
  return [
    heading(`h-${id}`, 3, `${ladder.label} Tier ${t}`, `${ladder.prefix}-tier-${t}`),
    ...(cards.length ? [{ id: `cards-${id}`, type: 'cards', cards, ...(t === 1 ? { caption: "Share of the meta and win rate. Art is the deck's most used card." } : {}) } as const] : []),
    text(id, [table(decks), note].filter(Boolean).join('\n\n')),
  ]
}

const ladderBlocks = (ladder: Ladder): WikiBlock[] => {
  const { stats, label, prefix } = ladder
  const primer = label === 'Genesys' ? ' New to the format? The [format primer](/wiki/yu-gi-oh-formats) explains the 100-point rule.' : ''
  return [
    heading(`h-${prefix}`, 2, `${label} tier list`, `${prefix}-tier-list`),
    text(
      `${prefix}-intro`,
      `The ${label} ladder is ${stats.syncedDays.count} days into the ${stats.season.label.split(' ')[0]} season, with ${num(stats.totals.matches)} matches from ${num(stats.totals.players)} players. The top deck holds ${pct(ladder.decks[0]?.metaShare)} of the meta, and ${pct(stats.tierDistribution?.others.share, 0)} of games come from decks outside all four tiers.${primer}`,
    ),
    ...tierBlocks(ladder, 1, leaderNote(ladder)),
    ...tierBlocks(ladder, 2, spreadNote(tier(ladder, 2))),
    ...tierBlocks(ladder, 3, ''),
    ...tierBlocks(ladder, 4, '', false),
  ]
}

/** Tiered decks by growth: the biggest risers first. */
const risers = (ladder: Ladder) => tiered(ladder).filter((deck) => (deck.growth ?? 0) > 0).sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0))
const fallers = (ladder: Ladder) => tiered(ladder).filter((deck) => (deck.growth ?? 0) < 0).sort((a, b) => (a.growth ?? 0) - (b.growth ?? 0))

const underplayed = (ladder: Ladder) =>
  tiered(ladder)
    .filter((deck) => (deck.tier ?? 0) >= 3 && deck.winRate != null)
    .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
    .slice(0, 3)

/** Only matchups whose whole 95% interval sits on one side of 50%: the rest are noise. */
const bestAndWorst = (ladder: Ladder, deck: StatArchetype) => {
  const byKey = new Map(ladder.decks.map((d) => [key(d.archetype), d]))
  const seen = ladder.stats.matchups
    .filter((m) => {
      const opponent = byKey.get(key(m.opponent))
      return key(m.archetype) === key(deck.archetype) && !!opponent?.tier && opponent.tier <= 3 && m.games >= MIN_MATCHUP_GAMES[ladder.label] && m.winRate != null && !!m.ci
    })
    .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))
  const cell = (m?: (typeof seen)[number]) => {
    const opponent = m && byKey.get(key(m.opponent))
    return m && opponent ? `${name(opponent)}, ${pct(m.winRate)} (${num(m.games)} games)` : null
  }
  return { best: cell(seen.find((m) => (m.ci?.lower ?? 0) > 0.5)), worst: cell([...seen].reverse().find((m) => (m.ci?.upper ?? 1) < 0.5)) }
}

const matchupTable = (ladder: Ladder, decks: StatArchetype[]) => {
  const rows = decks.map((deck) => {
    const { best, worst } = bestAndWorst(ladder, deck)
    return `| ${name(deck)} | ${best ?? 'None clear'} | ${worst ?? 'None clear'} |`
  })
  return ['| Deck | Best matchup | Worst matchup |', '|---|---|---|', ...rows].join('\n')
}

const staples = (ladder: Ladder) => ladder.stats.mostUsed.main.slice(0, 4).map((card) => ({ id: card.id, name: cardName(card), note: `in ${pct(card.popularity)} of decks` }))

/** The strongest deck by the API's own ranking: the low end of the interval, so a small sample can't win it. */
const strongest = (ladder: Ladder) => {
  const [top] = ladder.stats.rankings?.highestWinRate ?? []
  return ladder.decks.find((deck) => top && key(deck.archetype) === key(top)) ?? ladder.decks[0]
}

/** The widest gap between a tier and a win rate this week, so the answer always has a true example. */
const tierVsStrength = (ladder: Ladder) => {
  const byRate = (a: StatArchetype, b: StatArchetype) => (a.winRate ?? 0) - (b.winRate ?? 0)
  const high = [...tiered(ladder)].filter((deck) => (deck.tier ?? 0) <= 2).sort(byRate)[0]
  const low = [...tiered(ladder)].filter((deck) => (deck.tier ?? 0) >= 3).sort(byRate).at(-1)
  if (!high || !low) return 'Tiers measure popularity, so read them with the win rate.'
  return `Not always. Tiers measure popularity. ${name(high)} is ${ladder.label} Tier ${high.tier} with a ${pct(high.winRate)} win rate, while ${name(low)} is Tier ${low.tier} at ${pct(low.winRate)}.`
}

const buildTierList = (tcg: Ladder, genesys: Ladder, issue: string): WikiDoc => {
  const issueDay = day(issue)
  const matches = tcg.stats.totals.matches + genesys.stats.totals.matches
  const leader = tcg.decks[0]
  const genesysLeader = genesys.decks[0]
  if (!leader || !genesysLeader) throw new Error('A ladder came back with no decks.')
  const tcgBest = strongest(tcg) ?? leader
  const genesysBest = strongest(genesys) ?? genesysLeader
  const art = `card-${leader.face?.id}`

  const blocks: WikiBlock[] = [
    text(
      'intro',
      `This Yu-Gi-Oh! tier list ranks the decks people are playing on the YGO Omega ranked ladders, using data through ${day(tcg.stats.syncedDays.last ?? issue)}. ${leaders(tcg)} ${leaders(genesys)}\n\nA tier here measures **how much a deck is played**, not how strong it is. Read each tier with its win rate. For what moved this week, read the [latest meta report](/wiki/${reportSlug(issue)}); for the numbers as they change, the [live statistics page](/statistics).`,
    ),
    heading('h-glance', 2, 'Yu-Gi-Oh! tier list at a glance', 'at-a-glance'),
    text(
      'glance',
      [
        '| | TCG ladder | Genesys ladder |',
        '|---|---|---|',
        `| Tier 1 | ${tier(tcg, 1).map(name).join(', ')} | ${tier(genesys, 1).map(name).join(', ')} |`,
        `| Tier 2 | ${tier(tcg, 2).map(name).join(', ') || 'None'} | ${tier(genesys, 2).map(name).join(', ') || 'None'} |`,
        `| Decks in Tiers 1 to 4 | ${tiered(tcg).length} | ${tiered(genesys).length} |`,
        `| Matches counted | ${num(tcg.stats.totals.matches)} | ${num(genesys.stats.totals.matches)} |`,
        `| Players | ${num(tcg.stats.totals.players)} | ${num(genesys.stats.totals.players)} |`,
        `| Going first wins | ${goingFirst(tcg)} | ${goingFirst(genesys)} |`,
        `| Season opened | ${day(tcg.stats.season.startsAt)} | ${day(genesys.stats.season.startsAt)} |`,
      ].join('\n'),
    ),

    ...ladderBlocks(tcg),
    ...ladderBlocks(genesys),

    heading('h-sleepers', 2, 'Which decks win more than their tier suggests?', 'underplayed-decks'),
    text(
      'sleepers',
      `These Tier 3 and 4 decks post the best win rates outside the top of each ladder. Their samples are smaller, and the people playing them may be specialists, so treat them as leads to test, not as proof.\n\n${[tcg, genesys]
        .map((ladder) => `- **${ladder.label}:** ${and(underplayed(ladder).map((deck) => `${name(deck)} (${pct(deck.winRate)}${margin(deck)})`)) || 'None this week'}`)
        .join('\n')}`,
    ),

    heading('h-matchups', 2, 'What beats the top decks?', 'matchups'),
    text(
      'matchups-tcg',
      `Best and worst matchup for each top deck against Tiers 1 to 3. A matchup is listed only when its whole 95% confidence interval sits on one side of 50%, with at least ${MIN_MATCHUP_GAMES.TCG} games in TCG and ${MIN_MATCHUP_GAMES.Genesys} in Genesys.\n\n### TCG matchups\n\n${matchupTable(tcg, tcg.decks.slice(0, 6))}`,
    ),
    text('matchups-gen', `### Genesys matchups\n\n${matchupTable(genesys, genesys.decks.slice(0, 6))}`),

    heading('h-staples', 2, 'Most played generic cards', 'most-played-cards'),
    text(
      'staples-tcg',
      `Generic Main Deck cards seen across at least two archetypes, by share of deck-games. In TCG, ${tcg.stats.mostUsed.main.slice(0, 2).map((card) => `${cardLink(card)} shows up in ${pct(card.popularity)} of decks`).join(', and ')}.`,
    ),
    { id: 'cards-staples-tcg', type: 'cards', cards: staples(tcg), caption: 'TCG ladder' },
    text(
      'staples-gen',
      `In Genesys, ${genesys.stats.mostUsed.main.slice(0, 2).map((card) => `${cardLink(card)} shows up in ${pct(card.popularity)} of decks`).join(', and ')}.`,
    ),
    { id: 'cards-staples-gen', type: 'cards', cards: staples(genesys), caption: 'Genesys ladder' },

    heading('h-method', 2, 'How this tier list works', 'methodology'),
    text(
      'method',
      "Every number comes from ranked matches played on [YGO Omega](/wiki/ygo-omega-wiki), the same data behind our [statistics page](/statistics). Nothing is voted on or picked by hand.\n\n**Tiers follow meta share, measured against the most played deck of the season:**\n\n| Tier | Share compared with the top deck |\n|---|---|\n| Tier 1 | 60% or more |\n| Tier 2 | 30% to 60% |\n| Tier 3 | 15% to 30% |\n| Tier 4 | 5% to 15% |\n\nA deck also needs at least 0.5% of the meta to get a tier at all, so the top deck is always Tier 1 and a small format can't fill its tiers with fringe decks.\n\n- **Meta share** is the deck's share of deck-games. Each game counts once per player, and mirror matches count.\n- **Win rate** leaves mirror matches out, because a mirror always wins exactly half. The ± is its 95% confidence interval.\n- **Decks** are grouped by the archetypes they run, so a hybrid counts apart from pure builds.\n- **Seasons:** each ladder has its own season, so TCG and Genesys cover different date ranges.",
    ),
    {
      id: 'limits',
      type: 'callout',
      tone: 'cyan',
      title: "What this list can't tell you",
      md: 'This is ladder play on a simulator, not tournament results. Players of every level are in it. It shows what you will face on the ladder, which is not always what wins a premier event.',
    },

    heading('h-faq', 2, 'Frequently asked questions', 'faq'),
    {
      id: 'faq',
      type: 'faq',
      items: [
        {
          q: 'What is the best Yu-Gi-Oh! deck right now?',
          md: `On the TCG ladder, ${name(tcgBest)}, with a ${pct(tcgBest.winRate)} win rate at ${pct(tcgBest.metaShare)} of the meta. It has the strongest win rate once sample size is counted.`,
        },
        {
          q: 'What is the best Genesys deck right now?',
          md: `${name(genesysBest)}, with a ${pct(genesysBest.winRate)} win rate at ${pct(genesysBest.metaShare)} of the meta. It has the strongest win rate once sample size is counted.`,
        },
        { q: 'Is this tier list based on tournament results?', md: 'No. It comes from ranked ladder matches on YGO Omega. That gives a far larger sample than tournaments, but it reflects ladder play, not premier events.' },
        { q: 'How are the tiers decided?', md: 'By meta share compared with the most played deck: 60% of its share or more is Tier 1, 30% is Tier 2, 15% is Tier 3 and 5% is Tier 4. Decks under 0.5% of the meta get no tier.' },
        { q: 'Does a higher tier mean a stronger deck?', md: tierVsStrength(tcg) },
        { q: 'How much does going first matter?', md: `Going first wins ${goingFirst(tcg)} of games on the TCG ladder and ${goingFirst(genesys)} in Genesys.` },
        { q: 'How often is the tier list updated?', md: `Every week, on this same page. Each week also gets its own [meta report](/wiki/${reportSlug(issue)}), and the [statistics page](/statistics) shows the current numbers for TCG and [Genesys](/statistics?ladder=genesys) between updates.` },
        { q: 'Where can I see decklists for these decks?', md: 'The [statistics page](/statistics) has sample decklists, card usage and full matchup tables for each deck.' },
      ],
    },
  ]

  return {
    v: 1,
    // No date: the editor builds a new article's address from the title, and this one must stay fixed.
    title: 'Yu-Gi-Oh! Tier List',
    summary: `The Yu-Gi-Oh! tier list, updated ${issueDay}: ${headline(tcg)}, and ${headline(genesys)}. Ranked from ${num(matches)} YGO Omega ladder matches.`,
    cover: { asset: COVER.id },
    infobox: {
      ...(leader.face ? { asset: art, caption: `${leader.face.name?.replace(/[<>]/g, '')}, the most used card of the top TCG deck` } : {}),
      facts: [
        { label: 'Updated', value: issueDay },
        { label: 'Data through', value: day(tcg.stats.syncedDays.last ?? issue) },
        { label: 'TCG Tier 1', value: tier(tcg, 1).map(name).join('\n') },
        { label: 'Genesys Tier 1', value: tier(genesys, 1).map(name).join('\n') },
        { label: 'TCG matches', value: num(tcg.stats.totals.matches) },
        { label: 'Genesys matches', value: num(genesys.stats.totals.matches) },
        { label: 'Players', value: `${num(tcg.stats.totals.players)} TCG\n${num(genesys.stats.totals.players)} Genesys` },
        { label: 'Source', value: 'YGO Omega ranked ladders' },
        { label: 'Updates', value: 'Weekly' },
      ],
    },
    tags: ['tier-list', 'meta-report', 'tcg', 'genesys', 'deck-rankings'],
    blocks,
    assets: {
      [COVER.id]: COVER,
      ...(leader.face
        ? {
            [art]: {
              id: art,
              src: `https://ygopro.online/assets/card-arts/${leader.face.id}.jpg`,
              width: 624,
              height: 624,
              alt: `${leader.face.name?.replace(/[<>]/g, '')} card art, the most used card of the ${name(leader)} deck`,
            },
          }
        : {}),
    },
    seo: {
      // The month, not the day: the title shouldn't churn every week, and "| YGO Omega" still has to fit.
      title: `Yu-Gi-Oh! Tier List ${issueDay.replace(/ \d+,/, '')}: TCG, Genesys`,
      description: `Yu-Gi-Oh! tier list, updated ${issueDay}: ${name(leader)} leads TCG and ${name(genesysLeader)} leads Genesys, ranked from ${num(matches)} ladder matches.`,
      keyword: 'Yu-Gi-Oh! tier list',
      keywords: ['yugioh tier list', 'yugioh meta', 'best yugioh decks', 'tcg tier list', 'genesys tier list'],
      schema: 'Article',
    },
    hub: 'ygo-omega-wiki',
    related: ['yu-gi-oh-formats', 'beginner-s-guide-to-ygo-omega'],
  }
}

const movementTable = (decks: StatArchetype[]) =>
  [
    '| Deck | Tier | Season share | Change | Win rate |',
    '|---|---:|---:|---:|---:|',
    ...decks.map((deck) => `| ${name(deck)} | ${deck.tier} | ${pct(deck.metaShare)} | ${points(deck.growth ?? 0)} | ${pct(deck.winRate)}${margin(deck)} |`),
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
    .map((event) => `| ${ladder.label} | ${event.name} | ${EVENT_LABEL[event.kind]} | ${pct(event.from)} | ${pct(event.to)} | ${num(event.games)} |`)
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
    return [`| ${ladder.label} | ${shown} | ${label(was?.tier)} | ${label(is?.tier)} |`]
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
    text(
      'intro',
      `This Yu-Gi-Oh! meta report covers what moved on the YGO Omega ranked ladders, using data through ${day(tcg.stats.syncedDays.last ?? issue)}. ${rising(tcg)[0]?.toUpperCase()}${rising(tcg).slice(1)}, and ${rising(genesys)}.\n\nFor where every deck stands, see the full [Yu-Gi-Oh! tier list](/wiki/${TIER_LIST_SLUG}). This report only covers the changes.`,
    ),
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
      md: `Ranked matches on YGO Omega, not tournament results. Seasons run per ladder, so TCG and Genesys cover different dates. [How the tiers work](/wiki/${TIER_LIST_SLUG}#methodology).`,
    },
    heading('h-faq', 2, 'Frequently asked questions', 'faq'),
    {
      id: 'faq',
      type: 'faq',
      items: [
        { q: `What changed in the Yu-Gi-Oh! meta this week?`, md: `${rising(tcg)[0]?.toUpperCase()}${rising(tcg).slice(1)}, and ${rising(genesys)}. The tables above list every top mover.` },
        { q: 'What is the difference between this report and the tier list?', md: `The [tier list](/wiki/${TIER_LIST_SLUG}) ranks every deck and is updated in place. This report is a dated record of what moved that week.` },
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
    assets: { [COVER.id]: COVER },
    seo: {
      title: `Yu-Gi-Oh! Meta Report ${issueDay.replace(/^(\w{3})\w* /, '$1 ')}: What Moved`,
      // Deck names vary too much in length to fit here: the summary carries them.
      description: `Yu-Gi-Oh! meta report for ${issueDay}: the decks rising and falling on the TCG and Genesys ladders, with win rates and decks to watch.`,
      keyword: 'Yu-Gi-Oh! meta report',
      keywords: ['yugioh meta report', 'yugioh meta this week', 'rising yugioh decks'],
      schema: 'Article',
    },
    hub: TIER_LIST_SLUG,
    related: previous ? [reportSlug(previous.issue)] : ['yu-gi-oh-formats'],
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
  return { label, prefix, stats, decks: [...stats.archetypes].sort((a, b) => b.metaShare - a.metaShare) }
}

const main = async () => {
  const issue = process.argv[2] ?? new Date().toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issue)) throw new Error('The date must be YYYY-MM-DD.')

  const [tcg, genesys] = await Promise.all([load('TCG', 'tcg'), load('Genesys', 'genesys')])
  const articles = [
    { slug: TIER_LIST_SLUG, doc: buildTierList(tcg, genesys, issue) },
    { slug: reportSlug(issue), doc: buildReport(tcg, genesys, issue, previousSnapshot(issue)) },
  ]

  // Both or neither: a report must never go out pointing at a tier list that failed.
  for (const { slug, doc } of articles) {
    const problems = validateDoc(doc)
    if (problems.length) throw new Error(`The wiki would refuse ${slug}:\n- ${problems.join('\n- ')}`)
  }

  for (const { slug, doc } of articles) {
    const path = `${PAGES}/${slug}.json`
    writeFileSync(path, `${JSON.stringify({ slug, published: false, doc }, null, 2)}\n`)
    const checks = seoChecks(doc, { slug })
    console.log(`${path}\nSEO ${seoScore(checks)}/100, title ${titlePixels(searchTitle(doc))}/${TITLE_PX} px`)
    for (const check of checks.filter((c) => c.level !== 'pass')) console.log(`${check.level}: ${check.text}`)
  }

  mkdirSync(SNAPSHOTS, { recursive: true })
  writeFileSync(`${SNAPSHOTS}/${issue}.json`, `${JSON.stringify(snapshotOf(issue, [tcg, genesys]), null, 2)}\n`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
