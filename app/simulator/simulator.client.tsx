'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Dialog } from '@ui/dialog'
import { PageHeader } from '@ui/page-header'
import { DeckPicker } from '@app/calculator/deck-picker'
import { useCardCache } from '@app/deck-builder/use-card-cache'
import { apply, initial, isValid, shuffleAction, timeline } from '@utils/simulator/board'
import { draftStorage, writeDraft } from '@utils/simulator/draft'
import { sessionReducer } from '@utils/simulator/session'
import type { Action, Board } from '@utils/simulator/types'
import { BoardView } from './board'
import { bootSession, type Boot } from './boot'

const TOUCH = 'max-lg:min-h-11'
const DRAFT_DELAY_MS = 300
const DRAW: Action = { t: 'draw', n: 1 }
const END_TURN: Action = { t: 'endTurn' }

/** Every action is valid on the board the ones before it leave. */
const validRun = (board: Board, actions: readonly Action[]) => {
  let b = board
  for (const a of actions) {
    if (!isValid(b, a)) return false
    b = apply(b, a)
  }
  return true
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
  const [selected, setSelected] = useState<number | null>(null)
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
      },
    )
  }

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

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setPicker(true)} className={TOUCH}>
          {t('toolbar.deck')}
        </Button>
        <Button size="sm" disabled={session.deck.main.length === 0} onClick={newHand} className={TOUCH}>
          {t('toolbar.newHand')}
        </Button>
        <Button variant="secondary" size="sm" disabled={!isValid(board, DRAW)} onClick={() => perform([DRAW])} className={TOUCH}>
          {t('toolbar.draw')}
        </Button>
        <Button variant="secondary" size="sm" disabled={board.cards.length === 0} onClick={() => perform([END_TURN])} className={TOUCH}>
          {t('toolbar.endTurn')}
        </Button>
        <Button variant="secondary" size="sm" disabled={session.cursor === 0} onClick={() => dispatch({ type: 'undo' })} className={TOUCH}>
          {t('toolbar.undo')}
        </Button>
        <Button variant="secondary" size="sm" disabled={session.cursor === session.actions.length} onClick={() => dispatch({ type: 'redo' })} className={TOUCH}>
          {t('toolbar.redo')}
        </Button>
        <Button variant="ghost" size="sm" disabled={!hasActions} onClick={() => discard(hasActions, () => dispatch({ type: 'reset' }))} className={TOUCH}>
          {t('toolbar.reset')}
        </Button>
        <span className="ms-auto text-ink-muted signal">{t('turn', { n: board.turn })}</span>
      </div>

      <BoardView
        board={board}
        cards={cards}
        selected={selected}
        onCard={(id) => setSelected(id)}
        onMenu={(id) => setSelected(id)}
        onPile={() => {}} // the pile panel comes with the card menu
      />

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
