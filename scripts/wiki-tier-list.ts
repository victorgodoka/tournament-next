/**
 * Builds the weekly wiki articles from the live statistics and writes them to docs/wiki-pages,
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
 * Every number and every claim in the copy comes from the API, so a week where the leader or the tiers
 * change can't print something false. Refuses to write a doc the wiki would reject, and lists what the
 * editor's SEO panel would flag. Each run also saves a snapshot, which next week's report compares against:
 * commit it, and the images with it, and publish after they deploy. A snapshot from another season is ignored,
 * since tiers restart with the season, and so is one built on other tier rules (gaps, floors, band), whose tiers
 * don't compare. Tiers are relative to the leader (`fit.tiers`): the script refuses a build without those rules.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/wiki-tier-list.ts [YYYY-MM-DD]
 *
 * The date defaults to today (UTC). WIKI_IMAGE_BASE=http://localhost:5173 renders the images from a dev server,
 * which spares production eight renders in a row and also covers a change to the images that isn't deployed yet.
 * WIKI_API points the numbers at another API. Copy that reads like a judgment stays out of here: add it by hand
 * in the editor.
 *
 * Publish in this order: Genesys, TCG, report. The server wants `hub` and `related` to exist, and each names the one before it.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { deckFaces, effectPoints, families, matchupCall, weekJumps, windowDays, type DeckAnswer, type DeckStat, type Meta, type Week } from '@utils/statistics'
import { validateDoc, type WikiAsset, type WikiBlock, type WikiDoc } from '@utils/wiki-doc'
import { searchTitle, seoChecks, seoScore, titlePixels, TITLE_PX } from '@utils/wiki-seo'
import { and, behind, fallers, gapPoints, leaders, listed, name, pct, risers, rulesOf, T1_SLOTS, tier, type Ladder, type Move, type Tier, type TierRules } from './tier-list'

/** Production by default: a local API has no ladder data. */
const API = process.env.WIKI_API ?? 'https://godokaapi.duelistsunite.org'
const SITE = 'https://omega.duelistsunite.org'
const IMAGE_BASE = process.env.WIKI_IMAGE_BASE ?? SITE
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
const MATCHUP_GAMES = { TCG: 300, Genesys: 80 }
/** The tier list ranks on the aggregate band, pinned so a server default change can't move it. */
const BAND = 'aggregate'
const MONTHS =['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Last issue's tiered decks by deck key. `rebuilt` marks the keys of the rebuilt statistics. */
type Snapshot = {
  issue: string
  rebuilt?: true
  /**
   * `band` and `floor` say which games the tiers were fitted on, `rules` which gaps and floors cut them; tiers of
   * another band, floor or rules don't compare. A snapshot without `rules` predates the tiers relative to the leader.
   */
  ladders: Record<
    Ladder['label'],
    { season: string; band?: string; floor?: string; rules?: TierRules; decks: Record<string, { name: string; tier: number; share?: number; wrExpected?: number }> }
  >
}

const day = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number]
  return `${MONTHS[m - 1]} ${d}, ${y}`
}
const num = (n: number) => n.toLocaleString('en-US')
const interval = (deck: Pick<DeckStat, 'wrLo' | 'wrHi'>) => `${(deck.wrLo * 100).toFixed(1)}–${(deck.wrHi * 100).toFixed(1)}`
const points = (delta: number) => `${delta >= 0 ? '+' : '−'}${Math.abs(delta * 100).toFixed(1)}`
const capitalized = (sentence: string) => `${sentence[0]?.toUpperCase()}${sentence.slice(1)}`
/** Raw-HTML rule: "Maliss <P> Dormouse" is a real card name and the server refuses it. */
const cardName = (card: { id: number; name: string | null }) => (card.name ?? String(card.id)).replace(/[<>]/g, '')
const cardLink = (card: { id: number; name: string | null }) => `[${cardName(card)}](/wiki/card/${card.id})`
const tierListSlug = (ladder: Pick<Ladder, 'prefix'>) => `yu-gi-oh-${ladder.prefix}-tier-list`
const reportSlug = (issue: string) => `yu-gi-oh-meta-report-${day(issue).replace(/,/g, '').replace(/ /g, '-').toLowerCase()}`
const statisticsPath = (ladder: Ladder) => (ladder.prefix === 'tcg' ? '/statistics' : '/statistics?ladder=genesys')
const tiered = (ladder: Ladder) => ladder.decks.filter((deck) => deck.tier)
const byShare = (ladder: Ladder) => [...ladder.decks].sort((a, b) => b.share - a.share)
const share = (decks: DeckStat[]) => decks.reduce((total, deck) => total + deck.share, 0)
const goingFirst = (ladder: Ladder) => pct(0.5 + effectPoints(ladder.meta.fit.firstEffect) / 100)
const seasonWord = (ladder: Ladder) => ladder.meta.season.label.split(' ')[0]

