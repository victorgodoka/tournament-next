'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useEffectEvent, useMemo, useReducer, useRef, useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Dialog } from '@ui/dialog'
import { TextInput } from '@ui/field'
import { Icon } from '@ui/icon'
import { RailHead } from '@ui/rail-head'
import { DeckPicker } from '@app/calculator/deck-picker'
import { useCardCache } from '@app/deck-builder/use-card-cache'
import type { SharedCombo } from '@utils/combos'
import { destroyedBy, initial, isMonsterSlot, kindsIn, shuffleAction, stepCards, timeline, validRun } from '@utils/simulator/board'
import { comboSession } from '@utils/simulator/combo'
import { draftStorage, writeDraft } from '@utils/simulator/draft'
import { dropAction } from '@utils/simulator/drop'
import { sessionReducer } from '@utils/simulator/session'
import { LIMITS } from '@utils/simulator/types'
import type { Action, MonsterSlot, Pile, Session } from '@utils/simulator/types'
import { BoardView, DragGhost, FLIP_MS } from './board'
import { bootSession, type Boot } from './boot'
import { CardMenu } from './card-menu'
import { CardPanel } from './card-panel'
import { HandPicker } from './hand-picker'
import { History } from './history'
import { LifePlate, PileCounts } from './hud'
import { MyCombos } from './my-combos'
import { PilePanel } from './pile-panel'
import { ReplayBar } from './replay-bar'
import { Room } from './room'
import { SaveFlowView } from './save-dialog'
import { Commands, Dock, TOUCH } from './toolbar'
import { useDrag } from './use-drag'
import { useReplay } from './use-replay'
import { useSave } from './use-save'
import { VideoDialog } from './video-dialog'

const DRAFT_DELAY_MS = 300
const END_TURN: Action = { t: 'endTurn' }
/** Until the Life Points are played by hand. */
const START_LP = 8000
/** A key typed here is the field's, never a shortcut. */
const TYPING = 'input, textarea, select, [contenteditable]'
/** An open dialog owns the keyboard: its Escape, its fields, its buttons. */
const dialogOpen = () => document.querySelector('dialog[open]') !== null

/** Where a menu opens for a click: at the pointer, or under the card when a key sent it (those carry no coordinates). */
const anchor = (e: React.MouseEvent) => {
  if (e.clientX || e.clientY) return { x: e.clientX, y: e.clientY }
  const box = e.currentTarget.getBoundingClientRect()
  return { x: box.left, y: box.bottom }
}

/** The link's own params: read once at boot. */
const LINK_PARAMS = ['d', 'name', 'deck']

/** Writes the session waiting in `unsaved`, if any, and empties it, so a later flush has nothing left to write. */
const saveDraft = (unsaved: { current: Session | null }) => {
  if (unsaved.current) writeDraft(draftStorage(), unsaved.current)
  unsaved.current = null
}

/** Boots once from `?d=` or the draft (client only: the loader is `ssr: false`), then hands over to the loaded simulator. */
const Simulator = () => {
  const [boot] = useState(() => bootSession(window.location.search, draftStorage()))
  useEffect(() => {
    // `?d=` is read once; left in the URL it would beat the draft on reload and drop the line played since.
    const url = new URL(window.location.href)
    if (!LINK_PARAMS.some((key) => url.searchParams.has(key))) return
    for (const key of LINK_PARAMS) url.searchParams.delete(key)
    window.history.replaceState(null, '', url)
  }, [])
  return <Loaded boot={boot} />
}

