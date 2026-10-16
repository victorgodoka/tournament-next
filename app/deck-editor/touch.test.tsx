// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_DECK, type CardData } from '@utils/deck/types'
import { CardPool } from './card-pool'
import { DeckZone } from './deck-zone'
import { LONG_PRESS_MS } from './gestures'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('./pool-filters', () => ({ PoolFilters: () => null }))

const card = (id: number) =>
  ({ id, name: `c${id}`, kind: 'spell', monsterTypes: [], level: null, alias: null, ruleId: null, banlists: null, alternateArts: [] }) as unknown as CardData
const ASH = card(1)

vi.mock('./use-card-pool', () => ({
  useCardPool: () => ({ cards: [ASH], total: 1, loading: false, error: false, more: () => {}, retry: () => {} }),
}))

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} })
  Object.defineProperty(navigator, 'vibrate', { value: () => true, configurable: true })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('pool tile', () => {
  const setup = () => {
    const onAdd = vi.fn()
    const onOpen = vi.fn()
    render(<CardPool deck={EMPTY_DECK} cards={new Map([[1, ASH]])} banlist={null} onAdd={onAdd} onOpen={onOpen} remember={() => {}} />)
    return { onAdd, onOpen, tile: screen.getByTitle('c1') }
  }

  it('a touch tap opens the sheet and adds nothing', () => {
    const { onAdd, onOpen, tile } = setup()
    fireEvent.pointerDown(tile, { pointerType: 'touch' })
    fireEvent.pointerUp(tile, { pointerType: 'touch' })
    fireEvent.click(tile, { detail: 1 })
    expect(onOpen).toHaveBeenCalledWith(ASH)
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('a touch long-press adds once; the click and contextmenu after it do nothing', () => {
    vi.useFakeTimers()
    const { onAdd, onOpen, tile } = setup()
    fireEvent.pointerDown(tile, { pointerType: 'touch' })
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS))
    expect(onAdd).toHaveBeenCalledOnce()
    expect(onAdd).toHaveBeenCalledWith(ASH)
    fireEvent.contextMenu(tile)
    fireEvent.pointerUp(tile, { pointerType: 'touch' })
    fireEvent.click(tile, { detail: 1 })
    expect(onAdd).toHaveBeenCalledOnce()
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('a mouse click adds, as on desktop', () => {
    const { onAdd, onOpen, tile } = setup()
    fireEvent.pointerDown(tile, { pointerType: 'mouse' })
    fireEvent.click(tile, { detail: 1 })
    expect(onAdd).toHaveBeenCalledWith(ASH, undefined)
    expect(onOpen).not.toHaveBeenCalled()
  })
})

describe('deck row swipe', () => {
  const setup = () => {
    const onRemove = vi.fn()
    const { container } = render(
      <DeckZone zone="main" ids={[1, 1]} cards={new Map([[1, ASH]])} view="list" problems={new Set()} onRemove={onRemove} onDropCard={() => {}} onOpen={() => {}} />,
    )
    return { onRemove, row: container.querySelector('li[data-card="1"]')! }
  }
  const swipe = (row: Element, dx: number, dy: number) => {
    fireEvent.pointerDown(row, { pointerType: 'touch', clientX: 200, clientY: 200 })
    fireEvent.pointerMove(row, { pointerType: 'touch', clientX: 200 + dx / 2, clientY: 200 + dy / 2 })
    fireEvent.pointerUp(row, { pointerType: 'touch', clientX: 200 + dx, clientY: 200 + dy })
  }

  it('past 64 px with horizontal dominance removes one copy', () => {
    const { onRemove, row } = setup()
    swipe(row, -70, 10)
    expect(onRemove).toHaveBeenCalledOnce()
    expect(onRemove).toHaveBeenCalledWith(1)
  })

  it('a grid tile keeps its info button, which opens the sheet without removing a copy', () => {
    const onRemove = vi.fn()
    const onOpen = vi.fn()
    render(<DeckZone zone="main" ids={[1]} cards={new Map([[1, ASH]])} view="grid" problems={new Set()} onRemove={onRemove} onDropCard={() => {}} onOpen={onOpen} />)
    const info = screen.getByRole('button', { name: 'info' })
    fireEvent.pointerDown(info, { pointerType: 'touch' })
    fireEvent.pointerUp(info, { pointerType: 'touch' })
    fireEvent.click(info, { detail: 1 })
    expect(onOpen).toHaveBeenCalledWith(1)
    expect(onRemove).not.toHaveBeenCalled()
  })

  it('a mostly vertical drag, or a short swipe, removes nothing', () => {
    const { onRemove, row } = setup()
    swipe(row, -70, 120)
    swipe(row, -50, 0)
    expect(onRemove).not.toHaveBeenCalled()
  })
})
