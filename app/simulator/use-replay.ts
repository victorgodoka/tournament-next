'use client'

import { useEffect, useEffectEvent, useState } from 'react'
import { stepCards } from '@utils/simulator/board'
import type { SessionEvent } from '@utils/simulator/session'
import type { Action, Board, Session } from '@utils/simulator/types'
import type { Speed } from './replay-bar'

/** How long a step stays on screen at 1x: a move or a draw has a card to follow, the rest only changes in place. */
const stepMs = (a: Action | undefined) => (a?.t === 'move' || a?.t === 'draw' ? 1200 : 700)

type ReplayOptions = {
  session: Session
  /** `timeline(deck, actions)` of the session. */
  boards: Board[]
  dispatch: React.Dispatch<SessionEvent>
  /** The card the step just shown played: the card panel follows it. */
  onShow(card: number): void
}

/** The replay of a session: play from `start` at a speed, step through it, and the card panel following each step. */
export const useReplay = ({ session, boards, dispatch, onShow }: ReplayOptions) => {
  /** A replay is stepping from `start` to the end. */
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>(1)
  const { cursor, actions } = session
  const end = actions.length

  /**
   * Shows step `to` as the replay and its controls do: the card panel follows the card that step played (a step with
   * none, a shuffle or an end of turn, leaves it). Acting by hand is not this: a draw or a drag leaves the panel alone.
   */
  const go = (to: number) => {
    const at = Math.max(0, Math.min(to, end))
    const card = at > 0 ? stepCards(actions[at - 1]!, boards[at - 1]!)[0] : undefined
    if (card !== undefined) onShow(card)
    dispatch({ type: 'seek', cursor: at })
  }
  /** The bar's buttons, its timeline, the arrows and the history: they pause a replay, then show that step. */
  const step = (to: number) => {
    setPlaying(false)
    go(to)
  }

  // One timer per step, as long as the step on screen asks at this speed: a pause, the unmount or any move of the cursor
  // clears it; the step that reaches the end stops the replay.
  const delay = stepMs(actions[cursor - 1]) / speed
  const advance = useEffectEvent(() => {
    go(cursor + 1)
    if (cursor + 1 >= end) setPlaying(false)
  })
  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(advance, delay)
    return () => clearTimeout(timer)
  }, [playing, cursor, end, delay])

  /** Play from `start` (or from where a pause left off), or pause. Not with no step after `start`. */
  const toggle = () => {
    if (playing) return setPlaying(false)
    if (session.start >= end) return
    if (cursor === end || cursor < session.start) go(session.start)
    setPlaying(true)
  }

  return { playing, speed, setSpeed, toggle, step, go }
}
