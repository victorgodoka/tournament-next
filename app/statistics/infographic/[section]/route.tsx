/**
 * GET /statistics/infographic/:section?ladder=&season=&key=&mode=&size=wide|tall&locale= — one dashboard section
 * as a shareable PNG. `key` (an archetype "207-451") picks the deck for archetype-analysis and deep-dive;
 * for the comparator it is up to three keys joined by commas. Without it, the most played. `mode`
 * (general | pure | combined) reads a deep dive outside the page's data from the API, like the page's search.
 */

import { notFound } from 'next/navigation'
import { archKey, getDeepDive, getStatistics, type AgainstCard, type DeepDiveMode, type Matchup, type StatArchetype, type StatCard, type Statistics } from '@utils/statistics'
import { deckFaces, powerRanked } from '@utils/power-tier'
import type { RankedLadderId } from '@utils/types'
import { Art, Bar, C, Chip, col, Donut, Empty, F, Head, Kpi, Label, loadImages, mono, num, Panel, pct, render, row, sizeOf, translator, type Size, type Slice } from '@omega/infographic/infographic'

const SECTIONS = ['overview', 'trends', 'deck-ranking', 'matchup-matrix', 'archetype-analysis', 'comparator', 'cards', 'deep-dive', 'tier-list', 'meta-report'] as const
type Section = (typeof SECTIONS)[number]
/** These two read every tiered deck: the endpoint's default 30 rows stop before Tier 4. */
const WHOLE_META: readonly Section[] = ['tier-list', 'meta-report']

type T = (key: string, values?: Record<string, string | number>) => string
const MODES: readonly DeepDiveMode[] = ['general', 'pure', 'combined']
type Ctx = { data: Statistics; size: Size; t: T; locale: string; key: string | null; mode: DeepDiveMode | null }

const nameOf = (a: { name: string | null }, t: T) => a.name ?? t('unknownDeck')
const byShare = (data: Statistics) => [...data.archetypes].sort((a, b) => b.metaShare - a.metaShare)
const find = (data: Statistics, key: string | null | undefined) => (key ? data.archetypes.find((a) => archKey(a.archetype) === key) : undefined)
/**
 * The deck of `key` with its rank by meta share: the page's own row, or, in a mode other than pure, the
 * calculated deep dive from the API. No key: the most played. A key nobody has: null.
 */
const pick = async ({ data, key, mode }: Ctx): Promise<{ a: StatArchetype; rank: number } | null> => {
  const ranked = byShare(data)
  if (!key) return ranked[0] ? { a: ranked[0], rank: 1 } : null
  const local = find(data, key)
  if (local && (!mode || mode === 'pure')) return { a: local, rank: ranked.indexOf(local) + 1 }
  if (mode) {
    const state = await getDeepDive(data.season.code, mode, key.split('-').map(Number)).catch(() => null)
    if (state?.status === 'ready') return { a: state.archetype, rank: state.archetype.rank }
  }
  return local ? { a: local, rank: ranked.indexOf(local) + 1 } : null
}
const wrColor = (wr: number | null | undefined) => (wr == null ? C.muted : wr >= 0.5 ? C.win : C.loss)
const art = (arts: Map<number, string>, a: StatArchetype) => arts.get(a.face?.id ?? -1)

/** The deck's name in Anton, with its tier beside. */
const DeckName = ({ a, t, size }: { a: StatArchetype; t: T; size: number }) => (
  <div style={{ ...row, gap: 18 }}>
    <div style={{ display: 'flex', fontFamily: F.display, fontSize: size, lineHeight: 1, textTransform: 'uppercase' }}>{nameOf(a, t)}</div>
    {a.tier ? <Chip color={C.tier[a.tier]} edge={C.tier[a.tier]}>{`Tier ${a.tier}`}</Chip> : null}
  </div>
)

const Rank = ({ n, gold = false, size = 36 }: { n: number; gold?: boolean; size?: number }) => (
  <div style={{ display: 'flex', width: size, height: size, alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: gold ? C.gold : C.surface2, color: gold ? C.goldInk : C.ink, fontFamily: F.display, fontSize: size / 2 }}>
    {String(n).padStart(2, '0')}
  </div>
)

