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
vi.mock('@utils/combos', () => ({ listPublicCombos: vi.fn() }))

const row = (id: string): PublicCombo => ({ id, title: `Line ${id}`, deckName: 'Tenpai', steps: 12, visibility: 'public', updatedAt: '2026-10-19T00:00:00Z', owner: { id: 'u1', name: 'Ana' } })
const show = async () => {
  await act(async () => void render(<ComboBrowser />))
}

afterEach(() => {
  cleanup()
  vi.mocked(listPublicCombos).mockReset()
})

describe('ComboBrowser', () => {
  it('lists the published combos, each opening its replay, and loads the next page', async () => {
    vi.mocked(listPublicCombos).mockResolvedValueOnce({ combos: [row('a')], nextCursor: 'next' }).mockResolvedValueOnce({ combos: [row('b')], nextCursor: null })
    await show()
    expect(screen.getByRole('link', { name: /Line a/ }).getAttribute('href')).toBe('/simulator/c/a')
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'myCombos.more' })))
    expect(listPublicCombos).toHaveBeenLastCalledWith('next')
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'myCombos.more' })).toBeNull()
  })

  it('says so when nothing is published, and offers a retry when the list fails', async () => {
    vi.mocked(listPublicCombos).mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ combos: [], nextCursor: null })
    await show()
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'retry' })))
    expect(screen.getByText('browse.empty')).toBeTruthy()
  })
})
