'use client'

/**
 * The public ranked leaderboard, ported from the Omega Hub design bundle
 * (https://claude.ai/artifact/Bi3WkghqHpeZpvNdDwiFh1, RankedLeaderboard / LeaderboardPodium /
 * Leaderboard / LadderSwitch) and wired to GET /ranked/leaderboard, or to
 * GET /ranked/seasons/:code/standings for a closed season. Class names and markup follow the bundle
 * one to one; the styles live in ./leaderboard.css.
 */

import { Fragment, useState, type CSSProperties, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { useAuth } from '@contexts/auth/auth.context'
import { Avatar, Button, cx, Eyebrow, Icon } from '@omega/messenger/messenger-ui'
import { LocalTime } from '@omega/profile/local-time'
import { Select } from '@ui/field'
import { can } from '@utils/articles'
import { LEADERBOARD_PAGE_SIZE, RankedApiError, getLeaderboard, getSeasonStandings, refreshLeaderboard, type PageQuery } from '@utils/ranked'
import type { Cosmetics, LeaderboardEntry, LeaderboardPage, PastSeason, RankedLadderId, RankedSeason, Tier } from '@utils/types'
import './leaderboard.css'

const LADDERS: Record<RankedLadderId, { format: string; tone: string }> = {
  tcg: { format: 'TCG', tone: 'tcg' },
  genesys: { format: 'Genesys', tone: 'genesys' },
}
const IDS = Object.keys(LADDERS) as RankedLadderId[]

const fmtElo = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
const fmtCount = (n: number) => n.toLocaleString('en-US')
const winRate = (w: number, l: number, d: number) => {
  const g = w + l + d
  return g ? (Math.round((w / g) * 1000) / 10).toFixed(1) + '%' : '—'
}
const shortId = (id: string) => (id.length > 10 ? id.slice(0, 4) + '…' + id.slice(-4) : id)
const pad2 = (n: number) => (n < 10 ? '0' : '') + n
const hm = (iso: string) => {
  const d = new Date(iso)
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes())
}
const HM: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
const DAY: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
const profileHref = (id: string) => `/profile/${id}`
const seasonTitle = (s: Pick<RankedSeason, 'label' | 'ordinal'>) => s.label || `Season ${s.ordinal}`

type Row = {
  rank: number
  id: string
  name: string
  unnamed: boolean
  handle: string | null
  avatar: string | null
  cosmetics: Cosmetics
  tier: Tier
  elo: string
  w: number
  l: number
  d: number
  rate: string
  me: boolean
}

/** API entry → display row */
const entryRow = (e: LeaderboardEntry, meId?: string): Row => ({
  rank: e.rank,
  id: e.id,
  name: e.name ?? 'Unlinked duelist',
  unnamed: !e.name,
  handle: e.handle || (e.name ? null : 'ID ' + shortId(e.id)),
  avatar: e.avatar,
  cosmetics: e.cosmetics,
  tier: e.tier,
  elo: fmtElo(e.elo),
  w: e.wins,
  l: e.loses,
  d: e.draws,
  rate: winRate(e.wins, e.loses, e.draws),
  me: meId != null && e.id === meId,
})
const recordOf = (r: Row) => `${r.w}–${r.l}–${r.d}`

/* ---------- TierBadge / RailHead ---------- */
const TierBadge = ({ tier }: { tier: Tier }) => {
  const key = tier.toLowerCase()
  return (
    <span className="oh-cut oh-tier" style={{ '--edge': `var(--tier-${key})` } as CSSProperties}>
      <span className="oh-tier-gem" aria-hidden="true" style={{ background: `var(--tier-${key})` }} />
      {tier}
    </span>
  )
}

const RailHead = ({ num, label, stamp }: { num: string; label: string; stamp: string | null }) => (
  <div className="oh-rail" role="heading" aria-level={2}>
    <span className="oh-rail-num">{num}</span>
    <span className="oh-rail-label">{label}</span>
    <span className="oh-rail-rule" aria-hidden="true" />
    {stamp ? <span className="oh-rail-stamp">{stamp}</span> : null}
  </div>
)

