'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useEffectEvent, useMemo, useReducer, useRef, useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Dialog } from '@ui/dialog'
import { TextInput } from '@ui/field'
import { PageHeader } from '@ui/page-header'
import { TabBar, tabPanelProps } from '@ui/tab-bar'
import { DeckPicker } from '@app/calculator/deck-picker'
import { useCardCache } from '@app/deck-builder/use-card-cache'
import { initial, isMonsterSlot, shuffleAction, stepCards, timeline, validRun } from '@utils/simulator/board'
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
import { PilePanel } from './pile-panel'
import { ReplayBar, type Speed } from './replay-bar'
import { Toolbar, TOUCH } from './toolbar'
import { useDrag } from './use-drag'

const DRAFT_DELAY_MS = 300
/** How long a step stays on screen at 1x: a move or a draw has a card to follow, the rest only changes in place. */
const stepMs = (a: Action | undefined) => (a?.t === 'move' || a?.t === 'draw' ? 1200 : 700)
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
  /** The card the card panel shows: an instance id, so every reset of the board clears it. */
  const [selected, setSelected] = useState<number | null>(null)
  const [menu, setMenu] = useState<{ card: number; at: { x: number; y: number } } | null>(null)
  /** Target mode: the card being activated and the cards picked so far. Menus and drag are off until it is confirmed or cancelled. */
  const [targeting, setTargeting] = useState<{ source: number; targets: number[] } | null>(null)
  /** The pile (or the monster slot, for its Xyz materials) whose panel is open. */
  const [pile, setPile] = useState<Pile | MonsterSlot | null>(null)
  /** A replay is stepping from `start` to the end: menus, drag, target mode and the toolbar are off. */
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>(1)
  /** Below `lg` the card panel and the history share the space under the board as two tabs. */
  const [tab, setTab] = useState<'card' | 'history'>('card')
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
  /**
   * Shows step `to` as the replay and its controls do: the card panel follows the card that step played (a step with
   * none, a shuffle or an end of turn, leaves it). Acting by hand is not this: a draw or a drag leaves the panel alone.
   */
  const go = (to: number) => {
    const at = Math.max(0, Math.min(to, end))
    const card = at > 0 ? stepCards(session.actions[at - 1]!, boards[at - 1]!)[0] : undefined
    if (card !== undefined) setSelected(card)
    dispatch({ type: 'seek', cursor: at })
  }
  /** The bar's buttons, its timeline, the arrows and the history: they pause a replay, then show that step. */
  const step = (to: number) => {
    setPlaying(false)
    go(to)
  }

  // One timer per step, as long as the step on screen asks at this speed: a pause, the unmount or any move of the cursor
  // clears it; the step that reaches the end stops the replay.
  const delay = stepMs(shown) / speed
  const advance = useEffectEvent(() => {
    go(cursor + 1)
    if (cursor + 1 >= end) setPlaying(false)
  })
  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(advance, delay)
    return () => clearTimeout(timer)
  }, [playing, cursor, end, delay])

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
  /** A new board: the card the panel shows and a pick in progress mean nothing on it. */
  const forget = () => {
    setSelected(null)
    setTargeting(null)
  }

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
    if (playing) return setPlaying(false)
    if (targeting || session.start >= end) return
    if (cursor === end || cursor < session.start) go(session.start)
    setMenu(null)
    setPlaying(true)
  }

  /** An Xyz monster, by its looked-up card: summoned over cards, it comes in on top of them. */
  const isXyz = (id: number) => !!cards.get(board.cards[id]?.code ?? -1)?.monsterTypes.includes('xyz')
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
      : null
    if (!run) return
    e.preventDefault()
    if (run === 'play') togglePlay()
    else step(cursor + (run === 'redo' ? 1 : -1))
  })
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  /** The card panel shows `id`; below `lg` its tab comes forward. */
  const show = (id: number) => {
    setSelected(id)
    setTab('card')
  }
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
  const onCard = (id: number, e: React.MouseEvent) => (targeting ? pick(id) : e.detail === 0 ? openMenu(id, anchor(e)) : show(id))
  const onMenu = (id: number, e: React.MouseEvent) => {
    e.preventDefault() // not the browser's own menu
    if (!targeting) openMenu(id, anchor(e))
  }

  const nameOf = (id: number) => {
    const code = board.cards[id]!.code
    return cards.get(code)?.name ?? String(code)
  }

  // A materials panel needs a stack of two or more. When a move, Undo or Reset leaves fewer it closes for good,
  // here in render: an effect would paint one frame of "×0", and leaving the state set would bring the panel back
  // the next time something is stacked there.
  if (pile !== null && isMonsterSlot(pile) && board.zones[pile].length < 2) setPile(null)

  const picked = selected === null ? undefined : board.cards[selected]
  const code = picked?.code ?? null
  /** Only this deck's cards: an id that failed for an earlier deck is not this one's problem. */
  const lookupFailed = [...session.deck.main, ...session.deck.extra].some((id) => failed.has(id))

  return (
    <div className="mx-auto flex w-[min(1280px,calc(100%-32px))] flex-col gap-6 pt-8 pb-24">
      <PageHeader eyebrow={t('eyebrow')} eyebrowMeta={session.name || undefined} title={t('title')} />
      <DeckPicker
        open={picker}
        onClose={() => setPicker(false)}
        lookup={ensure}
        onPick={(build) =>
          discard(hasActions, () => {
            dispatch({ type: 'load', deck: build.deck, name: build.name })
            setNotice(null) // a damaged link says nothing about the deck just loaded
            forget()
          })
        }
      />

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

      <Toolbar
        board={board}
        session={session}
        playing={playing}
        picking={targetMode}
        onDeck={() => setPicker(true)}
        onNewHand={newHand}
        onChooseHand={() => setChoosing(true)}
        onAct={perform}
        onUndo={() => step(cursor - 1)}
        onRedo={() => step(cursor + 1)}
        onReset={reset}
      />
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

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-3">
          <BoardView
            board={board}
            cards={cards}
            selected={selected}
            activation={activation}
            marked={marked}
            step={{ cursor, actions: session.actions }}
            droppedRef={droppedRef}
            flipMs={FLIP_MS / Math.max(1, speed)}
            onCard={onCard}
            onMenu={onMenu}
            onLongPress={(id, at) => !targeting && openMenu(id, at)}
            onActivate={(id) => !targeting && perform([{ t: 'activate', card: id, targets: [] }])}
            drag={drag}
            onPile={(zone) => setPile((open) => (open === zone ? null : zone))}
          />
          {/* The caption of the step on screen: a field to write it in by hand, its text alone while a replay plays. */}
          {cursor === 0 ? null : playing ? (
            shown?.note ? <p className="text-center text-ink body">{shown.note}</p> : null
          ) : (
            <TextInput
              aria-label={t('caption.label')}
              placeholder={t('caption.placeholder')}
              maxLength={LIMITS.note}
              value={shown?.note ?? ''}
              onChange={(e) => dispatch({ type: 'note', index: cursor - 1, note: e.target.value })}
              plateClassName={TOUCH}
            />
          )}
        </div>
        <div className="flex flex-col gap-4">
          {pile ? (
            <PilePanel
              board={board}
              zone={pile}
              cards={cards}
              activation={activation}
              picking={targeting !== null}
              onCard={onCard}
              onMenu={onMenu}
              drag={drag}
              onClose={() => setPile(null)}
            />
          ) : null}
          {/* Below `lg` the card panel and the history are two tabs under the board; from `lg` the column stacks both. */}
          <TabBar
            tabs={[
              { id: 'card', label: t('tabs.card') },
              { id: 'history', label: t('tabs.history') },
            ]}
            active={tab}
            onSelect={setTab}
            label={t('tabs.label')}
            idPrefix="simulator-side"
            className="lg:hidden"
          />
          <div {...tabPanelProps('simulator-side', 'card')} className={tab === 'card' ? undefined : 'max-lg:hidden'}>
            <CardPanel code={code} card={code === null ? null : (cards.get(code) ?? null)} />
          </div>
          <div {...tabPanelProps('simulator-side', 'history')} className={tab === 'history' ? undefined : 'max-lg:hidden'}>
            <History
              session={session}
              boards={boards}
              cards={cards}
              nameOf={nameOf}
              disabled={playing || targetMode}
              onSeek={step}
              onSetStart={(start) => dispatch({ type: 'setStart', start })}
            />
          </div>
        </div>
      </div>

      <DragGhost card={dragging === null ? undefined : board.cards[dragging]} cards={cards} ghostRef={drag.ghostRef} />

      {/* Outside the board: its container query box would be the containing block of anything fixed inside it. */}
      {menu ? (
        <CardMenu
          key={`${menu.card}:${menu.at.x}:${menu.at.y}`}
          board={board}
          card={menu.card}
          at={menu.at}
          onAct={perform}
          onTargets={(source) => setTargeting({ source, targets: [] })}
          onDetails={show}
          onPile={setPile}
          onClose={() => setMenu(null)}
          xyz={isXyz(menu.card)}
        />
      ) : null}

      {choosing ? <HandPicker board={initial(session.deck)} cards={cards} onClose={() => setChoosing(false)} onPick={chooseHand} /> : null}

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
