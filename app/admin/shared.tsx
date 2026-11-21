'use client'

import Link from 'next/link'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Segmented } from '@ui/choice'
import { Select } from '@ui/field'
import type { LookupOption } from '@ui/lookup'
import { CardImage } from '@omega/card-art/card-image'
import { useResource } from '@hooks/index'
import { findArchetypes, searchCardArts } from '@utils/cards'
import { CARD_ART_URL, CARD_IMAGE_URL } from '@utils/const'
import { panelErrorText } from '@utils/panel'
import { getSeasons } from '@utils/statistics'

/** Module-level so `useSearch` sees a stable function. */
export const findCards = (text: string, signal: AbortSignal): Promise<LookupOption[]> =>
  searchCardArts(text, 8, signal).then((cards) => cards.map((c) => ({ key: c.id, label: c.name, meta: c.id })))

export const findSetcodes = (text: string, signal: AbortSignal): Promise<LookupOption[]> =>
  findArchetypes(text, signal).then((list) => list.map((a) => ({ key: a.code, label: a.name, meta: a.code })))

export const percent = (rate: number | null | undefined) => (rate === null || rate === undefined ? '—' : `${(rate * 100).toFixed(1)}%`)

/** `4,812`. */
export const count = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('en-US'))

/** A win-rate difference in points, signed: `+3.0`. */
export const points = (diff: number | null | undefined) => (diff === null || diff === undefined ? '—' : `${diff > 0 ? '+' : ''}${(diff * 100).toFixed(1)}`)

/** A setcode as the card database writes it; a Series code (65536 + id) stays decimal. */
export const hex = (code: number) => (code > 0xffff ? String(code) : `0x${code.toString(16).toUpperCase()}`)

export const wikiCard = (id: number) => `/wiki/card/${id}`

const KIND = { setcode: 'Setcode', 'series-setcode': 'Series over setcode', series: 'Series, new archetype' } as const
export const kindLabel = (kind: keyof typeof KIND) => KIND[kind]

const CV = { 32: 's', 44: '', 72: 'l', 176: 'xl' } as const

/** Square art crop of a card; a dashed "?" tile when there is none. */
export const Cover = ({ card, size = 44, ring, title }: { card: number | null | undefined; size?: keyof typeof CV; ring?: boolean; title?: string }) =>
  card ? (
    <span className={`cv ${CV[size]} ${ring ? 'ring' : ''}`} title={title}>
      <CardImage src={CARD_ART_URL(card)} alt="" fill sizes={`${size}px`} quality={60} />
    </span>
  ) : (
    <span className={`cv dash ${CV[size]}`} aria-label="No cover">
      ?
    </span>
  )

const CD = { 28: 's', 40: '', 64: 'l', 104: 'xl' } as const

/** The whole card, linked to its wiki page unless `plain`. `off` greys it (an excluded card). */
export const CardThumb = ({ id, name, size = 40, off, ring, plain }: { id: number; name?: string | null; size?: keyof typeof CD; off?: boolean; ring?: boolean; plain?: boolean }) => {
  const className = `cd ${CD[size]} ${off ? 'x' : ''} ${ring ? 'ring' : ''}`
  const image = <CardImage src={CARD_IMAGE_URL(id)} alt={plain ? '' : (name ?? `Card ${id}`)} fill sizes={`${size}px`} quality={60} />
  return plain ? (
    <span className={className} title={name ?? undefined}>
      {image}
    </span>
  ) : (
    <Link href={wikiCard(id)} target="_blank" className={className} title={name ? `${name} · open in the wiki` : 'Open in the wiki'}>
      {image}
    </Link>
  )
}

/** A 6px bar and the percent, right aligned. `of` scales the bar (the largest share of the table). */
export const ShareBar = ({ rate, of = 1, gold }: { rate: number; of?: number; gold?: boolean }) => (
  <span className="fx" style={{ gap: 8, flexWrap: 'nowrap' }}>
    <span className={`bar ${gold ? 'g' : ''}`}>
      <i style={{ width: `${Math.min(100, of > 0 ? (rate / of) * 100 : 0)}%` }} />
    </span>
    <span className="mono" style={{ width: 48, textAlign: 'right' }}>
      {percent(rate)}
    </span>
  </span>
)

