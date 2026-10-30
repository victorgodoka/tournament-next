'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { cardsByIds } from '@utils/cards'
import { getCombo, type SharedCombo } from '@utils/combos'
import type { CardMap } from '@utils/deck/types'
import { chainAt, destroyedBy, stepCards, timeline } from '@utils/simulator/board'
import { sessionOf } from '@utils/simulator/combo'
import { fitCardWidth } from '@utils/simulator/fit'
import { sessionReducer } from '@utils/simulator/session'
import { renderTimeline } from '@utils/simulator/timing'
import type { Session } from '@utils/simulator/types'
import { BoardView, FLIP_MS } from './board'
import type { Speed } from './replay-bar'
import { Room } from './room'
import { useDrag } from './use-drag'

/** How the recorder drives the frame: it awaits `ready`, then seeks to the replay's time on every frame it records. */
export type RenderHandle = {
  /** Settles once the combo is on screen, fitted, with every image decoded (or broken), the zone marks and the fonts loaded. */
  ready: Promise<{ title: string; durationMs: number }>
  /** Shows the frame `ms` into the video. Forward only: a time before the last one rejects. */
  seek(ms: number): Promise<void>
}

/** The card width the board is first drawn at, to be measured. */
const PROBE = 100

type Loaded = { combo: SharedCombo; session: Session; cards: CardMap }

/** The combo opened at `start`, as the player opens it, and every card of its deck: no frame shows a card still loading. */
const loadCombo = async (id: string): Promise<Loaded> => {
  const combo = await getCombo(id)
  if (!combo) throw new Error('combo not found')
  const parsed = sessionOf(combo.payload, null, null)
  if (!parsed) throw new Error('combo damaged')
  const cards = await cardsByIds([...parsed.deck.main, ...parsed.deck.extra])
  return { combo, session: { ...parsed, cursor: parsed.start }, cards }
}

/** A combo that cannot be drawn: `ready` rejects with why. */
const failed = (error: unknown): RenderHandle => {
  const ready = Promise.reject(error)
  // Handled here: the recorder awaits it later, and a rejection nobody awaits yet would be a page error.
  ready.catch(() => {})
  return { ready, seek: () => ready }
}

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve))
/** Every image on the page decoded or broken: a 404 or a blocked origin leaves its frames without it, never fails the video. */
const decoded = () => Promise.allSettled(Array.from(document.querySelectorAll('img'), (img) => img.decode()))
const none = () => {}

type RenderProps = { id: string; speed: Speed; onReady(handle: RenderHandle): void }

/**
 * What the recording popup (`/simulator/c/<id>/render`) records: one frame of the replay filling its box, the title strip
 * over the board and the caption under it, moved through the video's time by the `seek` of the handle given to `onReady`.
 */
export const ComboRender = ({ id, speed, onReady }: RenderProps) => {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  // An effect event: a parent's new callback on every render never loads the combo again.
  const report = useEffectEvent(onReady)

  useEffect(() => {
    let live = true
    loadCombo(id).then(
      (l) => live && setLoaded(l),
      (error) => {
        if (live) report(failed(error))
      },
    )
    return () => {
      live = false
    }
  }, [id])

  return loaded ? <Frame {...loaded} speed={speed} onReady={onReady} /> : null
}

