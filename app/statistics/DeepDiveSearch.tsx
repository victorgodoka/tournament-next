'use client'

/**
 * Section 05's search: any archetype of the season, not only the ones the page ships. A deck outside
 * the page's data is read from the API; if nobody calculated it yet, a signed-in viewer can start it.
 */

import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { useAuth } from '@hooks/index'
import { Button } from '@ui/button'
import { Tag } from '@ui/chip'
import { Segmented } from '@ui/choice'
import { Lookup, type LookupOption } from '@ui/lookup'
import { Panel } from '@ui/panel'
import { archKey, getArchetypeIndex, getDeepDive, requestDeepDive, type DeepDiveMode, type DeepDiveState, type IndexEntry, type Statistics } from '@utils/statistics'
import { DeepDive, NOTE, nameOf, num } from './DeepDive'

/* Cheap read of a job's state: the sooner it comes back `ready`, the sooner the card shows. */
const POLL_MS = 1000
/** Archetype chips a mode shows. */
export const PICKS = 8
const MODES = [
  { value: 'general', label: 'General' },
  { value: 'pure', label: 'Pure' },
  { value: 'combined', label: 'Combined' },
] as const
const SUFFIX = ['th', 'st', 'nd', 'rd']
const ordinal = (n: number) => n + (SUFFIX[((n % 100) - 20) % 10] ?? SUFFIX[n % 100] ?? 'th')
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const isActive = (s: DeepDiveState | null) => s?.status === 'queued' || s?.status === 'running'
const option = (e: IndexEntry): LookupOption => ({
  key: e.archetype.join('-'),
  label: nameOf(e),
  meta: `${num(e.games)} deck-games · ${e.ready ? 'Ready' : 'Needs calculation'}`,
})
const match = (text: string, entries: IndexEntry[]) => {
  const q = text.toLowerCase()
  return entries.filter((e) => nameOf(e).toLowerCase().includes(q)).slice(0, 20)
}

/** `quiet`: opened by the search itself, so it loads without the Overlay. */
type Picked = { mode: DeepDiveMode; archetype: number[]; name: string; quiet?: boolean }
/** An archetype to open from outside (section 03). A new `nonce` sets the mode and loads it like a search pick. */
export type DeepDiveRequest = { mode: DeepDiveMode; archetype: number[]; name: string; nonce: number }

/** Covers the page while a pick loads or calculates. `Cancel` only stops waiting: a running job still finishes server-side. */
const Overlay = ({ title, detail, onCancel }: { title: string; detail?: string; onCancel: () => void }) => (
  <div role="status" aria-live="polite" className="fixed inset-0 z-(--z-overlay) flex flex-col items-center justify-center gap-6 bg-scrim px-gutter text-center">
    <span className="equalizer-bars scale-200" aria-hidden>
      <span className="equalizer-bars__bar" />
      <span className="equalizer-bars__bar" />
      <span className="equalizer-bars__bar" />
      <span className="equalizer-bars__bar" />
    </span>
    <p className="mt-4 text-ink display-3">{title}</p>
    {detail ? <p className="max-w-[52ch] text-ink-dim body">{detail}</p> : null}
    <Button size="sm" variant="secondary" onClick={onCancel}>Cancel</Button>
  </div>
)

