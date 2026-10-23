/**
 * GET /statistics/infographic/:section?ladder=&season=&key=&size=wide|tall&locale= — one dashboard section
 * as a shareable PNG. `key` (an archetype "207-451") picks the deck for archetype-analysis, deep-dive and
 * sample-decks; without it, the most played.
 */

import { notFound } from 'next/navigation'
import { archKey, getStatistics, type Matchup, type StatArchetype, type Statistics } from '@utils/statistics'
import type { RankedLadderId } from '@utils/types'
import { Art, Bar, C, col, Empty, Kpi, Label, loadImages, num, Panel, pct, render, row, sizeOf, translator, type Size } from '@omega/infographic/infographic'

const SECTIONS = ['overview', 'trends', 'deck-ranking', 'matchup-matrix', 'archetype-analysis', 'cards', 'deep-dive', 'sample-decks'] as const
type Section = (typeof SECTIONS)[number]

type T = (key: string, values?: Record<string, string | number>) => string
type Ctx = { data: Statistics; size: Size; t: T; locale: string; key: string | null }

const nameOf = (a: { name: string | null }, t: T) => a.name ?? t('unknownDeck')
const byShare = (data: Statistics) => [...data.archetypes].sort((a, b) => b.metaShare - a.metaShare)
const pick = ({ data, key }: Ctx) => (key && data.archetypes.find((a) => archKey(a.archetype) === key)) || byShare(data)[0] || null
const wrColor = (wr: number | null) => (wr == null ? C.muted : wr >= 0.5 ? C.win : C.loss)

const DeckLine = ({ a, art, rank, t, size = 64 }: { a: StatArchetype; art?: string; rank: number; t: T; size?: number }) => (
  <div style={{ ...row, gap: 20 }}>
    <div style={{ display: 'flex', width: 44, fontSize: 30, color: C.muted }}>{rank}</div>
    <Art src={art} size={size} />
    <div style={{ ...col, flex: 1, gap: 8 }}>
      <div style={{ ...row, gap: 12, fontSize: 32, fontWeight: 700 }}>
        <div style={{ display: 'flex' }}>{nameOf(a, t)}</div>
        {a.tier ? <div style={{ display: 'flex', fontSize: 22, color: C.tier[a.tier] }}>T{a.tier}</div> : null}
      </div>
      <div style={{ ...row, gap: 14 }}>
        <Bar value={a.metaShare / 0.3} />
        <div style={{ display: 'flex', width: 110, fontSize: 26, color: C.cyan, justifyContent: 'flex-end' }}>{pct(a.metaShare)}</div>
      </div>
    </div>
    <div style={{ ...col, width: 150, alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, color: wrColor(a.winRate) }}>{pct(a.winRate)}</div>
      <div style={{ display: 'flex', fontSize: 20, color: C.muted }}>{t('winRate')}</div>
    </div>
  </div>
)

