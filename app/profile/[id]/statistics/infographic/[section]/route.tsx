/**
 * GET /profile/:id/statistics/infographic/:section?ladder=&season=&format=&size=wide|tall&locale= — the owner's
 * statistics as a PNG to save and share. Owner-only like the page: the incoming cookie goes to the API,
 * which checks it too, and the PNG is never stored in a shared cache.
 */

import { notFound } from 'next/navigation'
import { getPlayerStatistics, type PlayerAnswer, type Tally3 } from '@utils/statistics'
import { oneAtATime } from '@utils/one-at-a-time'
import { getProfile } from '@utils/profile'
import { getPlayerTournamentStats } from '@utils/tournaments'
import type { Profile, RankedLadderId } from '@utils/types'
import { byDeck, byOpponent, gameTally, matchTally, played, standingOf, winRate } from '@app/profile/statistics/insights'
import { Art, Bar, busy, C, col, Empty, Kpi, Label, loadImages, num, Panel, pct, render, row, sizeOf, toDataUri, translator, type Size } from '@omega/infographic/infographic'

const SECTIONS = ['overview', 'decks', 'matchups', 'tournaments'] as const
type Section = (typeof SECTIONS)[number]
type T = (key: string, values?: Record<string, string | number>) => string
type Owner = Extract<Profile, { isPrivate: false }>

const wrColor = (wr: number | null) => (wr == null ? C.muted : wr >= 0.5 ? C.win : C.loss)
const record = (t: Tally3) => `${t.wins}-${t.losses}-${t.draws}`
const PRIVATE = 'private, no-store'
const deckName = (data: PlayerAnswer, key: string) => data.decks.find((d) => d.key === key)?.name ?? data.matchups.find((m) => m.opponent === key)?.opponentName

const Head = async ({ profile, size, t, children }: { profile: Owner; size: Size; t: T; children?: React.ReactNode }) => {
  const avatar = profile.avatar ? await toDataUri(profile.avatar) : null
  return (
    <div style={{ ...row, gap: 28 }}>
      <Art src={avatar ?? undefined} size={size === 'wide' ? 120 : 140} />
      <div style={{ ...col, gap: 6, flex: 1 }}>
        <div style={{ display: 'flex', fontSize: 56, fontWeight: 700 }}>{profile.displayName ?? profile.handle ?? t('unknown')}</div>
        {profile.handle ? <div style={{ display: 'flex', fontSize: 28, color: C.muted }}>@{profile.handle}</div> : null}
      </div>
      {children}
    </div>
  )
}

const EloLine = ({ points, width, height }: { points: { elo: number }[]; width: number; height: number }) => {
  if (points.length < 2) return null
  const lo = Math.min(...points.map((p) => p.elo))
  const hi = Math.max(...points.map((p) => p.elo), lo + 1)
  const xy = points.map((p, i) => `${(i / (points.length - 1)) * width},${height - ((p.elo - lo) / (hi - lo)) * (height - 8) - 4}`)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={xy.join(' ')} fill="none" stroke={C.cyan} strokeWidth={5} strokeLinejoin="round" />
    </svg>
  )
}

const overview = async (profile: Owner, data: PlayerAnswer, pick: { season?: string; ladder: RankedLadderId }, size: Size, t: T) => {
  const matches = matchTally(data.timeline)
  const games = gameTally(data.timeline)
  const standing = standingOf(profile, pick)
  const last = data.timeline.slice(0, size === 'wide' ? 20 : 15)
  const top = byDeck(data.timeline)[0]
  const elo = standing?.eloHistory ?? []
  const head = await Head({
    profile,
    size,
    t,
    children: standing ? (
      <div style={{ ...col, alignItems: 'flex-end', gap: 6 }}>
        <div style={{ display: 'flex', fontSize: 30, color: C.gold }}>{standing.tier}</div>
        <div style={{ display: 'flex', fontSize: 40, fontWeight: 700 }}>{standing.rank ? `#${standing.rank} · ${standing.elo}` : String(standing.elo)}</div>
      </div>
    ) : undefined,
  })
  const kpis = (
    <div style={{ ...row, gap: 20, flexWrap: 'wrap' }}>
      {([
        [t('matches'), String(played(matches)), C.ink],
        [t('matchWinRate'), pct(winRate(matches)), wrColor(winRate(matches))],
        [t('gameWinRate'), pct(winRate(games)), wrColor(winRate(games))],
        [t('record'), record(matches), C.dim],
      ] as [string, string, string][]).map(([label, value, color]) => (
        <div key={label} style={{ display: 'flex', width: size === 'wide' ? '23%' : '48%' }}>
          <Kpi label={label} value={value} color={color} size={size === 'wide' ? 60 : 68} />
        </div>
      ))}
    </div>
  )
  const results = (
    <Panel title={t('recent')}>
      <div style={{ ...row, gap: 10, flexWrap: 'wrap' }}>
        {last.map((m, i) => (
          <div key={i} style={{ display: 'flex', width: 52, height: 52, alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: C.bg, background: m[1] === 'W' ? C.win : m[1] === 'L' ? C.loss : C.muted }}>
            {m[1] ?? '·'}
          </div>
        ))}
      </div>
    </Panel>
  )
  const eloPanel = elo.length > 1 ? (
    <Panel title={t('elo')} style={{ flex: 1 }}>
      <EloLine points={elo} width={size === 'wide' ? 780 : 888} height={size === 'wide' ? 170 : 300} />
    </Panel>
  ) : null
  const topDeck = top ? (
    <Panel title={t('mostPlayed')} style={{ flex: 1 }}>
      <div style={{ display: 'flex', fontSize: 40, fontWeight: 700 }}>{deckName(data, top.key) ?? t('unknownDeck')}</div>
      <div style={{ display: 'flex', fontSize: 28, color: C.dim }}>{t('deckLine', { matches: played(top.matches), rate: pct(winRate(top.matches)) })}</div>
    </Panel>
  ) : null
  return (
    <div style={{ ...col, gap: 28, flex: 1 }}>
      {head}
      {kpis}
      {size === 'wide' ? (
        <div style={{ ...row, gap: 28, alignItems: 'stretch' }}>
          {eloPanel}
          <div style={{ ...col, gap: 28, flex: 1 }}>{topDeck}{results}</div>
        </div>
      ) : (
        <>
          {eloPanel}
          {topDeck}
          {results}
        </>
      )}
    </div>
  )
}