const Who = ({ r, size, className }: { r: Row; size: 'sm' | 'lg'; className: string }) => (
  <>
    {r.unnamed ? (
      <span className={`oh-avatar oh-avatar-${size} oh-lb-anon`} aria-hidden="true">
        <Icon name="user" size={size === 'sm' ? 16 : 28} />
      </span>
    ) : (
      <Avatar name={r.name} src={r.avatar} cosmetics={r.cosmetics} size={size} />
    )}
    <span className={size === 'sm' ? 'oh-lb-id' : 'oh-podium-id'}>
      <Link className={cx(className, r.unnamed && 'is-anon')} href={profileHref(r.id)}>
        {r.name}
      </Link>
      {r.handle ? <span className="oh-lb-handle">{r.handle}</span> : null}
      {size === 'sm' ? (
        <span className="oh-lb-mini">
          <TierBadge tier={r.tier} />
          <span>{recordOf(r) + ' · ' + r.rate}</span>
        </span>
      ) : null}
    </span>
  </>
)

/* ---------- Leaderboard: rank 4 and below ---------- */
const COLS = ['#', 'Duelist', 'Tier', 'Elo', 'W–L–D', 'Win rate']

const Leaderboard = ({ rows, loading, label }: { rows: Row[]; loading: boolean; label: string }) => (
  <div className="oh-lb has-rate" role="table" aria-label={label}>
    <div className="oh-lb-row oh-lb-head" role="row">
      {COLS.map((c, i) => (
        <span
          key={c}
          role="columnheader"
          className={cx(i === 2 && 'oh-lb-c-tier', i >= 4 && 'oh-lb-c-extra')}
          style={{ textAlign: i === 0 ? 'center' : i >= 3 ? 'right' : 'left' }}
        >
          {c}
        </span>
      ))}
    </div>
    {rows.map((r) => (
      <div key={r.id} className={cx('oh-lb-row', r.me && 'is-me')} role="row">
        <span className={cx('oh-lb-rank', r.rank <= 3 && `p${r.rank}`)} role="cell">
          {r.rank}
        </span>
        <span className="oh-lb-who" role="cell">
          <Who r={r} size="sm" className="oh-lb-name" />
        </span>
        <span role="cell" className="oh-lb-c-tier">
          <TierBadge tier={r.tier} />
        </span>
        <span className="oh-lb-elo" role="cell">
          {r.elo}
        </span>
        <span className="oh-lb-num oh-lb-c-extra" role="cell">
          <span className="oh-lb-rec">
            <b className="oh-up">{r.w}</b>–<b className="oh-down">{r.l}</b>–<b className="oh-flat">{r.d}</b>
          </span>
        </span>
        <span className="oh-lb-num oh-lb-c-extra" role="cell">
          {r.rate}
        </span>
      </div>
    ))}
    {loading
      ? [0, 1, 2, 3, 4].map((i) => (
          <div key={'s' + i} className="oh-lb-row oh-lb-skel" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        ))
      : null}
  </div>
)

/* ---------- LeaderboardPodium: ranks 1–3 ---------- */
const PLACE = ['First', 'Second', 'Third']

