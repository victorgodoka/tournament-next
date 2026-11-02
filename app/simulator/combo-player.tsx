'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useEffectEvent, useMemo, useReducer, useRef, useState } from 'react'
import { useAuth } from '@contexts/auth/auth.context'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Dialog } from '@ui/dialog'
import { PageHeader } from '@ui/page-header'
import { TabBar, tabPanelProps } from '@ui/tab-bar'
import { useCardCache } from '@app/deck-builder/use-card-cache'
import { getCombo, type SharedCombo } from '@utils/combos'
import { chainAt, destroyedBy, stepCards, timeline } from '@utils/simulator/board'
import { comboSession, operateFrom, payloadOf, sessionOf } from '@utils/simulator/combo'
import { draftStorage, readDraft, writeDraft } from '@utils/simulator/draft'
import { sessionReducer } from '@utils/simulator/session'
import type { Session } from '@utils/simulator/types'
import { BoardView, FLIP_MS } from './board'
import { CardPanel } from './card-panel'
import { History } from './history'
import { ChainPlate, LifePlate } from './hud'
import { ReplayBar } from './replay-bar'
import { Room } from './room'
import { TOUCH } from './toolbar'
import { useDrag } from './use-drag'
import { useReplay } from './use-replay'
import { VideoDialog } from './video-dialog'

const COUNTDOWN_S = 3
const WIDTH = 'mx-auto w-[min(var(--container-page),calc(100%-32px))]'
/** Wider than the page's text: the table wants the room, short of filling the window. */
const STAGE_WIDTH = 'mx-auto w-[min(1600px,calc(100%-32px))]'

type Load = { kind: 'loading' | 'notFound' | 'damaged' | 'failed' } | { kind: 'ready'; combo: SharedCombo; session: Session }

/** A share link (`/simulator/c/<id>`): fetches the combo, replays its log as a draft is, then plays it read-only. */
export const ComboPlayer = ({ id }: { id: string }) => {
  const t = useTranslations('Simulator')
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    getCombo(id).then(
      (combo) => {
        if (!live) return
        if (!combo) return setLoad({ kind: 'notFound' })
        // Replayed like a draft; it opens at `start`, where the replay begins.
        const parsed = sessionOf(combo.payload, null, null)
        setLoad(parsed ? { kind: 'ready', combo, session: { ...parsed, cursor: parsed.start } } : { kind: 'damaged' })
      },
      () => live && setLoad({ kind: 'failed' }),
    )
    return () => {
      live = false
    }
  }, [id, attempt])

  // Keyed: another link opened in place starts its own session, never the last one's.
  if (load.kind === 'ready') return <Player key={load.combo.id} combo={load.combo} opened={load.session} />
  if (load.kind === 'loading') {
    return (
      <p role="status" className={`${WIDTH} pt-8 text-ink-muted body`}>
        {t('player.loading')}
      </p>
    )
  }
  return (
    <div className={`${WIDTH} pt-8`}>
      <Alert
        tone={load.kind === 'failed' ? 'negative' : 'warn'}
        edged
        title={t(`player.${load.kind}`)}
        action={
          load.kind === 'failed' ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setLoad({ kind: 'loading' })
                setAttempt((n) => n + 1)
              }}
              className={TOUCH}
            >
              {t('retry')}
            </Button>
          ) : undefined
        }
      />
    </div>
  )
}

