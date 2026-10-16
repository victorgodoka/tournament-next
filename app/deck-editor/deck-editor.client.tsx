'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { fromYdke } from '@utils/deck/codecs/ydke'
import { canonicalId } from '@utils/deck/model'
import { pointsUsed, validate, type Problem } from '@utils/deck/rules'
import { DeckCodeError, type CardMap, type Deck, type Zone } from '@utils/deck/types'
import { getBanlists, type Banlist } from '@utils/wiki'
import { editorReducer, initialEditorState, type EditorState, type ViewMode } from './deck-editor.reducer'
import { DeckZone, type DragPayload } from './deck-zone'
import { draftKey, readDraft, writeDraft } from './drafts'
import { Toolbar } from './toolbar'
import { useCardCache } from './use-card-cache'

const ZONES: Zone[] = ['main', 'extra', 'side']
const VIEW_KEY = 'deck-view'
const VIEWS: ViewMode[] = ['grid', 'list', 'stacked']

const readView = (): ViewMode => {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    return VIEWS.includes(v as ViewMode) ? (v as ViewMode) : 'grid'
  } catch {
    return 'grid'
  }
}

/** Runs once (client only): `?d=` wins over the local draft; a damaged link opens an empty deck. */
const boot = (deckId: string | null): { state: EditorState; damaged: boolean; today: string } => {
  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD, local
  const load = (deck: Deck, name = '', format: number | null = null, revision: number | null = null) =>
    editorReducer(initialEditorState(), { type: 'load', deck, name, format, deckId, revision, dirty: true })

  // URLSearchParams turns an unencoded `+` into a space; base64 has no spaces, so put them back.
  const code = new URLSearchParams(window.location.search).get('d')?.replaceAll(' ', '+')
  if (code !== undefined) {
    try {
      return { state: load(fromYdke(code)), damaged: false, today }
    } catch (error) {
      if (!(error instanceof DeckCodeError)) throw error
      return { state: { ...initialEditorState(), deckId }, damaged: true, today }
    }
  }
  const draft = readDraft(draftKey(deckId))
  if (draft) return { state: load(draft.deck, draft.name, draft.format, draft.revision), damaged: false, today }
  return { state: { ...initialEditorState(), deckId }, damaged: false, today }
}

/** Every canonical card a problem names, as the deck passcodes that print it. */
const deckIdsOf = (deck: Deck, cards: CardMap, cardId: number): number[] =>
  [...deck.main, ...deck.extra, ...deck.side].filter((id) => {
    const card = cards.get(id)
    return (card ? canonicalId(card) : id) === cardId
  })

const ZONE_OF: Partial<Record<Problem['code'], Zone>> = { 'main-size': 'main', 'extra-size': 'extra', 'side-size': 'side' }