const Frame = ({ combo, session: opened, cards, speed, onReady }: Loaded & Omit<RenderProps, 'id'>) => {
  const t = useTranslations('Simulator')
  const [session, dispatch] = useReducer(sessionReducer, opened)
  /** Null while the board is drawn at `PROBE` to be measured. */
  const [cardW, setCardW] = useState<number | null>(null)
  const room = useRef<HTMLDivElement>(null)
  const caption = useRef<HTMLParagraphElement>(null)
  // Read-only: nothing drags and nothing drops.
  const drag = useDrag({ enabled: false, onDrop: none })
  const droppedRef = useRef<number | null>(null)
  const report = useEffectEvent(onReady)

  const boards = useMemo(() => timeline(session.deck, session.actions), [session.deck, session.actions])
  const board = boards[session.cursor]!
  const shown = session.actions[session.cursor - 1]
  const marked = useMemo(() => (shown ? stepCards(shown, boards[session.cursor - 1]!) : []), [shown, boards, session.cursor])
  const destroyed = useMemo(() => (shown ? destroyedBy(shown, boards[session.cursor - 1]!) : null), [shown, boards, session.cursor])
  const video = useMemo(() => renderTimeline(opened.actions, opened.start, speed), [opened, speed])

  // Fitted before the first paint, so each image is asked for once, at the width it is drawn. The board's root fills the
  // row, so its size is the span of the table and the hand; nothing around it depends on the fonts (one line each, a fixed
  // caption). The caption shares the room, under the board: the board gets the room less the caption and the gap above it.
  useLayoutEffect(() => {
    const el = room.current!
    const boxes = [...el.querySelectorAll('[data-mat], [data-zone="hand"]')].map((part) => part.getBoundingClientRect())
    const bottom = Math.max(...boxes.map((b) => b.bottom))
    const measured = {
      width: Math.max(...boxes.map((b) => b.right)) - Math.min(...boxes.map((b) => b.left)),
      height: bottom - Math.min(...boxes.map((b) => b.top)),
    }
    const { width, height } = el.getBoundingClientRect()
    setCardW(fitCardWidth(PROBE, measured, { width, height: height - (caption.current!.getBoundingClientRect().bottom - bottom) }))
  }, [])

  // Handed to the recorder once the board is fitted: the images `ready` waits on are the ones the frames show.
  useEffect(() => {
    if (cardW === null) return
    const ready = decoded()
      .then(() => document.fonts.ready)
      .then(() => ({ title: combo.title, durationMs: video.durationMs }))
    let cursor = opened.cursor
    let last = -Infinity
    report({
      ready,
      async seek(ms) {
        if (ms < last) throw new RangeError(`seek(${ms}) after seek(${last}): the video only goes forward`)
        last = ms
        const at = video.at(ms)
        if (at.cursor !== cursor) {
          cursor = at.cursor
          // Committed at once (the step's slides start in its layout effects), then two frames for its glow to start, then
          // the images the step mounted (a card drawn, a new GY top), so its first frame never shows an empty tile.
          flushSync(() => dispatch({ type: 'seek', cursor: at.cursor }))
          await frame()
          await frame()
          await decoded()
        }
        // Every slide and glow held at the time inside the step, however late the frame comes.
        for (const animation of document.getAnimations()) {
          animation.pause()
          animation.currentTime = at.offset
        }
      },
    })
  }, [cardW, combo.title, opened.cursor, video])

  const w = cardW ?? PROBE
  return (
    <div className="relative flex size-full flex-col gap-4 p-6">
      <Room still />
      <header className="flex shrink-0 items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="truncate text-ink display-3">{combo.title}</h1>
          {combo.owner.name === null ? null : <p className="truncate text-ink-muted body-sm">{t('player.by', { name: combo.owner.name })}</p>}
        </div>
        <p className="shrink-0 text-ink-muted signal">{t('render.brand')}</p>
      </header>
      <div ref={room} className="flex min-h-0 flex-1 flex-col justify-center gap-4">
        {/* Keyed by the width: drawn anew once fitted, before the first paint, so the places its slides start from and its
            arrows are taken at the fitted size, never at the probe's. */}
        <BoardView
          key={cardW ?? 'probe'}
          still
          chain={chainAt(session.actions, session.cursor)}
          board={board}
          cards={cards}
          selected={null}
          activation={shown?.t === 'activate' ? shown : null}
          marked={marked}
          destroyed={destroyed}
          tags={session.cursor === session.actions.length}
          step={{ cursor: session.cursor, actions: session.actions }}
          droppedRef={droppedRef}
          flipMs={FLIP_MS / Math.max(1, speed)}
          onCard={none}
          onMenu={none}
          onLongPress={none}
          onActivate={none}
          drag={drag}
          onPile={none}
          cardW={w}
          imageSizes={`${w}px`}
        />
        {/* Right under the board in both shapes, as in the player. Two lines kept for every caption, so the board never
            moves; the counter sits in the frame's corner. */}
        <p ref={caption} className="line-clamp-2 h-12 shrink-0 px-16 text-center text-ink body">
          {shown?.note}
        </p>
      </div>
      <span className="absolute right-6 bottom-6 text-ink-muted signal tabular-nums">{`${session.cursor}/${session.actions.length}`}</span>
    </div>
  )
}
