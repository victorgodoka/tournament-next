// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { listPublicCombos, type PublicCombo } from '@utils/combos'
import { ComboBrowser } from './combo-browser'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key),
  useFormatter: () => ({ relativeTime: () => 'today' }),
  useNow: () => new Date(0),
}))
vi.mock('next/image', () => ({ default: ({ src }: { src: string }) => <i data-art={src} /> }))
vi.mock('@utils/cards', () => ({ searchCards: vi.fn() }))
vi.mock('@utils/combos', () => ({ listPublicCombos: vi.fn() }))

const row = (id: string): PublicCombo => ({
  id,
  title: `Line ${id}`,
  deckName: 'My deck',
  steps: 12,
  visibility: 'public',
  coverCards: [11, 22, 33],
  tags: ['rogue'],
  archetype: 'Tenpai',
  updatedAt: '2026-10-19T00:00:00Z',
  owner: { id: 'u1', name: 'Ana' },
})
const show = async () => {
  await act(async () => void render(<ComboBrowser />))
}

afterEach(() => {
  cleanup()
  vi.mocked(listPublicCombos).mockReset()
})

describe('ComboBrowser', () => {
  it('shows each combo with its three cards, opening its replay, and loads the next page', async () => {
    vi.mocked(listPublicCombos).mockResolvedValueOnce({ combos: [row('a')], nextCursor: 'next' }).mockResolvedValueOnce({ combos: [row('b')], nextCursor: null })
    await show()
    expect(screen.getByRole('link', { name: 'Line a' }).getAttribute('href')).toBe('/simulator/c/a')
    expect(document.querySelectorAll('.sim-pane-cover [data-art]')).toHaveLength(3)
    expect(screen.getByText(/Tenpai/)).toBeTruthy()
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'myCombos.more' })))
    expect(listPublicCombos).toHaveBeenLastCalledWith(expect.anything(), 'next')
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('asks again with a filter, and clearing it comes back', async () => {
    vi.mocked(listPublicCombos).mockResolvedValue({ combos: [row('a')], nextCursor: null })
    await show()
    await act(async () => void fireEvent.change(screen.getByRole('combobox', { name: 'tag' }), { target: { value: 'rogue' } }))
    expect(listPublicCombos).toHaveBeenLastCalledWith(expect.objectContaining({ tag: 'rogue' }))
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'clear' })))
    expect(listPublicCombos).toHaveBeenLastCalledWith(expect.objectContaining({ tag: null }))
  })

  it('says so when nothing matches, and offers a retry when the list fails', async () => {
    vi.mocked(listPublicCombos).mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ combos: [], nextCursor: null })
    await show()
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'retry' })))
    expect(screen.getByText('browse.empty')).toBeTruthy()
  })
})