/** A numbered section head: `01 Variations ———— note`. */
export const Rail = ({ n, title, note }: { n?: string; title: string; note?: React.ReactNode }) => (
  <div className="rail">
    {n ? <span className="n">{n}</span> : null}
    <h2 className="t3">{title}</h2>
    <i />
    {note ? <span className="lbl-sm">{note}</span> : null}
  </div>
)

export type LowMode = 'all' | 'hide' | 'only'
const LOW: { value: LowMode; label: string }[] = [
  { value: 'all', label: 'Show' },
  { value: 'hide', label: 'Hide' },
  { value: 'only', label: 'Only' },
]

/** Show / Hide / Only and the cut-off, in percent of `unit`. One component, three scopes. */
export const LowValueControl = ({ mode, onMode, cut, onCut, unit = '% lists' }: { mode: LowMode; onMode: (mode: LowMode) => void; cut: number; onCut: (cut: number) => void; unit?: string }) => (
  <>
    <div className="col-s">
      <span className="lbl-sm">Low value</span>
      <Segmented label="Low value" size="sm" options={LOW} value={mode} onChange={onMode} />
    </div>
    <label className="fld">
      <span className="lbl-sm">Cut-off</span>
      <span className="cut inpw" style={{ flexWrap: 'nowrap' }}>
        <input
          className="inp mono"
          style={{ flex: '0 0 48px', width: 48 }}
          inputMode="decimal"
          aria-label="Low value cut-off"
          defaultValue={cut}
          key={cut}
          onBlur={(e) => {
            const value = Number(e.target.value)
            if (Number.isFinite(value) && value >= 0 && value <= 100) onCut(value)
            else e.target.value = String(cut)
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <span className="lbl-sm" style={{ whiteSpace: 'nowrap' }}>{unit}</span>
      </span>
    </label>
  </>
)

/** Whether a share passes the low value control. */
export const passesLow = (mode: LowMode, low: boolean) => mode === 'all' || (mode === 'hide' ? !low : low)

/** State remembered per admin in localStorage. Reads after mount, so the server and the first paint agree. */
export const useStored = <T,>(key: string, initial: T): [T, (value: T) => void] => {
  const [value, setValue] = useState(initial)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`panel:${key}`)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage only exists after mount
      if (raw !== null) setValue(JSON.parse(raw) as T)
    } catch {} // storage blocked or a stale shape: keep the default
  }, [key])
  return [
    value,
    (next) => {
      setValue(next)
      try {
        localStorage.setItem(`panel:${key}`, JSON.stringify(next))
      } catch {}
    },
  ]
}

/** The swept seasons, newest first, and the picked one: the first until someone picks. */
export const useSeason = (picked: number | null) => {
  const seasons = useResource('statistics-seasons', () => getSeasons())
  const swept = (seasons.data ?? []).filter((s) => s.sweptThrough)
  return { swept, season: picked ?? swept[0]?.id ?? null, loading: !seasons.data }
}

export const SeasonSelect = ({ seasons, value, onChange }: { seasons: { id: number; label: string; code: string }[]; value: number | null; onChange: (id: number) => void }) => (
  <Select label="Season" value={value === null ? '' : String(value)} onChange={(e) => onChange(Number(e.target.value))} options={seasons.map((s) => ({ value: String(s.id), label: `${s.label} (${s.code})` }))} />
)

/** Every screen that changes classification ends with this. */
export const NextBuildNote = () => (
  <div className="cut f-gold c-xs" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span className="t4">A change shows in two steps</span>
    <span className="sm">
      Deck names in profiles, match history and tournament decklists change on their next read. /statistics changes after the next build: the nightly job, or Reclassify on the{' '}
      <Link className="lnk" href="/admin/statistics/sweep">
        job page
      </Link>
      .
    </span>
  </div>
)

