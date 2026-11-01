'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { twMerge } from 'tailwind-merge'
import { Alert } from '@ui/alert'
import { Button, buttonClasses } from '@ui/button'
import { useAuth } from '@contexts/auth/auth.context'
import { toOmega } from '@utils/deck/codecs/omega'
import { fromYdke, toYdke } from '@utils/deck/codecs/ydke'
import { addCard, canonicalId, deckIn, inFormat, printOf, usesTcgPasscodes } from '@utils/deck/model'
import { pointsUsed, validate, type Problem } from '@utils/deck/rules'
import { DeckCodeError, EMPTY_DECK, type CardData, type CardMap, type Deck, type Zone } from '@utils/deck/types'
import { getDeck, type SavedDeck } from '@utils/decks'
import { setReturnTo } from '@utils/return-to'
import { getBanlists, type Banlist } from '@utils/wiki'
import { BusyDialog } from './busy-dialog'
import { CardDetail } from './card-detail'
import { CardPool } from './card-pool'
import { shakeTiles } from './card-tile'
import { ConflictDialog } from './conflict-dialog'
import { editorReducer, initialEditorState, type EditorState, type ViewMode } from './deck-editor.reducer'
import { DeckTray } from './deck-tray'
import { readDeck } from './deck-io'
import { DeckZone, type DragPayload } from './deck-zone'
import { canStore, clearDraft, draftKey, readDraft, sameDraft, writeDraft, type Draft } from './drafts'
import { CardPanel } from './card-panel'
import { useEditorKeys } from './keyboard'
import { MyDecks } from './my-decks'
import { Toolbar } from './toolbar'
import { useCardCache } from './use-card-cache'
import { useDeckExport } from './use-export'
import { SaveDialog } from './save-dialog'
import { draftOf, loadAction, metaOf, NEW_META, useSave } from './use-save'

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

type Notice = 'damagedLink' | 'deckMissing' | 'deckCarried' | 'deckCopied'

/** A .ydk is a few KB; anything far bigger isn't one. */
const MAX_IMPORT_BYTES = 64 * 1024

/**
 * Runs once (client only): `?d=` wins over the local draft; a damaged link opens an empty deck.
 * `params` is the router's query: on a client navigation `window.location` still shows the previous page while this runs.
 */
