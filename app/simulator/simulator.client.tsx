'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Dialog } from '@ui/dialog'
import { PageHeader } from '@ui/page-header'
import { DeckPicker } from '@app/calculator/deck-picker'
import { useCardCache } from '@app/deck-builder/use-card-cache'
import { initial, shuffleAction, timeline, validRun } from '@utils/simulator/board'
import { draftStorage, writeDraft } from '@utils/simulator/draft'
import { sessionReducer } from '@utils/simulator/session'
import type { Action, MonsterSlot, Pile } from '@utils/simulator/types'
import { BoardView } from './board'
import { bootSession, type Boot } from './boot'
import { CardMenu } from './card-menu'
import { CardPanel } from './card-panel'
import { PilePanel } from './pile-panel'
import { Toolbar, TOUCH } from './toolbar'

const DRAFT_DELAY_MS = 300

/** Where a menu opens for a click: at the pointer, or under the card when a key sent it (those carry no coordinates). */
const anchor = (e: React.MouseEvent) => {
  if (e.clientX || e.clientY) return { x: e.clientX, y: e.clientY }
  const box = e.currentTarget.getBoundingClientRect()
  return { x: box.left, y: box.bottom }
}

/** Boots once from `?d=` or the draft (client only: the loader is `ssr: false`), then hands over to the loaded simulator. */
const Simulator = () => {
  const [boot] = useState(() => bootSession(window.location.search, draftStorage()))
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
  /** The card the card panel shows: an instance id, so every reset of the board clears it. */
  const [selected, setSelected] = useState<number | null>(null)
  const [menu, setMenu] = useState<{ card: number; at: { x: number; y: number } } | null>(null)
  /** The pile (or the monster slot, for its Xyz materials) whose panel is open. */
  const [pile, setPile] = useState<Pile | MonsterSlot | null>(null)
  const [lookupAttempt, setLookupAttempt] = useState(0)
  const { cards, failed, ensure } = useCardCache()

  const boards = useMemo(() => timeline(session.deck, session.actions), [session.deck, session.actions])
  const board = boards[session.cursor]!

  useEffect(() => {
    ensure([...session.deck.main, ...session.deck.extra]).catch(() => {})
  }, [session.deck, ensure, lookupAttempt])

  // The booted session is never written back, so a damaged link leaves the draft alone.
  useEffect(() => {
    if (session === boot.session) return
    const timer = setTimeout(() => writeDraft(draftStorage(), session), DRAFT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [session, boot.session])

  const perform = (actions: Action[]) => {
    if (validRun(board, actions)) dispatch({ type: 'act', actions })
  }

  /** Runs `run` at once, or after the confirm dialog when it would throw away something worth asking about. */
  const discard = (ask: boolean, run: () => void) => (ask ? setPending(() => run) : run())
  const hasActions = session.actions.length > 0

  /** Reset, shuffle, draw 5. Only shuffles and draws so far: no question, so testing hands takes one click each. */
  const newHand = () => {
    const start = initial(session.deck)
    const actions: Action[] = [shuffleAction(start), { t: 'draw', n: 5 }]
    if (!validRun(start, actions)) return
    discard(
      session.actions.some((a) => a.t !== 'shuffle' && a.t !== 'draw'),
      () => {
        dispatch({ type: 'reset' })
        dispatch({ type: 'act', actions })
        setSelected(null)
      },
    )
  }

  const reset = () =>
    discard(hasActions, () => {
      dispatch({ type: 'reset' })
      setSelected(null)
    })

  const openMenu = (id: number, e: React.MouseEvent) => {
    setSelected(id)
    setMenu({ card: id, at: anchor(e) })
  }
  /** A mouse click selects; a keyboard click (no click count) opens the menu, which is how the keyboard moves a card. */
  const onCard = (id: number, e: React.MouseEvent) => (e.detail === 0 ? openMenu(id, e) : setSelected(id))
  const onMenu = (id: number, e: React.MouseEvent) => {
    e.preventDefault() // not the browser's own menu
    openMenu(id, e)
  }

  const picked = selected === null ? undefined : board.cards[selected]
  const code = picked?.code ?? null

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
            setSelected(null)
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
      {failed.size ? (
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
        onDeck={() => setPicker(true)}
        onNewHand={newHand}
        onAct={perform}
        onUndo={() => dispatch({ type: 'undo' })}
        onRedo={() => dispatch({ type: 'redo' })}
        onReset={reset}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <BoardView
          board={board}
          cards={cards}
          selected={selected}
          onCard={onCard}
          onMenu={onMenu}
          onPile={(zone) => setPile((open) => (open === zone ? null : zone))}
        />
        <div className="flex flex-col gap-4">
          {pile ? <PilePanel board={board} zone={pile} cards={cards} onCard={onCard} onMenu={onMenu} onClose={() => setPile(null)} /> : null}
          <CardPanel code={code} card={code === null ? null : (cards.get(code) ?? null)} />
        </div>
      </div>

      {/* Outside the board: its container query box would be the containing block of anything fixed inside it. */}
      {menu ? (
        <CardMenu
          key={`${menu.card}:${menu.at.x}:${menu.at.y}`}
          board={board}
          card={menu.card}
          at={menu.at}
          onAct={perform}
          onTargets={() => {}} // target mode comes with task 7
          onDetails={setSelected}
          onClose={() => setMenu(null)}
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