/** A failed read or write, inline. */
export const Failure = ({ title = "That didn't go through", children }: { title?: string; children: React.ReactNode }) => (
  <div role="alert" className="well" style={{ borderColor: 'var(--color-crimson-lift)' }}>
    <span className="t4 rd">{title}</span>
    <p className="sm">{children}</p>
  </div>
)

/** The page head: gold eyebrow, title, lead, and the buttons on the right. */
export const Head = ({ eyebrow, title, lead, end }: { eyebrow: React.ReactNode; title: React.ReactNode; lead?: React.ReactNode; end?: React.ReactNode }) => (
  <div className="head">
    <div className="head-txt">
      <span className="lbl eyebrow">{eyebrow}</span>
      <h1 className="t1">{title}</h1>
      {lead ? <p className="lead">{lead}</p> : null}
    </div>
    {end ? <div className="fx">{end}</div> : null}
  </div>
)

/* ---------------------------------------------------------------- *
 * Feedback: what a write did, said where the admin is looking
 * ---------------------------------------------------------------- */

export type Notice = {
  /** `ok` a write that went through, `bad` one that did not. */
  tone: 'ok' | 'bad'
  title: string
  body?: string
  /** Puts things back as they were; shown as a button on the toast. */
  undo?: () => void
}

const ToastContext = createContext<(notice: Notice) => void>(() => undefined)

/** Tell the admin what a write did. A failure stays until dismissed; a success leaves on its own. */
export const useToast = () => useContext(ToastContext)

const STAY_MS = 7000

/** Holds the toasts of the panel, bottom right, announced politely. Mounted once by the shell. */
export const ToastHost = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<(Notice & { id: number })[]>([])
  const next = useRef(0)
  const drop = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), [])
  const notify = useCallback(
    (notice: Notice) => {
      const id = ++next.current
      // at most three on screen: the oldest gives way
      setToasts((list) => [...list.slice(-2), { ...notice, id }])
      if (notice.tone === 'ok') setTimeout(() => drop(id), STAY_MS)
    },
    [drop],
  )
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            <div className="col-s grow">
              <span className="t4">{t.title}</span>
              {t.body ? <span className="sm">{t.body}</span> : null}
            </div>
            {t.undo ? (
              <button
                type="button"
                className="act"
                onClick={() => {
                  drop(t.id)
                  t.undo!()
                }}
              >
                Undo
              </button>
            ) : null}
            <button type="button" className="act mut" aria-label="Dismiss" onClick={() => drop(t.id)}>
              Close
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** What every classification write ends with, short enough for a toast. */
export const TWO_STEPS = 'Deck names change on their next read; /statistics after the next build.'

/**
 * One write at a time with feedback: `pending` is the id of the control that started it (so that
 * control can say "Approving…"), `flash` the id of what just changed (so its row lights up once).
 */
export const useAction = (reload: () => void) => {
  const toast = useToast()
  const [pending, setPending] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const run = (id: string, request: Promise<unknown>, done: Omit<Notice, 'tone'> & { flash?: string }) => {
    setPending(id)
    request.then(
      () => {
        setPending(null)
        setFlash(done.flash ?? null)
        if (done.flash) setTimeout(() => setFlash((was) => (was === done.flash ? null : was)), 1800)
        toast({ tone: 'ok', title: done.title, body: done.body, undo: done.undo })
        reload()
      },
      (e: unknown) => {
        setPending(null)
        toast({ tone: 'bad', title: "That didn't go through", body: panelErrorText(e) })
      },
    )
  }
  return { run, pending, busy: pending !== null, flash }
}

/** A text action of a table row that says what it is doing while its write runs. */
export const RowAction = ({ id, pending, label, doing, danger, onClick }: { id: string; pending: string | null; label: string; doing: string; danger?: boolean; onClick: () => void }) => (
  <button type="button" className={`act ${danger ? 'dz' : ''} ${pending === id ? 'busy' : ''}`} disabled={pending !== null} aria-busy={pending === id} onClick={onClick}>
    {pending === id ? doing : label}
  </button>
)