const Player = ({ combo, opened }: { combo: SharedCombo; opened: Session }) => {
  const t = useTranslations('Simulator')
  const router = useRouter()
  const { user } = useAuth()
  const [session, dispatch] = useReducer(sessionReducer, opened)
  const [selected, setSelected] = useState<number | null>(null)
  /** The card under the pointer: the panel shows it, else the selected one, as on the table. */
  const [hovered, setHovered] = useState<number | null>(null)
  /** The card panel and the history share the rail as two tabs. */
  const [tab, setTab] = useState<'card' | 'history'>('card')
  /** Seconds before the replay starts by itself; null once it started or was cancelled. Nothing to play, nothing to count. */
  const [countdown, setCountdown] = useState<number | null>(opened.start < opened.actions.length ? COUNTDOWN_S : null)
  /** The session "Operate from here" or Edit hands to the simulator, waiting on the confirm. */
  const [pending, setPending] = useState<Session | null>(null)
  const [videoOpen, setVideoOpen] = useState(false)
  const { cards, ensure } = useCardCache()

  const boards = useMemo(() => timeline(session.deck, session.actions), [session.deck, session.actions])
  const board = boards[session.cursor]!
  const shown = session.actions[session.cursor - 1]
  const marked = useMemo(() => (shown ? stepCards(shown, boards[session.cursor - 1]!) : []), [shown, boards, session.cursor])
  const destroyed = useMemo(() => (shown ? destroyedBy(shown, boards[session.cursor - 1]!) : null), [shown, boards, session.cursor])
  const chain = useMemo(() => chainAt(session.actions, session.cursor), [session.actions, session.cursor])
  const replay = useReplay({ session, boards, dispatch, onShow: setSelected })
  // Read-only: nothing drags and nothing drops.
  const drag = useDrag({ enabled: false, onDrop: () => {} })
  const droppedRef = useRef<number | null>(null)

  useEffect(() => {
    ensure([...session.deck.main, ...session.deck.extra]).catch(() => {})
  }, [session.deck, ensure])

  /** Any hand on the replay ends the countdown: it would pull the viewer back to `start`. */
  const toggle = () => {
    setCountdown(null)
    replay.toggle()
  }
  const step = (to: number) => {
    setCountdown(null)
    replay.step(to)
  }
  const tick = useEffectEvent(() => (countdown! > 1 ? setCountdown(countdown! - 1) : toggle()))
  useEffect(() => {
    if (countdown === null) return
    const timer = setTimeout(tick, 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  /** Writing the draft and opening the simulator is the whole hand-off: it boots from that draft. */
  const handOff = (next: Session) => {
    writeDraft(draftStorage(), next)
    router.push('/simulator')
  }
  /** The viewer's own line in progress is replaced only once they agree. */
  const ask = (next: Session) => (readDraft(draftStorage())?.actions.length ? setPending(next) : handOff(next))
  const operate = () => ask(operateFrom(payloadOf(session), session.cursor))
  const edit = () => {
    const tied = comboSession(combo)
    if (tied) ask(tied)
  }

  const show = (id: number) => {
    setSelected(id)
    setTab('card')
  }
  const nameOf = (id: number) => {
    const code = board.cards[id]!.code
    return cards.get(code)?.name ?? String(code)
  }
  const inPanel = hovered ?? selected
  const code = inPanel === null ? null : (board.cards[inPanel]?.code ?? null)

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className={WIDTH}>
        <PageHeader
          eyebrow={t('eyebrow')}
          eyebrowMeta={combo.archetype ?? (session.name || undefined)}
          title={combo.title}
          lead={combo.owner.name === null ? undefined : t('player.by', { name: combo.owner.name })}
          end={
            <>
              <Button variant="ghost" href="/simulator/combos" className={TOUCH}>
                {t('browse.title')}
              </Button>
              {user?.id === combo.owner.id ? (
                <Button variant="secondary" onClick={edit} className={TOUCH}>
                  {t('player.edit')}
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => setVideoOpen(true)} className={TOUCH}>
                {t('video.open')}
              </Button>
              <Button onClick={operate} className={TOUCH}>
                {t('player.operate')}
              </Button>
            </>
          }
        />
      </div>

      {/* The simulator's own stage, inside the page: its window, not the whole one. */}
      <div data-framed className={`sim-stage ${STAGE_WIDTH}`}>
        <section aria-label={combo.title} className="sim-field">
          <Room />
          {countdown === null ? null : (
            <div className="sim-notices">
              <Alert
                tone="info"
                edged
                title={t('player.autoplay', { n: countdown })}
                action={
                  <div className="flex gap-2">
                    <Button size="sm" onClick={toggle} className={TOUCH}>
                      {t('player.playNow')}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setCountdown(null)} className={TOUCH}>
                      {t('player.cancel')}
                    </Button>
                  </div>
                }
              />
            </div>
          )}
          <LifePlate side="rival" lp={board.lp.rival} disabled onChange={() => {}} className="sim-life-rival" />
          <LifePlate side="me" lp={board.lp.me} disabled onChange={() => {}} className="sim-life-you" />
          <ChainPlate names={chain.map(nameOf)} />
          {/* Read-only: a click shows the card, and no menu, drag, activation or pile panel answers. */}
          <BoardView
            fill
            board={board}
            cards={cards}
            selected={selected}
            activation={shown?.t === 'activate' ? shown : null}
            marked={marked}
            destroyed={destroyed}
            tags={session.cursor === session.actions.length}
            step={{ cursor: session.cursor, actions: session.actions }}
            droppedRef={droppedRef}
            chain={chain}
            flipMs={FLIP_MS / Math.max(1, replay.speed)}
            onCard={show}
            onMenu={() => {}}
            onLongPress={() => {}}
            onActivate={() => {}}
            onHover={setHovered}
            drag={drag}
            onPile={() => {}}
          />
          {shown?.note ? <p className="sim-caption text-center text-ink body">{shown.note}</p> : null}
        </section>
        <aside aria-label={t('tabs.label')} className="sim-rail">
          <TabBar
            tabs={[
              { id: 'card', label: t('tabs.card') },
              { id: 'history', label: t('tabs.history') },
            ]}
            active={tab}
            onSelect={setTab}
            label={t('tabs.label')}
            idPrefix="player-side"
          />
          <div className="sim-rail-tabs">
            <div {...tabPanelProps('player-side', 'card')} data-off={tab === 'card' ? undefined : ''} className="sim-rail-tab">
              <CardPanel code={code} card={code === null ? null : (cards.get(code) ?? null)} className="sim-rail-section sim-rail-card" />
            </div>
            <div {...tabPanelProps('player-side', 'history')} data-off={tab === 'history' ? undefined : ''} className="sim-rail-tab">
              {/* "Replay starts here" moves this viewer's start only: the combo itself is never written from here. */}
              <History
                session={session}
                boards={boards}
                cards={cards}
                nameOf={nameOf}
                disabled={replay.playing}
                onSeek={step}
                onSetStart={(start) => dispatch({ type: 'setStart', start })}
                className="sim-rail-section sim-rail-log"
              />
            </div>
          </div>
          <div className="sim-rail-section border-t border-line">
            <ReplayBar
              cursor={session.cursor}
              end={session.actions.length}
              start={session.start}
              playing={replay.playing}
              picking={false}
              speed={replay.speed}
              onStep={step}
              onPlay={toggle}
              onSpeed={replay.setSpeed}
            />
          </div>
        </aside>
      </div>

      {/* The video is cut from the combo as it opened, like the render page does: this viewer's own "Replay starts here" never reaches it. */}
      <VideoDialog open={videoOpen} onClose={() => setVideoOpen(false)} comboId={combo.id} actions={opened.actions} start={opened.start} />

      <Dialog
        size="sm"
        open={pending !== null}
        onClose={() => setPending(null)}
        title={t('confirm.title')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)} className={TOUCH}>
              {t('player.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (pending) handOff(pending)
                setPending(null)
              }}
              className={TOUCH}
            >
              {t('confirm.discard')}
            </Button>
          </>
        }
      >
        <p className="text-ink body">{t('player.replace')}</p>
      </Dialog>
    </div>
  )
}