const DeckEditor = ({ deckId }: { deckId: string | null }) => {
  const t = useTranslations('DeckEditor')
  const [{ state: bootState, damaged, today }] = useState(() => boot(deckId))
  const [state, dispatch] = useReducer(editorReducer, bootState)
  const [notice, setNotice] = useState(damaged)
  const [banlists, setBanlists] = useState<Banlist[]>([])
  const [view, setView] = useState(readView)
  const { cards, ensure } = useCardCache()
  const { deck } = state

  useEffect(() => {
    getBanlists().then(setBanlists)
    // `?d=` is read once; left in the URL it would beat the draft on reload and drop the edits made since.
    const url = new URL(window.location.href)
    if (url.searchParams.has('d')) {
      url.searchParams.delete('d')
      window.history.replaceState(null, '', url)
    }
  }, [])

  useEffect(() => {
    ensure([...deck.main, ...deck.extra, ...deck.side]).catch(console.error)
  }, [deck, ensure])

  useEffect(() => {
    if (!state.dirty) return
    const timer = setTimeout(
      () => writeDraft(draftKey(deckId), { deck, name: state.name, format: state.format, revision: state.revision, at: Date.now() }),
      500,
    )
    return () => clearTimeout(timer)
  }, [deckId, deck, state.dirty, state.name, state.format, state.revision])

  // No format chosen yet: the TCG list.
  const banlist = banlists.find((b) => (state.format === null ? b.format === 'tcg' : b.id === state.format)) ?? null
  const problems = useMemo(() => validate(deck, cards, banlist, today), [deck, cards, banlist, today])
  const flagged = useMemo(() => new Set(problems.flatMap((p) => (p.cardId === undefined ? [] : deckIdsOf(deck, cards, p.cardId)))), [problems, deck, cards])
  const points = banlist && banlist.pointCap !== null ? { used: pointsUsed(deck, cards, banlist), cap: banlist.pointCap } : null

  const changeView = (next: ViewMode) => {
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {}
  }

  const jump = (problem: Problem) => {
    const id = problem.cardId === undefined ? undefined : deckIdsOf(deck, cards, problem.cardId)[0]
    const target =
      id !== undefined ? document.querySelector(`[data-card="${id}"]`) : document.getElementById(`zone-${ZONE_OF[problem.code] ?? 'main'}`)
    target?.scrollIntoView({ block: 'center' })
    target?.querySelector('button')?.focus({ preventScroll: true })
  }

  const dropCard = (to: Zone) => (payload: DragPayload, index?: number) => {
    if (payload.from === to) {
      if (payload.index !== undefined) dispatch({ type: 'reorder', zone: to, from: payload.index, to: index ?? deck[to].length - 1 })
    } else if (payload.from === 'pool') {
      const card = cards.get(payload.id)
      if (card) dispatch({ type: 'add', card, cards, zone: to })
    } else dispatch({ type: 'move', from: payload.from, id: payload.id, to, cards })
  }

  const rejectedName = state.rejected && (cards.get(state.rejected.cardId)?.name ?? String(state.rejected.cardId))

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,62fr)_minmax(0,38fr)]">
      <div className="flex flex-col gap-4 px-4 pb-8 lg:h-[calc(100dvh-var(--header-h,64px))] lg:overflow-y-auto">
        <div className="sticky top-0 z-(--z-sticky) border-b border-line bg-space-000 py-3">
          <Toolbar
            name={state.name}
            onRename={(name) => dispatch({ type: 'rename', name })}
            banlists={banlists}
            banlist={banlist}
            onFormat={(format) => dispatch({ type: 'format', format })}
            problems={problems}
            nameOf={(cardId) => {
              const id = deckIdsOf(deck, cards, cardId)[0] ?? cardId
              return cards.get(id)?.name ?? String(cardId)
            }}
            onJump={jump}
            points={points}
            canUndo={state.past.length > 0}
            canRedo={state.future.length > 0}
            onUndo={() => dispatch({ type: 'undo' })}
            onRedo={() => dispatch({ type: 'redo' })}
            onSort={() => dispatch({ type: 'sort', cards })}
            view={view}
            onView={changeView}
            dirty={state.dirty}
            onSave={() => {}} // Task 12
          />
        </div>

        {notice ? (
          <Alert tone="warn" edged title={t('damagedLink')} action={<Button variant="ghost" size="sm" onClick={() => setNotice(false)}>{t('dismiss')}</Button>} />
        ) : null}

        {ZONES.map((zone) => (
          <DeckZone
            key={zone}
            zone={zone}
            ids={deck[zone]}
            cards={cards}
            view={view}
            problems={flagged}
            onRemove={(id) => dispatch({ type: 'remove', zone, id })}
            onDropCard={dropCard(zone)}
            onOpen={() => {}} // detail sheet: a later task
          />
        ))}

        <p aria-live="polite" className="sr-only">
          {state.rejected && rejectedName ? t(`rejected.${state.rejected.reason}`, { name: rejectedName }) : null}
        </p>
      </div>

      {/* Card pool: Task 10. */}
      <div className="max-lg:hidden" />
    </div>
  )
}

export default DeckEditor
