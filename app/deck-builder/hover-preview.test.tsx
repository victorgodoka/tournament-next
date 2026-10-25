// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CardData } from '@utils/deck/types'
import { DELAY_MS, HoverPreview } from './hover-preview'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

const ASH = { id: 1, name: 'Ash Blossom', kind: 'monster', monsterTypes: ['tuner', 'effect'], race: 'zombie', level: 3, atk: 0, def: 1800, scale: null, attribute: 'fire', description: 'Negate.' } as unknown as CardData

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const setup = () => {
  render(
    <>
      <ul>
        <li data-card={1}>
          <button type="button">tile</button>
        </li>
      </ul>
      <HoverPreview cards={new Map([[1, ASH]])} />
    </>,
  )
  return screen.getByText('tile')
}
const hover = (el: Element) => {
  fireEvent.pointerMove(el, { pointerType: 'mouse' })
  act(() => vi.advanceTimersByTime(DELAY_MS))
}

describe('HoverPreview', () => {
  it('shows the card under the mouse after the delay, with its scan', () => {
    const tile = setup()
    fireEvent.pointerMove(tile, { pointerType: 'mouse' })
    expect(screen.queryByText('Ash Blossom')).toBeNull()
    act(() => vi.advanceTimersByTime(DELAY_MS))
    expect(screen.getByText('Ash Blossom')).toBeTruthy()
    expect(document.querySelector('img')?.getAttribute('src')).toBe('/card-image/common/1.jpg')
  })

  it('comes back after a click on the same tile once the pointer moves again', () => {
    const tile = setup()
    hover(tile)
    fireEvent.pointerDown(tile)
    expect(screen.queryByText('Ash Blossom')).toBeNull()
    hover(tile)
    expect(screen.getByText('Ash Blossom')).toBeTruthy()
  })

  it('hides when the pointer moves off every card, and never shows for touch', () => {
    const tile = setup()
    hover(tile)
    fireEvent.pointerMove(document.body, { pointerType: 'mouse' })
    expect(screen.queryByText('Ash Blossom')).toBeNull()
    fireEvent.pointerMove(tile, { pointerType: 'touch' })
    act(() => vi.advanceTimersByTime(DELAY_MS))
    expect(screen.queryByText('Ash Blossom')).toBeNull()
  })
})
