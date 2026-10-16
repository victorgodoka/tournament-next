'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { fromYdke } from '@utils/deck/codecs/ydke'
import { addCard, canonicalId, printOf } from '@utils/deck/model'
import { pointsUsed, validate, type Problem } from '@utils/deck/rules'
import { DeckCodeError, type CardData, type CardMap, type Deck, type Zone } from '@utils/deck/types'
import { getBanlists, type Banlist } from '@utils/wiki'
import { CardDetail } from './card-detail'
import { CardPool } from './card-pool'
import { shakeTiles } from './card-tile'
import { editorReducer, initialEditorState, type EditorState, type ViewMode } from './deck-editor.reducer'
import { DeckTray } from './deck-tray'
import { DeckZone, type DragPayload } from './deck-zone'
import { draftKey, readDraft, writeDraft, type Draft } from './drafts'
import { HoverPreview } from './hover-preview'
import { useEditorKeys } from './keyboard'
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
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` // local date
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

const flushDraft = (unsaved: React.RefObject<{ key: string; draft: Draft } | null>) => {
  if (!unsaved.current) return
  writeDraft(unsaved.current.key, unsaved.current.draft)
  unsaved.current = null
}

const ZONE_OF: Partial<Record<Problem['code'], Zone>> = { 'main-size': 'main', 'extra-size': 'extra', 'side-size': 'side' }

/** Tailwind's `lg`: the two-column editor. Below it, the pool and the deck tray. */
const WIDE = '(min-width: 1024px)'
const watchWide = (onChange: () => void) => {
  const query = matchMedia(WIDE)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
const useWide = () => useSyncExternalStore(watchWide, () => matchMedia(WIDE).matches)

const DeckEditor = ({ deckId }: { deckId: string | null }) => {
  const t = useTranslations('DeckEditor')
  const [{ state: bootState, damaged, today }] = useState(() => boot(deckId))
  const [state, dispatch] = useReducer(editorReducer, bootState)
  const [notice, setNotice] = useState(damaged)
  /** `null` while loading; `[]` when the API failed (getBanlists swallows the error). */
  const [banlists, setBanlists] = useState<Banlist[] | null>(null)
  const [view, setView] = useState(readView)
  const { cards, failed, isPending, remember, ensure } = useCardCache()
  const [detail, setDetail] = useState<{ card: CardData; art: number } | null>(null)
  const wide = useWide()
  const [trayTab, setTrayTab] = useState<Zone>('main')
  const { deck } = state
  const allIds = useMemo(() => [...deck.main, ...deck.extra, ...deck.side], [deck])
  /** The draft the debounce hasn't written yet, flushed on unmount and pagehide so closing the tab keeps it. */
  const unsaved = useRef<{ key: string; draft: Draft } | null>(null)

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
    ensure(allIds).catch(console.error)
  }, [allIds, ensure])

  useEffect(() => {
    if (!state.dirty) return
    unsaved.current = {
      key: draftKey(deckId),
      draft: { deck, name: state.name, format: state.format, revision: state.revision, at: Date.now() },
    }
    const timer = setTimeout(() => flushDraft(unsaved), 500)
    return () => clearTimeout(timer)
  }, [deckId, deck, state.dirty, state.name, state.format, state.revision])

  useEffect(() => {
    const flush = () => flushDraft(unsaved)
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [])

  // No format chosen yet: the TCG list.
  const banlist = banlists?.find((b) => (state.format === null ? b.format === 'tcg' : b.id === state.format)) ?? null
  const problems = useMemo(
    () =>
      // A card still loading, or whose lookup failed, isn't "not found": that verdict waits for an answer.
      validate(deck, cards, banlist, today).filter((p) => !(p.code === 'unknown-card' && (isPending(p.cardId!) || failed.has(p.cardId!)))),
    [deck, cards, banlist, today, isPending, failed],
  )
  const checking = banlists === null || allIds.some(isPending)
  const lookupFailed = allIds.some((id) => failed.has(id))
  const validity = checking ? 'checking' : banlists.length ? 'ready' : 'unavailable'
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
    const zone = id !== undefined ? ZONES.find((z) => deck[z].includes(id)) : (ZONE_OF[problem.code] ?? 'main')
    // The tray shows one zone at a time: switch to the card's before looking for it.
    if (!wide && zone) flushSync(() => setTrayTab(zone))
    const target = id !== undefined ? document.querySelector(`section[data-zone] [data-card="${id}"]`) : document.getElementById(`zone-${zone}`)
    target?.scrollIntoView({ block: 'center' })
    target?.querySelector('button')?.focus({ preventScroll: true })
  }

  /** A refused add shakes the card's tiles; the live region below says why. */
  const add = (card: CardData, zone?: Zone) => {
    if (!cards.has(card.id)) remember([card]) // an artwork picked in the detail sheet
    if (addCard(deck, card, cards, zone).rejected) shakeTiles(card.id)
    dispatch({ type: 'add', card, cards, zone })
  }

  const open = (id: number) => {
    const card = cards.get(id)
    if (card) setDetail({ card, art: id })
  }

  useEditorKeys({
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    act: (shortcut, tile) => {
      const card = cards.get(tile.id)
      const zone = ZONES.find((z) => z === tile.zone) // undefined in the pool
      if (!card) return
      if (shortcut === 'open') open(tile.id)
      else if (shortcut === 'add') add(printOf(card, tile.id), zone)
      else if (shortcut === 'side') add(printOf(card, tile.id), 'side')
      else {
        const from = zone ?? ZONES.find((z) => deck[z].includes(tile.id))
        if (from) dispatch({ type: 'remove', zone: from, id: tile.id })
      }
    },
  })

  const dropCard = (to: Zone) => (payload: DragPayload, index?: number) => {
    if (payload.from === to) {
      if (payload.index !== undefined) dispatch({ type: 'reorder', zone: to, from: payload.index, to: index ?? deck[to].length - 1 })
    } else if (payload.from === 'pool') {
      const card = cards.get(payload.id)
      if (card) add(printOf(card, payload.id), to) // the list view's + sends a deck passcode
    } else dispatch({ type: 'move', from: payload.from, id: payload.id, to, cards })
  }

  const rejectedName = state.rejected && (cards.get(state.rejected.cardId)?.name ?? String(state.rejected.cardId))
  const announcement =
    state.rejected && rejectedName
      ? t(`rejected.${state.rejected.reason}`, { name: rejectedName })
      : t('counts', { main: deck.main.length, extra: deck.extra.length, side: deck.side.length })

  const toolbar = (
    <Toolbar
      name={state.name}
      onRename={(name) => dispatch({ type: 'rename', name })}
      banlists={banlists ?? []}
      banlist={banlist}
      onFormat={(format) => dispatch({ type: 'format', format })}
      validity={validity}
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
  )

  const alerts = (
    <>
      {notice ? (
        <Alert tone="warn" edged title={t('damagedLink')} action={<Button variant="ghost" size="sm" onClick={() => setNotice(false)}>{t('dismiss')}</Button>} />
      ) : null}
      {lookupFailed ? (
        <Alert
          tone="negative"
          edged
          title={t('lookupFailed')}
          action={<Button variant="secondary" size="sm" onClick={() => ensure(allIds).catch(console.error)}>{t('retry')}</Button>}
        />
      ) : null}
    </>
  )

  // One layout at a time, not both hidden by CSS: the toolbar and the zones carry ids that must stay unique.
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,62fr)_minmax(0,38fr)]">
      {wide ? (
        <div className="flex flex-col gap-4 px-4 pb-8 lg:h-[calc(100dvh-var(--header-h,64px))] lg:overflow-y-auto">
          <div className="sticky top-0 z-(--z-sticky) border-b border-line bg-space-000 py-3">{toolbar}</div>
          {alerts}
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
              onOpen={open}
            />
          ))}
        </div>
      ) : null}

      {/* Below lg the pool is the page; its bottom clears the tray's peek row (+16px). */}
      <aside
        aria-label={t('pool.title')}
        className="flex flex-col gap-4 px-4 pt-3 pb-8 max-lg:pb-[calc(5rem+env(safe-area-inset-bottom))] lg:h-[calc(100dvh-var(--header-h,64px))] lg:overflow-y-auto lg:border-l lg:border-line"
      >
        {wide ? null : alerts}
        <CardPool deck={deck} cards={cards} banlist={banlist} onAdd={add} onOpen={(card) => setDetail({ card, art: card.id })} remember={remember} />
      </aside>

      {wide ? null : (
        <DeckTray
          state={state}
          cards={cards}
          problems={problems}
          validity={validity}
          flagged={flagged}
          tab={trayTab}
          onTab={setTrayTab}
          onRemove={(zone, id) => dispatch({ type: 'remove', zone, id })}
          onDropCard={dropCard}
          onOpen={open}
          toolbar={toolbar}
        />
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <HoverPreview cards={cards} />
      <CardDetail
        card={detail?.card ?? null}
        art={detail?.art}
        deck={deck}
        cards={cards}
        banlists={banlists ?? []}
        onClose={() => setDetail(null)}
        onAdd={add}
        onRemove={(id, zone) => dispatch({ type: 'remove', zone, id })}
      />
    </div>
  )
}

export default DeckEditor