/** A short text asked in a small dialog: the name of a new counter kind, or a card's tag. */
const TextDialog = ({ open, title, label, initial, maxLength, confirm, onConfirm, onClose }: { open: boolean; title: string; label: string; initial: string; maxLength: number; confirm: string; onConfirm(text: string): void; onClose(): void }) => {
  const t = useTranslations('Simulator')
  const [text, setText] = useState(initial)
  const field = useRef<HTMLDivElement>(null)
  // After `showModal`, which runs in the dialog's own effect and would otherwise leave the focus on its Close button.
  useEffect(() => {
    if (open) field.current?.querySelector('input')?.focus()
  }, [open])
  return (
    <Dialog
      size="sm"
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className={TOUCH}>
            {t('confirm.cancel')}
          </Button>
          <Button
            onClick={() => {
              onConfirm(text.trim())
              onClose()
            }}
            className={TOUCH}
          >
            {confirm}
          </Button>
        </>
      }
    >
      <div ref={field}>
        <TextInput
          aria-label={label}
          placeholder={label}
          maxLength={maxLength}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            onConfirm(text.trim())
            onClose()
          }}
          plateClassName={TOUCH}
        />
      </div>
    </Dialog>
  )
}

const Loaded = ({ boot }: { boot: Boot }) => {
  const t = useTranslations('Simulator')
  const [session, dispatch] = useReducer(sessionReducer, boot.session)
  const [notice, setNotice] = useState(boot.notice)
  /** No deck yet: the picker opens by itself. */
  const [picker, setPicker] = useState(boot.session.deck.main.length + boot.session.deck.extra.length === 0)
  /** What the confirm dialog runs once the player agrees to discard the session. */
  const [pending, setPending] = useState<(() => void) | null>(null)
  /** The opening hand picker is open. */
  const [choosing, setChoosing] = useState(false)
  /** The My combos list is open. */
  const [listing, setListing] = useState(false)
  /** The last card clicked or shown by the replay: an instance id, so every reset of the board clears it. */
  const [selected, setSelected] = useState<number | null>(null)
  /** The card under the pointer, and the one the card panel is locked on. The panel shows the locked one, else the hovered one, else the selected one. */
  const [hovered, setHovered] = useState<number | null>(null)
  const [locked, setLocked] = useState<number | null>(null)
  const [menu, setMenu] = useState<{ card: number; at: { x: number; y: number } } | null>(null)
  /** Target mode: the card being activated and the cards picked so far. Menus and drag are off until it is confirmed or cancelled. */
  const [targeting, setTargeting] = useState<{ source: number; targets: number[] } | null>(null)
  /** The piles (and the monster slots, for their Xyz materials) whose windows are open, in the order they were opened. */
  const [piles, setPiles] = useState<(Pile | MonsterSlot)[]>([])
  /** The card a new counter kind is being named for, and the card being tagged. */
  const [naming, setNaming] = useState<number | null>(null)
  const [tagging, setTagging] = useState<number | null>(null)
  /** The hash of the session a video was asked for: the dialog opens once that very line is saved, and a step since drops the ask. */
  const [videoFor, setVideoFor] = useState<string | null>(null)
  const [lookupAttempt, setLookupAttempt] = useState(0)
  const { cards, failed, ensure } = useCardCache()

  const boards = useMemo(() => timeline(session.deck, session.actions), [session.deck, session.actions])
  const board = boards[session.cursor]!

  // What the board shows of an activation: the pick in progress, else the step on screen when that is an activation.
  const shown = session.actions[session.cursor - 1]
  const activation = useMemo(
    () => (targeting ? { card: targeting.source, targets: targeting.targets } : shown?.t === 'activate' ? shown : null),
    [targeting, shown],
  )
  /** The cards the step on screen played: the board marks them. */
  const marked = useMemo(() => (shown ? stepCards(shown, boards[session.cursor - 1]!) : []), [shown, boards, session.cursor])
  const destroyed = useMemo(() => (shown ? destroyedBy(shown, boards[session.cursor - 1]!) : null), [shown, boards, session.cursor])
  /** The counter kinds the menu offers: those added by hand and those the log already uses. */
  const kinds = useMemo(() => [...new Set([...session.counterTypes, ...kindsIn(session.actions)])], [session.counterTypes, session.actions])

  useEffect(() => {
    ensure([...session.deck.main, ...session.deck.extra]).catch(() => {})
  }, [session.deck, ensure, lookupAttempt])

  const targetMode = targeting !== null
  useEffect(() => {
    if (!targetMode) return
    const escape = (e: KeyboardEvent) => e.key === 'Escape' && !dialogOpen() && setTargeting(null)
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [targetMode])

  const { cursor } = session
  const end = session.actions.length
  /** A replay is stepping from `start` to the end: menus, drag, target mode and the toolbar are off. */
  const { playing, speed, setSpeed, toggle, step } = useReplay({ session, boards, dispatch, onShow: setSelected })

  // The session still waiting on the debounce: the unmount and `pagehide` write it at once, so a reload keeps the last step.
  const unsaved = useRef<Session | null>(null)
  useEffect(() => {
    // A damaged link boots empty and is never written, so it leaves the stored draft alone.
    if (boot.notice !== null && session === boot.session) return
    unsaved.current = session
    // The booted session at once: the link is gone from the URL, so a reload before the first step reads it from the draft.
    if (session === boot.session) {
      saveDraft(unsaved)
      return
    }
    const timer = setTimeout(() => saveDraft(unsaved), DRAFT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [session, boot])
  useEffect(() => {
    const flush = () => saveDraft(unsaved)
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [])

  /** Not while a replay plays: acting there would cut the steps it is about to show. */
  const perform = (actions: Action[]) => {
    if (!playing && validRun(board, actions)) dispatch({ type: 'act', actions })
  }

  /** Runs `run` at once, or after the confirm dialog when it would throw away something worth asking about. */
  const discard = (ask: boolean, run: () => void) => (ask ? setPending(() => run) : run())
  const hasActions = session.actions.length > 0
  /** The cards the panel shows, the open pile windows and a pick in progress mean nothing on a new board. */
  const unpick = () => {
    setSelected(null)
    setLocked(null)
    setPiles([])
    setTargeting(null)
    setVideoFor(null)
  }
  // A reload clears the save alert itself before it opens the combo.
  const saves = useSave(session, dispatch, unpick)
  /** A new board: nothing picked, and the last save's alert (its Retry included) was about the old one. */
  const forget = () => {
    unpick()
    saves.dismiss()
  }
  /** The video is cut from the saved combo, so an unsaved line is saved first (the title dialog and all); the dialog opens once it is tied. */
  const askVideo = () => {
    setVideoFor(saves.hash)
    if (session.combo === null || saves.unsaved) saves.save()
  }
  const videoOpen = videoFor === saves.hash && session.combo !== null && !saves.unsaved && !saves.busy && saves.asking === null && saves.conflict === null

  /** A combo from the list replaces the session, tied to it. A damaged one loads nothing and says so; no question for that. */
  const openCombo = (combo: SharedCombo) => {
    const opened = comboSession(combo)
    if (!opened) {
      setListing(false)
      return saves.damaged()
    }
    discard(hasActions, () => {
      dispatch({ type: 'open', session: opened })
      setNotice(null) // a damaged link says nothing about the combo just opened
      forget()
      setListing(false)
    })
  }
  /** Deleting the combo the session is tied to leaves its line as an unsaved one. The reducer judges the tie: the delete may land long after the click. */
  const comboDeleted = (id: string) => dispatch({ type: 'unlink', id })

  /** A hand was just dealt: the board deals it from the deck. */
  const dealtRef = useRef(false)
  /**
   * A fresh board dealt by `actions`, with the replay starting after them: dealing the hand is never part of the line.
   * Nothing played after the start so far: no question, so testing hands takes one click each.
   */
  const deal = (actions: Action[]) => {
    const start = initial(session.deck)
    if (!validRun(start, actions)) return
    discard(end > session.start, () => {
      dispatch({ type: 'reset' })
      dispatch({ type: 'act', actions })
      dispatch({ type: 'setStart', start: actions.length })
      dealtRef.current = true
      forget()
    })
  }
  /** Shuffle, draw 5. */
  const newHand = () => deal([shuffleAction(initial(session.deck)), { t: 'draw', n: 5 }])
  /** Shuffle, then the picked cards into the hand in the order they were picked. */
  const chooseHand = (ids: number[]) => {
    setChoosing(false)
    deal([shuffleAction(initial(session.deck)), ...ids.map((card): Action => ({ t: 'move', card, to: 'hand' }))])
  }

  const reset = () =>
    discard(hasActions, () => {
      dispatch({ type: 'reset' })
      forget()
    })

  /** Play from `start` (or from where a pause left off), or pause. Not while picking targets, nor with no step after `start`. */
  const togglePlay = () => {
    if (playing) return toggle()
    if (targeting || session.start >= end) return
    setMenu(null)
    toggle()
  }

  /** An Xyz monster, by its looked-up card: summoned over cards, it comes in on top of them. */
  const isXyz = (id: number) => !!cards.get(board.cards[id]?.code ?? -1)?.monsterTypes.includes('xyz')
  /** One of the Extra Deck's cards: it never goes to the hand or into the Main Deck. */
  const isExtra = (id: number) => id >= session.deck.main.length
  /** The card a drag just dropped: it is already where the pointer let go, so the board does not slide it there. */
  const droppedRef = useRef<number | null>(null)
  // Off while the menu is open (a drag would move a card the menu is about to act on), while picking targets and while a
  // replay plays. The ghost goes with it, so none is left over a replay that started mid-drag.
  const dragOn = menu === null && !targeting && !playing
  const drag = useDrag({
    enabled: dragOn,
    onDrop: (card, zone, shift) => {
      const action = dropAction(board, card, zone, shift, isXyz(card))
      if (!action) return
      droppedRef.current = card
      perform([action])
    },
  })
  const dragging = dragOn ? drag.dragging : null

  // Shortcuts. Target mode owns the keyboard (Escape cancels it), as do an open menu and dialog, a text field, and any
  // widget that already handled the key (the tab bar's arrows). Space on a button presses the button. Nothing during a
  // drag: an undo there would take the dragged card off the board and leave its ghost hanging. During a replay a step
  // key pauses it first, as the bar's buttons do.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const target = e.target instanceof Element ? e.target : null
    if (e.defaultPrevented || targeting || menu || drag.dragging !== null || target?.matches(TYPING) || dialogOpen()) return
    const mod = e.ctrlKey || e.metaKey
    const key = e.key.toLowerCase()
    const run =
      mod && !e.altKey && key === 'z' ? (e.shiftKey ? 'redo' : 'undo')
      : mod && !e.altKey && !e.shiftKey && key === 'y' ? 'redo'
      : mod || e.altKey || e.shiftKey ? null
      : e.key === 'ArrowLeft' ? 'undo'
      : e.key === 'ArrowRight' ? 'redo'
      : e.key === ' ' && !target?.matches('button') ? 'play'
      : key === 'e' ? 'endTurn'
      : null
    if (!run) return
    e.preventDefault()
    if (run === 'play') togglePlay()
    else if (run === 'endTurn') perform([END_TURN])
    else step(cursor + (run === 'redo' ? 1 : -1))
  })
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const openMenu = (id: number, at: { x: number; y: number }) => {
    if (playing) return
    setSelected(id)
    setMenu({ card: id, at })
  }
  /** Picks a card as a target, or drops it when it already is one. The activating card cannot target itself. */
  const pick = (id: number) =>
    setTargeting((now) => {
      if (!now || id === now.source) return now
      return { ...now, targets: now.targets.includes(id) ? now.targets.filter((other) => other !== id) : [...now.targets, id] }
    })
  const confirmTargets = () => {
    if (targeting) perform([{ t: 'activate', card: targeting.source, targets: targeting.targets }])
    setTargeting(null)
  }
  /** A mouse click selects; a keyboard click (no click count) opens the menu, which is how the keyboard moves a card. While picking targets, any click picks. */
  const onCard = (id: number, e: React.MouseEvent) => (targeting ? pick(id) : e.detail === 0 ? openMenu(id, anchor(e)) : setSelected(id))
  const onMenu = (id: number, e: React.MouseEvent) => {
    e.preventDefault() // not the browser's own menu
    if (!targeting) openMenu(id, anchor(e))
  }
  /** Opens a pile's window, or closes it when it is open. */
  const togglePile = (zone: Pile | MonsterSlot) => setPiles((open) => (open.includes(zone) ? open.filter((z) => z !== zone) : [...open, zone]))
  /** Locks the panel on the card, or lets go when it is already locked on it. */
  const toggleLock = (id: number) => setLocked((now) => (now === id ? null : id))

  /** A counter of a kind named just now: the kind is kept for the menu, and one of it goes on the card. */
  const addKind = (card: number, name: string) => {
    const kind = name.slice(0, LIMITS.kind)
    if (!kind) return
    dispatch({ type: 'counterType', name: kind })
    perform([{ t: 'counter', card, delta: 1, kind }])
  }
  const tagCard = (card: number, text: string) => {
    if ((board.cards[card]?.tag ?? '') !== text) perform([{ t: 'tag', card, text }])
  }

  const nameOf = (id: number) => {
    const code = board.cards[id]!.code
    return cards.get(code)?.name ?? String(code)
  }

  // A materials window needs a stack of two or more. When a move, Undo or Reset leaves fewer it closes for good,
  // here in render: an effect would paint one frame of "×0", and leaving the state set would bring the window back
  // the next time something is stacked there.
  const open = piles.filter((zone) => !isMonsterSlot(zone) || board.zones[zone].length >= 2)
  if (open.length !== piles.length) setPiles(open)

  const inPanel = locked ?? hovered ?? selected
  const picked = inPanel === null ? undefined : board.cards[inPanel]
  const code = picked?.code ?? null
  /** Only this deck's cards: an id that failed for an earlier deck is not this one's problem. */
  const lookupFailed = [...session.deck.main, ...session.deck.extra].some((id) => failed.has(id))

  return (
    <div className="sim-stage">
      <h1 className="sr-only">{t('title')}</h1>
      <DeckPicker
        open={picker}
        onClose={() => setPicker(false)}
        lookup={ensure}
        onPick={(build) =>
          discard(hasActions, () => {
            dispatch({ type: 'load', deck: build.deck, name: build.name, deckId: build.deckId })
            setNotice(null) // a damaged link says nothing about the deck just loaded
            forget()
          })
        }
      />
      <MyCombos open={listing} onClose={() => setListing(false)} onOpen={openCombo} onDeleted={comboDeleted} />
      <VideoDialog open={videoOpen} onClose={() => setVideoFor(null)} comboId={session.combo?.id ?? ''} actions={session.actions} start={session.start} />

      <section aria-label={t('title')} className="sim-field">
        <Room />
        <div className="sim-bar">
          <Button variant="secondary" size="icon" href="/" aria-label={t('home')} title={t('home')} className="shrink-0">
            <Icon name="left" />
          </Button>
          <button
            type="button"
            aria-label={t('toolbar.deck')}
            title={t('toolbar.deck')}
            disabled={playing || saves.busy}
            onClick={() => setPicker(true)}
            className="min-w-0 cursor-pointer text-left disabled:cursor-not-allowed"
          >
            <span className="block text-ink-muted signal-sm">{t('eyebrow')}</span>
            <span className="flex items-center gap-1 text-ink body-strong">
              <span className="truncate">{session.name || t('toolbar.deck')}</span>
              <Icon name="down" size={14} className="shrink-0" />
            </span>
          </button>
        </div>

        <div className="sim-notices">
          {notice ? (
            <Alert
              tone="warn"
              edged
              title={t(notice)}
              action={
                <Button variant="ghost" size="sm" onClick={() => setNotice(null)} className={TOUCH}>
                  {t('dismiss')}
                </Button>
              }
            />
          ) : null}
          {lookupFailed ? (
            <Alert
              tone="warn"
              edged
              title={t('lookupFailed')}
              action={
                <Button variant="secondary" size="sm" onClick={() => setLookupAttempt((n) => n + 1)} className={TOUCH}>
                  {t('retry')}
                </Button>
              }
            />
          ) : null}
          <SaveFlowView flow={saves} playing={playing} />
          {targeting ? (
            <Alert
              tone="info"
              edged
              title={t('targets.prompt', { count: targeting.targets.length })}
              action={
                <div className="flex gap-2">
                  <Button size="sm" disabled={targeting.targets.length === 0} onClick={confirmTargets} className={TOUCH}>
                    {t('targets.confirm')}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setTargeting(null)} className={TOUCH}>
                    {t('targets.cancel')}
                  </Button>
                </div>
              }
            />
          ) : null}
        </div>

        <LifePlate label={t('life.rival')} lp={START_LP} className="sim-life-rival" />
        <LifePlate mine label={t('life.you')} lp={START_LP} className="sim-life-you" />
        <BoardView
          fill
          board={board}
          cards={cards}
          selected={selected}
          activation={activation}
          marked={marked}
          destroyed={destroyed}
          tags={cursor === end}
          step={{ cursor, actions: session.actions }}
          droppedRef={droppedRef}
          dealtRef={dealtRef}
          flipMs={FLIP_MS / Math.max(1, speed)}
          onCard={onCard}
          onMenu={onMenu}
          onLongPress={(id, at) => !targeting && openMenu(id, at)}
          onActivate={(id) => !targeting && perform([{ t: 'activate', card: id, targets: [] }])}
          onHover={setHovered}
          locked={locked}
          onLock={toggleLock}
          drag={drag}
          onPile={togglePile}
        />
        {playing && shown?.note ? <p className="sim-caption text-ink body">{shown.note}</p> : null}
        <Dock board={board} session={session} playing={playing || saves.busy} picking={targetMode} onAct={perform} onUndo={() => step(cursor - 1)} onRedo={() => step(cursor + 1)} />
      </section>

      <aside aria-label={t('rail.label')} className="sim-rail">
        {/* A save on its way holds these too: a deck or hand loaded before it lands would be tied to that combo. */}
        <Commands
          session={session}
          playing={playing || saves.busy}
          onNewHand={newHand}
          onChooseHand={() => setChoosing(true)}
          onReset={reset}
          unsaved={saves.unsaved}
          onSave={saves.save}
          onSaveAs={saves.saveAs}
          onMyCombos={() => saves.gate(() => setListing(true))}
          onShare={saves.share}
          onVideo={askVideo}
        />
        <RailHead num="01" label={t('rail.card')} />
        {/* It follows the pointer over the board, or stays on the card it is locked on. */}
        <CardPanel code={code} card={code === null ? null : (cards.get(code) ?? null)} locked={locked !== null} onUnlock={() => setLocked(null)} className="sim-rail-section sim-rail-card" />
        <RailHead num="02" label={t('rail.log')} />
        <div className="sim-rail-section sim-rail-log">
          <History
            session={session}
            boards={boards}
            cards={cards}
            nameOf={nameOf}
            disabled={playing || targetMode}
            onSeek={step}
            onSetStart={(start) => dispatch({ type: 'setStart', start })}
            className="max-h-none overflow-visible"
          />
        </div>
        {/* The caption of the step on screen: a field to write it in by hand; while a replay plays, its text shows over the field. */}
        {cursor === 0 || playing ? null : (
          <div className="sim-rail-section border-t border-line">
            <TextInput
              aria-label={t('caption.label')}
              placeholder={t('caption.placeholder')}
              maxLength={LIMITS.note}
              value={shown?.note ?? ''}
              onChange={(e) => dispatch({ type: 'note', index: cursor - 1, note: e.target.value })}
              plateClassName={TOUCH}
            />
          </div>
        )}
        <RailHead num="03" label={t('rail.zones')} className="border-t" />
        <PileCounts board={board} onPile={togglePile} />
        <div className="sim-rail-section flex flex-col gap-3 border-t border-line">
          <ReplayBar
            cursor={cursor}
            end={end}
            start={session.start}
            playing={playing}
            picking={targetMode}
            speed={speed}
            onStep={step}
            onPlay={togglePlay}
            onSpeed={setSpeed}
          />
          <Button size="lg" disabled={playing || saves.busy || board.cards.length === 0} onClick={() => perform([END_TURN])} className="w-full">
            {t('toolbar.endTurn')}
          </Button>
        </div>
      </aside>

      {/* Each open pile in its own window, the last opened on top. */}
      {piles.map((zone, index) => (
        <PilePanel
          key={zone}
          board={board}
          zone={zone}
          cards={cards}
          activation={activation}
          picking={targeting !== null}
          index={index}
          onCard={onCard}
          onMenu={onMenu}
          onHover={setHovered}
          drag={drag}
          onClose={() => togglePile(zone)}
        />
      ))}

      <DragGhost card={dragging === null ? undefined : board.cards[dragging]} cards={cards} ghostRef={drag.ghostRef} />

      {/* Outside the board: its container query box would be the containing block of anything fixed inside it. */}
      {menu ? (
        <CardMenu
          key={`${menu.card}:${menu.at.x}:${menu.at.y}`}
          board={board}
          card={menu.card}
          at={menu.at}
          kinds={kinds}
          extra={isExtra(menu.card)}
          onAct={perform}
          onTargets={(source) => setTargeting({ source, targets: [] })}
          onNewKind={setNaming}
          onTag={setTagging}
          onPile={togglePile}
          onClose={() => setMenu(null)}
          xyz={isXyz(menu.card)}
        />
      ) : null}

      {choosing ? <HandPicker board={initial(session.deck)} cards={cards} onClose={() => setChoosing(false)} onPick={chooseHand} /> : null}

      {/* Keyed by the card: each asks afresh, with that card's own tag filled in. */}
      {naming !== null ? (
        <TextDialog
          key={`kind:${naming}`}
          open
          title={t('counterKind.title')}
          label={t('counterKind.label')}
          initial=""
          maxLength={LIMITS.kind}
          confirm={t('counterKind.confirm')}
          onConfirm={(name) => addKind(naming, name)}
          onClose={() => setNaming(null)}
        />
      ) : null}
      {tagging !== null ? (
        <TextDialog
          key={`tag:${tagging}`}
          open
          title={t('tagDialog.title', { name: nameOf(tagging) })}
          label={t('tagDialog.label')}
          initial={board.cards[tagging]?.tag ?? ''}
          maxLength={LIMITS.tag}
          confirm={t('tagDialog.confirm')}
          onConfirm={(text) => tagCard(tagging, text)}
          onClose={() => setTagging(null)}
        />
      ) : null}

      <Dialog
        size="sm"
        open={pending !== null}
        onClose={() => setPending(null)}
        title={t('confirm.title')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)} className={TOUCH}>
              {t('confirm.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                pending?.()
                setPending(null)
              }}
              className={TOUCH}
            >
              {t('confirm.discard')}
            </Button>
          </>
        }
      >
        <p className="text-ink body">{t('confirm.body')}</p>
      </Dialog>
    </div>
  )
}

export default Simulator
