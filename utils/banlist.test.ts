import { describe, expect, it } from 'vitest'
import { BANLIST_CARDS, BANLIST_IDS, BANLISTS, cardByPasscode, cardBySlug, cardSlug, currentBanlist, direction, type BanStatus } from './banlist'

describe('banlist timeline', () => {
  it('chains every change from the status the card had before it', () => {
    const status = new Map<number, BanStatus>()
    for (const list of BANLISTS) {
      for (const { card, from, to } of list.changes) {
        const was = status.get(card) ?? 'N'
        expect(from === was || (from === 'U' && was === 'N'), `${BANLIST_CARDS[card]} in ${list.date}`).toBe(true)
        status.set(card, to)
      }
    }
  })

  it('runs the lists back to back, oldest first', () => {
    BANLISTS.slice(1).forEach((list, i) => expect(BANLISTS[i]!.date < list.date).toBe(true))
    expect(BANLISTS.at(-1)!.end).toBeNull()
  })

  it('picks the list in force on a day', () => {
    expect(currentBanlist('2026-10-16').date).toBe('2026-09-21')
    expect(currentBanlist('2026-10-19').date).toBe('2026-10-19')
    expect(currentBanlist('2002-05-07').date).toBe('2002-05-07')
  })

  it('gives every card its own slug', () => {
    const slugs = BANLIST_CARDS.map((_, card) => cardSlug(card))
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(cardBySlug('maxx-c')).toBe(BANLIST_CARDS.indexOf('Maxx "C"'))
  })

  it('gives every card its own passcode', () => {
    expect(BANLIST_IDS).toHaveLength(BANLIST_CARDS.length)
    expect(new Set(BANLIST_IDS).size).toBe(BANLIST_IDS.length)
    expect(BANLIST_IDS.every((id) => id > 0)).toBe(true)
    expect(cardByPasscode(55144522)).toBe(BANLIST_CARDS.indexOf('Pot of Greed'))
  })

  it('tells a tightening change from a loosening one', () => {
    expect(direction({ from: 'U', to: 'F' })).toBe('down')
    expect(direction({ from: 'N', to: 'S' })).toBe('down')
    expect(direction({ from: 'L', to: 'S' })).toBe('up')
    expect(direction({ from: 'F', to: 'U' })).toBe('up')
  })
})