/** What the pick shows below the field. `signedIn`: `undefined` while auth loads, `false` for a guest. */
const Result = ({ name, state, failed, signedIn, onLoad, onCalculate, onCancel }: {
  name: string
  state: DeepDiveState | null
  failed: number | null
  signedIn: boolean | undefined
  onLoad: () => void
  onCalculate: () => void
  onCancel: () => void
}) => {
  if (failed !== null)
    return (
      <Panel title={name} meta="Couldn't read it">
        <div className="flex flex-col items-start gap-4">
          {failed === 401 ? (
            <>
              <p className="text-ink-dim body">Your session expired. Sign in again.</p>
              <Button size="sm" variant="secondary" href="/login">Sign in</Button>
            </>
          ) : failed === 404 ? (
            <p className="text-ink-dim body">Not enough games for this deck anymore.</p>
          ) : (
            <>
              <p className="text-ink-dim body">The game server didn&apos;t answer. Try again in a moment.</p>
              <Button size="sm" variant="secondary" onClick={onLoad}>Retry</Button>
            </>
          )}
        </div>
      </Panel>
    )
  if (!state) return <Overlay title={`Loading ${name}`} onCancel={onCancel} />
  switch (state.status) {
    case 'ready':
      return <DeepDive archetype={state.archetype} rank={state.archetype.rank} />
    case 'missing':
      if (signedIn === undefined) return null
      return (
        <Panel title="Not calculated yet" meta={name}>
          <div className="flex flex-col items-start gap-4">
            <p className="text-ink-dim body">
              {name} is outside the season build, so nobody has calculated it yet.
              {signedIn ? ' Calculating adds up the whole season and can take up to a minute.' : ''}
            </p>
            {signedIn ? (
              <Button size="sm" onClick={onCalculate}>Calculate</Button>
            ) : (
              <Button size="sm" variant="secondary" href="/login">Sign in to calculate</Button>
            )}
          </div>
        </Panel>
      )
    case 'queued':
    case 'running':
      return (
        <Overlay
          title={state.status === 'queued' ? `${name}: ${ordinal(state.position)} in line` : `Calculating ${name}`}
          detail="This adds up the whole season and can take up to a minute. Cancel stops waiting; the calculation still finishes and is ready next time."
          onCancel={onCancel}
        />
      )
    case 'failed':
      return (
        <Panel title={name} meta="Failed">
          <div className="flex flex-col items-start gap-4">
            <p className="text-ink-dim body">{state.error}</p>
            <Button size="sm" variant="secondary" onClick={onCalculate}>Retry</Button>
          </div>
        </Panel>
      )
    case 'limited':
      return (
        <Panel title={name} meta="Limit reached">
          <p className="text-ink-dim body">
            {state.retryAt ? `5 new calculations an hour. Try again at ${hhmm(state.retryAt)}` : 'Too many requests. Try again in a minute.'}
          </p>
        </Panel>
      )
  }
}

/**
 * `onRemote(true)` while a pick outside the page's data is shown (the page hides its own deep dive then);
 * `onBusy(true)` while that pick loads or calculates (the page hides its archetype chips then).
 * `mode` lives in the page, so a remount of this search keeps it. `onLocal` is only asked in `pure`.
 */
