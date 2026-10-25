// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CardData } from '@utils/deck/types'
import { CardPanel } from './card-panel'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

const card = (id: number, name: string) =>
  ({ id, name, kind: 'spell', monsterTypes: [], level: null, description: `${name} text`, humanReadableCardType: 'Spell' }) as unknown as CardData
const CARDS = new Map([
  [1, card(1, 'Ash')],
  [2, card(2, 'Maxx')],
])

afterEach(cleanup)

const setup = (locked: number | null = null) => {
  const onLock = vi.fn()
  const view = render(
    <>
      <ul>
        <li data-card={1}>
          <button type="button">one</button>
        </li>
        <li data-card={2}>
          <button type="button">two</button>
        </li>
      </ul>
      <CardPanel cards={CARDS} locked={locked} onLock={onLock} />
    </>,
  )
  return { onLock, view }
}

describe('CardPanel', () => {
  it('shows the card under the pointer and keeps it after the pointer leaves', () => {
    setup()
    expect(screen.getByText('panel.empty')).toBeTruthy()
    fireEvent.pointerMove(screen.getByText('one'))
    expect(screen.getByText('Ash')).toBeTruthy()
    expect(document.querySelector('img')?.getAttribute('src')).toBe('/card-image/common/1.jpg')
    fireEvent.pointerMove(document.body)
    expect(screen.getByText('Ash')).toBeTruthy()
  })

  it('holds the pinned card over the pointer, and the pin button unpins it', () => {
    const { onLock } = setup(2)
    fireEvent.pointerMove(screen.getByText('one'))
    expect(screen.getByText('Maxx')).toBeTruthy()
    expect(screen.queryByText('Ash')).toBeNull()
    fireEvent.click(screen.getByRole('button', { pressed: true }))
    expect(onLock).toHaveBeenCalledWith(null)
  })

  it('pins the hovered card from the panel', () => {
    const { onLock } = setup()
    fireEvent.pointerMove(screen.getByText('two'))
    fireEvent.click(screen.getByRole('button', { pressed: false }))
    expect(onLock).toHaveBeenCalledWith(2)
  })
})
