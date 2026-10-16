'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { useAuth } from '@hooks/index'
import { fromYdke } from '@utils/deck/codecs/ydke'
import { addCard, canonicalId, printOf } from '@utils/deck/model'
import { pointsUsed, validate, type Problem } from '@utils/deck/rules'
import { DeckCodeError, EMPTY_DECK, type CardData, type CardMap, type Deck, type Zone } from '@utils/deck/types'
import { getDeck, type SavedDeck } from '@utils/decks'
import { getBanlists, type Banlist } from '@utils/wiki'
import { CardDetail } from './card-detail'
import { CardPool } from './card-pool'
import { shakeTiles } from './card-tile'
import { ConflictDialog } from './conflict-dialog'
import { editorReducer, initialEditorState, type EditorState, type ViewMode } from './deck-editor.reducer'
import { DeckTray } from './deck-tray'
import { DeckZone, type DragPayload } from './deck-zone'
import { clearDraft, draftKey, readDraft, writeDraft, type Draft } from './drafts'
import { HoverPreview } from './hover-preview'
import { useEditorKeys } from './keyboard'
import { MyDecks } from './my-decks'
import { Toolbar } from './toolbar'
import { useCardCache } from './use-card-cache'
import { draftOf, loadAction, useSave } from './use-save'

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

type Notice = 'damagedLink' | 'deckMissing'

/**
 * Runs once (client only): `?d=` wins over the local draft; a damaged link opens an empty deck.
 * `draft` is the stored draft as read, before the autosave restamps it.
 */