const overview = async ({ data, size, t, locale }: Ctx) => {
  const wide = size === 'wide'
  const tiers = data.tierDistribution
  const tierRows = tiers
    ? ([[1, tiers.tier1], [2, tiers.tier2], [3, tiers.tier3], [4, tiers.tier4], [0, tiers.others]] as const).filter(([, v]) => v.share > 0)
    : []
  const slices: Slice[] = tierRows.map(([k, v]) => ({ value: v.share, color: k ? C.tier[k]! : C.lineMid, label: k ? `T${k}` : undefined, sub: pct(v.share, 0) }))
  const kpis = (
    <div style={{ ...row, gap: 16, flexShrink: 0 }}>
      {([['games', data.totals.games], ['matches', data.totals.matches], ['players', data.totals.players]] as const).map(([k, v]) => (
        <Kpi key={k} label={t(`kpi.${k}`)} value={num(v, locale)} size={wide ? 64 : 60} />
      ))}
    </div>
  )
  const tierPanel = (
    <Panel n="01" title={t('tiers')} aside={t('tiersMeta')} style={{ flex: 1, gap: 24 }}>
      {tierRows.length ? (
        <div style={{ ...row, gap: 36, flex: 1 }}>
          <Donut
            slices={slices}
            size={wide ? 400 : 440}
            hole={wide ? 150 : 170}
            center={
              <div style={{ ...col, alignItems: 'center', gap: 4 }}>
                <Label size={14}>{t('kpi.archetypes')}</Label>
                <div style={{ display: 'flex', fontFamily: F.display, fontSize: 64, lineHeight: 1 }}>{num(data.archetypes.length, locale)}</div>
              </div>
            }
          />
          <div style={{ ...col, gap: 14, flex: 1 }}>
            {tierRows.map(([k, v]) => (
              <div key={k} style={{ ...row, gap: 14 }}>
                <div style={{ display: 'flex', width: 14, height: 14, background: k ? C.tier[k] : C.lineMid, flexShrink: 0 }} />
                <div style={{ display: 'flex', width: 90, fontSize: 24, fontWeight: 700 }}>{k ? `Tier ${k}` : t('others')}</div>
                <Bar value={v.share / Math.max(...tierRows.map(([, x]) => x.share), 0.01)} color={k ? C.tier[k] : C.lineMid} />
                <div style={{ display: 'flex', width: 84, justifyContent: 'flex-end', fontFamily: F.display, fontSize: 28 }}>{pct(v.share, 0)}</div>
                <div style={{ display: 'flex', width: 130, justifyContent: 'flex-end', ...mono, fontSize: 13, color: C.muted }}>{t('decksCount', { count: v.archetypes })}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Empty>{t('empty')}</Empty>
      )}
    </Panel>
  )
  const Split = ({ label, split, big }: { label: string; split: Statistics['turnOrder']['all']; big: boolean }) => {
    const f = split.first.winRate
    const s = split.second.winRate
    const share = f != null && s != null && f + s > 0 ? f / (f + s) : 0.5
    return (
      <div style={{ ...col, gap: 10 }}>
        <div style={{ ...row, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: big ? 26 : 22, fontWeight: 700 }}>{label}</div>
          <Label size={14}>{t('turnGames', { count: num(split.first.games + split.second.games, locale) })}</Label>
        </div>
        <div style={{ ...row, gap: 20 }}>
          <div style={{ display: 'flex', width: big ? 150 : 110, fontFamily: F.display, fontSize: big ? 56 : 36, lineHeight: 1, color: wrColor(f) }}>{pct(f)}</div>
          <div style={{ ...row, flex: 1, height: big ? 22 : 12, gap: 3 }}>
            <div style={{ display: 'flex', width: `${share * 100}%`, height: '100%', background: C.series[0] }} />
            <div style={{ display: 'flex', flex: 1, height: '100%', background: C.series[2] }} />
          </div>
          <div style={{ display: 'flex', width: big ? 150 : 110, justifyContent: 'flex-end', fontFamily: F.display, fontSize: big ? 56 : 36, lineHeight: 1, color: wrColor(s) }}>{pct(s)}</div>
        </div>
        <div style={{ ...row, justifyContent: 'space-between' }}>
          <div style={{ ...row, gap: 8, ...mono, fontSize: 14, color: C.dim }}><div style={{ display: 'flex', width: 10, height: 10, background: C.series[0] }} />{t('first')}</div>
          <div style={{ ...row, gap: 8, ...mono, fontSize: 14, color: C.dim }}><div style={{ display: 'flex', width: 10, height: 10, background: C.series[2] }} />{t('second')}</div>
        </div>
      </div>
    )
  }
  const turnPanel = (
    <Panel n="02" title={t('turn')} aside={t('turnMeta')} style={{ flex: 1, gap: 28, justifyContent: 'center' }}>
      <Split label={t('allGames')} split={data.turnOrder.all} big />
      <div style={{ display: 'flex', height: 1, background: C.line }} />
      <Split label={t('game1')} split={data.turnOrder.game1} big={false} />
      <Split label={t('postSide')} split={data.turnOrder.postSide} big={false} />
    </Panel>
  )
  return (
    <div style={{ ...col, gap: 24, flex: 1 }}>
      {kpis}
      <div style={{ ...(wide ? row : col), alignItems: 'stretch', gap: 24, flex: 1 }}>{tierPanel}{turnPanel}</div>
    </div>
  )
}

const trends = async ({ data, size, t }: Ctx) => {
  const wide = size === 'wide'
  const lines = data.trends
    .map((tr) => ({ ...tr, last: tr.points.at(-1)?.[1] ?? 0 }))
    .sort((a, b) => b.last - a.last)
    .slice(0, 6)
  if (!lines.length) return <Empty>{t('empty')}</Empty>
  const byKey = new Map(data.archetypes.map((a) => [archKey(a.archetype), a]))
  const arts = await loadImages(lines.map((l) => byKey.get(archKey(l.archetype))?.face?.id))
  const faceOf = (l: (typeof lines)[number]) => arts.get(byKey.get(archKey(l.archetype))?.face?.id ?? -1)
  const w = wide ? 1150 : 952
  const h = wide ? 560 : 860
  const dot = 56
  const maxDay = Math.max(...lines.flatMap((l) => l.points.map((p) => p[0])), 2)
  const maxShare = Math.max(...lines.flatMap((l) => l.points.map((p) => p[1])), 0.05) * 1.15
  const x = (d: number) => ((d - 1) / (maxDay - 1)) * (w - dot / 2)
  const y = (s: number) => h - (s / maxShare) * h
  const chart = (
    <div style={{ display: 'flex', position: 'relative', width: w, height: h, flexShrink: 0 }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1={0} x2={w} y1={h - f * h} y2={h - f * h} stroke={C.line} strokeWidth={1} />)}
        {lines.map((l, i) => (
          <polyline key={archKey(l.archetype)} points={l.points.map((p) => `${x(p[0])},${y(p[1])}`).join(' ')} fill="none" stroke={C.series[i]} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
        ))}
      </svg>
      {/* The deck's art on the end of its line: the legend on the chart. */}
      {lines.map((l, i) => {
        const last = l.points.at(-1)
        if (!last) return null
        return (
          <div key={archKey(l.archetype)} style={{ display: 'flex', position: 'absolute', left: x(last[0]) - dot / 2, top: Math.min(h - dot, Math.max(0, y(last[1]) - dot / 2)) }}>
            <Art src={faceOf(l)} size={dot} radius={dot / 2} edge={C.series[i]!} />
          </div>
        )
      })}
    </div>
  )
  const legend = (
    <div style={{ ...col, gap: 14, flex: 1 }}>
      {lines.map((l, i) => {
        const g = byKey.get(archKey(l.archetype))?.growth
        return (
          <div key={archKey(l.archetype)} style={{ ...row, gap: 16, padding: '10px 14px', background: C.surface, borderLeft: `4px solid ${C.series[i]}` }}>
            <Art src={faceOf(l)} size={wide ? 56 : 64} />
            <div style={{ ...col, flex: 1, gap: 4, minWidth: 0 }}>
              <div style={{ display: 'flex', fontSize: 26, fontWeight: 700 }}>{nameOf(l, t)}</div>
              <Label size={13}>{t('share')}</Label>
            </div>
            <div style={{ display: 'flex', fontFamily: F.display, fontSize: 34, color: C.cyan }}>{pct(l.last)}</div>
            {g != null ? <div style={{ display: 'flex', width: 110, justifyContent: 'flex-end', ...mono, fontSize: 18, fontWeight: 700, color: g >= 0 ? C.win : C.loss }}>{`${g >= 0 ? '▲ +' : '▼ '}${(g * 100).toFixed(1)}`}</div> : null}
          </div>
        )
      })}
    </div>
  )
  return (
    <div style={{ ...(wide ? row : col), gap: 40, flex: 1, alignItems: 'stretch' }}>
      <div style={{ ...col, gap: 16 }}>
        <Head n="01" title={t('shareOverTime', { days: maxDay })} aside={pct(maxShare, 0)} />
        {chart}
      </div>
      {legend}
    </div>
  )
}

const deckRanking = async ({ data, size, t, locale }: Ctx) => {
  const wide = size === 'wide'
  const top = byShare(data).slice(0, 10)
  if (!top.length) return <Empty>{t('empty')}</Empty>
  const sleeper = find(data, data.rankings?.sleeper[0] ? archKey(data.rankings.sleeper[0]) : null) ?? null
  const arts = await loadImages([...top, ...(sleeper ? [sleeper] : [])].map((a) => a.face?.id))
  const covered = top.reduce((s, a) => s + a.metaShare, 0)
  const slices: Slice[] = [
    ...top.map((a, i) => ({ value: a.metaShare, color: C.series[i % C.series.length]!, art: art(arts, a), label: pct(a.metaShare, 0), sub: `#${i + 1}`, edge: a === sleeper ? C.gold : undefined })),
    ...(covered < 1 ? [{ value: 1 - covered, color: C.surface2, label: pct(1 - covered, 0), sub: t('others') }] : []),
  ]
  const rowH = wide ? 48 : 66
  const Row = ({ a, i }: { a: StatArchetype; i: number }) => (
    <div style={{ ...row, gap: 14, height: rowH, padding: '0 12px 0 8px', background: C.surface, flexShrink: 0 }}>
      <Rank n={i + 1} gold={i === 0} size={rowH - 16} />
      <Art src={art(arts, a)} size={rowH - 12} />
      <div style={{ ...col, flex: 1, gap: 5, minWidth: 0 }}>
        <div style={{ ...row, gap: 10 }}>
          <div style={{ display: 'flex', fontSize: wide ? 22 : 26, fontWeight: 700, color: a === sleeper ? C.gold : C.ink }}>{nameOf(a, t)}</div>
          {a.tier ? <div style={{ display: 'flex', ...mono, fontSize: 13, color: C.tier[a.tier] }}>T{a.tier}</div> : null}
        </div>
        <Bar value={a.metaShare / (top[0]?.metaShare || 1)} height={3} color={a === sleeper ? C.gold : C.cyan} />
      </div>
      <div style={{ display: 'flex', width: 90, justifyContent: 'flex-end', ...mono, fontSize: 16, color: C.muted }}>{pct(a.metaShare)}</div>
      <div style={{ display: 'flex', width: 110, justifyContent: 'flex-end', fontFamily: F.display, fontSize: wide ? 30 : 34, color: wrColor(a.winRate) }}>{pct(a.winRate)}</div>
    </div>
  )
  const table = (
    <div style={{ ...col, gap: 6, flex: 1 }}>
      <Head n="01" title={t('topDecks')} aside={`${t('share')} · ${t('winRate')}`} />
      {top.map((a, i) => <Row key={archKey(a.archetype)} a={a} i={i} />)}
    </div>
  )
  const watch = sleeper ? (
    <div style={{ ...row, gap: 18, padding: '16px 20px', background: C.surface, border: `2px solid ${C.gold}`, flexShrink: 0 }}>
      <Art src={art(arts, sleeper)} size={wide ? 84 : 96} edge={C.gold} />
      <div style={{ ...col, gap: 6, flex: 1, minWidth: 0 }}>
        <Label color={C.gold} weight={700}>{`⚠ ${t('watchOut')}`}</Label>
        <div style={{ display: 'flex', fontFamily: F.display, fontSize: wide ? 34 : 40, lineHeight: 1, textTransform: 'uppercase' }}>{nameOf(sleeper, t)}</div>
        <div style={{ display: 'flex', fontSize: 18, color: C.dim }}>{t('sleeperLine', { rate: pct(sleeper.winRate), share: pct(sleeper.metaShare), games: num(sleeper.games, locale) })}</div>
      </div>
    </div>
  ) : null
  const donut = (
    <Donut
      slices={slices}
      size={wide ? 430 : 560}
      hole={wide ? 160 : 200}
      center={
        <div style={{ ...col, alignItems: 'center', gap: 4 }}>
          <Label size={14}>{t('top10Share')}</Label>
          <div style={{ display: 'flex', fontFamily: F.display, fontSize: wide ? 60 : 68, lineHeight: 1 }}>{pct(Math.min(1, covered), 0)}</div>
          <Label size={13} color={C.cyan}>{data.season.ladder === 'genesys' ? 'GENESYS' : 'TCG'}</Label>
        </div>
      }
    />
  )
  if (!wide) {
    return (
      <div style={{ ...col, gap: 24, flex: 1 }}>
        <div style={{ ...row, justifyContent: 'center' }}>{donut}</div>
        {watch}
        {table}
      </div>
    )
  }
  return (
    <div style={{ ...row, gap: 40, flex: 1, alignItems: 'stretch' }}>
      {table}
      <div style={{ ...col, gap: 20, width: 600, justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ ...row, justifyContent: 'center' }}>{donut}</div>
        {watch}
      </div>
    </div>
  )
}

const matchupMatrix = async ({ data, size, t }: Ctx) => {
  const wide = size === 'wide'
  const decks = [...data.archetypes].sort((a, b) => b.games - a.games).slice(0, 10)
  if (decks.length < 2) return <Empty>{t('empty')}</Empty>
  const arts = await loadImages(decks.map((a) => a.face?.id))
  const cell = new Map(data.matchups.map((m) => [`${archKey(m.archetype)}|${archKey(m.opponent)}`, m]))
  const side = wide ? 56 : 82
  const gap = 4
  const tint = (m?: Matchup) => {
    if (!m || m.winRate == null || m.games < data.minSamples) return C.surface
    const d = Math.min(1, Math.abs(m.winRate - 0.5) / 0.2)
    const [r, g, b] = m.winRate >= 0.5 ? [79, 220, 140] : [255, 133, 148]
    return `rgba(${r},${g},${b},${0.15 + d * 0.6})`
  }
  const grid = (
    <div style={{ ...col, gap, flexShrink: 0 }}>
      <div style={{ ...row, gap }}>
        <div style={{ display: 'flex', width: side, height: side, alignItems: 'center', justifyContent: 'center', ...mono, fontSize: 12, color: C.muted }}>{t('vs')}</div>
        {decks.map((o) => <Art key={archKey(o.archetype)} src={art(arts, o)} size={side} />)}
      </div>
      {decks.map((a) => (
        <div key={archKey(a.archetype)} style={{ ...row, gap }}>
          <Art src={art(arts, a)} size={side} edge={C.lineMid} />
          {decks.map((o) => {
            const m = cell.get(`${archKey(a.archetype)}|${archKey(o.archetype)}`)
            const mirror = archKey(a.archetype) === archKey(o.archetype)
            return (
              <div key={archKey(o.archetype)} style={{ display: 'flex', width: side, height: side, alignItems: 'center', justifyContent: 'center', background: mirror ? C.surface2 : tint(m), fontFamily: F.display, fontSize: wide ? 22 : 28, color: mirror ? C.muted : C.ink }}>
                {mirror || !m || m.games < data.minSamples ? '—' : pct(m.winRate, 0)}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
  // The key to the art, and how to read the grid.
  const key = (
    <div style={{ ...col, gap: 16, flex: 1 }}>
      <Head n="01" title={t('key')} aside={t('minGames', { min: data.minSamples })} />
      <div style={{ ...row, flexWrap: 'wrap', gap: wide ? 8 : 10 }}>
        {decks.map((a, i) => (
          <div key={archKey(a.archetype)} style={{ ...row, gap: 12, width: wide ? '100%' : 466, padding: '6px 10px', background: C.surface }}>
            <Rank n={i + 1} size={28} />
            <Art src={art(arts, a)} size={wide ? 40 : 44} />
            <div style={{ display: 'flex', flex: 1, fontSize: wide ? 22 : 24, fontWeight: 700 }}>{nameOf(a, t)}</div>
            <div style={{ display: 'flex', fontFamily: F.display, fontSize: 24, color: wrColor(a.winRate) }}>{pct(a.winRate)}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', fontSize: 18, color: C.muted, lineHeight: 1.4 }}>{t('matrixHow', { min: data.minSamples })}</div>
    </div>
  )
  return (
    <div style={{ ...(wide ? row : col), gap: 40, flex: 1, alignItems: wide ? 'flex-start' : 'center' }}>
      {grid}
      {key}
    </div>
  )
}

/** A card with its art, name and two figures under it. */
const CardTile = ({ src, name, a, b, width, dim = false }: { src?: string; name: string; a: string; b?: string; width: number; dim?: boolean }) => (
  <div style={{ ...col, gap: 6, width }}>
    <Art src={src} size={width} />
    <div style={{ display: 'flex', fontSize: 15, fontWeight: 700, color: C.dim, height: 38, overflow: 'hidden', lineHeight: 1.25 }}>{name}</div>
    <div style={{ display: 'flex', fontFamily: F.display, fontSize: 24, lineHeight: 1, color: dim ? C.loss : C.cyan }}>{a}</div>
    {b ? <div style={{ display: 'flex', ...mono, letterSpacing: 1, fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>{b}</div> : null}
  </div>
)

/** `withCards`: the deck's most included cards and the cards that beat it; the tall format always has room. */
const archetype = async (ctx: Ctx, withCards: boolean) => {
  const { data, size, t, locale } = ctx
  const wide = size === 'wide'
  const cards = withCards || !wide
  const picked = await pick(ctx)
  if (!picked) return <Empty>{t('empty')}</Empty>
  const { a, rank } = picked
  const key = archKey(a.archetype)
  const vs = data.matchups.filter((m) => archKey(m.archetype) === key && archKey(m.opponent) !== key && m.games >= data.minSamples && m.winRate != null)
  const sorted = [...vs].sort((x, y) => y.winRate! - x.winRate!)
  const best = sorted.slice(0, 3)
  const worst = sorted.slice(-3).reverse()
  const byKey = new Map(data.archetypes.map((x) => [archKey(x.archetype), x]))
  // Generic cards only: the deck's own archetype cards sit at 100% and say nothing.
  const topCards = cards ? (a.staples ?? a.cards).slice(0, 6) : []
  // The generic cards that hurt the deck most: by its win rate when it faced them, lowest first.
  const against = cards ? [...(a.against ?? [])].filter((c) => c.games >= data.minSamples && c.winRate != null).sort((x, y) => x.winRate! - y.winRate!).slice(0, 6) : []
  const arts = await loadImages([a.face?.id, ...topCards.map((c) => c.id), ...against.map((c) => c.id), ...[...best, ...worst].map((m) => byKey.get(archKey(m.opponent))?.face?.id)])
  const MatchList = ({ n, title, list, color }: { n: string; title: string; list: Matchup[]; color: string }) => (
    <Panel n={n} title={title} style={{ flex: 1, gap: 12 }}>
      {list.length ? list.map((m) => {
        const o = byKey.get(archKey(m.opponent))
        return (
          <div key={archKey(m.opponent)} style={{ ...row, gap: 12 }}>
            <Art src={o ? art(arts, o) : undefined} size={40} />
            <div style={{ display: 'flex', flex: 1, fontSize: 24, fontWeight: 700 }}>{o ? nameOf(o, t) : t('unknownDeck')}</div>
            <div style={{ display: 'flex', ...mono, fontSize: 13, color: C.muted }}>{num(m.games, locale)}</div>
            <div style={{ display: 'flex', width: 100, justifyContent: 'flex-end', fontFamily: F.display, fontSize: 30, color }}>{pct(m.winRate)}</div>
          </div>
        )
      }) : <div style={{ display: 'flex', fontSize: 22, color: C.muted }}>{t('empty')}</div>}
    </Panel>
  )
  const hero = (
    <div style={{ ...row, gap: 28, flexShrink: 0 }}>
      <Art src={art(arts, a)} size={wide ? 176 : 220} edge={C.cyan} />
      <div style={{ ...col, gap: 14, flex: 1, minWidth: 0 }}>
        <DeckName a={a} t={t} size={nameOf(a, t).length > (wide && cards ? 12 : 18) ? (wide ? 60 : 52) : wide ? 88 : 72} />
        <div style={{ ...row, gap: 10, flexWrap: 'wrap' }}>
          <Chip>{t('rankLine', { rank })}</Chip>
          <Chip>{t('playersCount', { count: num(a.players, locale) })}</Chip>
          <Chip>{t('gamesCount', { count: num(a.games, locale) })}</Chip>
        </div>
      </div>
    </div>
  )
  const kpis = (
    <div style={{ ...row, gap: 16, flexShrink: 0, alignItems: 'stretch' }}>
      <Kpi label={t('share')} value={pct(a.metaShare)} color={C.cyan} size={52} />
      <Kpi label={t('winRate')} value={pct(a.winRate)} color={wrColor(a.winRate)} size={52} hint={a.ci ? `± ${pct(a.ci.margin)}` : undefined} />
      <Kpi label={t('first')} value={pct(a.turnOrder.first.winRate)} color={wrColor(a.turnOrder.first.winRate)} size={52} />
      <Kpi label={t('second')} value={pct(a.turnOrder.second.winRate)} color={wrColor(a.turnOrder.second.winRate)} size={52} />
    </div>
  )
  const matchups = (
    <div style={{ ...row, gap: 16, alignItems: 'stretch', flexShrink: 0 }}>
      <MatchList n="01" title={t('best')} list={best} color={C.win} />
      <MatchList n="02" title={t('worst')} list={worst} color={C.loss} />
    </div>
  )
  // Three tiles a row, two rows; the panel is sized to them (tiles, gaps, padding) plus a little slack.
  const tile = wide ? 96 : 124
  const panelW = 3 * tile + 2 * 12 + 56 + 8
  const CardGrid = ({ n, title, aside, items }: { n: string; title: string; aside?: string; items: { src?: string; name: string; a: string; b?: string; dim?: boolean }[] }) => (
    <Panel n={n} title={title} aside={aside} style={{ flex: 1, gap: 16 }}>
      {items.length ? (
        <div style={{ ...row, gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {items.map((c, i) => <CardTile key={i} width={tile} {...c} />)}
        </div>
      ) : (
        <div style={{ display: 'flex', fontSize: 20, color: C.muted }}>{t('empty')}</div>
      )}
    </Panel>
  )
  const cardPanels = cards ? (
    <div style={{ ...row, gap: 16, alignItems: 'stretch', flex: 1 }}>
      <CardGrid n="03" title={t('topCards')} items={topCards.map((c: StatCard) => ({ src: arts.get(c.id), name: c.name ?? '—', a: pct(c.inclusion, 0), b: t('copies', { count: c.averageCopies.toFixed(1) }) }))} />
      <CardGrid n="04" title={t('bestAgainst')} items={against.map((c: AgainstCard) => ({ src: arts.get(c.id), name: c.name ?? '—', a: pct(c.winRate, 0), b: t('facedIn', { rate: pct(c.rate, 0) }), dim: true }))} />
    </div>
  ) : null
  if (wide) {
    return (
      <div style={{ ...row, gap: 24, flex: 1, alignItems: 'stretch' }}>
        <div style={{ ...col, gap: 20, flex: 1 }}>{hero}{kpis}{matchups}</div>
        {cardPanels ? <div style={{ ...col, width: 2 * panelW + 16, flexShrink: 0 }}>{cardPanels}</div> : null}
      </div>
    )
  }
  return <div style={{ ...col, gap: 20, flex: 1 }}>{hero}{kpis}{matchups}{cardPanels}</div>
}

const COMPARE = [
  { id: 'winRate', value: (a: StatArchetype) => a.winRate },
  { id: 'metaShare', value: (a: StatArchetype) => a.metaShare },
  { id: 'first', value: (a: StatArchetype) => a.turnOrder.first.winRate },
  { id: 'second', value: (a: StatArchetype) => a.turnOrder.second.winRate },
  { id: 'game1', value: (a: StatArchetype) => a.sideboarding.game1.winRate },
  { id: 'postSide', value: (a: StatArchetype) => a.sideboarding.postSide.winRate },
] as const

/** Up to three decks side by side: a grouped bar per metric, the best of each row in green. */
const comparator = async (ctx: Ctx, tm: T) => {
  const { data, size, t, locale, key } = ctx
  const wide = size === 'wide'
  const picked = [...new Set((key ?? '').split(','))].flatMap((k) => find(data, k) ?? [])
  const decks = (picked.length ? picked : byShare(data).slice(0, 2)).slice(0, 3)
  if (decks.length < 2) return <Empty>{t('empty')}</Empty>
  const arts = await loadImages(decks.map((a) => a.face?.id))
  const head = (
    <div style={{ ...row, gap: 16, flexShrink: 0 }}>
      {decks.map((a, i) => (
        <div key={archKey(a.archetype)} style={{ ...row, gap: 16, flex: 1, padding: 16, background: C.surface, borderTop: `4px solid ${C.series[i]}` }}>
          <Art src={art(arts, a)} size={wide ? 96 : 110} edge={C.series[i]!} />
          <div style={{ ...col, gap: 8, flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', fontFamily: F.display, fontSize: wide ? 40 : 34, lineHeight: 1, textTransform: 'uppercase' }}>{nameOf(a, t)}</div>
            <div style={{ ...row, gap: 12, flexWrap: 'wrap', ...mono, fontSize: 14, color: C.muted }}>
              {a.tier ? <div style={{ display: 'flex', color: C.tier[a.tier], whiteSpace: 'nowrap' }}>Tier {a.tier}</div> : null}
              <div style={{ display: 'flex', whiteSpace: 'nowrap' }}>{t('gamesCount', { count: num(a.games, locale) })}</div>
              <div style={{ display: 'flex', whiteSpace: 'nowrap' }}>{t('playersCount', { count: num(a.players, locale) })}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
  const barH = wide ? (decks.length > 2 ? 16 : 22) : decks.length > 2 ? 26 : 36
  const chart = (
    <div style={{ ...col, gap: wide ? 12 : 36, flex: 1 }}>
      {COMPARE.map((m) => {
        const values = decks.map((a) => m.value(a))
        const max = Math.max(...values.map((v) => v ?? 0), 1e-9)
        const bestV = values.reduce<number | null>((b, v) => (v != null && (b == null || v > b) ? v : b), null)
        return (
          <div key={m.id} style={{ ...row, gap: 24, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', width: wide ? 220 : 200, paddingTop: 2, fontSize: wide ? 22 : 26, fontWeight: 700 }}>{tm(`metrics.${m.id}`)}</div>
            <div style={{ ...col, gap: 4, flex: 1 }}>
              {decks.map((a, i) => {
                const v = values[i]
                const best = v != null && v === bestV && m.id !== 'metaShare'
                return (
                  <div key={archKey(a.archetype)} style={{ ...row, gap: 12 }}>
                    <div style={{ display: 'flex', flex: 1, height: barH, background: C.surface }}>
                      <div style={{ display: 'flex', width: `${v == null ? 0 : (v / max) * 100}%`, height: barH, background: C.series[i] }} />
                    </div>
                    {/* `lineHeight: 1`: the text, not the bar, sets the row's height. */}
                    <div style={{ display: 'flex', width: 96, justifyContent: 'flex-end', fontFamily: F.display, fontSize: wide && decks.length > 2 ? 18 : 24, lineHeight: 1, color: best ? C.win : C.ink }}>{pct(v)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
  return (
    <div style={{ ...col, gap: 28, flex: 1 }}>
      {head}
      <Head n="01" title={t('headToHead')} aside={t('bestInGreen')} />
      {chart}
    </div>
  )
}

/**
 * Top 10 main-deck cards as a butterfly around the card's art: popularity growing left, and on the right
 * "#n name" over the deck's win rate activating (ACT) and not activating (NACT) the card.
 */
const cards = async ({ data, size, t }: Ctx) => {
  const wide = size === 'wide'
  const top = (data.mostUsed?.main ?? []).slice(0, 10)
  if (!top.length) return <Empty>{t('empty')}</Empty>
  const arts = await loadImages(top.map((c) => c.id))
  const maxPop = Math.max(...top.map((c) => c.popularity), 0.01)
  // Wide: name 16 + two 16px bar rows + gaps = 56, inside the 60px tile; rows never shrink below it.
  const tile = wide ? 60 : 108
  const rowGap = wide ? 4 : 28
  const barH = wide ? 10 : 18
  const fs = wide ? 16 : 26
  return (
    <div style={{ ...col, gap: rowGap, flex: 1 }}>
      <div style={{ ...row, gap: 24 }}>
        <div style={{ ...row, flex: 1 }}><Head n="01" title={t('popularity')} aside={t('inDecksShort')} /></div>
        <div style={{ display: 'flex', width: tile }} />
        <div style={{ ...row, flex: 1 }}><Head n="02" title={t('actNact')} /></div>
      </div>
      {top.map((c, i) => {
        const act = c.winRateWith ?? c.winRateWhenUsed
        return (
          <div key={c.id} style={{ ...row, gap: 24, height: tile, flexShrink: 0 }}>
            <div style={{ ...row, flex: 1, gap: 14, justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', fontFamily: F.display, fontSize: wide ? 28 : 32, color: C.cyan }}>{pct(c.popularity, 0)}</div>
              <Bar value={c.popularity / maxPop} height={tile - 16} reverse color={C.cyan} track={C.surface} />
            </div>
            <Art src={arts.get(c.id)} size={tile} edge={c.handTrap ? C.gold : C.line} />
            <div style={{ ...col, flex: 1, gap: 4, justifyContent: 'center' }}>
              <div style={{ ...row, gap: 8, fontSize: wide ? 16 : 24, fontWeight: 700, lineHeight: 1 }}>
                <div style={{ display: 'flex', color: i < 3 ? C.gold : C.muted }}>{`#${i + 1}`}</div>
                <div style={{ display: 'flex', overflow: 'hidden', whiteSpace: 'nowrap' }}>{c.name ?? '—'}</div>
              </div>
              {([[act, C.win, t('act')], [c.winRateWithout, C.lineMid, t('nact')]] as const).map(([v, color, label]) => (
                <div key={label} style={{ ...row, gap: 10 }}>
                  <div style={{ display: 'flex', width: 50, ...mono, fontSize: 11, color: C.muted }}>{label}</div>
                  <div style={{ display: 'flex', flex: 1, height: barH, background: C.surface }}>
                    <div style={{ display: 'flex', width: `${v == null ? 0 : v * 100}%`, height: '100%', background: color }} />
                  </div>
                  <div style={{ display: 'flex', width: 76, justifyContent: 'flex-end', fontFamily: F.display, fontSize: fs, lineHeight: 1, color: wrColor(v) }}>{pct(v, 0)}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      <div style={{ ...row, gap: 28, justifyContent: 'flex-end', ...mono, fontSize: 13, color: C.muted }}>
        <div style={{ ...row, gap: 8 }}><div style={{ display: 'flex', width: 12, height: 12, border: `2px solid ${C.gold}` }} />{t('handTrap')}</div>
      </div>
    </div>
  )
}

const TIERS = [1, 2, 3, 4] as const
const ROW_WIDTH = { wide: 1634, tall: 810 }
/** Art side by tier, and how many lines of tiles a tier may take. */
const TILE = { wide: { 1: 130, 2: 114, 3: 100, 4: 90 }, tall: { 1: 176, 2: 146, 3: 146, 4: 146 } } as const
const LINES = { wide: 1, tall: 2 } as const
const TILE_GAP = 10

/** A deck on the board: its art, name and win rate. */
const Tile = ({ a, src, side, t }: { a: StatArchetype; src?: string; side: number; t: T }) => (
  <div style={{ ...col, width: side, gap: 5, flexShrink: 0 }}>
    <Art src={src} size={side} />
    {/* `block`, not flex: Satori only draws the ellipsis on a block. */}
    <div style={{ display: 'block', fontSize: 14, lineHeight: 1.1, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nameOf(a, t)}</div>
    <div style={{ display: 'flex', ...mono, fontSize: 13, lineHeight: 1, letterSpacing: 1, color: wrColor(a.winRate) }}>{pct(a.winRate)}</div>
  </div>
)

const tierList = async ({ data, size, t }: Ctx) => {
  const ranked = powerRanked(data.archetypes)
  const rows = TIERS.flatMap((tier) => {
    const decks = ranked.filter((a) => a.tier === tier)
    if (!decks.length) return []
    const side = TILE[size][tier]
    const slots = Math.floor((ROW_WIDTH[size] + TILE_GAP) / (side + TILE_GAP)) * LINES[size]
    const fits = decks.length <= slots
    return [{ tier, decks, side, shown: fits ? decks : decks.slice(0, slots - 1), share: decks.reduce((sum, a) => sum + a.metaShare, 0) }]
  })
  const faces = deckFaces(rows.flatMap((r) => r.shown))
  const arts = await loadImages([...faces.values()].map((face) => face.id))
  return (
    <div style={{ ...col, flex: 1, justifyContent: 'space-between', gap: 8 }}>
      {rows.map(({ tier, decks, side, shown, share }) => (
        <div key={tier} style={{ ...row, alignItems: 'stretch', gap: 14 }}>
          <div style={{ ...col, width: 128, flexShrink: 0, justifyContent: 'center', gap: 4, padding: '0 16px', background: C.surface, borderLeft: `6px solid ${C.tier[tier]}` }}>
            <div style={{ display: 'flex', fontFamily: F.display, fontSize: 58, lineHeight: 1, color: C.tier[tier] }}>{`T${tier}`}</div>
            <Label size={13}>{pct(share)}</Label>
          </div>
          <div style={{ ...row, alignItems: 'flex-start', flexWrap: 'wrap', flex: 1, gap: TILE_GAP }}>
            {shown.map((a) => <Tile key={archKey(a.archetype)} a={a} src={arts.get(faces.get(archKey(a.archetype))?.id ?? -1)} side={side} t={t} />)}
            {shown.length < decks.length ? (
              <div style={{ ...col, width: side, height: side, alignItems: 'center', justifyContent: 'center', gap: 4, flexShrink: 0, background: C.surface, border: `2px solid ${C.line}` }}>
                <div style={{ display: 'flex', fontFamily: F.display, fontSize: 38, lineHeight: 1 }}>{`+${decks.length - shown.length}`}</div>
                <Label size={12}>{t('more')}</Label>
              </div>
            ) : null}
          </div>
        </div>
      ))}
      <Label size={14}>{t('tierListNote')}</Label>
    </div>
  )
}

const points = (growth: number) => `${growth >= 0 ? '+' : '−'}${Math.abs(growth * 100).toFixed(1)}`

const MoverRow = ({ a, src, t }: { a: StatArchetype; src?: string; t: T }) => (
  <div style={{ ...row, gap: 16 }}>
    <Art src={src} size={64} />
    <div style={{ ...col, flex: 1, gap: 4, minWidth: 0 }}>
      <div style={{ display: 'block', fontSize: 21, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nameOf(a, t)}</div>
      <div style={{ ...row, gap: 12 }}>
        {a.tier ? <Label size={13} color={C.tier[a.tier]} weight={700}>{`T${a.tier}`}</Label> : null}
        <Label size={13}>{t('winRateShort', { rate: pct(a.winRate) })}</Label>
      </div>
    </div>
    <div style={{ display: 'flex', fontFamily: F.display, fontSize: 38, lineHeight: 1, color: (a.growth ?? 0) >= 0 ? C.win : C.loss }}>{points(a.growth ?? 0)}</div>
  </div>
)

const metaReport = async ({ data, size, t }: Ctx) => {
  const wide = size === 'wide'
  const listed = powerRanked(data.archetypes).filter((a) => a.growth != null)
  const rising = listed.filter((a) => a.growth! > 0).sort((a, b) => b.growth! - a.growth!).slice(0, 5)
  const falling = listed.filter((a) => a.growth! < 0).sort((a, b) => a.growth! - b.growth!).slice(0, 5)
  const hero = rising[0]
  const arts = await loadImages([...rising, ...falling].map((a) => a.face?.id))
  // The server's growth window: half the season, at most 7 days.
  const days = Math.min(7, Math.max(1, Math.floor(data.syncedDays.count / 2)))
  const list = (n: string, title: string, decks: StatArchetype[]) => (
    <Panel n={n} title={title} style={{ flex: 1, flexBasis: 0, minWidth: 0 }}>
      <div style={{ ...col, flex: 1, justifyContent: 'space-around', gap: 12 }}>
        {decks.length ? decks.map((a) => <MoverRow key={archKey(a.archetype)} a={a} src={art(arts, a)} t={t} />) : <Empty>{t('noMovers')}</Empty>}
      </div>
    </Panel>
  )
  return (
    <div style={{ ...col, flex: 1, gap: 16 }}>
      <div style={{ ...(wide ? row : col), flex: 1, alignItems: 'stretch', gap: 20 }}>
        {hero ? (
          <Panel n="01" title={t('fastestRiser')} style={wide ? { width: 460 } : undefined}>
            <div style={{ ...(wide ? col : row), alignItems: 'stretch', gap: 18 }}>
              <Art src={art(arts, hero)} size={wide ? 280 : 260} edge={C.gold} />
              {/* A column inside a column must not take `flex: 1`: its basis of 0 collapses it over the art. */}
              <div style={{ ...col, ...(wide ? {} : { flex: 1 }), gap: 14 }}>
                <div style={{ display: 'flex', fontFamily: F.display, fontSize: 40, lineHeight: 1.1, textTransform: 'uppercase' }}>{nameOf(hero, t)}</div>
                <div style={{ ...row, alignItems: 'flex-start' }}>
                  <div style={{ ...col, width: '50%', gap: 6 }}>
                    <div style={{ display: 'flex', fontFamily: F.display, fontSize: 52, lineHeight: 1, color: C.win }}>{points(hero.growth!)}</div>
                    <Label size={13}>{t('change')}</Label>
                  </div>
                  <div style={{ ...col, width: '50%', gap: 6 }}>
                    <div style={{ display: 'flex', fontFamily: F.display, fontSize: 52, lineHeight: 1, color: wrColor(hero.winRate) }}>{pct(hero.winRate)}</div>
                    <Label size={13}>{t('winRate')}</Label>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        ) : null}
        {list('02', t('rising'), rising)}
        {list('03', t('falling'), falling)}
      </div>
      <Label size={14}>{t('moversNote', { days })}</Label>
    </div>
  )
}

const BODY: Record<Section, (ctx: Ctx, tm: T) => Promise<React.ReactNode>> = {
  overview,
  trends,
  'deck-ranking': deckRanking,
  'matchup-matrix': matchupMatrix,
  'archetype-analysis': (ctx) => archetype(ctx, false),
  comparator,
  cards,
  'deep-dive': (ctx) => archetype(ctx, true),
  'tier-list': tierList,
  'meta-report': metaReport,
}

export const GET = async (request: Request, { params }: { params: Promise<{ section: string }> }) => {
  const { section } = await params
  if (!(SECTIONS as readonly string[]).includes(section)) notFound()
  const q = new URL(request.url).searchParams
  const ladder: RankedLadderId = q.get('ladder') === 'genesys' ? 'genesys' : 'tcg'
  const result = await getStatistics({ ladder, season: q.get('season') || undefined, archetypes: WHOLE_META.includes(section as Section) ? 100 : undefined })
  if (!result.ok) return new Response(null, { status: result.status === 404 ? 404 : 502 })
  const { data } = result
  const size = sizeOf(q)
  const [{ t, locale }, { t: tm }] = await Promise.all([translator(q, 'Infographic'), translator(q, 'Statistics.comparator')])
  const day = data.syncedDays.last ? new Date(`${data.syncedDays.last.slice(0, 10)}T00:00:00Z`).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : null
  const asked = q.get('mode')
  const mode = MODES.find((m) => m === asked) ?? null
  const body = await BODY[section as Section]({ data, size, t, locale, key: q.get('key'), mode }, tm)
  return render({
    size,
    eyebrow: t('source'),
    aside: day ? t('asOf', { date: day }) : undefined,
    title: t(`sections.${section}`),
    subtitle: data.season.ladder === 'genesys' ? 'Genesys' : 'TCG',
    // `totals.games` counts each duel twice: the two weekly images go out with articles that quote matches.
    chips: [
      data.season.label,
      WHOLE_META.includes(section as Section) ? t('matchesCount', { count: num(data.totals.matches, locale) }) : t('gamesCount', { count: num(data.totals.games, locale) }),
      t('playersCount', { count: num(data.totals.players, locale) }),
    ],
    footer: t('footer', { days: data.syncedDays.count }),
    body,
    // The statistics endpoint's own 5 minutes.
    cache: 'public, max-age=300, s-maxage=300',
  })
}
