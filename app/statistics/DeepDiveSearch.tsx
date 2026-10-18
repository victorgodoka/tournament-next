'use client'

/**
 * Section 05's search: any archetype of the season, not only the ones the page ships. A deck outside
 * the page's data is read from the API; if nobody calculated it yet, a signed-in viewer can start it.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@hooks/index'
import { Button } from '@ui/button'
import { Lookup, type LookupOption } from '@ui/lookup'
import { Panel } from '@ui/panel'
import { getArchetypeIndex, getDeepDive, requestDeepDive, type DeepDiveState, type IndexEntry, type Statistics } from '@utils/statistics'
import { DeepDive, NOTE, nameOf, num } from './DeepDive'

/* Cheap read of a job's state: the sooner it comes back `ready`, the sooner the card shows. */
const POLL_MS = 1000
const SUFFIX = ['th', 'st', 'nd', 'rd']
export const ordinal = (n: number) => n + (SUFFIX[((n % 100) - 20) % 10] ?? SUFFIX[n % 100] ?? 'th')
export const hhmm = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const isActive = (s: DeepDiveState | null) => s?.status === 'queued' || s?.status === 'running'
const option = (e: IndexEntry): LookupOption => ({
  key: e.archetype.join('-'),
  label: nameOf(e),
  meta: `${num(e.games)} deck-games · ${e.ready ? 'Ready' : 'Needs calculation'}`,
})

type Picked = { archetype: number[]; name: string }

/** Covers the page while a pick loads or calculates. `Cancel` only stops waiting: a running job still finishes server-side. */
export const Overlay = ({ title, detail, onCancel }: { title: string; detail?: string; onCancel: () => void }) => (
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
 */
export const DeepDiveSearch = ({ season, onLocal, onRemote, onBusy }: {
  season: Statistics['season']
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
  const index = useRef<{ code: string; promise: Promise<IndexEntry[]> } | null>(null)
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
  const busy = picked !== null && failed === null && (state === null || active)
  useEffect(() => busyRef.current(busy), [busy])
  useEffect(() => {
    if (!active) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [active])

  /* The index loads on the first search and stays for the season; a failed load is forgotten so the next search retries. */
  const search = useCallback(
    async (text: string) => {
      if (index.current?.code !== code) index.current = { code, promise: getArchetypeIndex(code) }
      const { promise } = index.current
      try {
        const entries = await promise
        setIndexFailed(false)
        const q = text.toLowerCase()
        return entries.filter((e) => nameOf(e).toLowerCase().includes(q)).slice(0, 20).map(option)
      } catch {
        if (index.current?.promise === promise) index.current = null
        setIndexFailed(true)
        return []
      }
    },
    [code],
  )

  /** Runs `first`, then polls while the job is queued or running. A `missing` answer ends the poll. */
  const run = (archetype: number[], first: (signal: AbortSignal) => Promise<DeepDiveState>, shown: DeepDiveState | null) => {
    const signal = restart()
    setFailed(null)
    setState(shown)
    const step = (req: Promise<DeepDiveState>) =>
      req.then(
        (s) => {
          if (signal.aborted) return
          setState(s)
          if (s.status === 'queued' || s.status === 'running') timer.current = setTimeout(() => step(getDeepDive(code, archetype, signal)), POLL_MS)
        },
        (e: { status?: number }) => {
          if (!signal.aborted) setFailed(e?.status ?? 0)
        },
      )
    step(first(signal))
  }

  const load = (p: Picked) => run(p.archetype, (signal) => getDeepDive(code, p.archetype, signal), null)
  const calculate = (p: Picked) => run(p.archetype, () => requestDeepDive(code, p.archetype), { status: 'running' })

  const cancel = () => {
    restart()
    setPicked(null)
    setState(null)
    setFailed(null)
    onRemote(false)
  }

  const onPick = ({ key, label }: LookupOption) => {
    if (onLocal(String(key))) return cancel()
    const next = { archetype: String(key).split('-').map(Number), name: String(label) }
    setPicked(next)
    onRemote(true)
    load(next)
  }

  return (
    <div className="mb-6 flex flex-col gap-4">
      <Lookup label="Search any archetype" placeholder="Search any archetype" search={search} onPick={onPick} className="max-w-md" />
      {indexFailed ? (
        <p className={NOTE} role="status">The archetype list isn&apos;t available right now. Try again in a moment.</p>
      ) : null}
      {picked ? (
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
    </div>
  )
}
