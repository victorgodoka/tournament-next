import { useEffect, useRef } from 'react'

export type Shortcut = 'search' | 'undo' | 'redo' | 'add' | 'remove' | 'side' | 'open' | Arrow
export type Arrow = 'left' | 'right' | 'up' | 'down'

type Keys = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>

const ARROWS: Record<string, Arrow> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }
const PLAIN: Record<string, Shortcut> = { '/': 'search', '+': 'add', '-': 'remove', s: 'side', S: 'side', Enter: 'open', ...ARROWS }

/** The editor's shortcut for a key press, or null. Nothing fires while typing in a field. */
export const shortcutOf = (e: Keys, typing: boolean): Shortcut | null => {
  if (typing || e.altKey) return null
  if (e.ctrlKey || e.metaKey) {
    const key = e.key.toLowerCase()
    if (key === 'z') return e.shiftKey ? 'redo' : 'undo'
    return key === 'y' && !e.shiftKey ? 'redo' : null
  }
  return PLAIN[e.key] ?? null
}

/** Roving focus in a grid of `length` tiles laid out in `columns`: arrows stop at the edges. */
export const nextIndex = (index: number, arrow: Arrow, columns: number, length: number): number => {
  const next = { left: index - 1, right: index + 1, up: index - columns, down: index + columns }[arrow]
  return next >= 0 && next < length ? next : index
}

const isTyping = (el: Element | null) => !!el?.closest('input, textarea, select, [contenteditable="true"]')

/** The tile a shortcut acts on: its passcode and where it sits (`pool`, `main`, `extra` or `side`). */
export type FocusedTile = { id: number; zone: string }

type Handlers = {
  undo(): void
  redo(): void
  /** `add`, `remove`, `side` and `open` on the focused tile. */
  act(shortcut: 'add' | 'remove' | 'side' | 'open', tile: FocusedTile): void
}

/** Columns of a CSS grid: the tiles that share the first one's row. */
const columnsOf = (tiles: HTMLElement[]) => Math.max(1, tiles.filter((t) => t.offsetTop === tiles[0]?.offsetTop).length)

/**
 * Window-level editor shortcuts. Tiles are `[data-tile]` buttons inside a `[data-card]` item, inside
 * a `[data-zone]` region; arrows move between the tiles of one list.
 */
export const useEditorKeys = (handlers: Handlers) => {
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement
      const shortcut = shortcutOf(e, isTyping(active))
      if (!shortcut) return
      if (shortcut === 'search') {
        document.getElementById('pool-search')?.focus()
        e.preventDefault()
        return
      }
      if (shortcut === 'undo' || shortcut === 'redo') {
        ref.current[shortcut]()
        e.preventDefault()
        return
      }
      const tile = active instanceof HTMLElement && active.matches('[data-tile]') ? active : null
      const item = tile?.closest<HTMLElement>('[data-card]')
      const zone = tile?.closest<HTMLElement>('[data-zone]')?.dataset.zone
      if (!tile || !item || !zone) return
      e.preventDefault() // Enter would also click the tile, and arrows would scroll
      if (shortcut === 'add' || shortcut === 'remove' || shortcut === 'side' || shortcut === 'open') {
        ref.current.act(shortcut, { id: Number(item.dataset.card), zone })
        return
      }
      const list = item.parentElement
      const tiles = list ? [...list.querySelectorAll<HTMLElement>('[data-tile]')] : []
      tiles[nextIndex(tiles.indexOf(tile), shortcut, columnsOf(tiles), tiles.length)]?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
