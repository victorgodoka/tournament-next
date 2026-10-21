// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DeckCard } from '@utils/combo/deck-cards'
import type { CardData } from '@utils/deck/types'
import type { Banlist } from '@utils/wiki'
import { CardMenu } from './card-menu'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

const magician = { id: 1, idOriginal: 1, idTcg: null, alias: null, ruleId: null, alternateArts: [], name: 'Dark Magician', banlists: null } as unknown as CardData
const limitedCard = { ...magician, banlists: [{ name: 'TCG', limitation: 1 }] } as unknown as CardData
const tcgList: Banlist = { id: 2, name: 'TCG', format: 'tcg', pointCap: null, bannedTypes: [], cards: 0 }

const row = (id: number, copies: number, card: CardData | null): DeckCard => ({ id, copies, card, passcode: id })
const noop = () => {}
const closed = () => Object.assign(new Event('toggle'), { newState: 'closed' })

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('CardMenu', () => {
  it('lists every palette tag as a checkbox and toggles it', () => {
    const onToggle = vi.fn()
    render(<CardMenu row={row(1, 1, magician)} roles={new Map([[1, ['Starter']]])} palette={['Starter', 'Brick']} anchor={null} changed={false} banlist={null} onToggle={onToggle} onCopies={noop} onClose={noop} />)
    const boxes = screen.getAllByRole('checkbox', { name: 'tags.toggle' }) as HTMLInputElement[]
    expect(boxes.map((b) => b.checked)).toEqual([true, false])
    fireEvent.click(boxes[1]!)
    expect(onToggle).toHaveBeenCalledWith(1, 'Brick')
  })

  it('is a dialog named by the card, or by its passcode when unknown', () => {
    render(<CardMenu row={row(999, 2, null)} roles={new Map()} palette={[]} anchor={null} changed={false} banlist={null} onToggle={noop} onCopies={noop} onClose={noop} />)
    expect(screen.getByRole('dialog', { name: '999' })).toBeTruthy()
    expect(screen.getByText('deck.unknown')).toBeTruthy()
  })

  it('caps + at the format limit, marks a changed card, badges HOPT', () => {
    const onCopies = vi.fn()
    const hopt = { ...limitedCard, description: 'You can only use this effect of "X" once per turn.' } as unknown as CardData
    render(<CardMenu row={row(1, 1, hopt)} roles={new Map()} palette={[]} anchor={null} changed banlist={tcgList} onToggle={noop} onCopies={onCopies} onClose={noop} />)
    const more = screen.getByRole('button', { name: 'deck.more' })
    expect(more.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(more)
    expect(onCopies).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'deck.fewer' }))
    expect(onCopies).toHaveBeenCalledWith(1, 0, 1)
    expect(screen.getByText('deck.changed')).toBeTruthy()
    expect(screen.getByText('deck.hopt')).toBeTruthy()
    expect(screen.queryByText('deck.opt')).toBeNull()
  })

  it('disables − at 0 copies and steps + up to the limit', () => {
    const onCopies = vi.fn()
    render(<CardMenu row={row(1, 0, magician)} roles={new Map()} palette={[]} anchor={null} changed={false} banlist={null} onToggle={noop} onCopies={onCopies} onClose={noop} />)
    expect(screen.getByRole('button', { name: 'deck.fewer' }).getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'deck.more' }))
    expect(onCopies).toHaveBeenCalledWith(1, 1, 1)
  })

  it('Enter on the new-tag field toggles the normalised tag and clears', () => {
    const onToggle = vi.fn()
    render(<CardMenu row={row(1, 1, magician)} roles={new Map()} palette={['Brick']} anchor={null} changed={false} banlist={null} onToggle={onToggle} onCopies={noop} onClose={noop} />)
    const field = screen.getByLabelText('tags.newTag') as HTMLInputElement
    fireEvent.change(field, { target: { value: ' brick ' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(onToggle).toHaveBeenCalledWith(1, 'Brick')
    expect(field.value).toBe('')
    fireEvent.change(field, { target: { value: '   ' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('closes on its toggle event and on ✕', () => {
    const onClose = vi.fn()
    render(<CardMenu row={row(1, 1, magician)} roles={new Map()} palette={[]} anchor={null} changed={false} banlist={null} onToggle={noop} onCopies={noop} onClose={onClose} />)
    const dialog = screen.getByRole('dialog')
    dialog.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'open' }))
    expect(onClose).not.toHaveBeenCalled()
    dialog.dispatchEvent(closed())
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'menu.close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('opens under the tile, flips above when there is no room, and stays inside the viewport', () => {
    const size = (width: number, height: number) => {
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width)
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(height)
    }
    const tile = (rect: Partial<DOMRect>) => ({ getBoundingClientRect: () => rect }) as HTMLElement
    const place = (anchor: HTMLElement) => {
      render(<CardMenu row={row(1, 1, magician)} roles={new Map()} palette={[]} anchor={anchor} changed={false} banlist={null} onToggle={noop} onCopies={noop} onClose={noop} />)
      const { top, left } = screen.getByRole('dialog').style
      cleanup()
      return { top, left }
    }
    vi.stubGlobal('innerWidth', 1000)
    vi.stubGlobal('innerHeight', 700)
    size(300, 400)
    expect(place(tile({ top: 100, bottom: 160, left: 50 }))).toEqual({ top: '160px', left: '50px' })
    expect(place(tile({ top: 500, bottom: 560, left: 900 }))).toEqual({ top: '100px', left: '692px' })
    expect(place(tile({ top: 100, bottom: 160, left: -20 })).left).toBe('8px')
  })
})
