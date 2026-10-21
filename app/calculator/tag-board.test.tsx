// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LONG_PRESS_MS } from '@app/deck-builder/gestures'
import type { DeckCard } from '@utils/combo/deck-cards'
import type { CardData } from '@utils/deck/types'
import { TagBoard } from './tag-board'

vi.mock('next/image', () => ({ default: () => null }))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

type Props = React.ComponentProps<typeof TagBoard>

const magician = { id: 1, idOriginal: 1, idTcg: null, alias: null, ruleId: null, alternateArts: [], name: 'Dark Magician', banlists: null } as unknown as CardData

const row = (id: number, copies: number, card: CardData | null): DeckCard => ({ id, copies, card, passcode: id })
const noop = () => {}

const props = (over: Partial<Props> = {}): Props => ({
  rows: [row(1, 3, magician), row(2, 1, null)],
  roles: new Map(),
  palette: ['Starter', 'Extender', 'Hand Trap', 'Brick'],
  hands: [{ name: '', rules: [{ subject: { kind: 'role', role: 'Starter' }, min: 1, max: null }] }],
  originalCopies: new Map([
    [1, 3],
    [2, 1],
  ]),
  banlist: null,
  notDrawn: 0,
  onSetRole: noop,
  onToggle: noop,
  onCopies: noop,
  onRestore: noop,
  onSuggest: noop,
  ...over,
})
const renderBoard = (over: Partial<Props> = {}) => render(<TagBoard {...props(over)} />)

const pills = () => screen.getAllByRole('button', { name: 'tags.brush' })
const tiles = () => screen.getAllByRole('button', { name: /tags\.tile/ })

afterEach(cleanup)

