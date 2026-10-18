'use client'

/**
 * Section 06's search: any card of the season, not only the ones the list ships. A card outside the
 * list is read from the API; if nobody calculated it yet, a signed-in viewer can start it. Same flow
 * as the archetype search (DeepDiveSearch), on the same server queue.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@hooks/index'
import { Button } from '@ui/button'
import { Lookup, type LookupOption } from '@ui/lookup'
import { Panel } from '@ui/panel'
import { getCard, requestCard, searchCards, type CardState, type MostUsedCard, type Statistics } from '@utils/statistics'
import { NOTE, pct } from './DeepDive'
import { hhmm, ordinal, Overlay } from './DeepDiveSearch'

const POLL_MS = 1000
type Picked = { id: number; name: string }

/** Everything but `ready`, which hands the card to the page's panel. `signedIn`: `undefined` while auth loads. */
const Result = ({ name, state, failed, signedIn, onLoad, onCalculate, onCancel }: {
  name: string
  state: CardState | null
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
            <p className="text-ink-dim body">This card has no games in the season.</p>
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
      return null
    case 'missing':
      if (signedIn === undefined) return null
      return (
        <Panel title="Not calculated yet" meta={name}>
          <div className="flex flex-col items-start gap-4">
            <p className="text-ink-dim body">
              {name} is outside the list, so nobody has calculated it yet.
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
            {state.retryAt ? `5 new card calculations an hour. Try again at ${hhmm(state.retryAt)}` : 'Too many requests. Try again in a minute.'}
          </p>
        </Panel>
      )
  }
}

/**
 * `onLocal(id)`: the page shows a card already in its list and answers true. `onCard`: a card read
 * from the API for the page's panel; `null` when the search lets go of it.
 */
export const CardSearch = ({ season, onLocal, onCard }: {
  season: Statistics['season']
  onLocal: (id: number) => boolean
  onCard: (card: MostUsedCard | null) => void
}) => {
  const { user } = useAuth()
  const code = season.code
  const [picked, setPicked] = useState<Picked | null>(null)
  const [state, setState] = useState<CardState | null>(null)
  const [failed, setFailed] = useState<number | null>(null)
  const [searchFailed, setSearchFailed] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const restart = () => {
    controller.current?.abort()
    clearTimeout(timer.current)
    controller.current = new AbortController()
    return controller.current.signal
  }

  /* A season switch remounts this search empty: the page's panel lets go of the old season's card. */
  const cardRef = useRef(onCard)
  useEffect(() => {
    cardRef.current = onCard
  })
  useEffect(
    () => () => {
      controller.current?.abort()
      clearTimeout(timer.current)
      cardRef.current(null)
    },
    [],
  )

  const active = failed === null && (state?.status === 'queued' || state?.status === 'running')
  useEffect(() => {
    if (!active) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [active])

  /* The server matches by name; the field asks from two characters on. */
  const search = useCallback(
    async (text: string, signal: AbortSignal): Promise<LookupOption[]> => {
      if (text.trim().length < 2) return []
      try {
        const cards = await searchCards(code, text, signal)
        setSearchFailed(false)
        return cards.map((c) => ({
          key: c.id,
          label: c.name ?? `#${c.id}`,
          meta: `${pct(c.popularity)} popularity · ${c.ready ? 'Ready' : 'Needs calculation'}`,
        }))
      } catch {
        if (!signal.aborted) setSearchFailed(true)
        return []
      }
    },
    [code],
  )

  /** Runs `first`, then polls while the job is queued or running; `ready` goes to the page's panel. */
  const run = (id: number, first: (signal: AbortSignal) => Promise<CardState>, shown: CardState | null) => {
    const signal = restart()
    setFailed(null)
    setState(shown)
    const step = (req: Promise<CardState>) =>
      req.then(
        (s) => {
          if (signal.aborted) return
          setState(s)
          if (s.status === 'ready') onCard(s.card)
          if (s.status === 'queued' || s.status === 'running') timer.current = setTimeout(() => step(getCard(code, id, signal)), POLL_MS)
        },
        (e: { status?: number }) => {
          if (!signal.aborted) setFailed(e?.status ?? 0)
        },
      )
    step(first(signal))
  }

  const load = (p: Picked) => run(p.id, (signal) => getCard(code, p.id, signal), null)
  const calculate = (p: Picked) => run(p.id, () => requestCard(code, p.id), { status: 'running' })

  const cancel = () => {
    restart()
    setPicked(null)
    setState(null)
    setFailed(null)
  }

  const onPick = ({ key, label }: LookupOption) => {
    const id = Number(key)
    onCard(null)
    if (onLocal(id)) return cancel()
    const next = { id, name: String(label) }
    setPicked(next)
    load(next)
  }

  return (
    <div className="flex flex-col gap-4">
      <Lookup label="Search any card" placeholder="Search any card" search={search} onPick={onPick} className="max-w-md" />
      {searchFailed ? <p className={NOTE} role="status">The card search isn&apos;t available right now. Try again in a moment.</p> : null}
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
