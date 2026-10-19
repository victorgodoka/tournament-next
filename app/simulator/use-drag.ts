'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { MOVE_SLOP } from '@app/deck-builder/gestures'
import { ZONES } from '@utils/simulator/types'
import type { ZoneId } from '@utils/simulator/types'

export type DragOptions = {
  /** Off while the card menu is open, while targets are picked and while a replay plays. */
  enabled: boolean
  /** The pointer came up over `zone` (null: outside every zone) after a drag; `shift` was held at the drop. */
  onDrop(card: number, zone: ZoneId | null, shift: boolean): void
}

type Point = { x: number; y: number }

/** The ghost follows the pointer through the DOM: a state update per move would render the whole board. */
const follow = (el: HTMLElement | null, { x, y }: Point) => {
  if (el) el.style.translate = `${x}px ${y}px`
}

/**
 * Pointer-event dragging for mouse, finger and pen. A press that travels past `MOVE_SLOP` becomes a drag: the
 * pointer is captured, `ghostRef` (rendered by the caller while `dragging` is set) follows it, and on release the
 * nearest `[data-zone]` under it is handed to `onDrop`. The click a mouse release sends after a drag is swallowed.
 * `touch: false` leaves finger presses alone, for a list that must scroll.
 */
export const useDrag = ({ enabled, onDrop }: DragOptions) => {
  const ghostRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  /** The pointer that is down on a card, and whether it has gone past the slop yet. */
  const press = useRef<{ card: number; id: number; from: Point; at: Point; moved: boolean } | null>(null)
  const swallow = useRef(false)

  // The ghost mounts after the first move that crossed the slop: put it under the pointer before it paints.
  useLayoutEffect(() => {
    if (dragging !== null && press.current) follow(ghostRef.current, press.current.at)
  }, [dragging])

  const cancel = () => {
    press.current = null
    setDragging(null)
  }

  return {
    bind: (card: number, touch: boolean) => ({
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        swallow.current = false // a new press: whatever click was left over from the last drag is gone
        if (!enabled || e.button !== 0 || (!touch && e.pointerType === 'touch')) return
        const at = { x: e.clientX, y: e.clientY }
        press.current = { card, id: e.pointerId, from: at, at, moved: false }
        // So the release lands here wherever the pointer went (a quick flick leaves the card before the first move).
        e.currentTarget.setPointerCapture?.(e.pointerId)
      },
      onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
        const p = press.current
        if (!p || e.pointerId !== p.id) return
        p.at = { x: e.clientX, y: e.clientY }
        if (!p.moved) {
          if (!enabled || Math.hypot(p.at.x - p.from.x, p.at.y - p.from.y) <= MOVE_SLOP) return
          p.moved = true
          setDragging(p.card)
        }
        follow(ghostRef.current, p.at)
      },
      onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
        const p = press.current
        if (!p || e.pointerId !== p.id) return
        cancel()
        if (!p.moved) return
        swallow.current = true
        const zone = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-zone]')?.getAttribute('data-zone')
        onDrop(p.card, ZONES.find((z) => z === zone) ?? null, e.shiftKey)
      },
      onPointerCancel: (e: React.PointerEvent<HTMLElement>) => {
        if (e.pointerId === press.current?.id) cancel()
      },
      /** Only a click from a pointer: a key's click (no click count) is never the tail of a drag. */
      onClickCapture: (e: React.MouseEvent) => {
        if (!swallow.current || e.detail === 0) return
        swallow.current = false
        e.stopPropagation()
        e.preventDefault()
      },
    }),
    ghostRef,
    dragging,
  }
}

export type Drag = ReturnType<typeof useDrag>