const overview = async (ctx: Ctx) => {
  const { data, size, t, locale } = ctx
  const top = byShare(data).slice(0, 5)
  const arts = await loadImages(top.map((a) => a.face?.id))
  const tiers = data.tierDistribution
  const tierRows = tiers
    ? ([['1', tiers.tier1], ['2', tiers.tier2], ['3', tiers.tier3], ['4', tiers.tier4], ['others', tiers.others]] as const)
    : []
  const turn = data.turnOrder.all
  const left = (
    <div style={{ ...col, gap: 28, ...(size === 'wide' ? { flex: 1 } : { flexShrink: 0 }) }}>
      <div style={{ ...row, gap: 20, flexWrap: 'wrap', flexShrink: 0 }}>
        {([['games', data.totals.games], ['players', data.totals.players], ['matches', data.totals.matches], ['archetypes', data.totals.archetypes]] as const).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', width: size === 'wide' ? '23%' : '48%' }}>
            <Kpi label={t(`kpi.${k}`)} value={num(v, locale)} size={size === 'wide' ? 46 : 72} />
          </div>
        ))}
      </div>
      {tierRows.length ? (
        <Panel title={t('tiers')}>
          <div style={{ display: 'flex', height: 36 }}>
            {tierRows.map(([k, v], i) => (
              <div key={k} style={{ display: 'flex', width: `${v.share * 100}%`, background: k === 'others' ? C.lineMid : C.tier[i + 1] }} />
            ))}
          </div>
          <div style={{ ...row, gap: 28, flexWrap: 'wrap' }}>
            {tierRows.map(([k, v], i) => (
              <div key={k} style={{ ...row, gap: 10, fontSize: 24 }}>
                <div style={{ display: 'flex', width: 16, height: 16, background: k === 'others' ? C.lineMid : C.tier[i + 1] }} />
                <div style={{ display: 'flex', color: C.dim }}>{k === 'others' ? t('others') : `T${k}`}</div>
                <div style={{ display: 'flex' }}>{pct(v.share, 0)}</div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
      <div style={{ ...row, gap: 20, flexShrink: 0 }}>
        <Kpi label={t('first')} value={pct(turn.first.winRate)} color={wrColor(turn.first.winRate)} size={60} />
        <Kpi label={t('second')} value={pct(turn.second.winRate)} color={wrColor(turn.second.winRate)} size={60} />
      </div>
    </div>
  )
  const right = (
    <Panel title={t('topDecks')} style={{ flex: 1, gap: 26 }}>
      {top.map((a, i) => <DeckLine key={archKey(a.archetype)} a={a} art={arts.get(a.face?.id ?? -1)} rank={i + 1} t={t} />)}
    </Panel>
  )
  return <div style={{ ...(size === 'wide' ? row : col), alignItems: 'stretch', gap: 32, flex: 1 }}>{left}{right}</div>
}

const trends = async ({ data, size, t }: Ctx) => {
  const lines = data.trends
    .map((tr) => ({ ...tr, last: tr.points.at(-1)?.[1] ?? 0 }))
    .sort((a, b) => b.last - a.last)
    .slice(0, 6)
  if (!lines.length) return <Empty>{t('empty')}</Empty>
  const w = size === 'wide' ? 1180 : 950
  const h = size === 'wide' ? 540 : 760
  const maxDay = Math.max(...lines.flatMap((l) => l.points.map((p) => p[0])), 2)
  const maxShare = Math.max(...lines.flatMap((l) => l.points.map((p) => p[1])), 0.05) * 1.1
  const x = (d: number) => ((d - 1) / (maxDay - 1)) * w
  const y = (s: number) => h - (s / maxShare) * h
  const growth = new Map(data.archetypes.map((a) => [archKey(a.archetype), a.growth]))
  const chart = (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1={0} x2={w} y1={h - f * h} y2={h - f * h} stroke={C.line} strokeWidth={2} />)}
      {lines.map((l, i) => (
        <polyline key={archKey(l.archetype)} points={l.points.map((p) => `${x(p[0])},${y(p[1])}`).join(' ')} fill="none" stroke={C.series[i]} strokeWidth={6} strokeLinejoin="round" />
      ))}
    </svg>
  )
  const legend = (
    <div style={{ ...col, gap: 22, flex: 1 }}>
      {lines.map((l, i) => {
        const g = growth.get(archKey(l.archetype))
        return (
          <div key={archKey(l.archetype)} style={{ ...row, gap: 16 }}>
            <div style={{ display: 'flex', width: 28, height: 28, background: C.series[i] }} />
            <div style={{ display: 'flex', flex: 1, fontSize: 30, fontWeight: 700 }}>{nameOf(l, t)}</div>
            <div style={{ display: 'flex', fontSize: 30, color: C.cyan }}>{pct(l.last)}</div>
            {g != null ? <div style={{ display: 'flex', width: 130, justifyContent: 'flex-end', fontSize: 24, color: g >= 0 ? C.win : C.loss }}>{`${g >= 0 ? '▲ +' : '▼ '}${(g * 100).toFixed(1)}`}</div> : null}
          </div>
        )
      })}
    </div>
  )
  return (
    <div style={{ ...(size === 'wide' ? row : col), gap: 48, flex: 1 }}>
      <div style={{ ...col, gap: 12 }}>
        <Label>{t('shareOverTime', { days: maxDay })}</Label>
        {chart}
      </div>
      {legend}
    </div>
  )
}

const deckRanking = async ({ data, size, t, locale }: Ctx) => {
  const top = byShare(data).slice(0, 10)
  const arts = await loadImages(top.map((a) => a.face?.id))
  const Row = ({ a, i }: { a: StatArchetype; i: number }) => (
    <div style={{ ...row, gap: 22, padding: '14px 0', borderBottom: `2px solid ${C.line}` }}>
      <div style={{ display: 'flex', width: 48, fontSize: 32, color: i < 3 ? C.gold : C.muted }}>{i + 1}</div>
      <Art src={arts.get(a.face?.id ?? -1)} size={size === 'wide' ? 56 : 84} />
      <div style={{ ...row, flex: 1, gap: 12 }}>
        <div style={{ display: 'flex', fontSize: 32, fontWeight: 700 }}>{nameOf(a, t)}</div>
        {a.tier ? <div style={{ display: 'flex', fontSize: 22, color: C.tier[a.tier] }}>T{a.tier}</div> : null}
      </div>
      <div style={{ display: 'flex', width: 130, justifyContent: 'flex-end', fontSize: 30, color: C.cyan }}>{pct(a.metaShare)}</div>
      <div style={{ display: 'flex', width: 130, justifyContent: 'flex-end', fontSize: 30, fontWeight: 700, color: wrColor(a.winRate) }}>{pct(a.winRate)}</div>
      {size === 'wide' ? <div style={{ display: 'flex', width: 150, justifyContent: 'flex-end', fontSize: 26, color: C.dim }}>{num(a.games, locale)}</div> : null}
    </div>
  )
  const head = (
    <div style={{ ...row, gap: 22, fontSize: 22, color: C.muted, textTransform: 'uppercase', letterSpacing: 2 }}>
      <div style={{ display: 'flex', flex: 1, paddingLeft: size === 'wide' ? 126 : 154 }}>{t('deck')}</div>
      <div style={{ display: 'flex', width: 130, justifyContent: 'flex-end' }}>{t('share')}</div>
      <div style={{ display: 'flex', width: 130, justifyContent: 'flex-end' }}>{t('winRate')}</div>
      {size === 'wide' ? <div style={{ display: 'flex', width: 150, justifyContent: 'flex-end' }}>{t('games')}</div> : null}
    </div>
  )
  if (size === 'tall') {
    return (
      <div style={{ ...col, gap: 4, flex: 1 }}>
        {head}
        {top.map((a, i) => <Row key={archKey(a.archetype)} a={a} i={i} />)}
      </div>
    )
  }
  return (
    <div style={{ ...row, alignItems: 'flex-start', gap: 56, flex: 1 }}>
      {[top.slice(0, 5), top.slice(5)].map((half, h) => (
        <div key={h} style={{ ...col, flex: 1, gap: 4 }}>
          {head}
          {half.map((a, i) => <Row key={archKey(a.archetype)} a={a} i={i + h * 5} />)}
        </div>
      ))}
    </div>
  )
}

const matchupMatrix = async ({ data, size, t }: Ctx) => {
  const decks = [...data.archetypes].sort((a, b) => b.games - a.games).slice(0, 8)
  if (decks.length < 2) return <Empty>{t('empty')}</Empty>
  const arts = await loadImages(decks.map((a) => a.face?.id))
  const cell = new Map(data.matchups.map((m) => [`${archKey(m.archetype)}|${archKey(m.opponent)}`, m]))
  const side = size === 'wide' ? 60 : 96
  const nameW = size === 'wide' ? 360 : 150
  const tint = (m?: Matchup) => {
    if (!m || m.winRate == null || m.games < data.minSamples) return C.surface
    const d = Math.min(1, Math.abs(m.winRate - 0.5) / 0.2)
    const [r, g, b] = m.winRate >= 0.5 ? [79, 220, 140] : [255, 133, 148]
    return `rgba(${r},${g},${b},${0.15 + d * 0.6})`
  }
  return (
    <div style={{ ...(size === 'wide' ? row : col), gap: 40, flex: 1, alignItems: 'flex-start' }}>
      <div style={{ ...col, gap: 4 }}>
        <div style={{ ...row, gap: 4 }}>
          <div style={{ display: 'flex', width: nameW }} />
          {decks.map((o) => <Art key={archKey(o.archetype)} src={arts.get(o.face?.id ?? -1)} size={side} />)}
        </div>
        {decks.map((a) => (
          <div key={archKey(a.archetype)} style={{ ...row, gap: 4 }}>
            <div style={{ ...row, width: nameW, gap: 12, overflow: 'hidden' }}>
              {size === 'wide' ? (
                <div style={{ display: 'flex', fontSize: 26, fontWeight: 700 }}>{nameOf(a, t)}</div>
              ) : (
                <Art src={arts.get(a.face?.id ?? -1)} size={side} />
              )}
            </div>
            {decks.map((o) => {
              const m = cell.get(`${archKey(a.archetype)}|${archKey(o.archetype)}`)
              const mirror = archKey(a.archetype) === archKey(o.archetype)
              return (
                <div key={archKey(o.archetype)} style={{ display: 'flex', width: side, height: side, alignItems: 'center', justifyContent: 'center', background: mirror ? C.surface2 : tint(m), fontSize: size === 'wide' ? 20 : 26, fontWeight: 700 }}>
                  {mirror || !m || m.games < data.minSamples ? '—' : pct(m.winRate, 0)}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div style={{ ...col, gap: 18, flex: 1 }}>
        <div style={{ display: 'flex', fontSize: 24, color: C.muted, lineHeight: 1.4 }}>{t('matrixHow', { min: data.minSamples })}</div>
        {/* Tall rows carry art only: the key to it. */}
        {size === 'tall' ? (
          <div style={{ ...row, flexWrap: 'wrap', gap: 14 }}>
            {decks.map((a) => (
              <div key={archKey(a.archetype)} style={{ ...row, gap: 14, width: 460, fontSize: 26 }}>
                <Art src={arts.get(a.face?.id ?? -1)} size={44} />
                <div style={{ display: 'flex' }}>{nameOf(a, t)}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** `withCards`: the deck's most included cards too; the tall format always has room for them. */
const archetype = async (ctx: Ctx, withCards: boolean) => {
  const cards = withCards || ctx.size === 'tall'
  const { data, size, t, locale } = ctx
  const a = pick(ctx)
  if (!a) return <Empty>{t('empty')}</Empty>
  const key = archKey(a.archetype)
  const vs = data.matchups.filter((m) => archKey(m.archetype) === key && archKey(m.opponent) !== key && m.games >= data.minSamples && m.winRate != null)
  const sorted = [...vs].sort((x, y) => y.winRate! - x.winRate!)
  const best = sorted.slice(0, 3)
  const worst = sorted.slice(-3).reverse()
  const names = new Map(data.archetypes.map((x) => [archKey(x.archetype), nameOf(x, t)]))
  const topCards = a.cards.slice(0, 6)
  const arts = await loadImages([a.face?.id, ...(cards ? topCards.map((c) => c.id) : [])])
  const MatchList = ({ title, list, color }: { title: string; list: Matchup[]; color: string }) => (
    <Panel title={title} style={{ flex: 1 }}>
      {list.length ? list.map((m) => (
        <div key={archKey(m.opponent)} style={{ ...row, gap: 12, fontSize: 28 }}>
          <div style={{ display: 'flex', flex: 1 }}>{names.get(archKey(m.opponent)) ?? t('unknownDeck')}</div>
          <div style={{ display: 'flex', color, fontWeight: 700 }}>{pct(m.winRate)}</div>
        </div>
      )) : <div style={{ display: 'flex', fontSize: 24, color: C.muted }}>{t('empty')}</div>}
    </Panel>
  )
  const hero = (
    <div style={{ ...row, gap: 32 }}>
      <Art src={arts.get(a.face?.id ?? -1)} size={size === 'wide' ? 160 : 240} />
      <div style={{ ...col, gap: 10, flex: 1 }}>
        <div style={{ ...row, gap: 16 }}>
          <div style={{ display: 'flex', fontSize: 64, fontWeight: 700 }}>{nameOf(a, t)}</div>
          {a.tier ? <div style={{ display: 'flex', fontSize: 36, color: C.tier[a.tier] }}>T{a.tier}</div> : null}
        </div>
        <div style={{ display: 'flex', fontSize: 28, color: C.dim }}>
          {t('rankLine', { rank: byShare(data).indexOf(a) + 1, players: num(a.players, locale) })}
        </div>
      </div>
    </div>
  )
  const kpis = (
    <div style={{ ...row, gap: 20 }}>
      <Kpi label={t('share')} value={pct(a.metaShare)} color={C.cyan} size={56} />
      <Kpi label={t('winRate')} value={pct(a.winRate)} color={wrColor(a.winRate)} size={56} />
      <Kpi label={t('first')} value={pct(a.turnOrder.first.winRate)} size={56} />
      <Kpi label={t('second')} value={pct(a.turnOrder.second.winRate)} size={56} />
    </div>
  )
  const matchups = (
    <div style={{ ...row, gap: 20, alignItems: 'stretch' }}>
      <MatchList title={t('best')} list={best} color={C.win} />
      <MatchList title={t('worst')} list={worst} color={C.loss} />
    </div>
  )
  const cardList = cards ? (
    <Panel title={t('topCards')} style={{ flex: 1 }}>
      <div style={{ ...row, gap: 18, flexWrap: 'wrap' }}>
        {topCards.map((c) => (
          <div key={c.id} style={{ ...col, gap: 8, width: size === 'wide' ? 150 : 128 }}>
            <Art src={arts.get(c.id)} size={size === 'wide' ? 150 : 128} />
            <div style={{ display: 'flex', fontSize: 20, color: C.dim, height: 50, overflow: 'hidden' }}>{c.name ?? '—'}</div>
            <div style={{ display: 'flex', fontSize: 22, color: C.cyan }}>{pct(c.inclusion, 0)}</div>
          </div>
        ))}
      </div>
    </Panel>
  ) : null
  if (size === 'wide') {
    return (
      <div style={{ ...row, gap: 32, flex: 1, alignItems: 'stretch' }}>
        <div style={{ ...col, gap: 28, flex: 1 }}>{hero}{kpis}{matchups}</div>
        {cardList ? <div style={{ ...col, width: 560 }}>{cardList}</div> : null}
      </div>
    )
  }
  return <div style={{ ...col, gap: 32, flex: 1 }}>{hero}{kpis}{matchups}{cardList}</div>
}

const cards = async ({ data, size, t }: Ctx) => {
  const top = (data.mostUsed?.main ?? []).slice(0, 10)
  if (!top.length) return <Empty>{t('empty')}</Empty>
  const arts = await loadImages(top.map((c) => c.id))
  // Two a row, five rows: fits both bodies.
  const w = size === 'wide' ? 860 : 462
  return (
    <div style={{ ...row, flexWrap: 'wrap', gap: 24, flex: 1, alignContent: 'flex-start' }}>
      {top.map((c, i) => (
        <div key={c.id} style={{ ...row, gap: 18, width: w, padding: 14, background: C.surface, border: `2px solid ${C.line}` }}>
          <Art src={arts.get(c.id)} size={size === 'wide' ? 76 : 180} />
          <div style={{ ...col, gap: 8, flex: 1 }}>
            <div style={{ ...row, gap: 10 }}>
              <div style={{ display: 'flex', fontSize: 24, color: i < 3 ? C.gold : C.muted }}>#{i + 1}</div>
              {c.handTrap ? <div style={{ display: 'flex', fontSize: 18, color: C.gold, border: `2px solid ${C.gold}`, padding: '2px 8px' }}>{t('handTrap')}</div> : null}
            </div>
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, maxHeight: 64, overflow: 'hidden' }}>{c.name ?? '—'}</div>
            <div style={{ ...row, justifyContent: 'space-between', fontSize: 22 }}>
              <div style={{ display: 'flex', color: C.cyan }}>{t('inDecks', { rate: pct(c.popularity, 0) })}</div>
              <div style={{ display: 'flex', color: wrColor(c.winRateWhenUsed) }}>{pct(c.winRateWhenUsed, 0)}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

const sampleDecks = async (ctx: Ctx) => {
  const { data, size, t, key } = ctx
  const decks = data.sampleDecks ?? []
  const deck = (key && decks.find((d) => archKey(d.archetype) === key)) || decks[0]
  if (!deck) return <Empty>{t('empty')}</Empty>
  const images = await loadImages([...deck.main, ...deck.extra].map((c) => c.id), 'card')
  const total = (list: { count: number }[]) => list.reduce((s, c) => s + c.count, 0)
  const cw = size === 'wide' ? 96 : 112
  const Grid = ({ title, list, width }: { title: string; list: typeof deck.main; width: number }) => (
    <div style={{ ...col, gap: 14, width }}>
      <Label color={C.cyan}>{title}</Label>
      <div style={{ ...row, flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' }}>
        {list.map((c) => (
          <div key={c.id} style={{ display: 'flex', position: 'relative', width: cw, height: Math.round(cw * 1.46) }}>
            {images.get(c.id) ? (
              // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
              <img src={images.get(c.id)} width={cw} height={Math.round(cw * 1.46)} style={{ width: cw, height: Math.round(cw * 1.46) }} />
            ) : (
              <div style={{ display: 'flex', width: cw, height: Math.round(cw * 1.46), background: C.surface2, fontSize: 16, padding: 8, color: C.dim }}>{c.name ?? c.id}</div>
            )}
            {c.count > 1 ? (
              <div style={{ display: 'flex', position: 'absolute', right: 6, bottom: 6, padding: '2px 10px', background: C.bg, border: `2px solid ${C.cyan}`, color: C.cyan, fontSize: 22, fontWeight: 700 }}>{`×${c.count}`}</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
  const head = (
    <div style={{ ...row, gap: 20, fontSize: 30 }}>
      <div style={{ display: 'flex', fontSize: 48, fontWeight: 700 }}>{nameOf(deck, t)}</div>
      <div style={{ display: 'flex', color: C.dim }}>{t('lists', { count: deck.lists })}</div>
    </div>
  )
  if (size === 'wide') {
    return (
      <div style={{ ...col, gap: 24, flex: 1 }}>
        {head}
        <div style={{ ...row, gap: 40, alignItems: 'flex-start' }}>
          <Grid title={t('main', { count: total(deck.main) })} list={deck.main} width={10 * (cw + 10)} />
          <Grid title={t('extra', { count: total(deck.extra) })} list={deck.extra} width={6 * (cw + 10)} />
        </div>
      </div>
    )
  }
  return (
    <div style={{ ...col, gap: 28, flex: 1 }}>
      {head}
      <Grid title={t('main', { count: total(deck.main) })} list={deck.main} width={952} />
      <Grid title={t('extra', { count: total(deck.extra) })} list={deck.extra} width={952} />
    </div>
  )
}

const BODY: Record<Section, (ctx: Ctx) => Promise<React.ReactNode>> = {
  overview,
  trends,
  'deck-ranking': deckRanking,
  'matchup-matrix': matchupMatrix,
  'archetype-analysis': (ctx) => archetype(ctx, false),
  cards,
  'deep-dive': (ctx) => archetype(ctx, true),
  'sample-decks': sampleDecks,
}

export const GET = async (request: Request, { params }: { params: Promise<{ section: string }> }) => {
  const { section } = await params
  if (!(SECTIONS as readonly string[]).includes(section)) notFound()
  const q = new URL(request.url).searchParams
  const ladder: RankedLadderId = q.get('ladder') === 'genesys' ? 'genesys' : 'tcg'
  const result = await getStatistics({ ladder, season: q.get('season') || undefined })
  if (!result.ok) return new Response(null, { status: result.status === 404 ? 404 : 502 })
  const { data } = result
  const size = sizeOf(q)
  const { t, locale } = await translator(q, 'Infographic')
  const day = data.syncedDays.last ? new Date(`${data.syncedDays.last.slice(0, 10)}T00:00:00Z`).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : null
  const body = await BODY[section as Section]({ data, size, t, locale, key: q.get('key') })
  return render({
    size,
    title: t(`sections.${section}`),
    subtitle: t('season', { label: data.season.label, ladder: data.season.ladder === 'genesys' ? 'Genesys' : 'TCG' }),
    footer: day ? t('updated', { date: day, games: num(data.totals.games, locale) }) : t('source'),
    body,
    // The statistics endpoint's own 5 minutes.
    cache: 'public, max-age=300, s-maxage=300',
  })
}
