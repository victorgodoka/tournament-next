/**
 * GET /statistics/infographic/:section?ladder=&season=&window=&band=&key=&size=wide|tall&locale= — one piece of the
 * statistics as a shareable PNG. `key` picks the deck of `deck`; without it, the most played.
 */

import { notFound } from 'next/navigation'
import { deckFaces, effectPoints, families, familyWeeks, getDeck, getMeta, plainDecks, scopeFrom, shareMoves, windowDays, type DeckAnswer, type DeckStat, type Meta, type Matchup, type Scope } from '@utils/statistics'
import { oneAtATime } from '@utils/one-at-a-time'
import { Art, busy, C, Chip, col, Empty, F, Kpi, Label, loadImages, mono, num, Panel, pct, render, row, sizeOf, translator, type Size } from '@omega/infographic/infographic'

const SECTIONS = ['tier-list', 'meta-report', 'deck'] as const
type Section = (typeof SECTIONS)[number]

type T = (key: string, values?: Record<string, string | number>) => string
type Ctx = { data: Meta; scope: Scope; size: Size; t: T; locale: string; key: string | null }

const nameOf = (a: { name: string | null }, t: T) => a.name ?? t('unknownDeck')
const wrColor = (wr: number | null | undefined) => (wr == null ? C.muted : wr >= 0.5 ? C.win : C.loss)
const range = (lo: number, hi: number) => `${(lo * 100).toFixed(1)}–${(hi * 100).toFixed(1)}`

/** The API's answers for `decks`, for their faces and matchups: any it refuses are left out. */
const answers = async (decks: DeckStat[], scope: Scope) => (await Promise.all(decks.map((d) => getDeck(d.key, scope)))).flatMap((r) => (r.ok ? [r.data] : []))

/** Each deck's face. A deck the API refuses keeps its panel cover: only the fallbacks need its answer. */
const facesOf = async (decks: DeckStat[], scope: Scope) => {
  const found = new Map((await answers(decks, scope)).map((a) => [a.deck.key, a]))
  return deckFaces(decks.map((deck) => ({ deck, cards: found.get(deck.key)?.cards ?? [], sampleDeck: found.get(deck.key)?.sampleDeck ?? null })))
}

const TIERS = [1, 1.5, 2, 3, 4] as const
type PowerTier = (typeof TIERS)[number]
const ROW_WIDTH = { wide: 1634, tall: 810 }
/** Art side by tier, and how many lines of tiles a tier may take. */
const TILE = { wide: { 1: 130, 1.5: 130, 2: 114, 3: 100, 4: 90 }, tall: { 1: 176, 1.5: 146, 2: 146, 3: 146, 4: 146 } } as const
const LINES = { wide: 1, tall: 2 } as const
const TILE_GAP = 10
/** Wide only: Tier 1 sits beside Tier 1.5 on one line, which is what keeps five tiers from shrinking the art. */
const TIER_1_WIDTH = 128 + 14 + 2 * 130 + TILE_GAP
const TIER_ROW_GAP = 20
const rowWidth = (size: Size, tier: PowerTier) => (size === 'wide' && tier === 1.5 ? ROW_WIDTH.wide - TIER_1_WIDTH - TIER_ROW_GAP - 128 - 14 : ROW_WIDTH[size])

