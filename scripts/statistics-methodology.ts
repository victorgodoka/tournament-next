import type { WikiDoc } from '@utils/wiki-doc'
import { gapPoints, plural, ratePct, type Ladder } from './tier-list'

export const METHODOLOGY_SLUG = 'ygo-omega-statistics-methodology'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const day = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number]
  return `${MONTHS[m - 1]} ${d}, ${y}`
}
const num = (n: number) => n.toLocaleString('en-US')

type Source = Pick<Ladder, 'label' | 'meta' | 'rules'>

/**
 * The method in words, the settings in numbers: every value comes from the builds the weekly run fetched (`fit.filters`,
 * `fit.tiers`, `classification`), so the article can't drift from the panel. Refuses a build without its filters.
 */
export const statisticsMethodology = (issue: string, ladders: readonly Source[]): WikiDoc => {
  const [tcg, genesys] = ladders as [Source, Source]
  const filtersOf = (ladder: Source) => {
    const filters = ladder.meta.fit.filters
    if (!filters) throw new Error(`The ${ladder.label} build has no filters: rebuild the statistics on the current server.`)
    return filters
  }
  const [ft, fg] = [filtersOf(tcg), filtersOf(genesys)]
  const classification = tcg.meta.classification ?? genesys.meta.classification
  const builtAt = [tcg.meta.fit.builtAt, genesys.meta.fit.builtAt].sort().at(-1)!.slice(0, 10)
  const built = day(builtAt)
  // A rerun of an issue on newer builds is updated on the build's day, not the issue's.
  const updated = day(builtAt > issue ? builtAt : issue)
  const off = (n: number) => (n > 0 ? num(n) : 'Off (0)')
  const row = (label: string, a: string, b: string) => `| ${label} | ${a} | ${b} |`
  const settings = [
    '| Setting | TCG | Genesys |',
    '|---|---:|---:|',
    row('Rating band ranked', `${ft.aggregateFloor}+`, `${fg.aggregateFloor}+`),
    row('Rating cap per player', num(ft.eloCap), num(fg.eloCap)),
    row('Ranked games a player needs', off(ft.minPlayerGames), off(fg.minPlayerGames)),
    row('Games a decklist needs', off(ft.minListGames), off(fg.minListGames)),
    row('Deck-games for a row', num(ft.minKeyGames), num(fg.minKeyGames)),
    row('Meta share for a tier', ratePct(tcg.rules.minShare), ratePct(genesys.rules.minShare)),
    row('Different players for a tier', tcg.rules.minPlayers > 1 ? num(tcg.rules.minPlayers) : 'None', genesys.rules.minPlayers > 1 ? num(genesys.rules.minPlayers) : 'None'),
    row('Tier 1 gap for the second deck', `${gapPoints(tcg.rules.t1Gap)} pts`, `${gapPoints(genesys.rules.t1Gap)} pts`),
    row('Tier 2 reaches', `${gapPoints(tcg.rules.t2Gap)} pts`, `${gapPoints(genesys.rules.t2Gap)} pts`),
    row('Tier 3 reaches', `${gapPoints(tcg.rules.t3Gap)} pts`, `${gapPoints(genesys.rules.t3Gap)} pts`),
  ].join('\n')
  const naming = classification
    ? `Both formats name decks the same way. A deck takes up to 3 archetype names, lead archetype first; a second or third name needs that set of archetypes in at least ${ratePct(classification.versionShare)} of a season's decklists, otherwise its lists count for the shorter name. A card counts as a staple when it appears in at least ${ratePct(classification.stapleShare)} of decklists and ${ratePct(classification.stapleForeign)} or more of the lists running it hold no other card of its archetype. Staples never name a deck.`
    : ''
  // One number when both formats share it, both when they differ.
  const gap = (key: 't1Gap' | 't2Gap' | 't3Gap') =>
    tcg.rules[key] === genesys.rules[key] ? gapPoints(tcg.rules[key]) : `${gapPoints(tcg.rules[key])} in TCG, ${gapPoints(genesys.rules[key])} in Genesys`
  const lists =
    ft.minListGames === 0 && fg.minListGames === 0
      ? 'Both formats set it to 0 right now, so it removes nothing.'
      : `TCG asks for ${off(ft.minListGames)}, Genesys for ${off(fg.minListGames)}.`
  const floors = (ladder: Source) =>
    ladder.rules.minPlayers > 1 ? `${ratePct(ladder.rules.minShare)} of the meta and ${plural(ladder.rules.minPlayers, 'different player')}` : `${ratePct(ladder.rules.minShare)} of the meta and no player minimum`

  return {
    v: 1,
    title: 'YGO Omega Statistics: How We Calculate Deck Strength',
    summary: 'We rank YGO Omega decks by expected win rate. See how we adjust for opponents, player ratings and turn order, the current settings for TCG and Genesys, and why we replaced the old ranking score.',
    tags: ['statistics', 'methodology', 'deck-rankings', 'ygo-omega'],
    cover: { asset: 'cover' },
    assets: {
      cover: { id: 'cover', src: '/wiki-images/article-cover.png', width: 1920, height: 420, alt: 'YGO Omega article banner', credit: 'Duelists Unite' },
      preview: { id: 'preview', src: '/wiki-images/article-seo-preview.png', width: 1200, height: 630, alt: 'YGO Omega statistics methodology article', credit: 'Duelists Unite' },
    },
    infobox: {
      facts: [
        { label: 'Source', value: 'YGO Omega ranked games' },
        { label: 'Ranking measure', value: 'Expected win rate against the field' },
        { label: 'Tier reference', value: 'The leading eligible deck' },
        { label: 'Settings from', value: `Builds of ${built}` },
        { label: 'Updated', value: updated },
      ],
    },
    blocks: [
      {
        id: 'intro',
        type: 'text',
        md: `Two decks can each win 55% of their games against different opponents and rating gaps. Our YGO Omega statistics estimate each deck’s strength from the games behind that percentage, then calculate its expected win rate against the field with equal player ratings and no first-turn edge. That estimate ranks the decks and sets their tiers. The [settings table](#current-settings) lists every value behind the current TCG and Genesys builds.`,
      },
      { id: 'h-before', type: 'heading', level: 2, text: 'The old score rewarded larger samples', anchor: 'old-calculation' },
      {
        id: 'before',
        type: 'text',
        md: 'We used to count wins, losses and draws, rank decks by the lower bound of a Wilson confidence interval, and assign tiers by distance from the leader’s score.\n\nThat lower bound rises as the sample grows. Two decks with the same observed win rate could land in different tiers because one had more games, so a small deck paid a ranking penalty even when its results matched a popular deck.\n\nThe old score also ignored who each deck faced, the rating gap and who went first. Our November 1 review found one more problem: daily results varied more than a calculation built on independent games assumes. Repeat pilots, games within one match and changes over a season make narrow intervals hard to defend.',
      },
      { id: 'h-comparison', type: 'heading', level: 2, text: 'The changes at a glance', anchor: 'before-and-now' },
      {
        id: 'comparison',
        type: 'text',
        md: '| Measure | Previous calculation | Current calculation |\n|---|---|---|\n| Deck ranking | Wilson lower confidence bound | Expected win rate from fitted deck strength |\n| Opponents, rating and turn order | No joint adjustment in the ranking score | Both deck strengths, the rating gap and who went first |\n| Small samples | A lower confidence bound cut the ranking score | Estimates shrink toward the ladder mean and show their uncertainty |\n| Tiers | Distance from the leader’s Wilson score | Distance from the leader’s expected win rate |\n| Matchup signals | Interval above or below 50% | Adjusted results against the model’s matchup expectation |\n| Weekly strength shifts | Sliding comparisons prone to repeat false signals | Fixed season-week blocks and a 3.5 combined-standard-error threshold |\n| Stored data | Daily aggregated counts | Individual games and registered decklists |',
      },
      { id: 'h-model', type: 'heading', level: 2, text: 'We estimate strength from individual games', anchor: 'current-calculation' },
      {
        id: 'model',
        type: 'text',
        md: 'For each decisive game, we fit the chance that one side wins from the gap between the two deck strengths, who went first and the players’ rating gap. We use each player’s rating from the day before the game, so a player’s current rank never rewrites older games.\n\nRegularization pulls estimates with little evidence toward the ladder mean, which limits what a short winning streak can do. A deck with 200 games still carries less evidence than one with 20,000, and its interval shows it.\n\nExpected win rate is a deck’s predicted result against the other decks in the field, weighted by meta share, with the rating gap and the first-turn term set to zero. A 55% describes what the model expects under those conditions. It makes no promise about your next 100 games.',
      },
      { id: 'h-settings', type: 'heading', level: 2, text: 'Current settings for TCG and Genesys', anchor: 'current-settings' },
      {
        id: 'settings',
        type: 'text',
        md: [
          `Staff set these values per format in the statistics panel. The API returns the values each build ran with, and we regenerate this table with the weekly tier lists. These are the builds of ${built}.`,
          settings,
          naming,
        ].filter(Boolean).join('\n\n'),
      },
      { id: 'h-sample', type: 'heading', level: 2, text: 'Which games count', anchor: 'sample-and-filters' },
      {
        id: 'sample',
        type: 'text',
        md: `Each format builds from its own ranked season. One game is one observation, so a best-of-three match adds up to three. Each side of a match stores one registered decklist. Casual and tournament games stay out.\n\nBefore fitting, we apply four filters. A game that fails one on either side leaves the sample:\n\n- **Player activity.** Both players need ${plural(ft.minPlayerGames, 'ranked game')} in the TCG season, or ${plural(fg.minPlayerGames, 'game')} in Genesys.\n- **Decklist activity.** Both decklists need a minimum number of games. ${lists}\n- **Iron band.** We drop games where the pair averages under Bronze or either player has no rating.\n- **Rating band.** Each game takes the band of its two players’ previous-day ratings, each capped at ${ft.eloCap === fg.eloCap ? num(ft.eloCap) : `${num(ft.eloCap)} in TCG and ${num(fg.eloCap)} in Genesys`} first. The tier lists rank from the format’s floor up: ${ft.aggregateFloor}+ in TCG, ${fg.aggregateFloor}+ in Genesys. A ${ft.aggregateFloor}+ game means the pair averages ${ft.aggregateFloor} or higher, so one player can sit below ${ft.aggregateFloor}.\n\nAfter the filters, a deck needs ${plural(ft.minKeyGames, 'deck-game')} in TCG or ${num(fg.minKeyGames)} in Genesys to get its own estimate and a row. Smaller decks share one pooled estimate, help fit everyone else, and stay off the list.`,
      },
      { id: 'h-counts', type: 'heading', level: 2, text: 'Raw win rate and meta share still describe the games', anchor: 'raw-win-rate-and-share' },
      {
        id: 'counts',
        type: 'text',
        md: 'Raw win rate is wins divided by wins, losses and draws. Draws stay in the denominator as zero wins. Games without a result count toward games played and stay out of win rates. The strength fit skips draws.\n\nRaw deck win rates and matchup counts leave out mirror matches, since both sides play the same deck. Mirrors still count toward meta share and help estimate the rating and first-turn effects. Each game adds two deck-games to share, one per side.\n\nWe show a 95% interval next to expected win rate. When a deck’s daily results swing more than sampling noise explains, we widen its interval. That covers the extra variation without treating repeat games or pilots as independent.',
      },
      { id: 'h-tiers', type: 'heading', level: 2, text: 'We assign tiers relative to the leader', anchor: 'tier-rules' },
      {
        id: 'tiers',
        type: 'text',
        md: `The leader is the deck with the best expected win rate among those that clear the format’s floors. TCG asks for ${floors(tcg)}; Genesys asks for ${floors(genesys)}. The leader takes Tier 1. The next deck joins it if it sits within ${gap('t1Gap')} points. Tier 1 holds two decks at most; further decks inside that gap take Tier 1.5. Tier 2 reaches ${gap('t2Gap')} points under the leader, Tier 3 reaches ${gap('t3Gap')}, and Tier 4 takes the remaining eligible decks. A deck under the floors gets no tier and appears apart as untiered.\n\nPopularity decides eligibility and weights the field. It adds nothing to a deck’s strength. Because tiers count from the leader, a leader that moves can shift another deck’s tier while that deck’s own rate holds still.\n\nOur tier-list articles and boards show Tiers 1–3 and the five highest-ranked Tier 4 builds; the live statistics page lists every deck. Reports cover current Tiers 1–3 and can record a promotion from Tier 4.`,
      },
      { id: 'h-matchups', type: 'heading', level: 2, text: 'We compare matchups with their expected results', anchor: 'matchups-and-cards' },
      {
        id: 'matchups',
        type: 'text',
        md: 'For each pairing, we calculate an expected result from the deck strengths, rating gaps and turn order of its recorded games. We pull the observed matchup rate toward that expectation, harder when evidence is thin. We flag a deviation when its adjusted interval excludes the expected rate.\n\n“Above expectation” and “above 50%” mean different things. A deck can beat a hard matchup’s expectation and still lose more games than it wins. Read the adjusted rate, interval and sample size together.\n\nFor card analysis, we estimate associations within a deck after accounting for each game’s baseline expectation. An association can’t prove that adding a card caused more wins. Card choices can track pilot skill, other deck changes or the opponents a player expects.',
      },
      { id: 'h-reports', type: 'heading', level: 2, text: 'Reports use two comparison periods', anchor: 'report-comparisons' },
      {
        id: 'reports',
        type: 'text',
        md: 'Tier changes compare an issue with the last saved report snapshot that shares its season, band, aggregate floor, sample filters and tier rules. Snapshots keep Tier 4, so a report can catch a promotion. A snapshot records a generation run; the script can’t confirm publication.\n\nShare changes and flagged strength shifts use the latest two seven-day blocks, counted from the season’s first day. The current block can be incomplete, and the blocks can cover different dates from the gap between published reports. We flag strength shifts beyond 3.5 combined standard errors to limit false signals across repeat comparisons.',
      },
      { id: 'h-use', type: 'heading', level: 2, text: 'Use the estimate with its limits', anchor: 'using-the-statistics' },
      {
        id: 'use',
        type: 'text',
        md: 'We adjust for recorded rating gaps, opponents and turn order. Deck mastery, pilot selection and anything the game log doesn’t record stay in the numbers. Tournament fields can also differ from the ranked ladder.\n\nCheck the interval and game count before you pick a deck, and compare its matchups with the field you expect. The [ranked statistics page](/statistics) has the current samples; the [TCG tier list](/wiki/yu-gi-oh-tcg-tier-list) and [Genesys tier list](/wiki/yu-gi-oh-genesys-tier-list) rank each format.',
      },
      { id: 'h-faq', type: 'heading', level: 2, text: 'YGO Omega statistics FAQ', anchor: 'faq' },
      {
        id: 'faq',
        type: 'faq',
        items: [
          { q: 'Why did you change the statistics calculation?', md: 'The Wilson lower bound gave larger samples a ranking edge, and the old score didn’t adjust for opponent decks, rating gaps or turn order. We now fit deck strength from individual games and rank decks by expected win rate against the field.' },
          { q: 'Is expected win rate the same as raw win rate?', md: 'No. Raw win rate is recorded wins divided by wins, losses and draws. Expected win rate estimates a deck’s result against the selected field with equal ratings and the first-turn term set to zero.' },
          { q: 'What are the current tier cut-offs?', md: `Tier 1 is the leader plus one deck within ${gap('t1Gap')} points; further decks within that gap take Tier 1.5. Tier 2 reaches ${gap('t2Gap')} points under the leader and Tier 3 reaches ${gap('t3Gap')}. To get a tier, a TCG deck needs ${floors(tcg)}; a Genesys deck needs ${floors(genesys)}.` },
          { q: 'Why is my deck missing from the tier list?', md: `A deck needs ${num(ft.minKeyGames)} deck-games in TCG or ${num(fg.minKeyGames)} in Genesys for its own row, and the tier floors above for a tier. The tier lists also show only the five highest Tier 4 builds; the [statistics page](/statistics) lists the rest.` },
          { q: 'Does the model remove player skill from deck performance?', md: 'It adjusts for the recorded rating gap. Deck mastery, specialist pilots and other unrecorded differences can still shape a deck’s estimated strength.' },
        ],
      },
    ],
    seo: {
      title: 'YGO Omega Statistics: Deck Strength and Tiers',
      description: 'How YGO Omega statistics work: expected win rate, tier cut-offs, sample filters and matchup adjustments, with the current TCG and Genesys settings.',
      keyword: 'YGO Omega statistics',
      keywords: ['expected win rate', 'deck strength', 'Yu-Gi-Oh tier methodology'],
      image: 'preview',
      schema: 'Article',
    },
    hub: 'ygo-omega-wiki',
    related: ['yu-gi-oh-tcg-tier-list', 'yu-gi-oh-genesys-tier-list', 'yu-gi-oh-formats'],
  }
}
