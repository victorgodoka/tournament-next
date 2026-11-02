// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PanelDeck } from '@utils/panel'
import { Setcodes } from './Setcodes'

const code = (id: number, name: string, ignored: boolean) => ({ code: id, name, ignored, decks: 10, share: 0.5, mean: 2, min: 1, max: 3 })
const deck = { key: '1', name: 'Snake-Eye', decks: 10 } as PanelDeck
const answer = (setcodes: ReturnType<typeof code>[]) => vi.fn(async () => new Response(JSON.stringify({ key: '1', name: 'Snake-Eye', decks: 10, setcodes })))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Setcodes', () => {
  it('hides the ignored until asked', async () => {
    vi.stubGlobal('fetch', answer([code(1, 'Snake-Eye', false), code(2, 'Fiendsmith', true)]))
    render(<Setcodes season={14} deck={deck} />)
    await waitFor(() => screen.getByText('Snake-Eye', { selector: 'td *, td' }))
    expect(screen.queryByText('Fiendsmith')).toBeNull()
    fireEvent.click(screen.getByRole('switch'))
    expect(screen.getByText('Fiendsmith')).toBeTruthy()
  })

  it('offers nothing when no setcode is ignored', async () => {
    vi.stubGlobal('fetch', answer([code(1, 'Snake-Eye', false)]))
    render(<Setcodes season={14} deck={deck} />)
    await waitFor(() => screen.getByText('Snake-Eye', { selector: 'td *, td' }))
    expect(screen.queryByRole('switch')).toBeNull()
  })
})