/** One card per deck, best deck first, by the same rule as the infographics: two builds of one archetype never share art. */
const facesOf = (ladder: Ladder) =>
  deckFaces(
    ladder.decks.map((deck) => {
      const answer = ladder.answers.get(deck.key)
      return { deck, cards: answer?.cards ?? [], sampleDeck: answer?.sampleDeck ?? null }
    }),
  )

/** Points under the leader as the articles print them: two decimals at most, the same in tables and prose. */
const back = (ladder: Ladder, deck: DeckStat) => gapPoints(behind(ladder, deck) / 100)
const SLOTS = ['none', 'one', 'two', 'three'][T1_SLOTS] ?? String(T1_SLOTS)

/** Which gap from the leader puts a deck in each tier, in points. */
const tierRange = ({ rules }: Pick<Ladder, 'rules'>, t: Tier) => {
  const [g1, g2, g3] = [rules.t1Gap, rules.t2Gap, rules.t3Gap].map(gapPoints)
  switch (t) {
    case 1:
      return `the leader, plus the next deck if it sits within ${g1} points of it`
    case 1.5:
      return `decks within ${g1} points of the leader that miss the ${SLOTS} Tier 1 spots`
    case 2:
      return `decks more than ${g1} and up to ${g2} points under the leader`
    case 3:
      return `decks more than ${g2} and up to ${g3} points under the leader`
    case 4:
      return `decks more than ${g3} points under the leader`
  }
}

/** The site's `win` and `loss` tokens. */
const WIN = '#4fdc8c'
const LOSS = '#ff8594'
/** Bold and coloured: `[text]{#hex}` is the wiki's Markdown for coloured text. */
const paint = (text: string, color: string) => `**[${text}]{${color}}**`

/** "Behind" is what sets the tier: points of expected win rate under the leader. */
const table = (ladder: Ladder, decks: DeckStat[]) =>
  [
    '| Deck | Expected win rate | Behind the leader | 95% interval | Meta share | Players |',
    '|---|---:|---:|---:|---:|---:|',
    ...decks.map((deck) => {
      const gap = deck === ladder.decks[0] ? 'Leader' : `${back(ladder, deck)} pts`
      return `| **${name(deck)}** | **${pct(deck.wrExpected)}** | ${gap} | ${interval(deck)} | ${pct(deck.share)} | ${num(deck.players)} |`
    }),
  ].join('\n')