const boot = (deckId: string | null, params: Pick<URLSearchParams, 'get' | 'has'>): { state: EditorState; notice: Notice | null; today: string } => {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` // local date
  const load = (deck: Deck, name = '', format: number | null = null, revision: number | null = null) =>
    editorReducer(initialEditorState(), { type: 'load', deck, name, format, deckId, revision, dirty: true })

  // Set by the redirect away from a deck that doesn't exist or isn't the user's; `carried`: its draft came along.
  const missing: Notice | null = params.has('missing') ? (params.get('missing') === 'carried' ? 'deckCarried' : 'deckMissing') : null
  // URLSearchParams turns an unencoded `+` into a space; base64 has no spaces, so put them back.
  const code = params.get('d')?.replaceAll(' ', '+')
  if (code !== undefined) {
    try {
      // `copy`: someone else's deck opened from its page, as the viewer's unsaved copy.
      return { state: load(fromYdke(code), params.get('name') ?? ''), notice: params.has('copy') ? 'deckCopied' : missing, today }
    } catch (error) {
      if (!(error instanceof DeckCodeError)) throw error
      return { state: { ...initialEditorState(), deckId }, notice: 'damagedLink', today }
    }
  }
  const draft = readDraft(draftKey(deckId))
  if (draft) return { state: load(draft.deck, draft.name, draft.format, draft.revision), notice: missing, today }
  return { state: { ...initialEditorState(), deckId }, notice: missing, today }
}

/** Whether a local dirty state holds anything the saved deck doesn't. */
const differs = (s: EditorState, saved: SavedDeck) =>
  s.revision !== saved.revision || !sameDraft(s, { deck: { main: saved.main, extra: saved.extra, side: saved.side }, name: saved.name, format: saved.format })

/** Every canonical card a problem names, as the deck passcodes that print it. */
const deckIdsOf = (deck: Deck, cards: CardMap, cardId: number): number[] =>
  [...deck.main, ...deck.extra, ...deck.side].filter((id) => {
    const card = cards.get(id)
    return (card ? canonicalId(card) : id) === cardId
  })

const flushDraft = (unsaved: Unsaved) => {
  if (!unsaved.current) return
  writeDraft(unsaved.current.key, unsaved.current.draft)
  unsaved.current = null
}

type Unsaved = React.RefObject<{ key: string; draft: Draft } | null>

/**
 * The deck is gone (deleted, or not the user's): its local changes become the unsaved new deck, and
 * the editor reopens on it. Replaces any other new draft: callers ask first when there is one.
 */
const carryAway = (deckId: string, local: EditorState, unsaved: Unsaved, router: { replace(href: string): void }) => {
  unsaved.current = null // or the unmount flush would write the orphan back
  writeDraft(draftKey(null), { ...draftOf(local), revision: null })
  clearDraft(draftKey(deckId))
  router.replace('/deck-builder?missing=carried')
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

/** `promo`: the page's VIP pitch, rendered inside a scrolling column so the page itself never scrolls on lg. */
const DeckEditor = ({ deckId, promo }: { deckId: string | null; promo?: React.ReactNode }) => {
  const t = useTranslations('DeckEditor')
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [{ state: bootState, notice: bootNotice, today }] = useState(() => boot(deckId, searchParams))
  const [state, dispatch] = useReducer(editorReducer, bootState)
  const [notice, setNotice] = useState(bootNotice)
  /** A saved deck reads from the server before it can be saved again. */
  const [loadState, setLoadState] = useState<'loading' | 'failed' | 'ready'>(deckId === null ? 'ready' : 'loading')
  const [loadAttempt, setLoadAttempt] = useState(0)
  /** The saved deck, while the editor shows a local draft that differs from it: Keep or Discard. */
  const [pending, setPending] = useState<SavedDeck | null>(null)
  /**
   * The deck isn't readable. `signin`: signed out (it may be theirs). `collision`: deleted or not
   * theirs, with local changes to carry into a new deck, but another unsaved new deck is in the way.
   */
  const [gone, setGone] = useState<'signin' | 'collision' | null>(null)
  const [myDecks, setMyDecks] = useState(false)
  /** `null` while loading; `[]` when the API failed (getBanlists swallows the error). */
  const [banlists, setBanlists] = useState<Banlist[] | null>(null)
  // No format chosen yet: the TCG list. It is also the list a save records.
  const banlist = banlists?.find((b) => (state.format === null ? b.format === 'tcg' : b.id === state.format)) ?? null
  const wait =
    loadState === 'loading' || banlists === null ? t('save.wait')
    : loadState === 'failed' ? t('save.loadFailed')
    : gone === 'collision' ? t('save.choose')
    : null
  const { cards, failed, isPending, remember, rememberArt, ensure } = useCardCache()
  const { deck } = state
  /** A canonical card's name, as the deck prints it. */
  const nameOf = (cardId: number) => cards.get(deckIdsOf(deck, cards, cardId)[0] ?? cardId)?.name ?? String(cardId)
  const { save, saving, conflict, resolveConflict, error: saveError, dismissError, signInTab, dismissSignInTab, latest, meta, setMeta, retry } = useSave(
    state,
    dispatch,
    banlist?.id ?? state.format,
    wait,
    nameOf,
  )
  const [view, setView] = useState(readView)
  const [detail, setDetail] = useState<{ card: CardData; art: number } | null>(null)
  /** The card panel's pin (lg only); a tile's pin button toggles it. */
  const [locked, setLocked] = useState<number | null>(null)
  const toggleLock = (id: number) => setLocked((current) => (current === id ? null : id))
  const wide = useWide()
  const [trayTab, setTrayTab] = useState<Zone>('main')
  /** The draft the debounce hasn't written yet, flushed on unmount and pagehide so closing the tab keeps it. */
  const unsaved = useRef<{ key: string; draft: Draft } | null>(null)
  const { exportAs, warmStory, copy, omega, tcg, allIds, toast, setToast, busy, setBusy } = useDeckExport({
    deck,
    cards,
    name: state.name,
    banlist,
    deckId: state.deckId,
    author: user?.profile?.username ?? null,
  })

  useEffect(() => {
    getBanlists().then(setBanlists)
    // `?d=` is read once; left in the URL it would beat the draft on reload and drop the edits made since.
    const url = new URL(window.location.href)
    if (url.searchParams.has('d') || url.searchParams.has('missing')) {
      for (const key of ['d', 'missing', 'name', 'copy']) url.searchParams.delete(key)
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
        const local = latest.current
        setLoadState('ready')
        if (saved && saved.ownerId !== userId && !local.dirty) {
          // Someone else's public or friends deck: it opens as an unsaved copy, the way a shared ydke link does.
          const copy = new URLSearchParams({ d: toYdke({ main: saved.main, extra: saved.extra, side: saved.side }), name: saved.name, copy: '' })
          router.replace(`/deck-builder?${copy}`)
          return
        }
        if (!saved || saved.ownerId !== userId) {
          // Signed out it may still be theirs: the draft stays put for after sign-in.
          if (userId === null) setGone('signin')
          else if (!local.dirty) router.replace('/deck-builder?missing')
          else {
            const other = readDraft(draftKey(null))
            if (other && !sameDraft(other, local)) setGone('collision')
            else carryAway(deckId, local, unsaved, router)
          }
          return
        }
        setGone(null)
        setMeta(metaOf(saved))
        if (local.dirty && differs(local, saved)) {
          // The editor keeps showing the local draft; nothing is cleared until the user picks Discard.
          // Edits made while loading have no base revision: they sit on the one just read.
          if (local.revision === null) dispatch({ type: 'load', deck: local.deck, name: local.name, format: local.format, deckId, revision: saved.revision, dirty: true })
          setPending(saved)
        } else {
          dispatch(loadAction(saved))
          clearDraft(draftKey(deckId)) // none, or the same content
        }
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
  }, [deckId, userId, loadAttempt, router, latest, setMeta])

  useEffect(() => {
    ensure(allIds).catch(console.error)
  }, [allIds, ensure])

  useEffect(() => {
    // Saved or loaded: a draft still waiting on the debounce is stale now.
    if (!state.dirty) {
      unsaved.current = null
      return
    }
    unsaved.current = { key: draftKey(state.deckId), draft: draftOf(state) }
    const timer = setTimeout(() => flushDraft(unsaved), 500)
    return () => clearTimeout(timer)
  }, [state])

  // Unsaved server changes; a new deck's draft survives a reload on its own, unless storage is unavailable.
  useEffect(() => {
    if (!state.dirty || (state.deckId === null && canStore())) return
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
  const saveNow = () => void save()
  const [saveDialog, setSaveDialog] = useState(false)
  /** The Save button confirms name and showcase first; signed out it goes straight to sign-in, as a save would. */
  const askSave = () => (user ? setSaveDialog(true) : saveNow())

  /** Keeps the current deck's pending edits, then opens an empty one. */
  const startNew = () => {
    flushDraft(unsaved)
    clearDraft(draftKey(null)) // My decks asked first if there was one
    dispatch({ type: 'load', deck: EMPTY_DECK, name: '', format: null, deckId: null, revision: null })
    setMeta(NEW_META)
    router.push('/deck-builder')
  }

  /** Deleting the open deck turns its content into the unsaved new deck; this other one would be replaced. */
  const otherNewDraft = () => {
    const other = readDraft(draftKey(null))
    return !!other && !sameDraft(other, state)
  }

  /** The open deck was deleted: its content carries on as the new, unsaved deck (My decks warned if that replaces one). */
  const deletedOpen = (id: string) => {
    if (id !== state.deckId) return
    unsaved.current = null
    clearDraft(draftKey(id))
    writeDraft(draftKey(null), { ...draftOf(state), revision: null })
    dispatch({ type: 'load', deck, name: state.name, format: state.format, deckId: null, revision: null, dirty: true })
    window.history.replaceState(null, '', '/deck-builder')
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
  const add = (shown: CardData, zone?: Zone) => {
    const card = inFormat(shown, tcg)
    // Pool tiles carry the shown print's passcode, deck tiles the format's: they differ on a double-script card.
    if (addCard(deck, card, cards, zone).rejected) for (const id of new Set([shown.id, card.id])) shakeTiles(id)
    dispatch({ type: 'add', card, cards, zone })
  }

  const open = (id: number) => {
    const card = cards.get(id)
    if (card) setDetail({ card, art: id })
  }

  /** Replaces the deck as one undoable step; a .ydk's file name names a deck that has none. */
  const importText = async (text: string, name?: string) => {
    setBusy('importing') // an Omega code looks its cards up before it can split the extra deck
    try {
      const { deck: next, format } = await readDeck(text, ensure)
      // ydk/ydke carry OCG passcodes; the deck holds the format's print.
      const known = await ensure([...next.main, ...next.extra, ...next.side])
      dispatch({ type: 'replace', deck: deckIn(next, known, tcg) })
      if (name && !state.name.trim()) dispatch({ type: 'rename', name })
      setToast({ tone: 'positive', text: t('io.imported', { format: t(`io.format.${format}`) }) })
    } catch (error) {
      if (!(error instanceof DeckCodeError)) console.error(error)
      setToast({ tone: 'negative', text: t(error instanceof DeckCodeError ? 'io.invalid' : 'io.lookupFailed') })
    } finally {
      setBusy(null)
    }
  }

  const importFile = (file: File) => {
    if (file.size > MAX_IMPORT_BYTES) return setToast({ tone: 'negative', text: t('io.invalid') })
    file.text().then(
      (text) => importText(text, file.name.replace(/\.[^.]*$/, '')),
      () => setToast({ tone: 'negative', text: t('io.invalid') }),
    )
  }

  useEditorKeys({
    paste: (data) => {
      const file = data.files[0]
      if (file) return importFile(file)
      const text = data.getData('text/plain')
      if (text.trim()) void importText(text)
    },
    copy: (data) => {
      if (!allIds.length) return setToast({ tone: 'negative', text: t('io.empty') })
      if (!omega.current) return void copy(toOmega(deckIn(deck, cards, tcg)), 'omega') // edited a moment ago: still encoding
      data.setData('text/plain', omega.current)
      setToast({ tone: 'positive', text: t('io.copied', { format: t('io.format.omega') }) })
    },
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
      onFormat={(format) => {
        const list = banlists?.find((b) => b.id === format)
        dispatch({ type: 'format', format, deck: deckIn(deck, cards, !list || usesTcgPasscodes(list.format)) })
      }}
      validity={validity}
      problems={problems}
      nameOf={nameOf}
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
      onSave={askSave}
      onMyDecks={() => setMyDecks(true)}
      onImport={(text) => void importText(text)}
      onImportFile={importFile}
      onExport={(kind) => void exportAs(kind)}
      onExportOpen={warmStory}
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
          title={t('load.draft', { revision: pending.revision })}
          action={
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPending(null)} className="max-lg:min-h-11">
                {t('load.keep')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  dispatch(loadAction(pending))
                  setMeta(metaOf(pending))
                  clearDraft(draftKey(pending.id))
                  setPending(null)
                }}
                className="max-lg:min-h-11"
              >
                {t('load.discard')}
              </Button>
            </div>
          }
        >
          {t('load.draftDetail')}
        </Alert>
      ) : null}
      {gone === 'signin' ? (
        <Alert
          tone="warn"
          edged
          title={t('load.signIn')}
          action={
            <Link href="/login" onClick={() => setReturnTo(location.pathname + location.search)} className={twMerge(buttonClasses({ variant: 'secondary', size: 'sm' }), 'max-lg:min-h-11')}>
              {t('myDecks.signIn')}
            </Link>
          }
        />
      ) : null}
      {gone === 'collision' && deckId !== null ? (
        <Alert
          tone="warn"
          edged
          title={t('load.goneTitle')}
          action={
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => carryAway(deckId, latest.current, unsaved, router)} className="max-lg:min-h-11">
                {t('load.goneCarry')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  unsaved.current = null
                  clearDraft(draftKey(deckId))
                  router.replace('/deck-builder?missing')
                }}
                className="max-lg:min-h-11"
              >
                {t('load.goneDiscard')}
              </Button>
            </div>
          }
        >
          {t('load.goneCollision')}
        </Alert>
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
  // The columns are `relative`: an overflow container only clips the absolutely positioned descendants
  // (the tiles' sr-only labels) whose containing block it is; otherwise they stretch the page below the fold.
  return (
    <div className="lg:grid lg:grid-cols-[minmax(16rem,15fr)_minmax(0,59fr)_minmax(0,26fr)]">
      {wide ? (
        <aside className="relative flex flex-col px-4 pt-3 pb-8 lg:h-[calc(100dvh-var(--header-h,64px))] lg:overflow-y-auto lg:border-r lg:border-line">
          <CardPanel cards={cards} locked={locked} onLock={setLocked} />
        </aside>
      ) : null}

      {wide ? (
        <div className="relative flex flex-col gap-4 px-4 pb-8 lg:h-[calc(100dvh-var(--header-h,64px))] lg:overflow-y-auto">
          <div className="sticky top-0 z-(--z-sticky) border-b border-line bg-space-000 py-3">{toolbar}</div>
          {alerts}
          {ZONES.map((zone) => (
            <DeckZone
              key={zone}
              zone={zone}
              ids={deck[zone]}
              cards={cards}
              banlist={banlist}
              view={view}
              problems={flagged}
              onRemove={(id) => dispatch({ type: 'remove', zone, id })}
              onDropCard={dropCard(zone)}
              onOpen={open}
              locked={locked}
              onLock={toggleLock}
            />
          ))}
          {promo}
        </div>
      ) : null}

      {/* Below lg the pool is the page; its bottom clears the tray's peek row (+16px). */}
      <aside
        aria-label={t('pool.title')}
        className="relative flex flex-col gap-4 px-4 pt-3 pb-8 max-lg:pb-[calc(5rem+env(safe-area-inset-bottom))] lg:h-[calc(100dvh-var(--header-h,64px))] lg:overflow-y-auto lg:border-l lg:border-line"
      >
        {wide ? null : alerts}
        <CardPool
          deck={deck}
          cards={cards}
          banlist={banlist}
          onAdd={add}
          onOpen={(card) => setDetail({ card, art: card.id })}
          remember={remember}
          locked={wide ? locked : undefined}
          onLock={wide ? toggleLock : undefined}
        />
        {wide ? null : promo}
      </aside>

      {wide ? null : (
        <DeckTray
          state={state}
          cards={cards}
          banlist={banlist}
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

      {toast ? (
        <div className="fixed inset-x-4 top-[calc(var(--header-h,64px)+12px)] z-(--z-toast) mx-auto max-w-120 drop-shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
          <Alert tone={toast.tone} edged title={toast.text} action={<Button variant="ghost" size="sm" onClick={() => setToast(null)} className="max-lg:min-h-11">{t('dismiss')}</Button>} />
        </div>
      ) : null}

      {signInTab ? (
        <div className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-(--z-toast) mx-auto max-w-120 lg:bottom-6">
          <Alert
            tone="warn"
            edged
            title={t('save.noStorage')}
            action={
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => window.open('/login', '_blank', 'noopener')} className="max-lg:min-h-11">
                  {t('save.signInTab')}
                </Button>
                <Button variant="ghost" size="sm" onClick={dismissSignInTab} className="max-lg:min-h-11">
                  {t('dismiss')}
                </Button>
              </div>
            }
          >
            {t('save.noStorageDetail')}
          </Alert>
        </div>
      ) : saveError ? (
        <div className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-(--z-toast) mx-auto max-w-120 lg:bottom-6">
          <Alert
            tone="negative"
            edged
            title={saveError}
            action={
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={retry} className="max-lg:min-h-11">
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
      <SaveDialog
        open={saveDialog}
        onClose={() => setSaveDialog(false)}
        name={state.name}
        meta={meta}
        cards={allIds}
        nameOf={(id) => cards.get(id)?.name ?? String(id)}
        onSave={(details) => {
          setSaveDialog(false)
          void save(false, details)
        }}
      />
      <MyDecks
        open={myDecks}
        onClose={() => setMyDecks(false)}
        currentId={state.deckId}
        onNew={startNew}
        newDiscards={() => (state.deckId === null ? state.dirty : readDraft(draftKey(null)) !== null)}
        onDeleted={deletedOpen}
        deleteReplacesNew={(id) => id === state.deckId && otherNewDraft()}
      />
      <BusyDialog label={busy && t(`io.${busy}`)} />
      <CardDetail
        card={detail?.card ?? null}
        art={detail?.art}
        deck={deck}
        cards={cards}
        banlists={banlists ?? []}
        onClose={() => setDetail(null)}
        onAdd={(print, zone) => {
          // An artwork picked in the sheet: its passcode resolves to the sheet's (API) card, as a lookup would.
          if (detail && !cards.has(print.id)) rememberArt(print.id, detail.card)
          add(print, zone)
        }}
        onRemove={(id, zone) => dispatch({ type: 'remove', zone, id })}
      />
    </div>
  )
}

export default DeckEditor
