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

const POLL_MS = 3000
const SUFFIX = ['th', 'st', 'nd', 'rd']
const ordinal = (n: number) => n + (SUFFIX[((n % 100) - 20) % 10] ?? SUFFIX[n % 100] ?? 'th')
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const isActive = (s: DeepDiveState | null) => s?.status === 'queued' || s?.status === 'running'
const option = (e: IndexEntry): LookupOption => ({
  key: e.archetype.join('-'),
  label: nameOf(e),
  meta: `${num(e.games)} deck-games · ${e.ready ? 'Ready' : 'Needs calculation'}`,
})

type Picked = { archetype: number[]; name: string }

/** What the pick shows below the field. `signedIn`: `undefined` while auth loads, `false` for a guest. */
const Result = ({ name, state, failed, signedIn, onLoad, onCalculate }: {
  name: string
  state: DeepDiveState | null
  failed: boolean
  signedIn: boolean | undefined
  onLoad: () => void
  onCalculate: () => void
}) => {
  if (failed)
    return (
      <Panel title={name} meta="Couldn't read it">
        <div className="flex flex-col items-start gap-4">
          <p className="text-ink-dim body">The game server didn&apos;t answer. Try again in a moment.</p>
          <Button size="sm" variant="secondary" onClick={onLoad}>Retry</Button>
        </div>
      </Panel>
    )
  if (!state) return <p className={NOTE} role="status">Loading {name}…</p>
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
        <Panel title={name} meta={state.status === 'queued' ? `${ordinal(state.position)} in line` : 'Calculating'}>
          <p className="text-ink-dim body" role="status">
            Calculating {name}. This adds up the whole season and can take up to a minute. Keep this page open.
          </p>
        </Panel>
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

export const DeepDiveSearch = ({ season, onLocal }: { season: Statistics['season']; onLocal: (key: string) => boolean }) => {
  const { user } = useAuth()
  const code = season.code
  const [picked, setPicked] = useState<Picked | null>(null)
  const [state, setState] = useState<DeepDiveState | null>(null)
  const [failed, setFailed] = useState(false)
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

  useEffect(
    () => () => {
      controller.current?.abort()
      clearTimeout(timer.current)
    },
    [],
  )

  /* Leaving mid-calculation loses the poll, not the job; still, ask first. */
  const active = isActive(state)
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
    setFailed(false)
    setState(shown)
    const step = (req: Promise<DeepDiveState>) =>
      req.then(
        (s) => {
          if (signal.aborted) return
          setState(s)
          if (s.status === 'queued' || s.status === 'running') timer.current = setTimeout(() => step(getDeepDive(code, archetype, signal)), POLL_MS)
        },
        () => {
          if (!signal.aborted) setFailed(true)
        },
      )
    step(first(signal))
  }

  const load = (p: Picked) => run(p.archetype, (signal) => getDeepDive(code, p.archetype, signal), null)
  const calculate = (p: Picked) => run(p.archetype, () => requestDeepDive(code, p.archetype), { status: 'running' })

  const onPick = ({ key, label }: LookupOption) => {
    if (onLocal(String(key))) {
      restart()
      setPicked(null)
      setState(null)
      setFailed(false)
      return
    }
    const next = { archetype: String(key).split('-').map(Number), name: String(label) }
    setPicked(next)
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
        />
      ) : null}
    </div>
  )
}
