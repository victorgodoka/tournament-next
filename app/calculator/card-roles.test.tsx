// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DeckCard } from '@utils/combo/deck-cards'
import type { CardData } from '@utils/deck/types'
import type { Banlist } from '@utils/wiki'
import { CardRoles } from './card-roles'

vi.mock('next/image', () => ({ default: () => null }))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

const magician = { id: 1, idOriginal: 1, idTcg: null, alias: null, ruleId: null, alternateArts: [], name: 'Dark Magician', banlists: null } as unknown as CardData
const limitedCard = { ...magician, banlists: [{ name: 'TCG', limitation: 1 }] } as unknown as CardData
const tcgList: Banlist = { id: 2, name: 'TCG', format: 'tcg', pointCap: null, bannedTypes: [], cards: 0 }

const row = (id: number, copies: number, card: CardData | null): DeckCard => ({ id, copies, card, passcode: id })
const noop = () => {}

afterEach(cleanup)

describe('CardRoles', () => {
  it('shows unknown cards by passcode and toggles roles', () => {
    const onToggle = vi.fn()
    render(<CardRoles rows={[row(999, 2, null)]} roles={new Map()} palette={['Starter']} originalCopies={new Map([[999, 2]])} banlist={null} notDrawn={0} onToggle={onToggle} onCopies={noop} onRestore={noop} />)
    expect(screen.getByText('999')).toBeTruthy()
    expect(screen.getByText('deck.unknown')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'deck.roleOf' }))
    expect(onToggle).toHaveBeenCalledWith(999, 'Starter')
    expect(screen.queryByText('deck.restore')).toBeNull()
  })
  it('caps + at the format limit and marks changed rows', () => {
    const onCopies = vi.fn()
    render(<CardRoles rows={[row(1, 1, limitedCard)]} roles={new Map()} palette={[]} originalCopies={new Map([[1, 2]])} banlist={tcgList} notDrawn={3} onToggle={noop} onCopies={onCopies} onRestore={noop} />)
    expect(screen.getByRole('button', { name: 'deck.more' }).getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'deck.fewer' }))
    expect(onCopies).toHaveBeenCalledWith(1, 0, 1)
    expect(screen.getByText('deck.changed')).toBeTruthy()
    expect(screen.getByText('deck.restore')).toBeTruthy()
    expect(screen.getByText('deck.notDrawn')).toBeTruthy()
  })
  it('a card at 0 copies keeps its row with − disabled, and Enter on the new-role field toggles it', () => {
    const onToggle = vi.fn()
    const onCopies = vi.fn()
    render(<CardRoles rows={[row(1, 0, magician)]} roles={new Map([[1, ['Starter']]])} palette={['Starter']} originalCopies={new Map([[1, 1]])} banlist={null} notDrawn={0} onToggle={onToggle} onCopies={onCopies} onRestore={noop} />)
    expect(screen.getByText('Dark Magician')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'deck.fewer' }).getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByRole('button', { name: 'deck.roleOf' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'deck.more' }))
    expect(onCopies).toHaveBeenCalledWith(1, 1, 1)
    const field = screen.getByPlaceholderText('deck.addRolePlaceholder') as HTMLInputElement
    fireEvent.change(field, { target: { value: ' Engine ' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(onToggle).toHaveBeenCalledWith(1, ' Engine ')
    expect(field.value).toBe('')
  })
  it('badges once-per-turn cards from their text', () => {
    const hopt = { ...magician, description: 'You can only use this effect of "X" once per turn.' } as unknown as CardData
    render(<CardRoles rows={[row(1, 1, hopt)]} roles={new Map()} palette={[]} originalCopies={new Map([[1, 1]])} banlist={null} notDrawn={0} onToggle={noop} onCopies={noop} onRestore={noop} />)
    expect(screen.getByText('deck.hopt')).toBeTruthy()
    expect(screen.queryByText('deck.opt')).toBeNull()
  })
})