/** A deck on the board: its art, name and expected win rate. */
const Tile = ({ a, src, side, t }: { a: DeckStat; src?: string; side: number; t: T }) => (
  <div style={{ ...col, width: side, gap: 5, flexShrink: 0 }}>
    <Art src={src} size={side} />
    {/* `block`, not flex: Satori only draws the ellipsis on a block. */}
    <div style={{ display: 'block', fontSize: 14, lineHeight: 1.1, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nameOf(a, t)}</div>
    <div style={{ display: 'flex', ...mono, fontSize: 13, lineHeight: 1, letterSpacing: 1, color: wrColor(a.wrExpected) }}>{pct(a.wrExpected)}</div>
  </div>
)

const tierList = async ({ data, scope, size, t }: Ctx) => {
  const ranked = plainDecks(data.decks).sort((a, b) => b.wrExpected - a.wrExpected)
  const rows = TIERS.flatMap((tier) => {
    const decks = ranked.filter((a) => a.tier === tier)
    if (!decks.length) return []
    const side = TILE[size][tier]
    const slots = Math.floor((rowWidth(size, tier) + TILE_GAP) / (side + TILE_GAP)) * LINES[size]
    const fits = decks.length <= slots
    return [{ tier, decks, side, shown: fits ? decks : decks.slice(0, slots - 1), share: decks.reduce((sum, a) => sum + a.share, 0) }]
  })
  if (!rows.length) return <Empty>{t('empty')}</Empty>
  const faces = await facesOf(rows.flatMap((r) => r.shown), scope)
  const arts = await loadImages([...faces.values()])
  const tierRow = ({ tier, decks, side, shown, share }: (typeof rows)[number], fit: React.CSSProperties = {}) => (
    <div key={tier} style={{ ...row, alignItems: 'stretch', flexShrink: 0, gap: 14, ...fit }}>
      <div style={{ ...col, width: 128, flexShrink: 0, justifyContent: 'center', gap: 4, padding: '0 14px', background: C.surface, borderLeft: `6px solid ${C.tier[tier]}` }}>
        <div style={{ display: 'flex', fontFamily: F.display, fontSize: tier === 1.5 ? 50 : 58, lineHeight: 1, color: C.tier[tier] }}>{`T${tier}`}</div>
        <Label size={13}>{pct(share)}</Label>
      </div>
      <div style={{ ...row, alignItems: 'flex-start', flexWrap: 'wrap', flex: 1, gap: TILE_GAP }}>
        {shown.map((a) => <Tile key={a.key} a={a} src={arts.get(faces.get(a.key) ?? -1)} side={side} t={t} />)}
        {shown.length < decks.length ? (
          <div style={{ ...col, width: side, height: side, alignItems: 'center', justifyContent: 'center', gap: 4, flexShrink: 0, background: C.surface, border: `2px solid ${C.line}` }}>
            <div style={{ display: 'flex', fontFamily: F.display, fontSize: 38, lineHeight: 1 }}>{`+${decks.length - shown.length}`}</div>
            <Label size={12}>{t('more')}</Label>
          </div>
        ) : null}
      </div>
    </div>
  )
  const first = rows.find((r) => r.tier === 1)
  const half = rows.find((r) => r.tier === 1.5)
  const paired = size === 'wide' && first && half
  return (
    <div style={{ ...col, flex: 1, justifyContent: 'space-between', gap: 8 }}>
      {paired ? (
        <div style={{ ...row, alignItems: 'stretch', gap: TIER_ROW_GAP }}>
          {tierRow(first, { width: TIER_1_WIDTH })}
          {tierRow(half, { flex: 1, minWidth: 0 })}
        </div>
      ) : null}
      {rows.filter((r) => !paired || r.tier > 1.5).map((r) => tierRow(r))}
      <Label size={14}>{t('tierListNote')}</Label>
    </div>
  )
}

const points = (delta: number) => `${delta >= 0 ? '+' : '−'}${Math.abs(delta * 100).toFixed(1)}`

/** `build` is the family's most played member: its tier and rate stand for the family, never the `A*` row's. */
type Mover = { a: DeckStat; build: DeckStat | null; delta: number }

const MoverRow = ({ m: { a, build, delta }, src, t }: { m: Mover; src?: string; t: T }) => (
  <div style={{ ...row, gap: 16 }}>
    <Art src={src} size={64} />
    <div style={{ ...col, flex: 1, gap: 4, minWidth: 0 }}>
      <div style={{ display: 'block', fontSize: 21, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nameOf(a, t)}</div>
      <div style={{ ...row, gap: 12 }}>
        {build?.tier ? <Label size={13} color={C.tier[build.tier]} weight={700}>{`T${build.tier}`}</Label> : null}
        {build ? <Label size={13}>{t('winRateShort', { rate: pct(build.wrExpected) })}</Label> : null}
      </div>
    </div>
    <div style={{ display: 'flex', fontFamily: F.display, fontSize: 38, lineHeight: 1, color: delta >= 0 ? C.win : C.loss }}>{points(delta)}</div>
  </div>
)

const metaReport = async ({ data, scope, size, t }: Ctx) => {
  const wide = size === 'wide'
  const fams = families(data.decks)
  const decks = new Map(fams.map(({ family }) => [family.key, family]))
  // A family row has no cards: its art is its most played member's.
  const lead = new Map(fams.map(({ family, members }) => [family.key, members[0] ?? family]))
  const moves = shareMoves(familyWeeks(data.weeks, fams))
  const mover = ({ key, delta }: { key: string; delta: number }): Mover => {
    const a = decks.get(key)!
    const member = lead.get(key)!
    return { a, build: member === a ? null : member, delta }
  }
  const rising = moves.risers.map(mover)
  const falling = moves.fallers.map(mover)
  const hero = rising[0]
  const faces = await facesOf([...rising, ...falling].map((m) => lead.get(m.a.key)!), scope)
  const arts = await loadImages([...faces.values()])
  const art = (a: DeckStat) => arts.get(faces.get(lead.get(a.key)!.key) ?? -1)
  const list = (n: string, title: string, movers: Mover[]) => (
    <Panel n={n} title={title} style={{ flex: 1, flexBasis: 0, minWidth: 0 }}>
      <div style={{ ...col, flex: 1, justifyContent: 'space-around', gap: 12 }}>
        {movers.length ? movers.map((m) => <MoverRow key={m.a.key} m={m} src={art(m.a)} t={t} />) : <Empty>{t('noMovers')}</Empty>}
      </div>
    </Panel>
  )
  return (
    <div style={{ ...col, flex: 1, gap: 16 }}>
      <div style={{ ...(wide ? row : col), flex: 1, alignItems: 'stretch', gap: 20 }}>
        {hero ? (
          <Panel n="01" title={t('fastestRiser')} style={wide ? { width: 460 } : undefined}>
            <div style={{ ...(wide ? col : row), alignItems: 'stretch', gap: 18 }}>
              <Art src={art(hero.a)} size={wide ? 280 : 260} edge={C.gold} />
              {/* A column inside a column must not take `flex: 1`: its basis of 0 collapses it over the art. */}
              <div style={{ ...col, ...(wide ? {} : { flex: 1 }), gap: 14 }}>
                <div style={{ display: 'flex', fontFamily: F.display, fontSize: 40, lineHeight: 1.1, textTransform: 'uppercase' }}>{nameOf(hero.a, t)}</div>
                <div style={{ ...row, alignItems: 'flex-start' }}>
                  <div style={{ ...col, width: '50%', gap: 6 }}>
                    <div style={{ display: 'flex', fontFamily: F.display, fontSize: 52, lineHeight: 1, color: C.win }}>{points(hero.delta)}</div>
                    <Label size={13}>{t('change')}</Label>
                  </div>
                  {hero.build ? (
                    <div style={{ ...col, width: '50%', gap: 6 }}>
                      <div style={{ display: 'flex', fontFamily: F.display, fontSize: 52, lineHeight: 1, color: wrColor(hero.build.wrExpected) }}>{pct(hero.build.wrExpected)}</div>
                      <Label size={13}>{t('winRate')}</Label>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </Panel>
        ) : null}
        {list('02', t('rising'), rising)}
        {list('03', t('falling'), falling)}
      </div>
      <Label size={14}>{t('moversNote')}</Label>
    </div>
  )
}

/** The expected rate's interval on a 40–70% scale, as on the page. */
const IntervalBar = ({ lo, hi, value, width }: { lo: number; hi: number; value: number; width: number }) => {
  const at = (rate: number) => (Math.min(1, Math.max(0, (rate - 0.4) / 0.3))) * width
  return (
    <div style={{ display: 'flex', position: 'relative', width, height: 28, background: C.surface }}>
      <div style={{ display: 'flex', position: 'absolute', left: at(0.5), top: 0, width: 2, height: 28, background: C.lineMid }} />
      <div style={{ display: 'flex', position: 'absolute', left: at(lo), top: 8, width: Math.max(4, at(hi) - at(lo)), height: 12, background: C.cyan }} />
      <div style={{ display: 'flex', position: 'absolute', left: at(value), top: 2, width: 4, height: 24, background: C.ink }} />
    </div>
  )
}

/** A deck's card: expected rate with its interval, and the matchups that are called. */
const deck = async ({ data, scope, size, t, locale, key }: Ctx) => {
  const wide = size === 'wide'
  const picked = key ?? [...plainDecks(data.decks)].sort((a, b) => b.share - a.share)[0]?.key
  if (picked == null) return <Empty>{t('empty')}</Empty>
  const result = await getDeck(picked, scope)
  if (!result.ok) return <Empty>{t('empty')}</Empty>
  const answer: DeckAnswer = result.data
  const a = answer.deck
  // best and worst by who wins the pairing (interval clear of 50%), not by the gap from the prediction
  const called = (best: boolean) => answer.matchups.filter((m) => (best ? m.wrLo > 0.5 : m.wrHi < 0.5)).sort((x, y) => (best ? y.wrAdjusted - x.wrAdjusted : x.wrAdjusted - y.wrAdjusted)).slice(0, 4)
  const face = deckFaces([answer]).get(a.key)
  const arts = await loadImages([face])
  const first = effectPoints(a.firstEffect)
  const MatchList = ({ n, title, list, color }: { n: string; title: string; list: Matchup[]; color: string }) => (
    <Panel n={n} title={title} style={{ flex: 1, gap: 12 }}>
      {list.length ? list.map((m) => (
        <div key={m.opponent} style={{ ...row, gap: 12 }}>
          <div style={{ display: 'flex', flex: 1, fontSize: 24, fontWeight: 700 }}>{m.opponentName ?? t('unknownDeck')}</div>
          <div style={{ display: 'flex', ...mono, fontSize: 13, color: C.muted }}>{num(m.games, locale)}</div>
          <div style={{ display: 'flex', width: 100, justifyContent: 'flex-end', fontFamily: F.display, fontSize: 30, color }}>{pct(m.wrAdjusted)}</div>
        </div>
      )) : <div style={{ display: 'flex', fontSize: 22, color: C.muted }}>{t('empty')}</div>}
    </Panel>
  )
  return (
    <div style={{ ...col, gap: 20, flex: 1 }}>
      <div style={{ ...row, gap: 28, flexShrink: 0 }}>
        <Art src={arts.get(face ?? -1)} size={wide ? 176 : 220} edge={C.cyan} />
        <div style={{ ...col, gap: 14, flex: 1, minWidth: 0 }}>
          <div style={{ ...row, gap: 18 }}>
            <div style={{ display: 'flex', fontFamily: F.display, fontSize: wide ? 80 : 64, lineHeight: 1, textTransform: 'uppercase' }}>{nameOf(a, t)}</div>
            {a.tier ? <Chip color={C.tier[a.tier]} edge={C.tier[a.tier]}>{`Tier ${a.tier}`}</Chip> : null}
          </div>
          <IntervalBar lo={a.wrLo} hi={a.wrHi} value={a.wrExpected} width={wide ? 700 : 640} />
          <div style={{ ...row, gap: 10, flexWrap: 'wrap' }}>
            <Chip>{t('playersCount', { count: num(a.players, locale) })}</Chip>
            <Chip>{t('gamesCount', { count: num(a.games, locale) })}</Chip>
          </div>
        </div>
      </div>
      <div style={{ ...row, gap: 16, flexShrink: 0, alignItems: 'stretch' }}>
        <Kpi label={t('winRate')} value={pct(a.wrExpected)} color={wrColor(a.wrExpected)} size={52} hint={range(a.wrLo, a.wrHi)} />
        <Kpi label={t('share')} value={pct(a.share)} color={C.cyan} size={52} />
        <Kpi label={t('first')} value={pct(a.firstG1Wr)} color={wrColor(a.firstG1Wr)} size={52} hint={`${first >= 0 ? '+' : '−'}${Math.abs(first).toFixed(1)}`} />
        <Kpi label={t('second')} value={pct(a.secondG1Wr)} color={wrColor(a.secondG1Wr)} size={52} />
      </div>
      <div style={{ ...(wide ? row : col), gap: 16, alignItems: 'stretch', flex: 1 }}>
        <MatchList n="01" title={t('best')} list={called(true)} color={C.win} />
        <MatchList n="02" title={t('worst')} list={called(false)} color={C.loss} />
      </div>
    </div>
  )
}

const BODY: Record<Section, (ctx: Ctx) => Promise<React.ReactNode>> = { 'tier-list': tierList, 'meta-report': metaReport, deck }

type Route = { params: Promise<{ section: string }> }

export const GET = (request: Request, route: Route) => oneAtATime(() => draw(request, route), busy)

const draw = async (request: Request, { params }: Route) => {
  const { section } = await params
  if (!(SECTIONS as readonly string[]).includes(section)) notFound()
  const q = new URL(request.url).searchParams
  const scope = scopeFrom(Object.fromEntries(q))
  const result = await getMeta(scope)
  if (!result.ok) return new Response(null, { status: result.status === 404 ? 404 : 502 })
  const { data } = result
  const size = sizeOf(q)
  const { t, locale } = await translator(q, 'Infographic')
  const swept = data.season.sweptThrough
  const day = swept ? new Date(`${swept}T00:00:00Z`).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : null
  const body = await BODY[section as Section]({ data, scope, size, t, locale, key: q.get('key') })
  return render({
    size,
    eyebrow: t('source'),
    aside: day ? t('asOf', { date: day }) : undefined,
    title: t(`sections.${section}`),
    subtitle: data.season.ladder === 'genesys' ? 'Genesys' : 'TCG',
    chips: [data.season.label, t('gamesCount', { count: num(data.fit.games, locale) }), t('playersCount', { count: num(data.fit.players, locale) })],
    footer: t('footer', { days: windowDays(data) }),
    body,
    // The statistics endpoint's own 5 minutes.
    cache: 'public, max-age=300, s-maxage=300',
  })
}