/** Deck names, not card names: readers look for the deck, and it dodges the raw-HTML rule. */
const tierCards = (ladder: Ladder, decks: DeckStat[]) => {
  const faces = facesOf(ladder)
  return decks.flatMap((deck) => {
    const face = faces.get(deck.key)
    return face ? [{ id: face, name: name(deck), note: `${pct(deck.share)} · expected ${pct(deck.wrExpected)}` }] : []
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
    `${ladder.label} tier list board with ${and(tier(ladder, 1).map(name))} in Tier 1, showing each deck's expected win rate`,
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

/** The leader is always Tier 1: the list is relative to it. */
const headline = (ladder: Ladder) => {
  const top = tier(ladder, 1).map(name)
  return top.length === 1 ? `${top[0]} holds Tier 1 alone` : `${and(top)} share Tier 1`
}

const moveOf = (ladder: Ladder, deck: DeckStat) => [...risers(ladder), ...fallers(ladder)].find((m) => m.deck === deck) ?? null

const leaderNote = (ladder: Ladder) => {
  const [first] = ladder.decks
  if (!first) return ''
  const moved = moveOf(ladder, first)
  const move = moved ? ` ${name(moved.family)} decks as a whole ${moved.delta >= 0 ? 'gained' : 'lost'} ${Math.abs(moved.delta * 100).toFixed(1)} points of share last week.` : ''
  return `${name(first)} has the best expected win rate on the ladder, ${pct(first.wrExpected)} (95% interval ${interval(first)}) over ${num(first.games)} games, and every other tier counts down from it. In game 1 it wins ${pct(first.firstG1Wr)} going first and ${pct(first.secondG1Wr)} going second.${move}`
}

/** What a tier holds, and the spread of its decks under the leader. */
const spreadNote = (ladder: Ladder, t: Tier) => {
  const decks = tier(ladder, t)
  const high = decks[0]
  const low = decks.at(-1)
  const range = `Tier ${t} holds the ${tierRange(ladder, t)}.`
  if (!high || !low || high === low) return range
  return `${range} This week that runs from ${name(high)} at ${pct(high.wrExpected)}, ${back(ladder, high)} points back, to ${name(low)} at ${pct(low.wrExpected)}, ${back(ladder, low)} back.`
}

/** Art for the tiers short enough to show it; a cards block holds 12 at most, and an empty one is invalid. */
const tierBlocks = (ladder: Ladder, t: Tier, note: string, art = true): WikiBlock[] => {
  const decks = tier(ladder, t)
  if (!decks.length) return []
  const id = `${ladder.prefix}-${String(t).replace('.', '-')}`
  const cards = art && decks.length <= 12 ? tierCards(ladder, decks) : []
  return [
    heading(`h-${id}`, 3, `${ladder.label} Tier ${t}`, `tier-${String(t).replace('.', '-')}`),
    ...(cards.length ? [{ id: `cards-${id}`, type: 'cards', cards, ...(t === 1 ? { caption: "Share of the meta and expected win rate. Art is the deck's most used card." } : {}) } as const] : []),
    text(id, [table(ladder, decks), note].filter(Boolean).join('\n\n')),
  ]
}

const ladderBlocks = (ladder: Ladder): WikiBlock[] => {
  const { meta, label, prefix } = ladder
  const primer = label === 'Genesys' ? ' New to the format? The [format primer](/wiki/yu-gi-oh-formats) explains the 100-point rule.' : ''
  return [
    heading(`h-${prefix}`, 2, `${label} tiers`, 'tiers'),
    text(
      `${prefix}-intro`,
      `The ${label} ladder is ${windowDays(meta)} days into the ${seasonWord(ladder)} season, with ${num(meta.fit.games)} games from ${num(meta.fit.players)} players. The most played deck, ${name(byShare(ladder)[0] as DeckStat)}, holds ${pct(byShare(ladder)[0]?.share)} of the meta, and the ${tiered(ladder).length} decks in these tiers cover ${pct(share(tiered(ladder)), 0)} of it.${primer}`,
    ),
    ...tierBlocks(ladder, 1, leaderNote(ladder)),
    ...tierBlocks(ladder, 1.5, spreadNote(ladder, 1.5)),
    ...tierBlocks(ladder, 2, spreadNote(ladder, 2)),
    ...tierBlocks(ladder, 3, spreadNote(ladder, 3)),
    // Every deck over the floors past the Tier 3 gap lands here: a long table, no art.
    ...tierBlocks(ladder, 4, spreadNote(ladder, 4), false),
  ]
}

/** Strong and rarely played: the top tiers, least played first. */
const underplayed = (ladder: Ladder) =>
  [...ladder.decks]
    .filter((deck) => deck.tier && deck.tier <= 2)
    .sort((a, b) => a.share - b.share)
    .slice(0, 3)

/** Popular without the results: among the ten most played, the ones below Tier 2. */
const overplayed = (ladder: Ladder) =>
  byShare(ladder)
    .slice(0, 10)
    .filter((deck) => !deck.tier || deck.tier >= 3)
    .slice(0, 3)

/** Only matchups whose interval excludes what the strengths predict: the rest are noise. */
const bestAndWorst = (ladder: Ladder, deck: DeckStat) => {
  const byKey = new Map(ladder.decks.map((d) => [d.key, d]))
  const seen = (ladder.answers.get(deck.key)?.matchups ?? [])
    .filter((m) => {
      const opponent = byKey.get(m.opponent)
      return !!opponent?.tier && opponent.tier <= 3 && m.games >= MATCHUP_GAMES[ladder.label]
    })
    .sort((a, b) => b.wrAdjusted - a.wrAdjusted)
  const cell = (m?: (typeof seen)[number]) => {
    const opponent = m && byKey.get(m.opponent)
    return m && opponent ? `${name(opponent)}, ${pct(m.wrAdjusted)} (${num(m.games)} games)` : null
  }
  return { best: cell(seen.find((m) => matchupCall(m) === 'favorable')), worst: cell([...seen].reverse().find((m) => matchupCall(m) === 'unfavorable')) }
}

const matchupTable = (ladder: Ladder, decks: DeckStat[]) => {
  const rows = decks.map((deck) => {
    const { best, worst } = bestAndWorst(ladder, deck)
    return `| **${name(deck)}** | ${best ? paint(best, WIN) : 'None clear'} | ${worst ? paint(worst, LOSS) : 'None clear'} |`
  })
  return ['| Deck | Best matchup | Worst matchup |', '|---|---|---|', ...rows].join('\n')
}

/** A pair from this week, so the answer always has a true example. */
const tierVsPopularity = (ladder: Ladder) => {
  const popular = overplayed(ladder)[0]
  const rare = underplayed(ladder)[0]
  if (!popular || !rare) return 'No. The tier comes from the expected win rate alone. Share of the meta only decides whether a deck gets ranked.'
  return `No. ${name(popular)} holds ${pct(popular.share)} of the meta and sits in Tier ${popular.tier}. ${name(rare)} holds ${pct(rare.share)} and sits in Tier ${rare.tier}.`
}

/** The tier table of the method section, from the build's own gaps. */
const tierRules = (ladder: Ladder) => {
  const { t1Gap, t2Gap, t3Gap } = ladder.rules
  const rows: [Tier, string][] = [
    [1, `The leader, plus the next deck within ${gapPoints(t1Gap)}`],
    [1.5, `Within ${gapPoints(t1Gap)}, once Tier 1 is full`],
    [2, `Up to ${gapPoints(t2Gap)}`],
    [3, `Up to ${gapPoints(t3Gap)}`],
    [4, `More than ${gapPoints(t3Gap)}`],
  ]
  return ['| Tier | Points under the leader |', '|---|---|', ...rows.map(([t, rule]) => `| Tier ${t} | ${rule} |`)].join('\n')
}

/** The floors a deck needs before it gets any tier: the format's own. */
const floors = ({ rules }: Ladder) => `${Number((rules.minShare * 100).toFixed(2))}% of the meta and ${rules.minPlayers} players`

const tierOneAnswer = (ladder: Ladder) => {
  const next = tier(ladder, 1.5)
  const after = next.length ? ` ${and(next.map(name))} ${next.length === 1 ? 'sits' : 'sit'} right behind in Tier 1.5.` : ''
  return `${and(tier(ladder, 1).map((deck) => `${name(deck)} (expected ${pct(deck.wrExpected)})`))}.${after}`
}

const mostPlayedAnswer = (ladder: Ladder) => {
  const top = byShare(ladder)[0]!
  const place = top === ladder.decks[0] ? 'and leads the tier list too' : `and sits in Tier ${top.tier}, ${back(ladder, top)} points under the leader`
  return `${name(top)}, at ${pct(top.share)} of the meta. It has an expected ${pct(top.wrExpected)} win rate ${place}.`
}

const buildTierList = (ladder: Ladder, other: Ladder, issue: string): WikiDoc => {
  const { label, prefix, meta } = ladder
  const issueDay = day(issue)
  const leader = ladder.decks[0]
  if (!leader) throw new Error(`The ${label} ladder came back with no decks.`)
  const faceId = facesOf(ladder).get(leader.key)
  const art = `card-${faceId}`
  const dataDay = day(meta.season.sweptThrough ?? issue)
  const board = boardImages(ladder, issue)
  const live = statisticsPath(ladder)

  const blocks: WikiBlock[] = [
    text('intro', `This Yu-Gi-Oh! ${label} tier list ranks the decks on the YGO Omega ${label} ladder by expected win rate, from ranked games through ${dataDay}. ${leaders(ladder)}`),
    figure('board', board, `The ${label} tier list at a glance`),
    text(
      'intro-more',
      `Every tier counts down from the deck at the top: a deck's tier says how many points of expected win rate it gives up to the leader. For what moved this week, read the [latest meta report](/wiki/${reportSlug(issue)}). For the other ladder, see the [${other.label} tier list](/wiki/${tierListSlug(other)}), and between updates, the [live statistics page](${live}).`,
    ),
    heading('h-glance', 2, `Yu-Gi-Oh! ${label} tier list at a glance`, 'at-a-glance'),
    text(
      'glance',
      [
        '| | |',
        '|---|---|',
        `| Leader | ${name(leader)}, expected ${pct(leader.wrExpected)} |`,
        `| Tier 1 | ${tier(ladder, 1).map(name).join(', ')} |`,
        `| Tier 1.5 | ${tier(ladder, 1.5).map(name).join(', ') || 'None'} |`,
        `| Tier 2 | ${tier(ladder, 2).map(name).join(', ') || 'None'} |`,
        `| Decks ranked | ${tiered(ladder).length} |`,
        `| Games counted | ${num(meta.fit.games)} |`,
        `| Players | ${num(meta.fit.players)} |`,
        `| Going first wins | ${goingFirst(ladder)} of game 1 |`,
        `| Season opened | ${day(meta.season.startsAt)} |`,
      ].join('\n'),
    ),

    ...ladderBlocks(ladder),

    heading('h-sleepers', 2, 'Which decks are underplayed and overplayed?', 'underplayed-decks'),
    text(
      'sleepers',
      `The underplayed decks reach Tier 2 or better on a small share of the meta. Specialists may pilot most of their games, so test one before you trust its number. The overplayed decks sit among the ten most played and land in Tier 3 or lower.\n\n- **Underplayed:** ${and(underplayed(ladder).map((deck) => `${name(deck)} (${pct(deck.share)} of the meta, expected ${pct(deck.wrExpected)})`)) || 'None this week'}\n- **Overplayed:** ${and(overplayed(ladder).map((deck) => `${name(deck)} (${pct(deck.share)} of the meta, expected ${pct(deck.wrExpected)})`)) || 'None this week'}`,
    ),

    heading('h-matchups', 2, 'What beats the top decks?', 'matchups'),
    text(
      'matchups',
      `The best and worst matchup of the six best decks against Tiers 1 to 3. A matchup shows up only when its 95% interval excludes the rate the two decks' strengths predict, over at least ${MATCHUP_GAMES[label]} games.\n\n${matchupTable(ladder, ladder.decks.slice(0, 6))}`,
    ),

    heading('h-method', 2, 'How this tier list works', 'methodology'),
    text(
      'method',
      `Every number comes from ranked games on [YGO Omega](/wiki/ygo-omega-wiki), the same data as the [statistics page](${live}). Nobody votes on a tier or moves a deck by hand.\n\n**Each deck gets an expected win rate.** One model reads the season's games between players rated ${meta.fit.aggregateFloor} and up, after it drops players with too few ranked games and one-off decklists. It gives each deck a strength and predicts each game from the two strengths, who went first and the rating gap. A deck's expected win rate is its strength against the whole field, weighted by how often you meet each deck. The model pulls a deck with few games toward 50%.\n\n**Tiers count down from the leader.** The deck with the best expected win rate leads and sets Tier 1. Every other deck takes its tier from how many points it sits under the leader:\n\n${tierRules(ladder)}\n\nTier 1 holds ${SLOTS} decks at most. When the leader's rate moves, every boundary moves with it, so a deck can change tier in a week its own rate held still. A deck needs ${floors(ladder)} before it gets a tier: the model corrects for few games, and the floors keep out decks with few pilots.\n\n- **Meta share** is the deck's share of deck-games. Each game counts once per player, mirrors included.\n- **The 95% interval** gives the range the expected win rate likely falls in. It widens when the deck's daily results swing more than chance explains.\n- **Decks** take their names from the archetypes they play, lead archetype first. A hybrid counts apart from the pure build.`,
    ),
    {
      id: 'limits',
      type: 'callout',
      tone: 'cyan',
      title: "What this list can't tell you",
      md: 'These are ladder games on a simulator. Players of every level take part, and a deck that specialists pilot can score above what it would in most hands. Use the list to see what wins on the ladder; a premier event can reward other decks.',
    },

    heading('h-faq', 2, `Yu-Gi-Oh! ${label} tier list FAQ`, 'faq'),
    {
      id: 'faq',
      type: 'faq',
      items: [
        {
          q: `What is the best Yu-Gi-Oh! ${label} deck right now?`,
          md: `${name(leader)}, with an expected ${pct(leader.wrExpected)} win rate (95% interval ${interval(leader)}) at ${pct(leader.share)} of the meta, from ladder games through ${dataDay}.`,
        },
        { q: `What are the Tier 1 decks in ${label}?`, md: tierOneAnswer(ladder) },
        { q: `What is the most played deck in the ${label} meta?`, md: mostPlayedAnswer(ladder) },
        {
          q: 'How are the tiers decided?',
          md: `By distance from the leader in expected win rate. Tier 1 is the leader plus one deck within ${gapPoints(ladder.rules.t1Gap)} points; further decks within that gap go to Tier 1.5. Tier 2 reaches ${gapPoints(ladder.rules.t2Gap)} points under the leader and Tier 3 reaches ${gapPoints(ladder.rules.t3Gap)}; Tier 4 takes the rest. A deck needs ${floors(ladder)} to be ranked.`,
        },
        {
          q: 'Why did a deck change tier when its win rate barely moved?',
          md: "The tiers count from the leader. When the leader's expected win rate rises or falls, every tier boundary moves with it, and decks near a boundary cross it.",
        },
        { q: 'Is this tier list based on tournament results?', md: 'No. It comes from ranked ladder games on YGO Omega. You get a far larger sample than any tournament, and it reflects ladder play, so a premier event can look different.' },
        { q: 'Does a popular deck get a higher tier?', md: tierVsPopularity(ladder) },
        { q: 'How much does going first matter?', md: `Going first wins ${goingFirst(ladder)} of game 1 between even decks on the ${label} ladder.` },
        { q: 'How often is the tier list updated?', md: `Every week, on this same page. Each week also gets its own [meta report](/wiki/${reportSlug(issue)}), and the [statistics page](${live}) shows the current numbers between updates.` },
        { q: 'Where can I see decklists for these decks?', md: `The [statistics page](${live}) has sample decklists, card usage and full matchup tables for each deck.` },
      ],
    },
  ]

  return {
    v: 1,
    // No date: the editor builds a new article's address from the title, and this one must stay fixed.
    title: `Yu-Gi-Oh! ${label} Tier List`,
    summary: `The Yu-Gi-Oh! ${label} tier list, updated ${issueDay}: ${headline(ladder)}. Ranked from ${num(meta.fit.games)} YGO Omega ladder games.`,
    cover: { asset: COVER.id },
    infobox: {
      ...(faceId ? { asset: art, caption: `The most used card of ${name(leader)}, the top deck` } : {}),
      facts: [
        { label: 'Updated', value: issueDay },
        { label: 'Data through', value: dataDay },
        { label: 'Tier 1', value: tier(ladder, 1).map(name).join('\n') || 'None' },
        { label: 'Games', value: num(meta.fit.games) },
        { label: 'Players', value: num(meta.fit.players) },
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
      ...(faceId
        ? {
            [art]: {
              id: art,
              src: `https://ygopro.online/assets/card-arts/${faceId}.jpg`,
              width: 624,
              height: 624,
              alt: `Card art of the most used card of the ${name(leader)} deck`,
            },
          }
        : {}),
    },
    seo: {
      // The month, not the day: the title shouldn't churn every week. Short, so Genesys and "| YGO Omega" fit in September too.
      title: `Yu-Gi-Oh! ${label} Tier List ${issueDay.replace(/ \d+,/, '').replace(/^(\w{3})\w*/, '$1')}: Best Decks`,
      description: `Yu-Gi-Oh! ${label} tier list, updated ${issueDay}: ${name(leader)} leads, ranked from ${num(meta.fit.games)} ladder games by expected win rate.`,
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

const movementTable = (moves: Move[]) =>
  [
    '| Family | Tier | Season share | Change | Expected win rate |',
    '|---|---:|---:|---:|---:|',
    // Tier and rate are the most played listed build's: the `A*` row's would contradict the tier list under the same name.
    ...moves.map(({ family, deck, delta }) => `| **${name(family)}** | ${deck?.tier ?? '—'} | ${pct(family.share)} | ${paint(points(delta), delta >= 0 ? WIN : LOSS)} | ${deck ? pct(deck.wrExpected) : '—'} |`),
  ].join('\n')

/** The API's flagged shifts: this week's expected rate against last week's, past noise. */
const eventRows = (ladder: Ladder) => {
  const weeks = ladder.meta.weeks
  const before = (w: Week) => weeks.find((x) => x.key === w.key && x.week === w.week - 1)
  const byKey = new Map(ladder.decks.map((d) => [d.key, d]))
  return weekJumps(weeks).flatMap((w) => {
    const deck = byKey.get(w.key)
    const from = before(w)
    return deck && from ? [`| ${ladder.label} | **${name(deck)}** | ${paint(w.jump > 0 ? 'Stronger' : 'Weaker', w.jump > 0 ? WIN : LOSS)} | ${pct(from.wrExpected)} | ${pct(w.wrExpected)} | ${num(w.games)} |`] : []
  })
}

const sameRules = (a: TierRules | undefined, b: TierRules) => !!a && (['t1Gap', 't2Gap', 't3Gap', 'minShare', 'minPlayers'] as const).every((key) => a[key] === b[key])

/**
 * `null` without a comparable issue: no snapshot yet, the season changed under it, or it was cut on other tier rules
 * (including every snapshot from before the tiers became relative to the leader).
 */
const tierChanges = (ladder: Ladder, previous: Snapshot | null) => {
  const before = previous?.rebuilt ? previous.ladders[ladder.label] : null
  if (!before || before.season !== ladder.meta.season.code || before.band !== BAND || before.floor !== ladder.meta.fit.aggregateFloor || !sameRules(before.rules, ladder.rules)) return null
  const now = new Map(ladder.decks.map((deck) => [deck.key, deck]))
  const label = (tier?: number | null) => (tier ? `Tier ${tier}` : 'Unranked')
  const keys = new Set([...Object.keys(before.decks), ...tiered(ladder).map((deck) => deck.key)])
  return [...keys].flatMap((id) => {
    const was = before.decks[id]
    const is = now.get(id)
    if ((was?.tier ?? null) === (is?.tier ?? null)) return []
    const shown = was?.name ?? (is ? name(is) : id)
    // Tier 1 is the top: a lower number is a climb, and leaving the tiers is the bottom.
    const rank = (tier?: number | null) => tier || 5
    // The rate shows whether the deck moved or the leader did: tiers count from the leader.
    const rate = was?.wrExpected !== undefined && is ? `${pct(was.wrExpected)} → ${pct(is.wrExpected)}` : is ? pct(is.wrExpected) : '—'
    return [`| ${ladder.label} | **${shown}** | ${label(was?.tier)} | ${paint(label(is?.tier), rank(is?.tier) < rank(was?.tier) ? WIN : LOSS)} | ${rate} |`]
  })
}

/** The leader both issues, when the snapshot has it: a new leader or a moved one shifts every boundary. */
const leaderShift = (ladder: Ladder, previous: Snapshot | null) => {
  const before = previous?.ladders[ladder.label]
  const was = before && Object.entries(before.decks).sort(([, a], [, b]) => (b.wrExpected ?? 0) - (a.wrExpected ?? 0))[0]
  const is = ladder.decks[0]
  if (!was || was[1].wrExpected === undefined || !is) return ''
  const [key, deck] = was
  const old = ladder.decks.find((d) => d.key === key)
  const now = () => (old ? ` and sits at ${pct(old.wrExpected)} in Tier ${old.tier}` : ' and fell under the floors')
  return key === is.key
    ? `${ladder.label}: ${name(is)} still leads, ${pct(deck.wrExpected)} then and ${pct(is.wrExpected)} now.`
    : `${ladder.label}: ${name(is)} leads now at ${pct(is.wrExpected)}. ${deck.name} led the last issue at ${pct(deck.wrExpected)}${now()}.`
}

/** The fastest riser with what a reader needs to try it. This is what makes each report more than a table. */
const spotlight = (ladder: Ladder): WikiBlock[] => {
  const riser = risers(ladder)[0]
  if (!riser) return []
  const { family, deck, delta } = riser
  const id = `spotlight-${ladder.prefix}`
  const opening = `${name(family)} gained ${Math.abs(delta * 100).toFixed(1)} points of meta share last week, the most on the ladder, for ${pct(family.share)} of the season so far.`
  // A family with no listed build has nothing more to say: the stats, matchups and sample deck all belong to one build.
  if (!deck) return [heading(`h-${id}`, 3, `${ladder.label}: ${name(family)}`, id), text(id, opening)]
  const { best, worst } = bestAndWorst(ladder, deck)
  const answer = ladder.answers.get(deck.key)
  const faced = (answer?.against ?? []).slice(0, 3).map(cardLink)
  const lines = [
    `${opening} ${name(deck) === name(family) ? 'Its core build has' : `Its most played build, ${name(deck)}, has`} an expected win rate of ${pct(deck.wrExpected)} (95% interval ${interval(deck)}); in game 1 it wins ${pct(deck.firstG1Wr)} going first and ${pct(deck.secondG1Wr)} going second.`,
    best ? `- **Best matchup:** ${best}` : '',
    worst ? `- **Worst matchup:** ${worst}` : '',
    faced.length ? `- **Most used against it:** ${and(faced)}` : '',
  ]
  const cards = (answer?.sampleDeck?.main ?? []).slice(0, 4).map((card) => ({ id: card.id, name: cardName(card), note: `×${card.count} in the sample deck` }))
  return [
    heading(`h-${id}`, 3, `${ladder.label}: ${name(family)}`, id),
    text(id, lines.filter(Boolean).join('\n')),
    ...(cards.length ? [{ id: `cards-${id}`, type: 'cards', cards, caption: `From the sample deck of ${name(deck)}` } as const] : []),
  ]
}

/** The three biggest share gains on each ladder, in points. */
const risingAnswer = (...ladders: Ladder[]) =>
  ladders
    .map((ladder) => {
      const top = risers(ladder).slice(0, 3)
      return top.length ? `In ${ladder.label}, ${and(top.map(({ family, delta }) => `${name(family)} (${points(delta)})`))}, in points of meta share.` : `No ${ladder.label} deck gained share.`
    })
    .join(' ')

const buildReport = (tcg: Ladder, genesys: Ladder, issue: string, previous: Snapshot | null): WikiDoc => {
  const issueDay = day(issue)
  const lead = (ladder: Ladder) => risers(ladder)[0]?.family
  const rising = (ladder: Ladder) => {
    const family = lead(ladder)
    return family ? `${name(family)} rose fastest in ${ladder.label}` : `no ${ladder.label} deck gained share`
  }
  const events = [...eventRows(tcg), ...eventRows(genesys)]
  const changes = [tierChanges(tcg, previous), tierChanges(genesys, previous)]
  const compared = changes.some((rows) => rows !== null)
  const changed = changes.flatMap((rows) => rows ?? [])
  const shifts = [tcg, genesys]
    .filter((_, i) => changes[i] !== null)
    .map((ladder) => leaderShift(ladder, previous))
    .filter(Boolean)
    .join(' ')
  const tcgImages = reportImages(tcg, issue)
  const genesysImages = reportImages(genesys, issue)
  const dataDay = day(tcg.meta.season.sweptThrough ?? issue)
  const tierLinks = `the [TCG tier list](/wiki/${tierListSlug(tcg)}) and the [Genesys tier list](/wiki/${tierListSlug(genesys)})`
  const ladderMoves = (ladder: Ladder): WikiBlock[] => [
    heading(`h-moves-${ladder.prefix}`, 3, `${ladder.label} movers`, `${ladder.prefix}-movers`),
    text(
      `moves-${ladder.prefix}`,
      ['Last week against the week before.', risers(ladder).length ? `**Rising**\n\n${movementTable(risers(ladder).slice(0, 5))}` : '', fallers(ladder).length ? `**Falling**\n\n${movementTable(fallers(ladder).slice(0, 5))}` : '']
        .filter(Boolean)
        .join('\n\n'),
    ),
  ]

  const blocks: WikiBlock[] = [
    text('intro', `This Yu-Gi-Oh! meta report covers what moved on the YGO Omega ranked ladders, from games through ${dataDay}. ${capitalized(rising(tcg))}, and ${rising(genesys)}. At the top, ${headline(tcg)} in TCG and ${headline(genesys)} in Genesys.`),
    figure('report-board-tcg', tcgImages, `TCG movers for ${issueDay}`),
    figure('report-board-genesys', genesysImages, `Genesys movers for ${issueDay}`),
    text('intro-more', `For where every deck stands, see ${tierLinks}. This report covers the changes.`),
    heading('h-moves', 2, 'Yu-Gi-Oh! meta report: which decks moved?', 'which-decks-moved'),
    text('moves', 'Change compares meta share in the last week of games with the week before it, in percentage points. Season share, tier and expected win rate cover the whole season, so a deck can climb fast from a small base.'),
    ...ladderMoves(tcg),
    ...ladderMoves(genesys),
    ...(compared
      ? [
          heading('h-tiers', 2, `Tier changes since ${day(previous?.issue ?? issue)}`, 'tier-changes'),
          text(
            'tiers',
            [
              "Tiers count down from each ladder's leader, so a deck changes tier when its own expected win rate moves or when the leader's does.",
              shifts,
              changed.length ? ['| Ladder | Deck | Last issue | Now | Expected win rate |', '|---|---|---|---|---:|', ...changed].join('\n') : 'No deck changed tier since the last issue.',
            ]
              .filter(Boolean)
              .join('\n\n'),
          ),
        ]
      : []),
    heading('h-events', 2, 'Biggest shifts in the numbers', 'biggest-shifts'),
    text(
      'events',
      `We list a shift when a deck's strength moves more than 3.5 standard errors from one week to the next. Chance alone gets there about once across every deck and week.\n\n${events.length ? ['| Ladder | Deck | Shift | From | To | Games |', '|---|---|---|---:|---:|---:|', ...events].join('\n') : 'No deck crossed that bar this week.'}`,
    ),
    ...(lead(tcg) || lead(genesys) ? [heading('h-spotlight', 2, 'Decks to watch', 'decks-to-watch'), ...spotlight(tcg), ...spotlight(genesys)] : []),
    {
      id: 'limits',
      type: 'callout',
      tone: 'cyan',
      title: 'Where these numbers come from',
      md: `Ranked games on YGO Omega, not tournament results. Each ladder runs its own season, so TCG and Genesys cover different dates. [How the tiers work](/wiki/${tierListSlug(tcg)}#methodology).`,
    },
    heading('h-faq', 2, 'Yu-Gi-Oh! meta report FAQ', 'faq'),
    {
      id: 'faq',
      type: 'faq',
      items: [
        { q: 'What changed in the Yu-Gi-Oh! meta this week?', md: `${capitalized(rising(tcg))}, and ${rising(genesys)}. The tables above list every top mover.` },
        {
          q: 'What is the best Yu-Gi-Oh! deck this week?',
          md: `In TCG, ${name(tcg.decks[0]!)} leads with an expected ${pct(tcg.decks[0]!.wrExpected)} win rate. In Genesys, ${name(genesys.decks[0]!)} leads with ${pct(genesys.decks[0]!.wrExpected)}. ${tierLinks.replace(/^the/, 'The')} rank the rest.`,
        },
        { q: 'Which Yu-Gi-Oh! decks are rising right now?', md: risingAnswer(tcg, genesys) },
        { q: 'What is the difference between this report and the tier lists?', md: `${capitalized(tierLinks)} rank every deck and change in place each week. This report keeps a dated record of what moved that week.` },
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
        { label: 'Data through', value: dataDay },
        { label: 'TCG riser', value: lead(tcg) ? name(lead(tcg) as DeckStat) : 'None' },
        { label: 'Genesys riser', value: lead(genesys) ? name(lead(genesys) as DeckStat) : 'None' },
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
      description: `Yu-Gi-Oh! meta report for ${issueDay}: the decks rising and falling on the TCG and Genesys ladders, with expected win rates and decks to watch.`,
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
    season: ladder.meta.season.code,
    band: BAND,
    floor: ladder.meta.fit.aggregateFloor,
    rules: ladder.rules,
    decks: Object.fromEntries(tiered(ladder).map((deck) => [deck.key, { name: name(deck), tier: deck.tier ?? 0, share: deck.share, wrExpected: deck.wrExpected }])),
  })
  const [tcg, genesys] = ladders as [Ladder, Ladder]
  return { issue, rebuilt: true, ladders: { TCG: of(tcg), Genesys: of(genesys) } }
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

/** One at a time, waiting out the API's 60 requests a minute. */
const read = async <T>(path: string): Promise<T> => {
  for (;;) {
    const res = await fetch(`${API}${path}`)
    if (res.status === 429) {
      await new Promise((done) => setTimeout(done, Number(res.headers.get('retry-after') ?? 30) * 1000))
      continue
    }
    if (!res.ok) throw new Error(`GET ${path} failed with ${res.status}`)
    return (await res.json()) as T
  }
}

const load = async (label: Ladder['label'], prefix: Ladder['prefix']): Promise<Ladder> => {
  const meta = await read<Meta>(`/statistics/meta?ladder=${prefix}&band=${BAND}`)
  const rules = rulesOf(meta, label)
  const decks = listed(meta)
  const ladder: Ladder = { label, prefix, meta, rules, decks, families: families(meta.decks), answers: new Map() }
  const wanted = [...new Set([...tiered(ladder), ...risers(ladder).slice(0, 5).flatMap((m) => (m.deck ? [m.deck] : []))])]
  for (const deck of wanted) ladder.answers.set(deck.key, await read<DeckAnswer>(`/statistics/decks/${encodeURIComponent(deck.key)}?ladder=${prefix}&band=${BAND}`))
  return ladder
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

  const tcg = await load('TCG', 'tcg')
  const genesys = await load('Genesys', 'genesys')
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
