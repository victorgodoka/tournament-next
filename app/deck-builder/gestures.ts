import { useEffect, useRef } from 'react'

export const LONG_PRESS_MS = 450
/** Finger travel that still counts as holding still (or as a tap). */
export const MOVE_SLOP = 10
/** Leftward swipe on a deck row that removes a copy. */
const SWIPE_COMMIT = 64
/** Vertical drag on the tray handle that opens or closes it. */
const TRAY_DRAG = 48

/** How far a row follows a swipe: leftward only, and only while horizontal movement dominates. */
export const swipeTravel = (dx: number, dy: number) => (dx < 0 && Math.abs(dx) > Math.abs(dy) ? dx : 0)

export const swipeCommits = (dx: number, dy: number) => swipeTravel(dx, dy) < -SWIPE_COMMIT

/** The tray after a handle drag of `dy` (up is negative): past 48 px it opens or closes, short of that it stays. */
export const trayAfterDrag = (open: boolean, dy: number) => (dy < -TRAY_DRAG ? true : dy > TRAY_DRAG ? false : open)

export type PressKind = 'long' | 'tap' | 'click'

/**
 * Touch and pen presses for a set of elements (one press at a time): holding 450 ms within 10 px
 * runs the bound callback with a haptic tick. Mouse and keyboard pass through untouched. Each element
 * spreads `bind(onLongPress)` and asks `kind(e)` in its click and contextmenu handlers.
 */
export const useLongPress = () => {
  const press = useRef<{ x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null)
  const touch = useRef(false)
  const fired = useRef(false)

  const cancel = () => {
    clearTimeout(press.current?.timer)
    press.current = null
  }
  useEffect(() => cancel, [])

  return {
    bind: (onLongPress: () => void) => ({
      onPointerDown: (e: React.PointerEvent) => {
        cancel()
        touch.current = e.pointerType === 'touch' || e.pointerType === 'pen'
        fired.current = false
        if (!touch.current) return
        const timer = setTimeout(() => {
          press.current = null
          fired.current = true
          navigator.vibrate?.(10)
          onLongPress()
        }, LONG_PRESS_MS)
        press.current = { x: e.clientX, y: e.clientY, timer }
      },
      onPointerMove: (e: React.PointerEvent) => {
        const p = press.current
        if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_SLOP) cancel()
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
    }),
    /** `long`: a long press already handled it. `tap`: a touch or pen tap. `click`: mouse or keyboard. */
    kind: (e: React.MouseEvent): PressKind => {
      if (e.type === 'click' && e.detail === 0) return 'click' // keyboard
      if (!touch.current) return 'click'
      return fired.current ? 'long' : 'tap'
    },
  }
}