const LeaderboardPodium = ({ rows, label }: { rows: Row[]; label: string }) =>
  rows.length ? (
    <ol className={cx('oh-podium', `is-${rows.length}`)} aria-label={label}>
      {rows.map((r) => (
        <li key={r.id} className={cx('oh-cut oh-notch oh-podium-card', `p${r.rank}`, r.me && 'is-me')}>
          <div className="oh-podium-top">
            <span className="oh-podium-rank" aria-label={PLACE[r.rank - 1] + ' place'}>
              {r.rank}
            </span>
            <TierBadge tier={r.tier} />
          </div>
          <div className="oh-podium-who">
            <Who r={r} size="lg" className="oh-podium-name" />
          </div>
          <dl className="oh-podium-stats">
            <div className="is-elo">
              <dt>Elo</dt>
              <dd>{r.elo}</dd>
            </div>
            <div>
              <dt>W–L–D</dt>
              <dd>{recordOf(r)}</dd>
            </div>
            <div>
              <dt>Win rate</dt>
              <dd>{r.rate}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ol>
  ) : null

/* ---------- LadderSwitch: one tab per ladder ---------- */
const LadderSwitch = ({
  value,
  onChange,
  controls,
}: {
  value: RankedLadderId
  onChange: (id: RankedLadderId) => void
  controls: string
}) => {
  const key = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!n) return
    e.preventDefault()
    const next = (i + n + IDS.length) % IDS.length
    onChange(IDS[next] ?? value)
    e.currentTarget.parentElement?.querySelectorAll('button')[next]?.focus()
  }
  return (
    <div className="oh-ladders" role="tablist" aria-label="Ranked ladder">
      {IDS.map((id, i) => {
        const sel = id === value
        const L = LADDERS[id]
        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={`ladder-tab-${id}`}
            aria-selected={sel}
            aria-controls={controls}
            tabIndex={sel ? 0 : -1}
            className={cx('oh-cut oh-ladder', `is-${L.tone}`)}
            onClick={() => onChange(id)}
            onKeyDown={(e) => key(e, i)}
          >
            <span className="oh-ladder-sq" aria-hidden="true" />
            <span className="oh-ladder-name">{L.format}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ---------- RankedLeaderboard: the whole public list ---------- */
type Board = {
  status: 'idle' | 'loading' | 'ready' | 'more' | 'error'
  season: Pick<RankedSeason, 'label' | 'ordinal'> | null
  syncedAt: string | null
  entries: LeaderboardEntry[]
  nextCursor: string | null
}
type Notice = { tone: 'cyan' | 'live'; title: string; body: string }

/** Boards are kept per ladder and season. No `code` is the open season, live; `/` never appears in a code. */
const boardKey = (ladder: RankedLadderId, code?: string) => (code ? `${ladder}/${code}` : ladder)

/** A closed season never changes, so its `null` `syncedAt` also means a walk has no refresh to cross. */
const readPage = (ladder: RankedLadderId, code: string | undefined, query: PageQuery): Promise<Omit<Board, 'status'>> =>
  code ? getSeasonStandings(code, query).then((pg) => ({ ...pg, syncedAt: null })) : getLeaderboard(ladder, query)

/** A fallback page (API unreachable at render) has no `syncedAt`: show it as the error it is. */
const fromPage = (pg: LeaderboardPage): Board => ({
  status: pg.syncedAt ? 'ready' : 'error',
  season: pg.season,
  syncedAt: pg.syncedAt,
  entries: pg.entries,
  nextCursor: pg.nextCursor,
})

const IDLE: Board = { status: 'idle', season: null, syncedAt: null, entries: [], nextCursor: null }

export const LeaderboardBrowser = ({
  initial,
  past,
}: {
  initial: Record<RankedLadderId, LeaderboardPage>
  past: Record<RankedLadderId, PastSeason[]>
}) => {
  const { user } = useAuth()
  const meId = user?.id
  const limit = LEADERBOARD_PAGE_SIZE
  const [ladder, setLadder] = useState<RankedLadderId>('tcg')
  const [picked, setPicked] = useState<Partial<Record<RankedLadderId, string>>>({})
  const [boards, setBoards] = useState<Partial<Record<string, Board>>>(() => ({
    [boardKey('tcg')]: fromPage(initial.tcg),
    [boardKey('genesys')]: fromPage(initial.genesys),
  }))
  const [notice, setNotice] = useState<Notice | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const code = picked[ladder]
  const st = boards[boardKey(ladder, code)] ?? IDLE

  const setL = (key: string, v: Partial<Board>) =>
    setBoards((o) => ({ ...o, [key]: { ...(o[key] ?? IDLE), ...v } }))

  const loadTop = (id: RankedLadderId, seasonCode?: string, reload?: boolean) => {
    const key = boardKey(id, seasonCode)
    setL(key, { status: 'loading', entries: [], nextCursor: null })
    return readPage(id, seasonCode, { limit, reload }).then(
      (pg) => setL(key, { status: 'ready', season: pg.season, syncedAt: pg.syncedAt, entries: pg.entries, nextCursor: pg.nextCursor }),
      () => setL(key, { status: 'error' }),
    )
  }

  const choose = (id: RankedLadderId) => {
    setLadder(id)
    if (!boards[boardKey(id, picked[id])]) loadTop(id, picked[id])
  }

  const pick = (seasonCode?: string) => {
    setPicked((o) => ({ ...o, [ladder]: seasonCode }))
    if (!boards[boardKey(ladder, seasonCode)]) loadTop(ladder, seasonCode)
  }

  const more = () => {
    const id = ladder
    const key = boardKey(id, code)
    const cur = st
    if (!cur.nextCursor) return
    setL(key, { status: 'more' })
    readPage(id, code, { cursor: cur.nextCursor, limit }).then(
      (pg) => {
        /* `rank` is recomputed by every read, so a walk that crosses one can skip or repeat a duelist. */
        if (pg.syncedAt !== cur.syncedAt) {
          setNotice({
            tone: 'cyan',
            title: 'The ladder was re-read',
            body: `The list refreshed at ${hm(pg.syncedAt ?? new Date().toISOString())} while you were paging, so ranks may have moved. You're back at the top of the new read.`,
          })
          return loadTop(id, code)
        }
        setL(key, { status: 'ready', entries: cur.entries.concat(pg.entries), nextCursor: pg.nextCursor })
      },
      () => {
        setL(key, { status: 'ready' })
        setNotice({ tone: 'live', title: "Couldn't load more", body: "The next page didn't arrive. Try again in a moment." })
      },
    )
  }

  const refresh = () => {
    setRefreshing(true)
    refreshLeaderboard().then(
      (r) => {
        setRefreshing(false)
        setNotice({
          tone: 'cyan',
          title: 'Leaderboard re-read at ' + hm(r.readAt),
          body: `TCG ${fmtCount(r.tcg)} duelists · Genesys ${fmtCount(r.genesys)} duelists. The 30-minute cache now starts from this read.`,
        })
        setBoards({})
        loadTop(ladder, undefined, true)
      },
      (e) => {
        setRefreshing(false)
        const denied = e instanceof RankedApiError && e.status === 403
        setNotice({
          tone: 'live',
          title: denied ? 'Only admins can refresh the leaderboard' : 'Refresh failed',
          body: denied ? "Your session doesn't have system.manage." : "The game server didn't answer. The list you see is still the last read.",
        })
      },
    )
  }

  const L = LADDERS[ladder]
  const closed = past[ladder].find((s) => s.code === code)
  const open = boards[boardKey(ladder)]?.season
  const season = closed ?? st.season
  const entries = st.entries
  const seasonName = season ? seasonTitle(season) : null
  const rows = entries.map((e) => entryRow(e, meId))
  const loading = st.status === 'loading' || st.status === 'idle'
  const panelId = 'ladder-panel'

  return (
    <div className={cx('oh-rl', `is-${L.tone}`)}>
      <div className="oh-rl-bar">
        <div className="oh-rl-pick">
          <LadderSwitch value={ladder} onChange={choose} controls={panelId} />
          {past[ladder].length ? (
            <Select
              prefix="Season"
              aria-label="Season"
              value={code ?? ''}
              onChange={(e) => pick(e.target.value || undefined)}
              options={[
                { value: '', label: open ? `${seasonTitle(open)} · open` : 'Open season' },
                ...past[ladder].map((s) => ({ value: s.code, label: seasonTitle(s) })),
              ]}
            />
          ) : null}
        </div>
        <div className="oh-rl-meta">
          <span className="oh-rl-stamp" aria-live="polite">
            {closed ? (
              <>
                Ended <LocalTime iso={closed.endsAt} options={DAY} />
              </>
            ) : (
              <>
                <span className="oh-livedot" aria-hidden="true" />
                {st.syncedAt ? (
                  <>
                    Read <LocalTime iso={st.syncedAt} options={HM} /> · refreshes every 30 min
                  </>
                ) : (
                  'Reading the ladder…'
                )}
              </>
            )}
          </span>
          {!closed && can(user, 'system.manage') ? (
            <Button size="sm" icon="refresh" disabled={refreshing} onClick={refresh}>
              {refreshing ? 'Refreshing…' : 'Refresh leaderboard'}
            </Button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <div className={cx('oh-cut oh-rl-notice', `is-${notice.tone}`)} role="status">
          <div>
            <b>{notice.title}</b>
            <p>{notice.body}</p>
          </div>
          <Button variant="ghost" size="sm" iconOnly icon="close" aria-label="Dismiss" onClick={() => setNotice(null)} />
        </div>
      ) : null}

      <section id={panelId} role="tabpanel" aria-labelledby={`ladder-tab-${ladder}`} className="oh-rl-panel">
        <RailHead
          num="01"
          label={L.format + (seasonName ? ' · ' + seasonName : '')}
          stamp={closed ? 'Final results' : season ? "Season W–L–D counts from the season's start" : null}
        />
        {st.status === 'error' ? (
          <div className="oh-rl-empty">
            <h3>Couldn&apos;t read the ladder</h3>
            <p>The leaderboard didn&apos;t load. The game server may be busy.</p>
            <Button variant="primary" onClick={() => loadTop(ladder, code)}>
              Try again
            </Button>
          </div>
        ) : !loading && !season ? (
          <div className="oh-rl-empty">
            <h3>No open {L.format} season</h3>
            <p>There&apos;s no season running on this ladder right now, so there&apos;s nothing to rank.</p>
          </div>
        ) : !loading && !entries.length ? (
          <div className="oh-rl-empty">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed 60×56 mark, as in the bundle */}
            <img src="/omega-mark.png" alt="" />
            <h3>Nobody has played {seasonName} yet</h3>
            <p>The season just started. The first ranked {L.format} game puts its players on the board.</p>
          </div>
        ) : (
          <Fragment>
            {loading ? (
              <div className="oh-podium-skel" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            ) : (
              <LeaderboardPodium rows={rows.slice(0, 3)} label={`Top three, ${L.format}`} />
            )}
            {rows.length > 3 || loading ? (
              <Leaderboard
                rows={rows.slice(3)}
                loading={loading || st.status === 'more'}
                label={`${L.format} ladder, rank 4 and below`}
              />
            ) : null}
            <div className="oh-rl-foot">
              <span className="oh-rl-count">{entries.length ? `Showing 1–${entries.at(-1)?.rank}` : ''}</span>
              {st.nextCursor ? (
                <Button onClick={more} disabled={st.status === 'more'} icon={st.status === 'more' ? undefined : 'down'}>
                  {st.status === 'more' ? 'Loading…' : `Show ${limit} more`}
                </Button>
              ) : entries.length && !loading ? (
                <span className="oh-rl-count">End of the ladder</span>
              ) : null}
            </div>
          </Fragment>
        )}
      </section>

      <p className="oh-rl-note">
        {closed
          ? `Elo, tier and rank are frozen as ${seasonName} closed. W–L–D counts only games in that season, and names and avatars are current.`
          : 'Elo and tier are read from the game server and cached for 30 minutes, so a profile can be a little ahead of this list. W–L–D counts only games in the open season. Only duelists who have played it are listed.'}
      </p>
    </div>
  )
}

/* ---------- PageHeader ---------- */
export const PageHeader = ({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: string }) => (
  <header className="oh-pagehead">
    <div className="oh-pagehead-main">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="oh-pagehead-title">{title}</h1>
      <p className="oh-pagehead-lead">{lead}</p>
    </div>
  </header>
)