const boot = (deckId: string | null): { state: EditorState; draft: Draft | null; notice: Notice | null; today: string } => {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` // local date
  const load = (deck: Deck, name = '', format: number | null = null, revision: number | null = null) =>
    editorReducer(initialEditorState(), { type: 'load', deck, name, format, deckId, revision, dirty: true })

  const params = new URLSearchParams(window.location.search)
  // Set by the redirect away from a deck that doesn't exist or isn't the user's.
  const missing: Notice | null = params.has('missing') ? 'deckMissing' : null
  // URLSearchParams turns an unencoded `+` into a space; base64 has no spaces, so put them back.
  const code = params.get('d')?.replaceAll(' ', '+')
  if (code !== undefined) {
    try {
      return { state: load(fromYdke(code)), draft: null, notice: missing, today }
    } catch (error) {
      if (!(error instanceof DeckCodeError)) throw error
      return { state: { ...initialEditorState(), deckId }, draft: null, notice: 'damagedLink', today }
    }
  }
  const draft = readDraft(draftKey(deckId))
  if (draft) return { state: load(draft.deck, draft.name, draft.format, draft.revision), draft, notice: missing, today }
  return { state: { ...initialEditorState(), deckId }, draft: null, notice: missing, today }
}

const sameContent = (s: EditorState, saved: SavedDeck) =>
  s.revision === saved.revision && s.name === saved.name && s.format === saved.format && ZONES.every((z) => s.deck[z].join() === saved[z].join())

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
  const router = useRouter()
  const { user } = useAuth()
  const [{ state: bootState, draft: bootDraft, notice: bootNotice, today }] = useState(() => boot(deckId))
  const [state, dispatch] = useReducer(editorReducer, bootState)
  const [notice, setNotice] = useState(bootNotice)
  /** A saved deck reads from the server before it can be saved again. */
  const [loadState, setLoadState] = useState<'loading' | 'failed' | 'ready'>(deckId === null ? 'ready' : 'loading')
  const [loadAttempt, setLoadAttempt] = useState(0)
  /** Local edits newer than the saved deck, held while the user picks Restore or Discard. */
  const [pending, setPending] = useState<Draft | null>(null)
  const [myDecks, setMyDecks] = useState(false)
  const latest = useRef(state)
  useEffect(() => {
    latest.current = state
  })
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
    if (url.searchParams.has('d') || url.searchParams.has('missing')) {
      url.searchParams.delete('d')
      url.searchParams.delete('missing')
      window.history.replaceState(null, '', url)
    }
  }, [])

  // A saved deck: wait for the session to know the owner, then read it.
  const userId = user === undefined ? undefined : (user?.id ?? null)
  useEffect(() => {
    if (deckId === null || userId === undefined) return
    let live = true
    getDeck(deckId).then(
      (saved) => {
        if (!live) return
        if (!saved || saved.ownerId !== userId) {
          router.replace('/deck-editor?missing')
          return
        }
        const local = latest.current
        // Edited since boot, or a stored draft written after the server's last save.
        const newer = local !== bootState || (bootDraft !== null && bootDraft.at > Date.parse(saved.updatedAt))
        dispatch(loadAction(saved))
        if (local.dirty && newer && !sameContent(local, saved)) setPending(draftOf(local))
        else clearDraft(draftKey(deckId))
        setLoadState('ready')
      },
      (error) => {
        if (!live) return
        console.error(error)
        setLoadState('failed')
      },
    )
    return () => {
      live = false
    }
  }, [deckId, userId, loadAttempt, bootState, bootDraft, router])

  useEffect(() => {
    ensure(allIds).catch(console.error)
  }, [allIds, ensure])

  useEffect(() => {
    // Saved or loaded: a draft still waiting on the debounce is stale now.
    if (!state.dirty) {
      unsaved.current = null
      return
    }
    unsaved.current = {
      key: draftKey(state.deckId),
      draft: { deck, name: state.name, format: state.format, revision: state.revision, at: Date.now() },
    }
    const timer = setTimeout(() => flushDraft(unsaved), 500)
    return () => clearTimeout(timer)
  }, [state.deckId, deck, state.dirty, state.name, state.format, state.revision])

  // Unsaved server changes; a new deck's draft survives a reload on its own.
  useEffect(() => {
    if (!state.dirty || state.deckId === null) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [state.dirty, state.deckId])

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
  // The list the editor checks against is the one saved, even before the user picks one.
  const { save, saving, conflict, resolveConflict, error: saveError, dismissError } = useSave(state, dispatch, banlist?.id ?? state.format)
  // Waits for the banlists (a moment at most) so the TCG default isn't saved as null.
  const saveNow = () => {
    if (loadState === 'ready' && banlists !== null) void save()
  }

  /** Keeps the current deck's pending edits, then opens an empty one. */
  const startNew = () => {
    flushDraft(unsaved)
    clearDraft(draftKey(null)) // My decks asked first if there was one
    dispatch({ type: 'load', deck: EMPTY_DECK, name: '', format: null, deckId: null, revision: null })
    router.push('/deck-editor')
  }

  /** The open deck was deleted: its content carries on as a new, unsaved deck. */
  const deletedOpen = (id: string) => {
    if (id !== state.deckId) return
    clearDraft(draftKey(id))
    dispatch({ type: 'load', deck, name: state.name, format: state.format, deckId: null, revision: null, dirty: true })
    window.history.replaceState(null, '', '/deck-editor')
  }

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
    save: saveNow,
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
      saving={saving}
      onSave={saveNow}
      onMyDecks={() => setMyDecks(true)}
    />
  )

  const alerts = (
    <>
      {notice ? (
        <Alert tone="warn" edged title={t(notice)} action={<Button variant="ghost" size="sm" onClick={() => setNotice(null)} className="max-lg:min-h-11">{t('dismiss')}</Button>} />
      ) : null}
      {loadState === 'loading' ? <Alert title={t('load.loading')} /> : null}
      {loadState === 'failed' ? (
        <Alert
          tone="negative"
          edged
          title={t('load.failed')}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setLoadState('loading')
                setLoadAttempt((n) => n + 1)
              }}
              className="max-lg:min-h-11"
            >
              {t('retry')}
            </Button>
          }
        />
      ) : null}
      {pending ? (
        <Alert
          tone="warn"
          edged
          title={t('load.newerDraft')}
          action={
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  dispatch({ type: 'load', deck: pending.deck, name: pending.name, format: pending.format, deckId: state.deckId, revision: pending.revision, dirty: true })
                  setPending(null)
                }}
                className="max-lg:min-h-11"
              >
                {t('load.restore')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Edits made on the saved deck since are the draft now: keep them.
                  if (!state.dirty) clearDraft(draftKey(state.deckId))
                  setPending(null)
                }}
                className="max-lg:min-h-11"
              >
                {t('load.discard')}
              </Button>
            </div>
          }
        />
      ) : null}
      {lookupFailed ? (
        <Alert
          tone="negative"
          edged
          title={t('lookupFailed')}
          action={<Button variant="secondary" size="sm" onClick={() => ensure(allIds).catch(console.error)} className="max-lg:min-h-11">{t('retry')}</Button>}
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

      {saveError ? (
        <div className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-(--z-toast) mx-auto max-w-120 lg:bottom-6">
          <Alert
            tone="negative"
            edged
            title={saveError}
            action={
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={saveNow} className="max-lg:min-h-11">
                  {t('retry')}
                </Button>
                <Button variant="ghost" size="sm" onClick={dismissError} className="max-lg:min-h-11">
                  {t('dismiss')}
                </Button>
              </div>
            }
          >
            {t('save.kept')}
          </Alert>
        </div>
      ) : null}

      <ConflictDialog latest={conflict} onResolve={resolveConflict} />
      <MyDecks
        open={myDecks}
        onClose={() => setMyDecks(false)}
        currentId={state.deckId}
        onNew={startNew}
        newDiscards={() => (state.deckId === null ? state.dirty : readDraft(draftKey(null)) !== null)}
        onDeleted={deletedOpen}
      />
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