const decks = (data: PlayerAnswer, size: Size, t: T) => {
  const list = byDeck(data.timeline).slice(0, 6)
  if (!list.length) return <Empty>{t('empty')}</Empty>
  const most = Math.max(...list.map((d) => played(d.matches)))
  return (
    <div style={{ ...row, flexWrap: 'wrap', gap: 24, alignContent: 'flex-start', flex: 1 }}>
      {list.map((d) => (
        <div key={d.key} style={{ ...row, gap: 22, width: size === 'wide' ? 860 : 952, padding: 20, background: C.surface, border: `2px solid ${C.line}` }}>
          <div style={{ ...col, gap: 12, flex: 1 }}>
            <div style={{ display: 'flex', fontSize: 34, fontWeight: 700 }}>{deckName(data, d.key) ?? t('unknownDeck')}</div>
            <div style={{ ...row, gap: 14 }}>
              <Bar value={played(d.matches) / most} />
              <div style={{ display: 'flex', fontSize: 24, color: C.dim }}>{t('matchesCount', { count: played(d.matches) })}</div>
            </div>
          </div>
          <div style={{ ...col, alignItems: 'flex-end', width: 170 }}>
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, color: wrColor(winRate(d.matches)) }}>{pct(winRate(d.matches))}</div>
            <div style={{ display: 'flex', fontSize: 22, color: C.muted }}>{record(d.matches)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** By opponent deck, every own deck summed; 3+ matches to be called best or worst. */
const matchups = (data: PlayerAnswer, size: Size, t: T) => {
  const rows = byOpponent(data.timeline).filter((m) => played(m.matches) >= 3).sort((a, b) => winRate(b.matches)! - winRate(a.matches)!)
  if (!rows.length) return <Empty>{t('empty')}</Empty>
  const n = size === 'wide' ? 5 : 6
  const List = ({ title, list, color }: { title: string; list: typeof rows; color: string }) => (
    <Panel title={title} style={{ flex: 1, gap: 22 }}>
      {list.map((m, i) => (
        <div key={i} style={{ ...row, gap: 16, fontSize: 32 }}>
          <div style={{ display: 'flex', flex: 1, fontWeight: 700 }}>{deckName(data, m.key) ?? t('unknownDeck')}</div>
          <div style={{ display: 'flex', fontSize: 24, color: C.muted }}>{record(m.matches)}</div>
          <div style={{ display: 'flex', width: 130, justifyContent: 'flex-end', color, fontWeight: 700 }}>{pct(winRate(m.matches))}</div>
        </div>
      ))}
    </Panel>
  )
  const best = rows.slice(0, n)
  const worst = rows.slice(-n).reverse().filter((m) => !best.includes(m))
  return (
    <div style={{ ...(size === 'wide' ? row : col), gap: 28, alignItems: 'stretch', flex: 1 }}>
      <List title={t('best')} list={best} color={C.win} />
      {worst.length ? <List title={t('worst')} list={worst} color={C.loss} /> : null}
    </div>
  )
}

const tournaments = async (profile: Owner, id: string, cookie: string | null, format: string | undefined, size: Size, t: T, locale: string) => {
  const data = await getPlayerTournamentStats(id, cookie, format).catch(() => null)
  if (!data) return null
  const rec = { wins: data.record.wins, losses: data.record.loses, draws: data.record.draws }
  const top = [...data.archetypes].sort((a, b) => b.wins + b.loses + b.draws - (a.wins + a.loses + a.draws)).slice(0, 5)
  const arts = await loadImages(top.map((a) => a.artCardId))
  const first = data.turnOrder.first.games ? data.turnOrder.first.wins / data.turnOrder.first.games : null
  const second = data.turnOrder.second.games ? data.turnOrder.second.wins / data.turnOrder.second.games : null
  return (
    <div style={{ ...col, gap: 28, flex: 1 }}>
      {await Head({ profile, size, t })}
      <div style={{ ...row, gap: 20, flexWrap: 'wrap' }}>
        {([
          [t('tournaments'), num(data.tournaments, locale), C.ink],
          [t('titles'), num(data.titles, locale), C.gold],
          [t('matchWinRate'), pct(winRate(rec)), wrColor(winRate(rec))],
          [t('record'), record(rec), C.dim],
        ] as [string, string, string][]).map(([label, value, color]) => (
          <div key={label} style={{ display: 'flex', width: size === 'wide' ? '23%' : '48%' }}>
            <Kpi label={label} value={value} color={color} size={size === 'wide' ? 60 : 68} />
          </div>
        ))}
      </div>
      <div style={{ ...(size === 'wide' ? row : col), gap: 28, alignItems: 'stretch' }}>
        <Panel title={t('topDecks')} style={{ flex: 1, gap: 18 }}>
          {top.length ? top.map((a) => (
            <div key={a.archetype} style={{ ...row, gap: 18 }}>
              <Art src={arts.get(a.artCardId ?? -1)} size={size === 'wide' ? 44 : 64} />
              <div style={{ display: 'flex', flex: 1, fontSize: 30, fontWeight: 700 }}>{a.archetype}</div>
              <div style={{ display: 'flex', fontSize: 24, color: C.muted }}>{`${a.wins}-${a.loses}-${a.draws}`}</div>
              <div style={{ display: 'flex', width: 120, justifyContent: 'flex-end', fontSize: 30, color: wrColor(a.winRate) }}>{pct(a.winRate)}</div>
            </div>
          )) : <div style={{ display: 'flex', fontSize: 26, color: C.muted }}>{t('empty')}</div>}
        </Panel>
        <div style={{ ...(size === 'wide' ? col : row), gap: 20, width: size === 'wide' ? 420 : undefined }}>
          <Kpi label={t('first')} value={pct(first)} color={wrColor(first)} size={56} />
          <Kpi label={t('second')} value={pct(second)} color={wrColor(second)} size={56} />
        </div>
      </div>
      {data.format ? <Label>{data.format}</Label> : null}
    </div>
  )
}

type Route = { params: Promise<{ id: string; section: string }> }

export const GET = (request: Request, route: Route) => oneAtATime(() => draw(request, route), busy)

const draw = async (request: Request, { params }: Route) => {
  const { id, section } = await params
  if (!(SECTIONS as readonly string[]).includes(section)) notFound()
  const cookie = request.headers.get('cookie')
  const profile = await getProfile(id, cookie)
  if (!profile) notFound()
  // Self profile only: only it carries `visibility`. The API refuses anyone else too.
  if (profile.isPrivate || profile.visibility === undefined) return new Response(null, { status: 403, headers: { 'cache-control': PRIVATE } })

  const q = new URL(request.url).searchParams
  const size = sizeOf(q)
  const { t, locale } = await translator(q, 'Infographic.profile')
  const name = profile.displayName ?? profile.handle ?? t('unknown')
  const today = new Date().toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })

  if (section === 'tournaments') {
    const format = q.get('format') || undefined
    const body = await tournaments(profile, id, cookie, format, size, t, locale)
    if (!body) return new Response(null, { status: 502, headers: { 'cache-control': PRIVATE } })
    return render({ size, title: t('sections.tournaments'), subtitle: format ?? t('allFormats'), footer: t('footer', { name, date: today }), body, cache: PRIVATE })
  }

  const ladder: RankedLadderId = q.get('ladder') === 'genesys' ? 'genesys' : 'tcg'
  const season = q.get('season') || undefined
  const result = await getPlayerStatistics(id, { ladder, season }, cookie)
  if (!result.ok) return new Response(null, { status: result.status || 502, headers: { 'cache-control': PRIVATE } })
  const { data } = result
  const ladderName = ladder === 'genesys' ? 'Genesys' : 'TCG'
  const subtitle = data.season ? t('season', { label: data.season.label, ladder: data.season.ladder === 'genesys' ? 'Genesys' : 'TCG' }) : t('allSeasons', { ladder: ladderName })
  const body =
    section === 'overview'
      ? await overview(profile, data, { season, ladder: data.season?.ladder ?? ladder }, size, t)
      : section === 'decks'
        ? decks(data, size, t)
        : matchups(data, size, t)
  return render({ size, title: t(`sections.${section as Section}`), subtitle, footer: t('footer', { name, date: today }), body, cache: PRIVATE })
}