export const DeepDiveSearch = ({ season, mode, onMode, request, onLocal, onRemote, onBusy }: {
  season: Statistics['season']
  mode: DeepDiveMode
  onMode: (mode: DeepDiveMode) => void
  request: DeepDiveRequest | null
  onLocal: (key: string) => boolean
  onRemote: (active: boolean) => void
  onBusy: (busy: boolean) => void
}) => {
  const { user } = useAuth()
  const code = season.code
  const [picked, setPicked] = useState<Picked | null>(null)
  const [state, setState] = useState<DeepDiveState | null>(null)
  const [failed, setFailed] = useState<number | null>(null)
  const [indexFailed, setIndexFailed] = useState(false)
  /* Combined: the chosen lead, so Second only offers pairs that exist. */
  const [lead, setLead] = useState<{ code: number; name: string } | null>(null)
  /* General and Combined chips: the mode's index, once loaded. */
  /* `frozen`: the General index is empty, the season was frozen before modes. */
  const [list, setList] = useState<{ mode: DeepDiveMode; entries: IndexEntry[]; frozen: boolean } | null>(null)
  /* One index per `${code}:${mode}`, kept for the season; a failed load is forgotten so the next read retries. */
  const indexes = useRef(new Map<string, Promise<IndexEntry[]>>())
  const controller = useRef<AbortController | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  /** Cancels whatever is in flight and hands out the signal of the next pick. */
  const restart = () => {
    controller.current?.abort()
    clearTimeout(timer.current)
    controller.current = new AbortController()
    return controller.current.signal
  }

  /* The latest `onRemote`, for the unmount below: a season switch remounts this search empty, so the page's deep dive must come back. */
  const remote = useRef(onRemote)
  const busyRef = useRef(onBusy)
  useEffect(() => {
    remote.current = onRemote
    busyRef.current = onBusy
  })

  useEffect(
    () => () => {
      controller.current?.abort()
      clearTimeout(timer.current)
      remote.current(false)
      busyRef.current(false)
    },
    [],
  )

  /* Leaving mid-calculation loses the poll, not the job; still, ask first. */
  const active = failed === null && isActive(state)
  const busy = picked !== null && failed === null && ((state === null && !picked.quiet) || active)
  useEffect(() => busyRef.current(busy), [busy])
  useEffect(() => {
    if (!active) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [active])

  const indexOf = useCallback(
    (m: DeepDiveMode) => {
      const key = `${code}:${m}`
      const cached = indexes.current.get(key)
      if (cached) return cached
      const promise = getArchetypeIndex(code, m)
      indexes.current.set(key, promise)
      promise.catch(() => {
        if (indexes.current.get(key) === promise) indexes.current.delete(key)
      })
      return promise
    },
    [code],
  )

  /** The mode's index, or `null` when it can't be read (the note says so). */
  const read = useCallback(
    (m: DeepDiveMode) =>
      indexOf(m).then(
        (entries) => (setIndexFailed(false), entries),
        () => (setIndexFailed(true), null),
      ),
    [indexOf],
  )

  /*
   * General and Combined open on their first chip, quietly, until the viewer picks or cancels (a mode switch
   * allows it again). An empty General index on the first read is a season frozen before modes: go to Pure.
   */
  const auto = useRef(true)
  const opened = useRef(false)

  const search = useCallback(async (text: string) => match(text, (await read(mode)) ?? []).map(option), [mode, read])

  /* A lead's name is its General row: General A holds every A>X, so each lead has one. */
  const searchLead = useCallback(
    async (text: string) => {
      const [general, combined] = await Promise.all([read('general'), read('combined')])
      const mixes = new Map<number, number>()
      for (const e of combined ?? []) mixes.set(e.archetype[0]!, (mixes.get(e.archetype[0]!) ?? 0) + 1)
      return match(text, (general ?? []).filter((e) => mixes.has(e.archetype[0]!))).map((e) => {
        const n = mixes.get(e.archetype[0]!)!
        return { key: e.archetype[0]!, label: nameOf(e), meta: `${n} ${n === 1 ? 'mix' : 'mixes'}` }
      })
    },
    [read],
  )

  /* Second lists the lead's pairs by their second name: "A with B" shows as B. */
  const searchSecond = useCallback(
    async (text: string) => {
      if (!lead) return []
      const prefix = `${lead.name} with `
      const pairs = ((await read('combined')) ?? [])
        .filter((e) => e.archetype[0] === lead.code)
        .map((e) => ({ ...e, name: e.name?.startsWith(prefix) ? e.name.slice(prefix.length) : e.name }))
      return match(text, pairs).map(option)
    },
    [lead, read],
  )

  /** Runs `first`, then polls while the job is queued or running. A `missing` answer ends the poll. */
  const run = ({ mode, archetype }: Picked, first: (signal: AbortSignal) => Promise<DeepDiveState>, shown: DeepDiveState | null) => {
    const signal = restart()
    setFailed(null)
    setState(shown)
    const step = (req: Promise<DeepDiveState>) =>
      req.then(
        (s) => {
          if (signal.aborted) return
          setState(s)
          if (s.status === 'queued' || s.status === 'running') timer.current = setTimeout(() => step(getDeepDive(code, mode, archetype, signal)), POLL_MS)
        },
        (e: { status?: number }) => {
          if (!signal.aborted) setFailed(e?.status ?? 0)
        },
      )
    step(first(signal))
  }

  const load = (p: Picked) => run(p, (signal) => getDeepDive(code, p.mode, p.archetype, signal), null)
  const calculate = (p: Picked) => run(p, () => requestDeepDive(code, p.mode, p.archetype), { status: 'running' })

  const cancel = () => {
    auto.current = false
    restart()
    setPicked(null)
    setState(null)
    setFailed(null)
    onRemote(false)
  }

  /** Search picks, chips and requests all land here. A pure deck the page ships shows the page's own row. */
  const choose = (m: DeepDiveMode, archetype: number[], name: string) => {
    auto.current = false
    if (m === 'pure' && onLocal(archKey(archetype))) return cancel()
    const next = { mode: m, archetype, name }
    setPicked(next)
    onRemote(true)
    load(next)
  }

  const onPick = ({ key, label }: LookupOption) => choose(mode, String(key).split('-').map(Number), String(label))

  /** A mode change stops waiting on the pick (its job, if any, still finishes server-side) and clears it. */
  const switchMode = (m: DeepDiveMode) => {
    if (m === mode) return
    cancel()
    auto.current = true
    setLead(null)
    onMode(m)
  }

  const autoPick = useEffectEvent((m: DeepDiveMode, entries: IndexEntry[]) => {
    const first = !opened.current
    opened.current = true
    if (!entries.length) return void (first && m === 'general' && onMode('pure'))
    if (!auto.current || picked) return
    const next = { mode: m, archetype: entries[0]!.archetype, name: nameOf(entries[0]!), quiet: true }
    setPicked(next)
    onRemote(true)
    load(next)
  })

  /* Pure chips are the page's; General and Combined read their index as soon as the mode shows. */
  useEffect(() => {
    if (mode === 'pure') return
    let live = true
    Promise.all([indexOf(mode), indexOf('general')]).then(
      ([entries, general]) => {
        if (!live) return
        setIndexFailed(false)
        setList({ mode, entries, frozen: !general.length })
        autoPick(mode, entries)
      },
      () => live && setIndexFailed(true),
    )
    return () => {
      live = false
    }
  }, [mode, indexOf])

  /* A request already there at mount was handled before the remount (a chip click or a new season remounts this search). */
  const handled = useRef(request?.nonce)
  const onRequest = useEffectEvent((r: DeepDiveRequest) => {
    if (r.mode !== mode) {
      setLead(null)
      onMode(r.mode)
    }
    choose(r.mode, r.archetype, r.name)
  })
  useEffect(() => {
    if (!request || request.nonce === handled.current) return
    handled.current = request.nonce
    onRequest(request)
  }, [request])

  const entries = mode !== 'pure' && list?.mode === mode ? list.entries : null
  const chips = entries?.slice(0, PICKS) ?? []

  return (
    <div className="mb-6 flex flex-col gap-4">
      <Segmented label="Deep dive mode" options={MODES} value={mode} onChange={switchMode} />
      {entries && !entries.length ? (
        <p className={NOTE} role="status">
          {list?.frozen ? 'This season was frozen before General and Combined existed.' : 'No mixed decks with enough games yet.'}
        </p>
      ) : mode === 'combined' ? (
        <div className="flex flex-wrap items-center gap-4">
          {lead ? (
            <Tag note="Lead" onRemove={() => setLead(null)} removeLabel="Clear the lead">{lead.name}</Tag>
          ) : (
            <Lookup label="Lead" placeholder="Search the lead archetype" search={searchLead} onPick={({ key, label }) => setLead({ code: Number(key), name: String(label) })} className="w-full max-w-md" />
          )}
          {lead ? <Lookup label="Second" placeholder="Search the second archetype" search={searchSecond} onPick={({ key, label }) => choose('combined', String(key).split('-').map(Number), `${lead.name} with ${label}`)} className="w-full max-w-md" /> : null}
        </div>
      ) : (
        /* Keyed by mode: each mode starts a fresh search, and a slow answer of the other mode can't land here. */
        <Lookup key={mode} label="Search any archetype" placeholder="Search any archetype" search={search} onPick={onPick} className="max-w-md" />
      )}
      {indexFailed ? (
        <p className={NOTE} role="status">The archetype list isn&apos;t available right now. Try again in a moment.</p>
      ) : null}
      {picked?.quiet && !state && failed === null ? (
        <p className={NOTE} role="status">Loading {picked.name}…</p>
      ) : picked ? (
        <Result
          name={picked.name}
          state={state}
          failed={failed}
          signedIn={user === undefined ? undefined : user !== null}
          onLoad={() => load(picked)}
          onCalculate={() => calculate(picked)}
          onCancel={cancel}
        />
      ) : null}
      {chips.length && !busy ? (
        <Segmented
          label="Archetype"
          /* A chip stays inside a 375px screen: "A with B" pairs run long. */
          options={chips.map((e) => ({ value: archKey(e.archetype), label: <span title={nameOf(e)} className="block max-w-72 truncate">{nameOf(e)}</span> }))}
          value={picked ? archKey(picked.archetype) : ''}
          onChange={(key) => choose(mode, key.split('-').map(Number), nameOf(chips.find((e) => archKey(e.archetype) === key)!))}
        />
      ) : null}
    </div>
  )
}
