import { describe, expect, it } from 'vitest'
import { nextIndex, shortcutOf } from './keyboard'

const key = (k: string, mods: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean } = {}) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
})

describe('shortcutOf', () => {
  it('maps the editor keys', () => {
    expect(shortcutOf(key('/'), false)).toBe('search')
    expect(shortcutOf(key('+', { shiftKey: true }), false)).toBe('add')
    expect(shortcutOf(key('-'), false)).toBe('remove')
    expect(shortcutOf(key('s'), false)).toBe('side')
    expect(shortcutOf(key('S', { shiftKey: true }), false)).toBe('side')
    expect(shortcutOf(key('Enter'), false)).toBe('open')
    expect(shortcutOf(key('ArrowDown'), false)).toBe('down')
    expect(shortcutOf(key('x'), false)).toBeNull()
  })

  it('undoes on Ctrl/Cmd+Z and redoes on Ctrl+Y or Ctrl+Shift+Z', () => {
    expect(shortcutOf(key('z', { ctrlKey: true }), false)).toBe('undo')
    expect(shortcutOf(key('z', { metaKey: true }), false)).toBe('undo')
    expect(shortcutOf(key('Z', { ctrlKey: true, shiftKey: true }), false)).toBe('redo')
    expect(shortcutOf(key('y', { ctrlKey: true }), false)).toBe('redo')
    // Ctrl+S is the save shortcut (Task 12), not "add to side".
    expect(shortcutOf(key('s', { ctrlKey: true }), false)).toBeNull()
  })

  it('ignores everything while typing, and Alt chords', () => {
    expect(shortcutOf(key('/'), true)).toBeNull()
    expect(shortcutOf(key('z', { ctrlKey: true }), true)).toBeNull()
    expect(shortcutOf(key('s', { altKey: true }), false)).toBeNull()
  })
})

describe('nextIndex', () => {
  // 4 columns, 10 tiles: rows 0-3, 4-7, 8-9.
  it('moves by one sideways and by a row up and down', () => {
    expect(nextIndex(5, 'left', 4, 10)).toBe(4)
    expect(nextIndex(5, 'right', 4, 10)).toBe(6)
    expect(nextIndex(5, 'up', 4, 10)).toBe(1)
    expect(nextIndex(5, 'down', 4, 10)).toBe(9)
  })

  it('stays put at the edges', () => {
    expect(nextIndex(0, 'left', 4, 10)).toBe(0)
    expect(nextIndex(9, 'right', 4, 10)).toBe(9)
    expect(nextIndex(2, 'up', 4, 10)).toBe(2)
    expect(nextIndex(7, 'down', 4, 10)).toBe(7) // no tile under it in the short last row
  })
})