describe('TagBoard', () => {
  it('groups pills by the hands and offers Use in hands only on labels with a suggestion', () => {
    renderBoard()
    expect(screen.getByText('tags.inHands')).toBeTruthy()
    expect(screen.getByText('tags.labels')).toBeTruthy()
    expect(pills()).toHaveLength(4) // Starter (used) first, then Extender, Hand Trap, Brick
    expect(screen.getAllByRole('button', { name: 'tags.useInHands' })).toHaveLength(1) // Brick only: Starter is used, the others suggest nothing
    expect(screen.queryByRole('button', { name: 'tags.help' })).toBeNull()
    expect(screen.queryByText('deck.restore')).toBeNull()
  })

  it('a brush paints on pointer-down in the direction of the first tile and keeps it through the stroke', () => {
    const onSetRole = vi.fn()
    const onPainted = vi.fn()
    const onTour = vi.fn()
    renderBoard({ roles: new Map([[2, ['Brick']]]), onSetRole, onPainted, onTour })
    fireEvent.click(pills()[3]!) // Brick
    const [a, b] = tiles()
    fireEvent.pointerDown(a!, { button: 0, buttons: 1, pointerType: 'mouse' })
    fireEvent.pointerEnter(b!, { buttons: 1, pointerType: 'mouse' })
    expect(onSetRole.mock.calls).toEqual([[1, 'Brick', true]]) // b already has Brick: the stroke adds, so b is left alone
    expect(onPainted).toHaveBeenCalledTimes(1)
    expect(onTour).toHaveBeenCalledWith('brush')
    expect(onTour).toHaveBeenCalledWith('paint')
  })

  it('a stroke paints every tile it enters while the button is held, with one onPainted', () => {
    const onSetRole = vi.fn()
    const onPainted = vi.fn()
    renderBoard({ onSetRole, onPainted })
    fireEvent.click(pills()[3]!) // Brick
    const [a, b] = tiles()
    fireEvent.pointerDown(a!, { button: 0, buttons: 1, pointerType: 'mouse' })
    fireEvent.pointerEnter(b!, { buttons: 1, pointerType: 'mouse' })
    expect(onSetRole.mock.calls).toEqual([
      [1, 'Brick', true],
      [2, 'Brick', true],
    ])
    expect(onPainted).toHaveBeenCalledTimes(1)
  })

  it('a mouse enter with the button up ends a stroke whose release the window never saw', () => {
    const onSetRole = vi.fn()
    const onPainted = vi.fn()
    renderBoard({ onSetRole, onPainted })
    fireEvent.click(pills()[3]!) // Brick
    const [a, b] = tiles()
    fireEvent.pointerDown(a!, { button: 0, buttons: 1, pointerType: 'mouse' })
    const off = vi.spyOn(window, 'removeEventListener')
    fireEvent.pointerEnter(b!, { buttons: 0, pointerType: 'mouse' }) // released outside the window
    expect(off).toHaveBeenCalledWith('pointerup', expect.any(Function))
    expect(off).toHaveBeenCalledWith('pointercancel', expect.any(Function))
    off.mockRestore()
    fireEvent.pointerEnter(b!, { buttons: 1, pointerType: 'mouse' }) // a later drag that began off the tiles
    expect(onSetRole.mock.calls).toEqual([[1, 'Brick', true]])
    expect(onPainted).toHaveBeenCalledTimes(1)
  })

  it('a stroke ends on pointerup anywhere: a later hover does not paint', () => {
    const onSetRole = vi.fn()
    renderBoard({ onSetRole })
    fireEvent.click(pills()[3]!)
    const [a, b] = tiles()
    fireEvent.pointerDown(a!, { button: 0, buttons: 1, pointerType: 'mouse' })
    fireEvent.pointerUp(window)
    fireEvent.pointerEnter(b!, { buttons: 1, pointerType: 'mouse' })
    expect(onSetRole).toHaveBeenCalledTimes(1)
  })

  it('touch paints on the tap, never on pointer-down', () => {
    const onSetRole = vi.fn()
    renderBoard({ onSetRole })
    fireEvent.click(pills()[0]!) // Starter
    const [a] = tiles()
    fireEvent.pointerDown(a!, { pointerType: 'touch' })
    expect(onSetRole).not.toHaveBeenCalled()
    fireEvent.pointerUp(a!, { pointerType: 'touch' })
    fireEvent.click(a!, { detail: 1 })
    expect(onSetRole.mock.calls).toEqual([[1, 'Starter', true]])
  })

  it('a mouse click with a brush paints once: on its pointer-down, not again on the click', () => {
    const onSetRole = vi.fn()
    renderBoard({ onSetRole })
    fireEvent.click(pills()[0]!)
    const [a] = tiles()
    fireEvent.pointerDown(a!, { button: 0, buttons: 1, pointerType: 'mouse' })
    fireEvent.pointerUp(a!, { button: 0, pointerType: 'mouse' })
    fireEvent.click(a!, { detail: 1 })
    expect(onSetRole).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('without a brush a click opens the menu; Escape closes it, then a second Escape is a no-op', () => {
    const onTour = vi.fn()
    renderBoard({ onTour })
    fireEvent.click(tiles()[0]!)
    expect(screen.getByRole('dialog', { name: 'Dark Magician' })).toBeTruthy()
    expect(onTour).toHaveBeenCalledWith('menu')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a Ctrl-click (a right-click on macOS) does not paint or start a stroke; its contextmenu opens the menu', () => {
    const onSetRole = vi.fn()
    renderBoard({ onSetRole })
    fireEvent.click(pills()[0]!)
    const [a, b] = tiles()
    fireEvent.pointerDown(a!, { button: 0, buttons: 1, pointerType: 'mouse', ctrlKey: true })
    fireEvent.pointerEnter(b!, { buttons: 1, pointerType: 'mouse' })
    fireEvent.contextMenu(a!, { ctrlKey: true })
    expect(onSetRole).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Dark Magician' })).toBeTruthy()
  })

  it('a tagged tile names its tags; with a brush, every tile says whether it carries it', () => {
    renderBoard({ roles: new Map([[2, ['Brick']]]) })
    expect(screen.getAllByRole('button', { name: /tags\.tileTags/ })).toHaveLength(1)
    expect(tiles()[1]!.textContent).toContain('tags.tileTags')
    expect(tiles().map((tile) => tile.getAttribute('aria-pressed'))).toEqual([null, null])
    fireEvent.click(pills()[3]!) // Brick
    expect(tiles().map((tile) => tile.getAttribute('aria-pressed'))).toEqual(['false', 'true'])
  })

  it('right-click opens the menu even with a brush, and does not paint', () => {
    const onSetRole = vi.fn()
    renderBoard({ onSetRole })
    fireEvent.click(pills()[0]!)
    fireEvent.contextMenu(tiles()[0]!)
    expect(screen.getByRole('dialog', { name: 'Dark Magician' })).toBeTruthy()
    expect(onSetRole).not.toHaveBeenCalled()
  })

  it('a long press opens the menu even with a brush, and its click does not paint', () => {
    vi.useFakeTimers()
    try {
      const onSetRole = vi.fn()
      renderBoard({ onSetRole })
      fireEvent.click(pills()[0]!)
      const [a] = tiles()
      fireEvent.pointerDown(a!, { pointerType: 'touch' })
      act(() => vi.advanceTimersByTime(LONG_PRESS_MS))
      expect(screen.getByRole('dialog', { name: 'Dark Magician' })).toBeTruthy()
      fireEvent.pointerUp(a!, { pointerType: 'touch' })
      fireEvent.click(a!, { detail: 1 })
      expect(onSetRole).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('Escape with a brush and the menu open closes the menu first, then drops the brush', () => {
    renderBoard()
    fireEvent.click(pills()[0]!)
    fireEvent.contextMenu(tiles()[0]!)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('tags.stop')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText('tags.stop')).toBeNull()
  })

  it('keys 1–9 pick the shown pill; Escape drops the brush; keys typed in a field are ignored', () => {
    renderBoard()
    fireEvent.keyDown(window, { key: '1' })
    expect(pills()[0]!.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('tags.stop')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText('tags.stop')).toBeNull()
    fireEvent.click(screen.getByText('tags.newTag'))
    fireEvent.keyDown(screen.getByPlaceholderText('tags.newTagPlaceholder'), { key: '2' })
    expect(pills().every((p) => p.getAttribute('aria-pressed') === 'false')).toBe(true)
  })

  it('the same key again puts the brush down; Ctrl+digit is ignored, Shift+digit (AZERTY) picks', () => {
    renderBoard()
    fireEvent.keyDown(window, { key: '2' })
    expect(pills()[1]!.getAttribute('aria-pressed')).toBe('true')
    fireEvent.keyDown(window, { key: '2' })
    expect(pills()[1]!.getAttribute('aria-pressed')).toBe('false')
    fireEvent.keyDown(window, { key: '3', ctrlKey: true })
    expect(pills()[2]!.getAttribute('aria-pressed')).toBe('false')
    fireEvent.keyDown(window, { key: '3', shiftKey: true })
    expect(pills()[2]!.getAttribute('aria-pressed')).toBe('true')
  })

  it('a held key (auto-repeat) does not toggle the brush off', () => {
    renderBoard()
    fireEvent.keyDown(window, { key: '1' })
    fireEvent.keyDown(window, { key: '1', repeat: true })
    expect(pills()[0]!.getAttribute('aria-pressed')).toBe('true')
  })

  it('a new tag in another case becomes the default brush; a fresh custom tag keeps a pressed pill', () => {
    renderBoard()
    fireEvent.click(screen.getByText('tags.newTag'))
    const field = () => screen.getByPlaceholderText('tags.newTagPlaceholder')
    fireEvent.change(field(), { target: { value: ' brick ' } })
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(screen.queryByPlaceholderText('tags.newTagPlaceholder')).toBeNull()
    expect(pills()).toHaveLength(4)
    expect(pills()[3]!.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByText('tags.newTag'))
    fireEvent.change(field(), { target: { value: 'Engine' } })
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(pills()).toHaveLength(5)
    expect(pills()[4]!.getAttribute('aria-pressed')).toBe('true')
  })

  it('Escape hides the new-tag field without picking', () => {
    renderBoard()
    fireEvent.click(screen.getByText('tags.newTag'))
    fireEvent.change(screen.getByPlaceholderText('tags.newTagPlaceholder'), { target: { value: 'Engine' } })
    fireEvent.keyDown(screen.getByPlaceholderText('tags.newTagPlaceholder'), { key: 'Escape' })
    expect(screen.queryByPlaceholderText('tags.newTagPlaceholder')).toBeNull()
    expect(pills()).toHaveLength(4)
  })

  it('Use in hands calls onSuggest; Untagged dims tagged tiles', () => {
    const onSuggest = vi.fn()
    renderBoard({ onSuggest, roles: new Map([[1, ['Starter']]]) })
    const use = screen.getByRole('button', { name: 'tags.useInHands' })
    expect(use.title).toBe('tags.useInHands') // the rule shows on hover too
    fireEvent.click(use)
    expect(onSuggest).toHaveBeenCalledWith('Brick')
    const [a, b] = tiles()
    const untagged = screen.getByRole('button', { name: 'tags.untagged' })
    expect(a!.closest('[data-card]')!.className).not.toContain('opacity-(--opacity-dim)')
    fireEvent.click(untagged)
    expect(untagged.getAttribute('aria-pressed')).toBe('true')
    expect(a!.closest('[data-card]')!.className).toContain('opacity-(--opacity-dim)')
    expect(b!.closest('[data-card]')!.className).not.toContain('opacity-(--opacity-dim)')
  })

  it('dims a card at 0 copies and rings the tiles that carry the brush', () => {
    const { container } = renderBoard({ rows: [row(1, 0, magician), row(2, 1, null)], roles: new Map([[2, ['Brick']]]) })
    expect(container.querySelector('[data-card="1"]')!.className).toContain('opacity-(--opacity-dim)')
    expect(container.querySelector('[data-card="2"] .outline-2')).toBeNull()
    fireEvent.click(pills()[3]!) // Brick
    expect(container.querySelector('[data-card="2"] .outline-2')).toBeTruthy()
    expect(container.querySelector('[data-card="1"] .outline-2')).toBeNull()
  })

  it('the menu closes when its card leaves the rows', () => {
    const { rerender } = renderBoard()
    fireEvent.click(tiles()[0]!)
    expect(screen.getByRole('dialog')).toBeTruthy()
    rerender(<TagBoard {...props({ rows: [row(2, 1, null)] })} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    rerender(<TagBoard {...props()} />)
    expect(screen.queryByRole('dialog')).toBeNull() // back in the rows: it stays closed
  })

  it('Restore shows when copies differ from the loaded deck', () => {
    const onRestore = vi.fn()
    renderBoard({ originalCopies: new Map([[1, 2]]), onRestore })
    fireEvent.click(screen.getByText('deck.restore'))
    expect(onRestore).toHaveBeenCalledTimes(1)
  })

  it('shows the help button only with onHelp', () => {
    const onHelp = vi.fn()
    renderBoard({ onHelp })
    fireEvent.click(screen.getByRole('button', { name: 'tags.help' }))
    expect(onHelp).toHaveBeenCalledTimes(1)
  })

  it('the help button puts the brush down first, so the tour can see the next pick', () => {
    const onHelp = vi.fn()
    renderBoard({ onHelp })
    fireEvent.click(pills()[0]!)
    expect(pills()[0]!.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'tags.help' }))
    expect(onHelp).toHaveBeenCalledTimes(1)
    expect(pills().some((p) => p.getAttribute('aria-pressed') === 'true')).toBe(false)
  })
})
