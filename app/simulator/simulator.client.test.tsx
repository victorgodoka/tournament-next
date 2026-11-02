// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@contexts/auth/auth.context'
import { cardsByIds } from '@utils/cards'
import { ComboApiError, ComboConflictError, deleteCombo, getCombo, listMyCombos, saveCombo, updateCombo, type ComboSummary, type SharedCombo } from '@utils/combos'
import { toYdke } from '@utils/deck/codecs/ydke'
import type { CardData } from '@utils/deck/types'
import { listMyDecks } from '@utils/decks'
import { DRAFT_KEY as DRAFT } from '@utils/simulator/draft'
import Simulator from './simulator.client'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
  useFormatter: () => ({ relativeTime: () => 'now' }),
  useNow: () => new Date(),
}))
vi.mock('@contexts/auth/auth.context', () => ({ useAuth: vi.fn() }))
vi.mock('@utils/cards', () => ({ cardsByIds: vi.fn(async () => new Map()) }))
vi.mock('@utils/decks', async (original) => ({ ...(await original<typeof import('@utils/decks')>()), listMyDecks: vi.fn() }))
// The errors and `comboUrl` stay real: the client tells them apart and builds the link with them.
vi.mock('@utils/combos', async (original) => ({
  ...(await original<typeof import('@utils/combos')>()),
  saveCombo: vi.fn(),
  updateCombo: vi.fn(),
  getCombo: vi.fn(),
  listMyCombos: vi.fn(),
  deleteCombo: vi.fn(),
}))

const DECK = `/simulator?d=${encodeURIComponent(toYdke({ main: [1, 2, 3, 4, 5, 6], extra: [7], side: [] }))}`

const wait = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })

/** Renders the simulator at `url` and lets the boot and card lookups settle. */
const open = async (url: string) => {
  window.history.replaceState(null, '', url)
  render(<Simulator />)
  await wait(50)
}

const zone = (key: string) => screen.getByRole('group', { name: `zones.${key}` })
/** The card buttons of a zone: each card also carries a lock button for the card panel, which is not a card. */
const cardButtons = (el: HTMLElement) => within(el).queryAllByRole('button').filter((b) => b.hasAttribute('data-card'))
const hand = () => cardButtons(zone('hand'))
const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name })
const click = (name: string) => act(async () => fireEvent.click(button(name)))
/** Save as, My combos and Share sit behind the toolbar's More button. */
const more = async (name: string) => {
  await click('toolbar.more')
  await act(async () => fireEvent.click(screen.getByRole('menuitem', { name })))
}
/** Whether the session is tied to a saved combo: Save as is offered under More only then. */
const tied = async () => {
  await click('toolbar.more')
  const yes = screen.queryByRole('menuitem', { name: 'toolbar.saveAs' }) !== null
  await click('toolbar.more')
  return yes
}

/** The innermost list open: a submenu opens beside the one it hangs from. */
const menu = () => screen.getAllByRole('menu').at(-1)!
const names = () => within(menu()).getAllByRole('menuitem').map((el) => el.textContent)
const choose = (name: string) => act(async () => fireEvent.click(within(menu()).getByRole('menuitem', { name })))
const rightClick = (el: HTMLElement) => act(async () => void fireEvent.contextMenu(el))
/** A mouse click on the element: `detail` 1, as a browser sends it (the default is a keyboard click, 0). */
const mouseClick = (el: HTMLElement) => act(async () => void fireEvent.click(el, { detail: 1 }))
const cardsIn = (key: string) => cardButtons(zone(key))
/** The counter badges in a zone. A card prints its own passcode (a number too) inside its button, so those are left out. */
const counters = (key: string) =>
  within(zone(key))
    .queryAllByText(/^\d+$/)
    .filter((el) => !el.closest('button'))
    .map((el) => el.textContent)

/** A mouse drag of the card onto the zone: happy-dom has no layout, so `document.elementFromPoint` is told what lies under the pointer. */
const dragOnto = async (card: HTMLElement, key: string) => {
  const under = vi.spyOn(document, 'elementFromPoint').mockReturnValue(zone(key))
  const pointer = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', at: number) => act(async () => void fireEvent[type](card, { clientX: at, clientY: at, pointerId: 1, pointerType: 'mouse' }))
  await pointer('pointerDown', 0)
  await pointer('pointerMove', 50)
  await pointer('pointerUp', 50)
  under.mockRestore()
}
/** The first card of the hand, dragged into `to`. */
const play = (to: string) => dragOnto(hand()[0]!, to.replace('zones.', ''))
/** The first card of the hand, Normal Summoned from its menu: unlike a drop it flies there, and the click after it counts. */
const summon = async (to: string) => {
  await rightClick(hand()[0]!)
  await choose('menu.normal')
  await click(to)
}
/** The first card of the hand, sent to the GY from its menu. */
const discard = async () => {
  await rightClick(hand()[0]!)
  await choose('menu.sendTo')
  await choose('menu.toGy')
}
/** Manage counters › the plain counter (the first one; it says its count once it has one) › Add or Remove. */
const counter = async (what: 'menu.counterUp' | 'menu.counterDown') => {
  await choose('menu.counters')
  await act(async () => fireEvent.click(within(menu()).getAllByRole('menuitem')[0]!))
  await choose(what)
}
const MAIN_HAND = ['menu.normal', 'menu.special', 'menu.activate', 'menu.set', 'menu.sendTo', 'menu.destroy', 'menu.shuffleDeck']
const MAIN_FIELD = ['menu.activate', 'menu.flipDown', 'menu.position', 'menu.negate', 'menu.counters', 'menu.sendTo', 'menu.destroy', 'menu.shuffleDeck', 'menu.tag']

/** The callbacks of every ResizeObserver the board made, so a test can fire the one that is watching. */
let resized: (() => void)[] = []

beforeEach(() => {
  // Node's own (flagged) localStorage shadows happy-dom's: each test gets a fresh one in memory.
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) })
  // The board redraws its arrows when it is resized.
  resized = []
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resized.push(callback)
      }
      observe() {}
      disconnect() {}
    },
  )
  // Reduced motion: nothing animates unless a test asks (happy-dom says no-preference but has no `Element.animate`).
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  vi.mocked(listMyDecks).mockResolvedValue({ decks: [], nextCursor: null })
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'u1' } } as ReturnType<typeof useAuth>)
  vi.mocked(saveCombo).mockResolvedValue({ id: 'c1', revision: 1 })
  vi.mocked(updateCombo).mockResolvedValue({ id: 'c1', revision: 2 })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('Simulator', () => {
  it('New hand draws 5 from the deck in the URL', async () => {
    await open(DECK)
    expect(hand()).toHaveLength(0)
    await click('toolbar.newHand')
    expect(hand()).toHaveLength(5)
    expect(within(zone('deck')).getByText('1')).toBeTruthy()
  })

  it('Draw 1 adds a card and Undo takes it back', async () => {
    await open(DECK)
    expect(button('toolbar.undo').disabled).toBe(true)
    await click('toolbar.newHand')
    await click('toolbar.draw')
    expect(hand()).toHaveLength(6)
    await click('toolbar.undo')
    expect(hand()).toHaveLength(5)
    await click('toolbar.undo') // the draw of 5
    await click('toolbar.undo') // the shuffle: back at cursor 0
    expect(hand()).toHaveLength(0)
    expect(button('toolbar.undo').disabled).toBe(true)
  })

  it('New hand asks to confirm once the session has more than draws', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await click('toolbar.newHand') // only shuffles and draws so far: no question
    expect(screen.queryByText('confirm.title')).toBeNull()
    await click('toolbar.endTurn')
    await click('toolbar.newHand')
    expect(screen.getByText('confirm.title')).toBeTruthy()
    await click('confirm.cancel')
    expect(screen.queryByText('confirm.title')).toBeNull()
    await click('toolbar.newHand') // the end of turn is still there, so it asks again
    expect(screen.getByText('confirm.title')).toBeTruthy()
    await click('confirm.discard')
    expect(screen.queryByText('confirm.title')).toBeNull()
    expect(hand()).toHaveLength(5)
    await click('toolbar.newHand') // a fresh hand holds only a shuffle and a draw
    expect(screen.queryByText('confirm.title')).toBeNull()
  })

  it('the draft survives a reload without ?d=', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await wait(350) // the draft is written 300 ms after the change
    cleanup()
    await open('/simulator')
    expect(hand()).toHaveLength(5)
  })

  it('a damaged ?d= shows damagedLink', async () => {
    await open('/simulator?d=garbage!!')
    expect(screen.getByText('damagedLink')).toBeTruthy()
  })

  it('the link leaves the URL once booted, and a reload before any step still shows its deck', async () => {
    await open(`${DECK}&name=Line&deck=abc&keep=1`)
    expect(location.search).toBe('?keep=1')
    cleanup()
    await open(location.pathname + location.search)
    expect(within(zone('deck')).getByText('6')).toBeTruthy() // written to the draft at boot
  })

  it('a reload right after a step on a ?d= link keeps the line', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    cleanup() // inside the 300 ms debounce
    await open(location.pathname + location.search)
    expect(hand()).toHaveLength(5)
  })

  it('a step still on the debounce is written on pagehide and on unmount', async () => {
    const cursor = () => JSON.parse(localStorage.getItem(DRAFT)!).cursor
    await open(DECK)
    await click('toolbar.newHand')
    expect(cursor()).toBe(0) // the booted deck only: the hand waits on the debounce
    await act(async () => void window.dispatchEvent(new Event('pagehide')))
    expect(cursor()).toBe(2)
    await click('toolbar.draw')
    cleanup()
    expect(cursor()).toBe(3)
  })

  it('a damaged ?d= leaves the stored draft as it was, for the next reload', async () => {
    const saved = JSON.stringify({ v: 1, deck: { main: [1, 2, 3], extra: [], side: [] }, name: 'Saved', actions: [{ t: 'draw', n: 2 }], cursor: 1, start: 0 })
    localStorage.setItem(DRAFT, saved)
    await open('/simulator?d=garbage!!')
    expect(screen.getByText('damagedLink')).toBeTruthy()
    await wait(350)
    cleanup()
    expect(localStorage.getItem(DRAFT)).toBe(saved)
    await open(location.pathname + location.search)
    expect(hand()).toHaveLength(2)
  })

  it('picking a deck with steps in the session asks first, and Cancel keeps the hand', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await pickDeck(toYdke({ main: [11, 12, 13, 14, 15, 16, 17], extra: [], side: [] }))
    expect(screen.getByText('confirm.title')).toBeTruthy()
    await click('confirm.cancel')
    expect(screen.queryByText('confirm.title')).toBeNull()
    expect(hand()).toHaveLength(5)
    expect(within(zone('deck')).getByText('1')).toBeTruthy() // still the deck of the link
  })

  it('loading a deck clears damagedLink', async () => {
    await open('/simulator?d=garbage!!')
    await pickDeck(toYdke({ main: [11, 12, 13, 14, 15, 16, 17], extra: [], side: [] }))
    expect(screen.queryByText('damagedLink')).toBeNull()
    expect(within(zone('deck')).getByText('7')).toBeTruthy()
  })
})

/** The deck picker's paste tab, with `code` imported. */
const pickDeck = async (code: string) => {
  await click('toolbar.deck')
  await act(async () => void fireEvent.click(screen.getByText('picker.paste')))
  fireEvent.change(screen.getByPlaceholderText('picker.placeholder'), { target: { value: code } })
  await act(async () => void fireEvent.click(screen.getByText('picker.import')))
}

describe('Simulator card menu', () => {
  it('Move to puts a hand card in a monster zone and Undo brings it back', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await play('zones.m2')
    expect(cardsIn('m2')).toHaveLength(1)
    expect(hand()).toHaveLength(4)
    expect(screen.queryByRole('menu')).toBeNull()
    await click('toolbar.undo')
    expect(hand()).toHaveLength(5)
    expect(within(zone('m2')).queryAllByRole('button')).toHaveLength(0)
  })

  it('keyboard opens the menu on the first item and Escape returns focus to the card', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    const card = hand()[0]!
    card.focus()
    await act(async () => void fireEvent.click(card)) // detail 0: Enter on a focused button
    const first = within(menu()).getAllByRole('menuitem')[0]!
    expect(document.activeElement).toBe(first)
    await act(async () => void fireEvent.keyDown(first, { key: 'ArrowDown' }))
    expect(document.activeElement).toBe(within(menu()).getAllByRole('menuitem')[1])
    await act(async () => void fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' }))
    expect(document.activeElement).toBe(first)
    await act(async () => void fireEvent.keyDown(first, { key: 'Escape' }))
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(card)
  })

  it('a pointer down outside closes the menu', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await rightClick(hand()[0]!)
    await act(async () => void fireEvent.pointerDown(within(menu()).getAllByRole('menuitem')[0]!))
    expect(screen.getByRole('menu')).toBeTruthy()
    await act(async () => void fireEvent.pointerDown(document.body))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('right-click keeps the browser menu away', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    let proceeded = true
    await act(async () => {
      proceeded = fireEvent.contextMenu(hand()[0]!)
    })
    expect(proceeded).toBe(false)
  })

  it('a field card gets flip, position, negate and counters; a hand card does not', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await rightClick(hand()[0]!)
    expect(names()).toEqual(MAIN_HAND)
    await act(async () => void fireEvent.keyDown(document, { key: 'Escape' }))
    await play('zones.m0')
    await rightClick(cardsIn('m0')[0]!)
    expect(names()).toEqual(MAIN_FIELD)
    await choose('menu.counters')
    expect(names()).toEqual(['menu.counterPlain', 'menu.newKind'])
    await choose('menu.counterPlain')
    expect(names()).toEqual(['menu.counterUp']) // no counters yet: no Remove
    await choose('menu.counterUp')
    await rightClick(cardsIn('m0')[0]!)
    await choose('menu.counters')
    expect(names()).toContain('menu.counterKind') // the plain counter now says its count
    await choose('menu.counterKind')
    expect(names()).toContain('menu.counterDown')
  })

  it('a monster flips face-down into Defense and comes face-up in the position asked for', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await play('zones.m0')
    const pos = () => cardsIn('m0')[0]!.getAttribute('data-pos')
    expect(pos()).toBe('atk')
    await rightClick(cardsIn('m0')[0]!)
    await choose('menu.flipDown')
    expect(pos()).toBe('def')
    await rightClick(cardsIn('m0')[0]!)
    await choose('menu.flipUp')
    expect(names()).toEqual(['menu.flipAtk', 'menu.flipDef'])
    await choose('menu.flipAtk')
    expect(pos()).toBe('atk')
    await rightClick(cardsIn('m0')[0]!)
    expect(names()).toContain('menu.flipDown')
  })

  it('a banished card turns over from Send to', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await rightClick(hand()[0]!)
    await choose('menu.sendTo')
    await choose('menu.banishDown')
    await rightClick(within(await openPile('banished')).getAllByRole('button')[0]!)
    await choose('menu.sendTo')
    expect(names()).toEqual(['menu.toGy', 'menu.banish', 'menu.toHand'])
    await choose('menu.banish')
    await rightClick(within(screen.getByRole('list', { name: 'zones.banished' })).getAllByRole('button')[0]!) // the pile stays open
    await choose('menu.sendTo')
    expect(names()).toEqual(['menu.toGy', 'menu.banishDown', 'menu.toHand'])
  })

  it('a spell or trap slot card gets flip but no ATK/DEF position', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await play('zones.s0')
    await rightClick(cardsIn('s0')[0]!)
    expect(names()).toEqual(['menu.activate', 'menu.flipDown', 'menu.negate', 'menu.counters', 'menu.sendTo', 'menu.destroy', 'menu.shuffleDeck', 'menu.tag'])
  })

  it('Send to, Destroy and Shuffle take the card off; an Extra Deck card goes back to the Extra Deck instead', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await rightClick(hand()[0]!)
    await choose('menu.sendTo')
    expect(names()).toEqual(['menu.toGy', 'menu.banish', 'menu.banishDown']) // in hand: no "Hand"
    await act(async () => void fireEvent.keyDown(document, { key: 'Escape' }))
    await rightClick(hand()[0]!)
    await choose('menu.destroy')
    expect(names()).toEqual(['menu.destroyGy', 'menu.destroyBanish'])
    await choose('menu.destroyGy')
    expect(hand()).toHaveLength(4)
    expect(within(zone('gy')).getByText('1')).toBeTruthy()
    expect(document.querySelectorAll('[data-destroyed]').length).toBeGreaterThan(0) // the step on screen: cracks on the GY
    await click('toolbar.undo')
    expect(document.querySelector('[data-destroyed]')).toBeNull()
    await rightClick(hand()[0]!)
    await choose('menu.shuffleDeck')
    expect(hand()).toHaveLength(4)
    expect(steps().slice(-2)).toEqual(['history.move', 'history.shuffle'])
    // the extra card, from its pile: there is no deck to shuffle it into, and it comes back to the Extra Deck, not the hand
    const extra = within(await openPile('extra')).getAllByRole('button')[0]!
    await rightClick(extra)
    expect(names()).not.toContain('menu.shuffleDeck')
    await choose('menu.sendTo')
    expect(names()).toEqual(['menu.toGy', 'menu.banish', 'menu.banishDown'])
    await choose('menu.toGy')
    await rightClick(within(await openPile('gy')).getAllByRole('button')[0]!)
    await choose('menu.sendTo')
    expect(names()).toContain('menu.toExtra')
    expect(names()).not.toContain('menu.toHand')
    await choose('menu.toExtra')
    expect(within(zone('extra')).getByText('1')).toBeTruthy()
  })

  it('a counter kind named in the dialog goes on the card and is offered from then on', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await play('zones.m0')
    await rightClick(cardsIn('m0')[0]!)
    await choose('menu.counters')
    await choose('menu.newKind')
    const field = screen.getByRole<HTMLInputElement>('textbox', { name: 'counterKind.label' })
    await act(async () => void fireEvent.change(field, { target: { value: ' Spell ' } }))
    await click('counterKind.confirm')
    expect(within(zone('m0')).getByText('SPE 1')).toBeTruthy()
    await rightClick(cardsIn('m0')[0]!)
    await choose('menu.counters')
    expect(names()).toEqual(['menu.counterPlain', 'menu.counterKind', 'menu.newKind'])
    await act(async () => void fireEvent.keyDown(document, { key: 'Escape' }))
    // the kind is offered on another card too, and stays through a reload (the draft keeps it)
    await play('zones.m1')
    cleanup()
    await open('/simulator')
    await rightClick(cardsIn('m1')[0]!)
    await choose('menu.counters')
    expect(names()).toEqual(['menu.counterPlain', 'Spell', 'menu.newKind']) // none on this card yet: the kind's name alone
  })

  it('a tag shows over the card on the last step, and an empty one clears it', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await play('zones.m0')
    await rightClick(cardsIn('m0')[0]!)
    await choose('menu.tag')
    const field = screen.getByRole<HTMLInputElement>('textbox', { name: 'tagDialog.label' })
    await act(async () => void fireEvent.change(field, { target: { value: 'Negates once' } }))
    await click('tagDialog.confirm')
    expect(within(zone('m0')).getByText('Negates once')).toBeTruthy()
    await click('toolbar.undo') // not the last step any more: no tags
    expect(screen.queryByText('Negates once')).toBeNull()
    await click('toolbar.redo')
    await rightClick(cardsIn('m0')[0]!)
    await choose('menu.sendTo')
    await choose('menu.toGy') // the tag goes with the card: the GY shows it on its top
    expect(within(zone('gy')).getByText('Negates once')).toBeTruthy()
    await click('toolbar.undo')
    await rightClick(cardsIn('m0')[0]!)
    expect(names()).toContain('menu.retag')
    await choose('menu.retag')
    await act(async () => void fireEvent.change(screen.getByRole('textbox', { name: 'tagDialog.label' }), { target: { value: '' } }))
    await click('tagDialog.confirm')
    expect(screen.queryByText('Negates once')).toBeNull()
  })

  it('focus goes to the pile button when the keyboard moved the card into a pile', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    // Pile cards have no [data-card] on the board, so the card itself is not there to take the focus back.
    for (const [item, pile] of [['menu.toGy', 'gy'], ['menu.banish', 'banished']] as const) {
      const card = hand()[0]!
      card.focus()
      await act(async () => void fireEvent.click(card)) // detail 0: Enter on the focused card
      await choose('menu.sendTo')
      await choose(item)
      expect(screen.queryByRole('menu')).toBeNull()
      expect(document.activeElement).toBe(within(zone(pile)).getByRole('button', { name: `zones.${pile}` }))
    }
  })

  it('position and negate show on the card, and flip is one step of its own', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await play('zones.m0')
    const top = () => cardsIn('m0')[0]!
    await rightClick(top())
    await choose('menu.position')
    expect(top().parentElement!.className).toContain('rotate-90')
    await rightClick(top())
    await choose('menu.negate')
    expect(within(zone('m0')).getByRole('img', { name: 'negated' })).toBeTruthy()
    await rightClick(top())
    await choose('menu.flipDown')
    await click('toolbar.undo') // the flip only: the card is still there, still negated and sideways
    expect(cardsIn('m0')).toHaveLength(1)
    expect(within(zone('m0')).getByRole('img', { name: 'negated' })).toBeTruthy()
    await rightClick(top())
    await choose('menu.negate') // negate is a toggle
    expect(within(zone('m0')).queryByRole('img', { name: 'negated' })).toBeNull()
  })

  it('counters go up and the badge shows the count', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await play('zones.m2')
    expect(counters('m2')).toEqual([])
    await rightClick(cardsIn('m2')[0]!)
    await counter('menu.counterUp')
    await rightClick(cardsIn('m2')[0]!)
    await counter('menu.counterUp')
    expect(counters('m2')).toEqual(['2'])
    await rightClick(cardsIn('m2')[0]!)
    await counter('menu.counterDown')
    expect(counters('m2')).toEqual(['1'])
  })

  it('a submenu opens as the pointer rests on its item, closes on a plain item, and a finger does neither', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await rightClick(hand()[0]!)
    const item = (name: string) => within(screen.getAllByRole('menu')[0]!).getByRole('menuitem', { name })
    const hover = async (name: string, pointerType: string) => {
      await act(async () => void fireEvent.pointerEnter(item(name), { pointerType }))
      await act(() => wait(150))
    }
    await hover('menu.sendTo', 'touch')
    expect(screen.getAllByRole('menu')).toHaveLength(1)
    await hover('menu.sendTo', 'mouse')
    expect(names()).toEqual(['menu.toGy', 'menu.banish', 'menu.banishDown'])
    expect(item('menu.sendTo').getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(within(screen.getAllByRole('menu')[0]!).getAllByRole('menuitem')[0]) // the focus stays where it was
    await hover('menu.destroy', 'mouse')
    expect(names()).toEqual(['menu.destroyGy', 'menu.destroyBanish'])
    await hover('menu.set', 'mouse')
    expect(screen.getAllByRole('menu')).toHaveLength(1)
  })

  it('the right arrow enters a submenu and the left arrow comes back to its item', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await rightClick(hand()[0]!)
    const opener = within(menu()).getByRole('menuitem', { name: 'menu.special' })
    await act(async () => void opener.focus())
    await act(async () => void fireEvent.keyDown(opener, { key: 'ArrowRight' }))
    expect(names()).toEqual(['menu.specialAtk', 'menu.specialDef', 'menu.specialDownAtk', 'menu.specialSet'])
    expect(document.activeElement).toBe(within(menu()).getAllByRole('menuitem')[0])
    await act(async () => void fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' }))
    expect(screen.getAllByRole('menu')).toHaveLength(1)
    expect(document.activeElement).toBe(opener)
  })

  it('Activate opens its own list: now, or with targets', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    const card = hand()[1]!
    await rightClick(card)
    await choose('menu.activate')
    expect(names()).toEqual(['menu.activateNow', 'menu.activateTargets'])
    await choose('menu.activateNow')
    expect(card.dataset.active).toBe('true')
  })
})

describe('Simulator card panel lock', () => {
  it('the panel follows the pointer over the cards; the lock keeps it on one, and the panel’s own lock lets go', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    const [first, second] = hand() as [HTMLElement, HTMLElement]
    expect(screen.getByText('cardPanel.empty')).toBeTruthy()
    await act(async () => void fireEvent.pointerEnter(first.parentElement!.parentElement!))
    expect(screen.getByRole('heading', { name: first.title })).toBeTruthy()
    await act(async () => void fireEvent.pointerLeave(first.parentElement!.parentElement!))
    expect(screen.getByText('cardPanel.empty')).toBeTruthy()
    // the lock button is the sibling of the tile's wrapper
    await act(async () => void fireEvent.click(within(first.parentElement!.parentElement!).getByRole('button', { name: 'lock.lock' })))
    expect(screen.getByRole('heading', { name: first.title })).toBeTruthy()
    await act(async () => void fireEvent.pointerEnter(second.parentElement!.parentElement!))
    expect(screen.getByRole('heading', { name: first.title })).toBeTruthy() // locked: the hover changes nothing
    expect(within(first.parentElement!.parentElement!).getByRole('button', { name: 'lock.unlock' })).toBeTruthy()
    await click('cardPanel.unlock')
    expect(screen.getByRole('heading', { name: second.title })).toBeTruthy() // still hovered
    await act(async () => void fireEvent.pointerLeave(second.parentElement!.parentElement!))
    await click('toolbar.newHand') // a new board clears the lock too
    expect(screen.getByText('cardPanel.empty')).toBeTruthy()
  })
})

describe('Simulator card panel', () => {
  it('a mouse click selects the card without opening the menu; New hand and Reset clear it', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    const card = hand()[0]!
    await mouseClick(card)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('heading', { name: card.title })).toBeTruthy()
    await click('toolbar.newHand')
    expect(screen.getByText('cardPanel.empty')).toBeTruthy()
    await mouseClick(hand()[0]!)
    await more('toolbar.reset')
    await click('confirm.discard')
    expect(screen.getByText('cardPanel.empty')).toBeTruthy()
  })
})

const openPile = async (key: string) => {
  await mouseClick(within(zone(key)).getByRole('button', { name: `zones.${key}` }))
  return screen.getByRole('list', { name: `zones.${key}` })
}
const openMaterials = async (key: string) => {
  await mouseClick(within(zone(key)).getByRole('button', { name: 'pile.materials' }))
  return screen.getByRole('list', { name: 'pile.materials' })
}

describe('Simulator pile panel', () => {
  it('the deck pile panel moves a card to the hand', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    const list = await openPile('deck')
    const cards = within(list).getAllByRole('button')
    expect(cards).toHaveLength(1)
    await rightClick(cards[0]!)
    await choose('menu.sendTo')
    await choose('menu.toHand')
    expect(hand()).toHaveLength(6)
    expect(screen.getByText('pile.empty')).toBeTruthy()
    await click('pile.close')
    expect(screen.queryByRole('list', { name: 'zones.deck' })).toBeNull()
  })

  it('a second click on the pile closes its panel', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await openPile('deck')
    await mouseClick(within(zone('deck')).getByRole('button', { name: 'zones.deck' }))
    expect(screen.queryByRole('list', { name: 'zones.deck' })).toBeNull()
  })

  it('a mouse click in the panel selects and a touch tap opens the menu', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    const card = within(await openPile('deck')).getAllByRole('button')[0]!
    await mouseClick(card)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('heading', { name: card.title })).toBeTruthy()
    await act(async () => void fireEvent.pointerDown(card, { pointerType: 'touch' }))
    await mouseClick(card)
    expect(names()).toContain('menu.sendTo')
  })

  it('the x N badge opens the materials, and the menu works on each of them', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await play('zones.m0')
    await play('zones.m0') // an occupied monster zone: the second card goes on top, the first becomes its material
    const materials = within(await openMaterials('m0')).getAllByRole('button')
    expect(materials).toHaveLength(1)
    await rightClick(materials[0]!)
    // a material is not a field card: no flip, position, negate or counters
    expect(names()).toEqual(['menu.activate', 'menu.sendTo', 'menu.destroy', 'menu.shuffleDeck', 'menu.tag'])
    await choose('menu.sendTo')
    await choose('menu.toGy')
    expect(within(zone('gy')).getAllByRole('button').length).toBeGreaterThan(0)
    expect(within(zone('m0')).queryByRole('button', { name: 'pile.materials' })).toBeNull()
  })

  it('the top card’s menu opens the materials too', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await play('zones.m0')
    await play('zones.m0')
    await rightClick(cardsIn('m0')[0]!) // the monster on top
    expect(names()).toContain('menu.materials')
    await choose('menu.materials')
    expect(within(screen.getByRole('list', { name: 'pile.materials' })).getAllByRole('button')).toHaveLength(1)
  })

  it('the materials panel closes once the slot no longer holds a stack', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await play('zones.m0')
    await play('zones.m0')
    await rightClick(within(await openMaterials('m0')).getAllByRole('button')[0]!)
    await choose('menu.sendTo')
    await choose('menu.toGy') // the last material leaves: the slot is a lone monster again
    expect(screen.queryByRole('list', { name: 'pile.materials' })).toBeNull()
    expect(screen.queryByText('pile.empty')).toBeNull()
    await play('zones.m0') // a new material in the same slot does not bring the closed panel back
    expect(within(zone('m0')).getByRole('button', { name: 'pile.materials' })).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'pile.materials' })).toBeNull()
  })

  it('a card moved over a monster stays on top, and the one under it is its material', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await play('zones.m0')
    const under = cardsIn('m0')[0]!.dataset.card
    const moved = hand()[0]!.dataset.card
    await play('zones.m0')
    expect(cardsIn('m0')[0]!.dataset.card).toBe(moved)
    const materials = within(await openMaterials('m0')).getAllByRole('button')
    expect(materials.map((el) => el.dataset.card)).toEqual([under])
  })

  it('a double-click on a material sends it to the GY; on a card of any other pile it activates it there', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await play('zones.m0')
    await play('zones.m0')
    const material = within(await openMaterials('m0')).getAllByRole('button')[0]!
    await act(async () => void fireEvent.doubleClick(material))
    expect(within(zone('gy')).getByText('1')).toBeTruthy()
    expect(within(zone('m0')).queryByRole('button', { name: 'pile.materials' })).toBeNull()
    await act(async () => void fireEvent.doubleClick(within(await openPile('gy')).getAllByRole('button')[0]!))
    expect(steps().at(-1)).toBe('history.activate')
  })
})

/** New hand, the first card to m0, then the next card of the hand in target mode: the activating card and the one on the field. */
const targetMode = async () => {
  await click('toolbar.newHand')
  await summon('zones.m0')
  const source = hand()[0]!
  await rightClick(source)
  await choose('menu.activate')
  await choose('menu.activateTargets')
  return { source, field: cardsIn('m0')[0]! }
}
const marked = (attr: 'data-active' | 'data-targeted') => Array.from(document.querySelectorAll(`[${attr}]`))

describe('Simulator targets', () => {
  it('activate with targets marks the source and the target, and Undo removes both', async () => {
    await open(DECK)
    const { source, field } = await targetMode()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(button('targets.confirm').disabled).toBe(true) // nothing picked yet
    await mouseClick(field)
    expect(button('targets.confirm').disabled).toBe(false)
    await click('targets.confirm')
    expect(screen.queryByRole('button', { name: 'targets.confirm' })).toBeNull()
    expect(marked('data-active')).toEqual([source])
    expect(marked('data-targeted')).toEqual([field])
    await click('toolbar.undo')
    expect(marked('data-active')).toEqual([])
    expect(marked('data-targeted')).toEqual([])
    expect(cardsIn('m0')).toHaveLength(1) // the step undone was the activation, not the move
  })

  it('a click on a target again drops it, and the source cannot be its own target', async () => {
    await open(DECK)
    const { source, field } = await targetMode()
    await mouseClick(field)
    expect(marked('data-targeted')).toEqual([field]) // shown while picking
    await mouseClick(source)
    expect(marked('data-targeted')).toEqual([field])
    await mouseClick(field)
    expect(marked('data-targeted')).toEqual([])
    expect(button('targets.confirm').disabled).toBe(true)
  })

  it('a keyboard click on a card picks it instead of opening the menu', async () => {
    await open(DECK)
    const { field } = await targetMode()
    await act(async () => void fireEvent.click(field)) // detail 0: Enter on a focused button
    expect(screen.queryByRole('menu')).toBeNull()
    expect(marked('data-targeted')).toEqual([field])
  })

  it('a touch tap on a card in the pile panel picks it instead of opening the menu', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await play('zones.gy')
    await rightClick(hand()[0]!)
    await choose('menu.activate')
    await choose('menu.activateTargets')
    const card = within(await openPile('gy')).getAllByRole('button')[0]!
    await act(async () => void fireEvent.pointerDown(card, { pointerType: 'touch' }))
    await mouseClick(card)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(button('targets.confirm').disabled).toBe(false)
  })

  it('Escape leaves target mode without a step', async () => {
    await open(DECK)
    const { field } = await targetMode()
    await mouseClick(field)
    expect(button('targets.confirm')).toBeTruthy() // in target mode, with a pick
    await act(async () => void fireEvent.keyDown(document.body, { key: 'Escape' }))
    expect(screen.queryByRole('button', { name: 'targets.confirm' })).toBeNull()
    expect(marked('data-active')).toEqual([])
    expect(marked('data-targeted')).toEqual([])
    await click('toolbar.undo') // the step undone is still the move, so no activation was logged
    expect(within(zone('m0')).queryAllByRole('button')).toHaveLength(0)
  })

  it('Cancel leaves target mode too', async () => {
    await open(DECK)
    await targetMode()
    await click('targets.cancel')
    expect(screen.queryByRole('button', { name: 'targets.confirm' })).toBeNull()
  })

  it('no menu while picking', async () => {
    await open(DECK)
    await targetMode()
    let proceeded = true
    await act(async () => {
      proceeded = fireEvent.contextMenu(hand()[0]!)
    })
    expect(proceeded).toBe(false) // still not the browser's menu
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('a double-click activates a card with no targets: it glows, nothing is targeted', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    const card = hand()[0]!
    await act(async () => void fireEvent.dblClick(card))
    expect(marked('data-active')).toEqual([card])
    expect(marked('data-targeted')).toEqual([])
  })

  describe('arrows', () => {
    const arrows = () => Array.from(document.querySelectorAll('[data-arrows] path'))
    /** The line of an arrow (the first four numbers of its path): where it leaves and where its head lands. */
    const line = (el: Element) => el.getAttribute('d')!.match(/-?\d+(\.\d+)?/g)!.slice(0, 4).map(Number)
    const expectLine = (el: Element | undefined, to: number[]) => line(el!).forEach((n, i) => expect(n).toBeCloseTo(to[i]!))
    /** Where the stubbed layout puts each card: the activating one at x 0, the target at x 100, each 10 × 10; zones sit further right. */
    let at: Record<string, number> = {}
    const left = (el: Element) => (el.hasAttribute('data-card') ? at[el.getAttribute('data-card')!] : el.hasAttribute('data-zone') ? at[el.getAttribute('data-zone')!] : undefined)

    beforeEach(() => {
      at = {}
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        const x = left(this)
        return x === undefined ? new DOMRect(0, 0, 0, 0) : new DOMRect(x, 0, 10, 10)
      })
    })
    afterEach(() => void vi.restoreAllMocks())

    it('one arrow per target, from the edge of the source to the edge of the target', async () => {
      await open(DECK)
      const { source, field } = await targetMode()
      at[source.getAttribute('data-card')!] = 0
      at[field.getAttribute('data-card')!] = 100
      await mouseClick(field)
      await click('targets.confirm')
      expect(arrows()).toHaveLength(1)
      // The line leaves the source on its right edge and ends on the left edge of the target.
      expectLine(arrows()[0], [10, 5, 100, 5])
      expect(document.querySelector('[data-arrows]')!.getAttribute('aria-hidden')).toBe('true')
      await click('toolbar.undo')
      expect(arrows()).toHaveLength(0)
    })

    it('a ResizeObserver redraws the arrows where the cards are now', async () => {
      await open(DECK)
      const { source, field } = await targetMode()
      at[source.getAttribute('data-card')!] = 0
      at[field.getAttribute('data-card')!] = 100
      await mouseClick(field)
      await click('targets.confirm')
      at[field.getAttribute('data-card')!] = 200
      await act(async () => resized.at(-1)!())
      expectLine(arrows()[0], [10, 5, 200, 5])
    })

    it('a target in a pile gets its arrow from the pile’s zone', async () => {
      await open(DECK)
      await click('toolbar.newHand')
      await discard()
      const source = hand()[0]!
      await rightClick(source)
      await choose('menu.activate')
      await choose('menu.activateTargets')
      at[source.getAttribute('data-card')!] = 0
      at.gy = 300
      await mouseClick(within(await openPile('gy')).getAllByRole('button')[0]!)
      await click('targets.confirm')
      expect(arrows()).toHaveLength(1)
      expectLine(arrows()[0], [10, 5, 300, 5])
    })
  })
})

describe('Simulator gestures', () => {
  type Pointer = 'pointerDown' | 'pointerMove' | 'pointerUp' | 'pointerCancel'
  const ptr = (el: HTMLElement, type: Pointer, x: number, y: number, init: PointerEventInit = {}) =>
    act(async () => void fireEvent[type](el, { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', ...init }))
  /** What `document.elementFromPoint` finds under the pointer: happy-dom has no layout. */
  const under = (el: Element) => vi.spyOn(document, 'elementFromPoint').mockReturnValue(el)
  /** Press at (0, 0), move to (50, 50), release over `to`. */
  const drag = async (el: HTMLElement, to: Element, init: PointerEventInit = {}) => {
    under(to)
    await ptr(el, 'pointerDown', 0, 0, init)
    await ptr(el, 'pointerMove', 50, 50, init)
    await ptr(el, 'pointerUp', 50, 50, init)
  }
  const touch = { pointerType: 'touch' }

  afterEach(() => void vi.restoreAllMocks())

  it('a card dropped on the strip of the hand, away from its cards, goes back to the hand', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await play('zones.m0')
    // The strip lets the pointer through: what lies under it is the board, which no zone covers.
    vi.spyOn(zone('hand'), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 100))
    under(document.body)
    const card = cardsIn('m0')[0]!
    await ptr(card, 'pointerDown', 0, 0)
    await ptr(card, 'pointerMove', 50, 50)
    expect(zone('hand').hasAttribute('data-over')).toBe(true) // lit up while the card is over it
    await ptr(card, 'pointerUp', 50, 50)
    expect(zone('hand').hasAttribute('data-over')).toBe(false)
    expect(hand()).toHaveLength(5)
    expect(cardsIn('m0')).toHaveLength(0)
  })

  it('dragging a hand card onto an empty monster zone moves it', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await drag(hand()[0]!, zone('m0'))
    expect(cardsIn('m0')).toHaveLength(1)
    expect(hand()).toHaveLength(4)
  })

  it('a drop outside any zone adds no step', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await drag(hand()[0]!, document.body)
    expect(hand()).toHaveLength(5)
    await click('toolbar.undo') // the last step is still the draw
    expect(hand()).toHaveLength(0)
  })

  it('a ghost follows the pointer through the DOM and goes when it is released', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    const card = hand()[0]!
    const ghost = () => document.querySelector<HTMLElement>('[inert]')
    under(document.body)
    await ptr(card, 'pointerDown', 0, 0)
    expect(ghost()).toBeNull()
    await ptr(card, 'pointerMove', 50, 60)
    expect(ghost()!.style.translate).toBe('50px 60px')
    await ptr(card, 'pointerMove', 70, 80)
    expect(ghost()!.style.translate).toBe('70px 80px')
    await ptr(card, 'pointerUp', 70, 80)
    expect(ghost()).toBeNull()
  })

  it('a press that stays inside the slop is not a drag', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    const card = hand()[0]!
    under(zone('m0'))
    await ptr(card, 'pointerDown', 0, 0)
    await ptr(card, 'pointerMove', 4, 4)
    await ptr(card, 'pointerUp', 4, 4)
    expect(hand()).toHaveLength(5)
    expect(within(zone('m0')).queryAllByRole('button')).toHaveLength(0)
  })

  it('Shift on the drop sets the card: face-down DEF on a monster zone', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await drag(hand()[0]!, zone('m1'), { shiftKey: true })
    expect(cardsIn('m1')[0]!.parentElement!.className).toContain('rotate-90')
  })

  it('the click that ends a drag is swallowed, the next one selects', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    const card = hand()[0]!
    await drag(card, document.body)
    await mouseClick(card)
    expect(screen.getByText('cardPanel.empty')).toBeTruthy()
    await mouseClick(card)
    expect(screen.queryByText('cardPanel.empty')).toBeNull()
  })

  it('double-click activates without moving the card', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await act(async () => void fireEvent.dblClick(hand()[0]!))
    expect(hand()).toHaveLength(5)
    await click('toolbar.undo') // the step undone was the activation
    expect(hand()).toHaveLength(5)
  })

  it('a touch drag moves a card and never opens the menu', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await drag(hand()[0]!, zone('m0'), touch)
    await wait(500) // past the long press
    expect(cardsIn('m0')).toHaveLength(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('a long press opens the menu at the finger and selects the card', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    const card = hand()[0]!
    await ptr(card, 'pointerDown', 20, 30, touch)
    expect(screen.queryByRole('menu')).toBeNull()
    await wait(500)
    expect(names()).toContain('menu.sendTo')
    expect([menu().style.left, menu().style.top]).toEqual(['20px', '30px'])
    expect(screen.getByRole('heading', { name: card.title })).toBeTruthy()
  })

  it('no drag while the menu is open', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await rightClick(hand()[0]!)
    await drag(hand()[1]!, zone('m0'))
    expect(within(zone('m0')).queryAllByRole('button')).toHaveLength(0)
    expect(hand()).toHaveLength(5)
  })

  it('no drag while picking targets', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await rightClick(hand()[0]!)
    await choose('menu.activate')
    await choose('menu.activateTargets')
    await drag(hand()[1]!, zone('m0'))
    expect(within(zone('m0')).queryAllByRole('button')).toHaveLength(0)
    expect(hand()).toHaveLength(5)
  })

  it('shortcuts wait while a card is dragged', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    under(document.body)
    await ptr(hand()[0]!, 'pointerDown', 0, 0)
    await ptr(hand()[0]!, 'pointerMove', 50, 50)
    await act(async () => void fireEvent.keyDown(window, { key: 'z', ctrlKey: true }))
    expect(hand()).toHaveLength(5)
    expect(document.querySelector('[inert]')).toBeTruthy() // the ghost still follows the card
  })

  it('a pile panel card drags with the mouse but not with a finger', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    const card = within(await openPile('deck')).getAllByRole('button')[0]!
    await drag(card, zone('hand'), touch)
    expect(hand()).toHaveLength(5)
    await drag(card, zone('hand'))
    expect(hand()).toHaveLength(6)
  })
})

/** The history rows; each one's first button seeks to it. */
const rows = () => within(screen.getByRole('list', { name: 'history.title' })).getAllByRole('listitem')
const steps = () => rows().map((row) => within(row).getAllByRole('button')[0]!.textContent)
const replayFrom = (row: number) => act(async () => void fireEvent.click(within(rows()[row]!).getByRole('button', { name: 'history.replayFromHere' })))
const key = (target: Window | Element, init: KeyboardEventInit) => act(async () => void fireEvent.keyDown(target, init))

describe('Simulator history and replay', () => {
  it('history lists steps and seeking shows that moment', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    expect(steps()).toEqual(['history.start', 'history.shuffle', 'history.draw'])
    expect(rows().map((row) => row.querySelector('[data-step-number]')?.textContent ?? null)).toEqual([null, '#1', '#2'])
    expect(within(rows()[2]!).getAllByRole('button')[0]!.getAttribute('aria-current')).toBe('step')
    expect(within(rows()[2]!).getByText('history.startMark')).toBeTruthy() // the hand is dealt before the replay starts
    await click('history.shuffle')
    expect(hand()).toHaveLength(0)
    expect(button('history.shuffle').getAttribute('aria-current')).toBe('step')
  })

  it('acting after a seek drops the later steps', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await click('history.shuffle')
    await click('toolbar.draw')
    expect(steps()).toEqual(['history.start', 'history.shuffle', 'history.draw'])
    expect(hand()).toHaveLength(1)
  })

  it('replay starts at the chosen step and plays to the end', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await click('toolbar.draw')
    await replayFrom(1) // the shuffle
    await replayFrom(2) // back to the draw of 5
    expect(within(rows()[2]!).getByText('history.startMark')).toBeTruthy()
    vi.useFakeTimers()
    await click('replay.play')
    expect(hand()).toHaveLength(5)
    expect(button('replay.pause')).toBeTruthy()
    await act(async () => void vi.advanceTimersByTime(1200)) // the draw of 5 on screen: a draw stays 1.2 s
    expect(hand()).toHaveLength(6)
    expect(button('replay.play')).toBeTruthy()
  })

  it('no menu opens while the replay plays', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await click('toolbar.draw')
    vi.useFakeTimers()
    await click('replay.play')
    await rightClick(hand()[0]!)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(button('toolbar.undo').disabled).toBe(true) // the toolbar is off but for Pause
    await click('replay.pause')
    await act(async () => void vi.advanceTimersByTime(800))
    expect(hand()).toHaveLength(5) // paused: no step
  })

  it('Ctrl+Z undoes, but not when typed into an input', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await click('toolbar.draw')
    await key(window, { key: 'z', ctrlKey: true })
    expect(hand()).toHaveLength(5)
    const input = document.body.appendChild(document.createElement('input'))
    await key(input, { key: 'z', ctrlKey: true })
    expect(hand()).toHaveLength(5)
    input.remove()
  })

  it('arrows step, Ctrl+Y and Ctrl+Shift+Z redo', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await key(window, { key: 'ArrowLeft' })
    expect(hand()).toHaveLength(0)
    await key(window, { key: 'ArrowRight' })
    expect(hand()).toHaveLength(5)
    await key(window, { key: 'ArrowLeft' })
    await key(window, { key: 'y', ctrlKey: true })
    expect(hand()).toHaveLength(5)
    await key(window, { key: 'ArrowLeft' })
    await key(window, { key: 'Z', ctrlKey: true, shiftKey: true })
    expect(hand()).toHaveLength(5)
  })

  it('in target mode, Ctrl+Z does not undo', async () => {
    await open(DECK)
    await targetMode()
    await key(window, { key: 'z', ctrlKey: true })
    expect(cardsIn('m0')).toHaveLength(1)
    expect(button('targets.confirm')).toBeTruthy()
    expect(button('toolbar.undo').disabled).toBe(true)
  })

  it('Escape in an open dialog leaves target mode alone', async () => {
    await open(DECK)
    await targetMode()
    await more('toolbar.reset') // the confirm dialog
    await key(document.body, { key: 'Escape' })
    expect(button('targets.confirm')).toBeTruthy()
  })

  it('a row that names a card shows its thumbnail, hidden from the row’s name', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    const card = hand()[0]!
    await play('zones.m0')
    expect(steps()[3]).toBe('history.move')
    const thumb = rows()[3]!.querySelector('[data-tile]')
    expect(thumb?.getAttribute('title')).toBe(card.title)
    expect(thumb?.getAttribute('aria-hidden')).toBe('true')
    expect(rows()[2]!.querySelector('[data-tile]')).toBeNull() // a draw names no card
  })

  describe('flights', () => {
    let motion = true
    let animate = vi.fn()
    beforeEach(() => {
      motion = true
      vi.stubGlobal('matchMedia', () => ({ matches: motion }))
      animate = vi.fn()
      Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true })
      // The hand sits at y 300, each of its cards 50 px right of the one before; m0 at x 200, the deck at x 600;
      // everything else at the origin. Every box is 10 px wide, so a centre is 5 px in.
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        const at = this.closest('[data-zone]')?.getAttribute('data-zone')
        const slot = this.closest('[data-zone="hand"] > *')
        const x = at === 'm0' ? 200 : at === 'deck' ? 600 : slot ? [...slot.parentElement!.children].indexOf(slot) * 50 : 0
        return new DOMRect(x, at === 'hand' ? 300 : 0, 10, 10)
      })
    })
    afterEach(() => {
      vi.restoreAllMocks()
      delete (HTMLElement.prototype as Partial<HTMLElement>).animate
    })
    /** Every copy that flew: where it left, where it landed, and what stayed hidden meanwhile (the next call to animate). */
    const flights = (): { from: string; to: string; hidden: Element }[] =>
      animate.mock.calls.flatMap((call, i) => {
        if (!(animate.mock.contexts[i] as HTMLElement).classList.contains('sim-flight')) return []
        const frames = call[0] as Keyframe[]
        const place = (frame: Keyframe) => /translate\(([^)]*)\)/.exec(String(frame.transform))![1]!
        return [{ from: place(frames[0]!), to: place(frames.at(-1)!), hidden: animate.mock.contexts[i + 1] as Element }]
      })

    it('a move flies a copy from where the card was and hides the card until it lands, unless motion is reduced', async () => {
      await open(DECK)
      await click('toolbar.newHand')
      animate.mockClear()
      await summon('zones.m0')
      expect(flights()).toHaveLength(1)
      expect(flights()[0]).toMatchObject({ from: '5px, 305px', to: '205px, 5px' })
      expect(flights()[0]!.hidden).toBe(cardsIn('m0')[0]!.parentElement) // the wrapper DEF turns, not the button inside it
      expect(cardsIn('m0')[0]!.closest('.sim-fx')).toBeNull()
      expect(document.querySelector('.sim-flight [data-card]')).toBeNull() // a copy is no card
      motion = false
      await summon('zones.m1')
      expect(flights()).toHaveLength(1)
    })

    it('a draw from the deck flies the new hand card from the deck pile', async () => {
      await open(DECK)
      await click('toolbar.newHand')
      animate.mockClear()
      await click('toolbar.draw')
      expect(flights()).toHaveLength(1) // the cards already in the hand stay put
      expect(flights()[0]).toMatchObject({ from: '605px, 5px', to: '255px, 305px' })
      expect(flights()[0]!.hidden).toBe(hand()[5]!.parentElement)
    })

    it('only the card of the step flies: the hand closing the gap it left does not', async () => {
      await open(DECK)
      await click('toolbar.newHand')
      animate.mockClear()
      await summon('zones.m0') // the four cards after it each shift 50 px left
      expect(flights()).toHaveLength(1)
      expect(flights()[0]!.hidden).toBe(cardsIn('m0')[0]!.parentElement)
    })

    it('a card sent to a pile lands on the pile, whose top shows once it has', async () => {
      await open(DECK)
      await click('toolbar.newHand')
      animate.mockClear()
      await discard() // from the hand at (0, 300) to the GY at the origin
      expect(flights()).toHaveLength(1)
      expect(flights()[0]).toMatchObject({ from: '5px, 305px', to: '5px, 5px' })
      expect(flights()[0]!.hidden).toBe(zone('gy').querySelector('[data-pile] > *'))
    })

    it('a card added to the hand, by the menu or a drag, says so and stands out of the fan', async () => {
      const word = () => document.querySelector('.sim-label')?.textContent
      await open(DECK)
      await click('toolbar.newHand')
      await discard()
      await rightClick(within(await openPile('gy')).getAllByRole('button')[0]!)
      await choose('menu.sendTo')
      await choose('menu.toHand')
      expect(word()).toBe('fx.toHand')
      expect(animate.mock.calls.some(([frames]) => (frames as Keyframe[])[1]?.translate === '0 -24%')).toBe(true)
      await click('pile.close')
      await play('zones.m0')
      expect(word()).toBeUndefined()
      await dragOnto(cardsIn('m0')[0]!, 'hand')
      expect(word()).toBe('fx.toHand')
    })

    it('a step back flies the card back to where it came from', async () => {
      await open(DECK)
      await click('toolbar.newHand')
      await play('zones.m0')
      animate.mockClear()
      await click('replay.prev')
      expect(flights()).toHaveLength(1)
      expect(flights()[0]).toMatchObject({ from: '205px, 5px', to: '5px, 305px' })
      expect(flights()[0]!.hidden).toBe(hand()[0]!.parentElement)
    })

    it('the next step clears the copies of the last one', async () => {
      await open(DECK)
      await click('toolbar.newHand')
      await summon('zones.m0')
      expect(document.querySelectorAll('.sim-flight')).toHaveLength(1)
      await summon('zones.m1')
      expect(document.querySelectorAll('.sim-flight')).toHaveLength(1)
    })

    it('a card dropped by drag lands where it was dropped, with no flight', async () => {
      await open(DECK)
      await click('toolbar.newHand')
      animate.mockClear()
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(zone('m0'))
      const card = hand()[0]!
      for (const [type, x] of [['pointerDown', 0], ['pointerMove', 50], ['pointerUp', 50]] as const)
        await act(async () => void fireEvent[type](card, { clientX: x, clientY: x, pointerId: 1, pointerType: 'mouse' }))
      expect(cardsIn('m0')).toHaveLength(1)
      expect(flights()).toHaveLength(0)
      expect(document.querySelectorAll('.sim-ripple').length).toBeGreaterThan(0) // it still touches down
    })

    it('a new hand is dealt out of the deck, one card after the other, turning over', async () => {
      await open(DECK)
      animate.mockClear()
      await click('toolbar.newHand')
      expect(flights()).toHaveLength(5)
      const delays = animate.mock.calls.filter((_, i) => (animate.mock.contexts[i] as HTMLElement).classList.contains('sim-flight')).map((call) => (call[1] as KeyframeAnimationOptions).delay as number)
      expect(delays).toEqual([...delays].sort((a, b) => a - b))
      expect(new Set(delays).size).toBe(5)
      expect(document.querySelectorAll('.sim-face-under')).toHaveLength(5)
      expect(flights().every(({ from }) => from === '605px, 5px')).toBe(true)
    })

    it('a destroyed card breaks where it stood instead of flying to the GY', async () => {
      await open(DECK)
      await click('toolbar.newHand')
      await play('zones.m0')
      animate.mockClear()
      await rightClick(cardsIn('m0')[0]!)
      await choose('menu.destroy')
      await choose('menu.destroyGy')
      expect(flights()).toHaveLength(6) // the pieces of the card
      expect(flights().every(({ from }) => from === '205px, 5px')).toBe(true)
    })

    it('reduced motion leaves no effect behind', async () => {
      motion = false
      await open(DECK)
      await click('toolbar.newHand')
      await play('zones.m0')
      await click('toolbar.shuffle')
      await click('toolbar.endTurn')
      expect(animate).not.toHaveBeenCalled()
      expect(document.querySelector('.sim-fx')!.childElementCount).toBe(0)
      expect(document.querySelector('.sim-ground')!.childElementCount).toBe(0)
    })
  })
})

describe('Simulator bringing a card into play', () => {
  const picks = () => [...document.querySelectorAll('.sim-pick')].map((el) => el.getAttribute('aria-label'))

  it('Special Summon asks for the zone, offers only the free ones, and logs how it came in', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await play('zones.m1')
    await rightClick(hand()[0]!)
    await choose('menu.special')
    await choose('menu.specialAtk')
    expect(picks()).toEqual(['zones.emz0', 'zones.emz1', 'zones.m0', 'zones.m2', 'zones.m3', 'zones.m4'])
    await click('zones.m2')
    expect(cardsIn('m2')).toHaveLength(1)
    expect(picks()).toEqual([])
    expect(steps().at(-1)).toBe('history.special')
  })

  it('a Normal Summon stays out of the Extra Monster Zones, and Set lands face-down in Defense', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await rightClick(hand()[0]!)
    await choose('menu.normal')
    expect(picks()).toEqual(['zones.m0', 'zones.m1', 'zones.m2', 'zones.m3', 'zones.m4'])
    await act(async () => void fireEvent.keyDown(document, { key: 'Escape' }))
    expect(picks()).toEqual([])
    await rightClick(hand()[0]!)
    await choose('menu.set')
    await click('zones.m0')
    expect(cardsIn('m0')[0]!.getAttribute('data-pos')).toBe('def')
    expect(steps().at(-1)).toBe('history.set')
  })

  it('a digit picks a menu item', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await rightClick(hand()[0]!)
    await act(async () => void fireEvent.keyDown(menu(), { key: '1' }))
    expect(picks()).toHaveLength(5)
  })

  it('while a zone is asked for, the cards take no menu', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await rightClick(hand()[0]!)
    await choose('menu.special')
    await choose('menu.specialAtk')
    await rightClick(hand()[1]!)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it.each([
    ['menu.specialAtk', 'up', 'atk'],
    ['menu.specialDef', 'up', 'def'],
    ['menu.specialDownAtk', 'down', 'atk'],
    ['menu.specialSet', 'down', 'def'],
  ])('%s comes in where it says', async (position, face, pos) => {
    await open(DECK)
    await click('toolbar.newHand')
    await rightClick(hand()[0]!)
    await choose('menu.special')
    expect(names()).toEqual(['menu.specialAtk', 'menu.specialDef', 'menu.specialDownAtk', 'menu.specialSet'])
    await choose(position)
    await click('zones.m0')
    expect(cardsIn('m0')[0]!.getAttribute('data-pos')).toBe(pos)
    await act(async () => void window.dispatchEvent(new Event('pagehide')))
    expect(JSON.parse(localStorage.getItem(DRAFT)!).actions.at(-1)).toMatchObject({ how: 'special', face, pos })
  })

  it('a card in the hand goes to the GY or is banished, face-up or face-down', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await rightClick(hand()[0]!)
    await choose('menu.sendTo')
    await choose('menu.toGy')
    expect(within(zone('gy')).getByText('1')).toBeTruthy()
    await rightClick(hand()[0]!)
    // A card with no data prints its passcode; a back prints nothing.
    const top = () => within(zone('banished')).getAllByRole('button')[0]!.textContent
    await choose('menu.sendTo')
    await choose('menu.banish')
    expect(top()).not.toBe('')
    await rightClick(hand()[0]!)
    await choose('menu.sendTo')
    await choose('menu.banishDown')
    expect(top()).toBe('')
    expect(within(zone('banished')).getByText('2')).toBeTruthy()
  })

  describe('a Spell in the hand', () => {
    const SPELLS = new Map([1, 2, 3, 4, 5, 6].map((id) => [id, { ...UTOPIA, id, kind: 'spell', humanReadableCardType: 'Normal Spell', monsterTypes: [] }]))
    beforeEach(() => void vi.mocked(cardsByIds).mockResolvedValue(SPELLS as never))
    afterEach(() => void vi.mocked(cardsByIds).mockResolvedValue(new Map()))
    const start = async () => {
      await open(DECK)
      await click('toolbar.newHand')
      await wait(0)
    }

    it('offers Activate and Set, and activating leaves it in the hand', async () => {
      await start()
      const card = hand()[0]!
      await rightClick(card)
      expect(names()).toEqual(['menu.play', 'menu.set', 'menu.sendTo', 'menu.destroy', 'menu.shuffleDeck'])
      await choose('menu.play')
      expect(names()).toEqual(['menu.activateNow', 'menu.activateTargets'])
      await choose('menu.activateNow')
      expect(picks()).toEqual([])
      expect(hand()).toHaveLength(5)
      expect(card.dataset.active).toBe('true')
      expect(steps().at(-1)).toBe('history.activate')
    })

    it('activating with targets picks them from where it lies', async () => {
      await start()
      await rightClick(hand()[0]!)
      await choose('menu.set')
      await click('zones.s1')
      const field = cardsIn('s1')[0]!
      const source = hand()[0]!
      await rightClick(source)
      await choose('menu.play')
      await choose('menu.activateTargets')
      await mouseClick(field)
      await click('targets.confirm')
      expect(hand()).toHaveLength(4)
      expect(source.dataset.active).toBe('true')
      expect(field.getAttribute('data-targeted')).not.toBeNull()
    })

    it('a Spell in a pile activates where it lies, and can still be Set', async () => {
      await start()
      await discard()
      await rightClick(within(await openPile('gy')).getAllByRole('button')[0]!)
      expect(names().slice(0, 2)).toEqual(['menu.play', 'menu.set'])
      await choose('menu.play')
      await choose('menu.activateNow')
      expect(picks()).toEqual([])
      expect(cardsIn('s0')).toHaveLength(0)
      expect(steps().at(-1)).toBe('history.activate')
      expect(within(screen.getByRole('list', { name: 'zones.gy' })).getAllByRole('button')).toHaveLength(1)
    })

    it('a double-click activates it in the hand, as Activate does', async () => {
      await start()
      await act(async () => void fireEvent.doubleClick(hand()[0]!))
      expect(picks()).toEqual([])
      expect(hand()).toHaveLength(5)
      expect(steps().at(-1)).toBe('history.activate')
    })
  })
})

describe('Simulator rail', () => {
  it('the card and the duel log take turns in one space, and the zones are gone', async () => {
    await open(DECK)
    const off = (name: string) => screen.getByRole('tabpanel', { name, hidden: true }).hasAttribute('data-off')
    expect(screen.getByRole('tab', { name: 'rail.card' }).getAttribute('aria-selected')).toBe('true')
    expect([off('rail.card'), off('rail.log')]).toEqual([false, true])
    await act(async () => void fireEvent.click(screen.getByRole('tab', { name: 'rail.log' })))
    expect([off('rail.card'), off('rail.log')]).toEqual([true, false])
    expect(screen.queryByRole('button', { name: 'rail.open' })).toBeNull()
  })
})

describe('Simulator help and first steps', () => {
  it('a deck with nothing played offers a hand on the table, and the first step takes it away', async () => {
    await open(DECK)
    await click('empty.deal')
    expect(hand()).toHaveLength(5)
    expect(screen.queryByRole('button', { name: 'empty.deal' })).toBeNull()
  })

  it('nothing on the table takes a touch until a hand is dealt', async () => {
    await open(DECK)
    const off = ['toolbar.draw', 'toolbar.shuffle', 'toolbar.endTurn', 'toolbar.save']
    const inert = () => document.querySelector('.sim-board')!.hasAttribute('inert')
    const rail = () => screen.getAllByRole<HTMLButtonElement>('button', { name: /^(life\.edit|rail\.open)$/ }).map((el) => el.disabled)
    expect(inert()).toBe(true)
    for (const name of off) expect(button(name).disabled).toBe(true)
    expect(rail().every(Boolean)).toBe(true)
    await act(async () => void fireEvent.keyDown(window, { key: 'e' }))
    expect(steps()).toEqual(['history.start'])

    await click('empty.deal')
    expect(inert()).toBe(false)
    for (const name of off) expect(button(name).disabled).toBe(false)
    expect(rail().some(Boolean)).toBe(false)
  })

  it('? opens the list of shortcuts', async () => {
    await open(DECK)
    await act(async () => void fireEvent.keyDown(window, { key: '?', shiftKey: true }))
    expect(screen.getByRole('heading', { name: 'help.title' })).toBeTruthy()
  })

  it('Choose hand can fill the rest at random', async () => {
    await open(DECK)
    await click('toolbar.chooseHand')
    await act(async () => void fireEvent.click(button('2')))
    await act(async () => void fireEvent.click(screen.getByRole('checkbox', { name: 'handPicker.fill' })))
    await click('handPicker.confirm')
    expect(hand()).toHaveLength(5)
    expect(hand()[0]!.title).toBe('2')
  })
})

describe('Simulator duel state', () => {
  /** A Life Points plate, its menu opened: the rival's comes first on the page. */
  const openLife = (index: number) => act(async () => void fireEvent.click(screen.getAllByRole('button', { name: 'life.edit' })[index]!))

  it('the Life Points change by hand, go in the log and come back with Undo', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    expect(screen.getAllByText('8000')).toHaveLength(2)
    await openLife(0)
    await click('−1000')
    expect(screen.getByText('7000')).toBeTruthy()
    expect(screen.getAllByText('8000')).toHaveLength(1)
    expect(steps().at(-1)).toBe('history.lp')
    await click('toolbar.undo')
    expect(screen.getAllByText('8000')).toHaveLength(2)
  })

  it('a typed amount is applied, and half takes what is left down by half', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await openLife(1)
    await act(async () => void fireEvent.change(screen.getByRole('textbox', { name: 'life.amount' }), { target: { value: '-1500' } }))
    await click('life.apply')
    expect(screen.getByText('6500')).toBeTruthy()
    await openLife(1)
    await click('life.half')
    expect(screen.getByText('3250')).toBeTruthy()
  })

  it('the core moves on to the next phase', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    expect(screen.getByText('phases.main1')).toBeTruthy()
    await click('phaseNext')
    expect(screen.getByText('phases.battle')).toBeTruthy()
    expect(steps().at(-1)).toBe('history.phase')
  })

  it('E ends the turn, and the new one opens in Main 1', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await click('phaseNext')
    await act(async () => void fireEvent.keyDown(window, { key: 'e' }))
    expect(steps().at(-1)).toBe('history.endTurn')
    expect(screen.getByText('phases.main1')).toBeTruthy()
  })

  it('activations in a row build the chain, and any other step closes it', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    for (const card of hand().slice(0, 2)) await act(async () => void fireEvent.doubleClick(card))
    expect(within(screen.getByRole('list', { name: 'chain.title' })).getAllByRole('listitem')).toHaveLength(2)
    expect([...document.querySelectorAll('.sim-link-card')].map((el) => el.textContent)).toEqual(['1', '2'])
    await click('toolbar.draw')
    expect(screen.queryByRole('list', { name: 'chain.title' })).toBeNull()
  })
})

describe('Simulator replay bar', () => {
  const position = () => screen.getByText(/^\d+ \/ \d+$/).textContent
  const timeline = () => screen.getByRole<HTMLInputElement>('slider', { name: 'replay.timeline' })
  const speed = (label: string) =>
    act(async () => void fireEvent.click(within(screen.getByRole('group', { name: 'replay.speed' })).getByRole('button', { name: label })))
  const empty = (key: string) => within(zone(key)).queryAllByRole('button')

  it('steps back and forward, seeks on the timeline, and Stop goes back to the last step', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await click('toolbar.draw')
    expect(position()).toBe('3 / 3')
    expect(button('replay.next').disabled).toBe(true)
    await click('replay.prev')
    expect(hand()).toHaveLength(5)
    await click('replay.next')
    expect(hand()).toHaveLength(6)
    await act(async () => void fireEvent.change(timeline(), { target: { value: '1' } }))
    expect(hand()).toHaveLength(0)
    expect(position()).toBe('1 / 3')
    await click('replay.stop')
    expect(hand()).toHaveLength(6)
    expect(position()).toBe('3 / 3')
  })

  it('a move stays on screen 1.2 s at 1x and half that at 2x', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await play('zones.m0')
    await play('zones.m1')
    await replayFrom(3) // after the first move
    vi.useFakeTimers()
    await click('replay.play')
    expect(cardsIn('m0')).toHaveLength(1)
    expect(empty('m1')).toHaveLength(0)
    await act(async () => void vi.advanceTimersByTime(1199))
    expect(empty('m1')).toHaveLength(0)
    await act(async () => void vi.advanceTimersByTime(1))
    expect(cardsIn('m1')).toHaveLength(1)
    await speed('2x')
    await click('replay.play')
    await act(async () => void vi.advanceTimersByTime(599))
    expect(empty('m1')).toHaveLength(0)
    await act(async () => void vi.advanceTimersByTime(1))
    expect(cardsIn('m1')).toHaveLength(1)
  })

  it('the card of the step on screen is marked and the card panel shows it', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    const moved = hand()[1]!
    await dragOnto(moved, 'm0')
    await click('replay.prev') // the draw of 5: the panel shows the first of its cards; cards in the hand carry no brackets
    expect(hand().some((card) => card.dataset.step)).toBe(false)
    expect(screen.getByRole('heading', { name: hand()[0]!.title })).toBeTruthy()
    await click('replay.next')
    expect(cardsIn('m0')[0]!.dataset.step).toBe('true')
    expect(hand().some((card) => card.dataset.step)).toBe(false)
    expect(screen.getByRole('heading', { name: moved.title })).toBeTruthy()
  })
})

/** The deck's Extra card (passcode 7), looked up as an Xyz monster. */
const UTOPIA = {
  id: 7, idOriginal: 7, idTcg: null, name: 'Utopia', description: '', kind: 'monster', humanReadableCardType: 'Xyz Monster',
  monsterTypes: ['xyz', 'effect'], spellTrapType: null, race: 'Warrior', attribute: 'light', level: 4, scale: null, atk: 2500, def: 2000,
  linkMarkers: [], archetypes: [], supports: [], ruleId: null, alias: null, alternateArts: [], erratas: [], released: { ocg: null, tcg: null },
  banlists: null, i18n: { pt: null, jp: null },
} as unknown as CardData

describe('Simulator board details', () => {
  const ptr = (el: HTMLElement, type: 'pointerDown' | 'pointerMove' | 'pointerUp', x: number) =>
    act(async () => void fireEvent[type](el, { clientX: x, clientY: x, pointerId: 1, pointerType: 'mouse' }))
  const dragTo = async (el: HTMLElement, to: Element) => {
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(to)
    await ptr(el, 'pointerDown', 0)
    await ptr(el, 'pointerMove', 50)
    await ptr(el, 'pointerUp', 50)
  }
  const icon = (key: string) => zone(key).querySelector('[data-icon]')?.getAttribute('data-icon') ?? null
  afterEach(() => void vi.restoreAllMocks())

  it('empty zones show their mark: a gravestone, an X, a blue and a red gem; a card covers it', async () => {
    await open(DECK)
    expect(icon('gy')).toBe('grave')
    expect(icon('banished')).toBe('xmark')
    expect(icon('s0')).toBe('gem')
    expect(icon('s4')).toBe('gem')
    expect(zone('s0').querySelector('[data-icon]')!.getAttribute('class')).toContain('text-azure')
    expect(zone('s4').querySelector('[data-icon]')!.getAttribute('class')).toContain('text-crimson')
    expect(icon('s1')).toBeNull()
    await click('toolbar.newHand')
    await play('zones.gy')
    expect(icon('gy')).toBeNull()
  })

  it('an Xyz dragged over a monster comes in on top, and the monster becomes its material', async () => {
    vi.mocked(cardsByIds).mockResolvedValue(new Map([[7, UTOPIA]]))
    await open(DECK)
    await click('toolbar.newHand')
    await play('zones.m0')
    await act(async () => void fireEvent.click(within(zone('extra')).getByRole('button')))
    const utopia = within(screen.getByRole('list', { name: 'zones.extra' })).getByRole('button', { name: 'Utopia' })
    await dragTo(utopia, zone('m0'))
    expect(cardsIn('m0')[0]!.title).toBe('Utopia')
    expect(within(zone('m0')).getByRole('button', { name: 'pile.materials' })).toBeTruthy()
  })

  it('a card activated in the GY shows on top of the GY, glowing, while its step is on screen', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    const first = hand()[0]!.title
    await play('zones.gy')
    await play('zones.gy') // another card on top of it
    await act(async () => void fireEvent.click(within(zone('gy')).getByRole('button')))
    const card = within(screen.getByRole('list', { name: 'zones.gy' })).getByRole('button', { name: first })
    await rightClick(card)
    await choose('menu.activate')
    await choose('menu.activateNow')
    const top = within(zone('gy')).getByRole('button')
    expect(top.title).toBe(first)
    expect(top.dataset.active).toBe('true')
    await click('replay.prev')
    expect(within(zone('gy')).getByRole('button').title).not.toBe(first) // the real order never changed
  })

  it('Choose hand puts the picked cards in hand and starts the replay after them', async () => {
    await open(DECK)
    await click('toolbar.chooseHand')
    await act(async () => void fireEvent.click(button('2')))
    await act(async () => void fireEvent.click(button('5')))
    expect(button('2').getAttribute('aria-pressed')).toBe('true')
    await click('handPicker.confirm')
    expect(hand().map((card) => card.title)).toEqual(['2', '5'])
    expect(within(zone('deck')).getByText('4')).toBeTruthy()
    expect(steps()).toEqual(['history.start', 'history.shuffle', 'history.move', 'history.move'])
    expect(within(rows()[3]!).getByText('history.startMark')).toBeTruthy()
  })

  it('a caption typed for a step shows in the history and under the field during the replay', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await play('zones.m0')
    const caption = () => screen.queryByRole<HTMLInputElement>('textbox', { name: 'caption.label' })
    await act(async () => void fireEvent.change(caption()!, { target: { value: 'Normal Summon' } }))
    expect(rows()[3]!.textContent).toContain('Normal Summon')
    await click('toolbar.endTurn') // a step after it, so the replay is still playing when it shows the caption
    expect(caption()!.value).toBe('')
    await click('replay.prev')
    expect(caption()!.value).toBe('Normal Summon')
    vi.useFakeTimers()
    await click('replay.play') // from the step on screen, the captioned one
    expect(caption()).toBeNull() // a replay only shows the caption
    expect(screen.getByText('Normal Summon', { selector: 'p' })).toBeTruthy()
    await act(async () => void vi.advanceTimersByTime(1200)) // the end of turn, and the end of the replay
    expect(screen.queryByText('Normal Summon', { selector: 'p' })).toBeNull()
  })
})

describe('Simulator save and share', () => {
  const DECK_ID = '0123456789abcdef'
  /** A deck with a name and a saved deck id, as the deck picker hands it over. */
  const NAMED = `${DECK}&name=Line&deck=${DECK_ID}`
  const LINK = (id: string) => `${location.origin}/simulator/c/${id}`
  const saveDialog = () => screen.queryByText('combos.dialogTitle')
  const titleField = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'combos.titleLabel' })
  const retitle = (title: string) => act(async () => void fireEvent.change(titleField(), { target: { value: title } }))
  /** The unsaved dot: Save says so in its description. */
  const unsaved = () => button('toolbar.save').title === 'toolbar.unsaved'
  /** New hand, then the first Save through the title dialog: the session is tied to `c1`, revision 1. */
  const saved = async (url = NAMED) => {
    await open(url)
    await click('toolbar.newHand')
    await click('toolbar.save')
    await click('combos.save')
  }
  const clipboard = (writeText: () => Promise<void>) => {
    const spy = vi.fn(writeText)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: spy }, configurable: true })
    return spy
  }

  it('signed out, Save asks to sign in with a link back here and saves nothing', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as ReturnType<typeof useAuth>)
    await open(DECK)
    await click('toolbar.newHand')
    await click('toolbar.save')
    expect(screen.getByText('combos.signIn')).toBeTruthy()
    const link = screen.getByRole('link', { name: 'combos.signInAction' })
    expect(link.getAttribute('href')).toBe('/login')
    expect(saveDialog()).toBeNull()
    expect(saveCombo).not.toHaveBeenCalled()
    expect(hand()).toHaveLength(5) // the line stays
    await act(async () => void fireEvent.click(link))
    expect(sessionStorage.getItem('return-to')).toBe('/simulator') // back here after signing in
  })

  it('the first Save asks the title with the deck name filled in, then a Save after a step updates it without asking', async () => {
    await open(NAMED)
    await click('toolbar.newHand')
    expect(unsaved()).toBe(true)
    await click('toolbar.save')
    expect(titleField().value).toBe('Line')
    await retitle('  Opening  ')
    await click('combos.save')
    expect(saveCombo).toHaveBeenCalledWith({ title: 'Opening', deckId: DECK_ID, payload: expect.objectContaining({ name: 'Line', start: 2 }), visibility: 'link', coverCards: expect.any(Array), tags: [] })
    expect(saveDialog()).toBeNull()
    expect(unsaved()).toBe(false)

    await click('toolbar.draw')
    expect(unsaved()).toBe(true)
    await click('toolbar.save')
    expect(saveDialog()).toBeNull()
    expect(updateCombo).toHaveBeenCalledWith('c1', { title: 'Opening', deckId: DECK_ID, payload: expect.objectContaining({ name: 'Line' }) }, 1)
    expect(vi.mocked(updateCombo).mock.calls[0]![1].payload.actions).toHaveLength(3)
    expect(saveCombo).toHaveBeenCalledTimes(1)
    expect(unsaved()).toBe(false)
  })

  it('an empty title cannot be saved', async () => {
    await open(NAMED)
    await click('toolbar.newHand')
    await click('toolbar.save')
    await retitle('   ')
    expect(button('combos.save').disabled).toBe(true)
    expect(button('combos.saveAsNew').disabled).toBe(true)
  })

  it('Save as new always posts: from the first save, and from a tied session through Save as', async () => {
    await open(NAMED)
    await click('toolbar.newHand')
    expect(await tied()).toBe(false) // nothing to save as yet
    await click('toolbar.save')
    await click('combos.saveAsNew')
    expect(saveCombo).toHaveBeenCalledTimes(1)

    vi.mocked(saveCombo).mockResolvedValue({ id: 'c2', revision: 1 })
    await click('toolbar.draw')
    await more('toolbar.saveAs')
    expect(titleField().value).toBe('Line') // the combo's title
    await retitle('Line, again')
    await click('combos.saveAsNew')
    expect(saveCombo).toHaveBeenCalledTimes(2)
    expect(saveCombo).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Line, again' }))
    expect(updateCombo).not.toHaveBeenCalled()

    await play('zones.m2') // tied to the new one now
    await click('toolbar.save')
    expect(updateCombo).toHaveBeenCalledWith('c2', expect.objectContaining({ title: 'Line, again' }), 1)
  })

  it('the cover starts as the first three cards of the deck, takes no fourth, and goes out with the tags', async () => {
    await open(NAMED)
    await click('toolbar.newHand')
    await click('toolbar.save')
    const tiles = () => within(screen.getByRole('list', { name: 'combos.coverLabel' })).getAllByRole('button')
    const tile = (n: number) => act(async () => void fireEvent.click(tiles()[n]!))
    expect(tiles().filter((el) => el.getAttribute('aria-pressed') === 'true')).toHaveLength(3)
    await tile(3) // full: the fourth waits for a free place
    await tile(0)
    await tile(3)
    await click('deckTags.rogue')
    await click('combos.save')
    expect(vi.mocked(saveCombo).mock.lastCall![0]).toMatchObject({ coverCards: [2, 3, 4], tags: ['rogue'] })
  })

  it('the dialog says who opens the combo; a later Save keeps it, and Share warns when it is private', async () => {
    await saved()
    await more('toolbar.saveAs')
    await click('combos.visibility.private')
    await click('combos.save')
    expect(updateCombo).toHaveBeenLastCalledWith('c1', expect.objectContaining({ visibility: 'private' }), 1)
    await click('toolbar.draw')
    await click('toolbar.save')
    expect(vi.mocked(updateCombo).mock.lastCall![1].visibility).toBeUndefined() // absent: the server keeps it
    await more('toolbar.share')
    expect(screen.getByText('combos.copiedPrivate')).toBeTruthy()
  })

  it('a copy saved as new is never more open than the combo it came from', async () => {
    await saved()
    await more('toolbar.saveAs')
    await click('combos.visibility.private')
    await click('combos.save')
    vi.mocked(updateCombo).mockRejectedValueOnce(new ComboConflictError(9))
    await click('toolbar.draw')
    await click('toolbar.save')
    await click('combos.saveAsNew')
    expect(vi.mocked(saveCombo).mock.lastCall![0].visibility).toBe('private')
  })

  it('Save in the Save as dialog renames the tied combo', async () => {
    await saved()
    await more('toolbar.saveAs')
    await retitle('Renamed')
    await click('combos.save')
    expect(updateCombo).toHaveBeenCalledWith('c1', expect.objectContaining({ title: 'Renamed' }), 1)
    expect(saveCombo).toHaveBeenCalledTimes(1)
  })

  it('a combo saved elsewhere since: the conflict dialog, and Reload loads the saved one', async () => {
    await saved()
    await click('toolbar.draw')
    vi.mocked(updateCombo).mockRejectedValueOnce(new ComboConflictError(2))
    // As the server sends it: jsonb reorders the keys, so its hash is not the session's.
    vi.mocked(getCombo).mockResolvedValue({
      id: 'c1',
      title: 'Line',
      deckId: DECK_ID,
      owner: { id: 'u1', name: 'Me' },
      visibility: 'link',
      coverCards: [],
      tags: [],
      archetype: null,
      revision: 2,
      updatedAt: '2026-10-19T00:00:00Z',
      payload: { start: 0, name: 'Line', actions: [{ n: 2, t: 'draw' }], deck: { side: [], extra: [7], main: [1, 2, 3, 4, 5, 6] } } as never,
    })
    await click('toolbar.save')
    expect(screen.getByText('combos.conflict.title')).toBeTruthy()
    expect(hand()).toHaveLength(6) // nothing changed yet

    await click('combos.conflict.reload')
    expect(getCombo).toHaveBeenCalledWith('c1')
    expect(screen.queryByText('combos.conflict.title')).toBeNull()
    expect(hand()).toHaveLength(2)
    expect(unsaved()).toBe(false)

    await click('toolbar.draw')
    await click('toolbar.save')
    expect(updateCombo).toHaveBeenLastCalledWith('c1', expect.anything(), 2) // the revision just loaded
  })

  it('Save as new in the conflict dialog posts the line as a new combo', async () => {
    await saved()
    await click('toolbar.draw')
    vi.mocked(updateCombo).mockRejectedValueOnce(new ComboConflictError(2))
    await click('toolbar.save')
    vi.mocked(saveCombo).mockResolvedValue({ id: 'c2', revision: 1 })
    await click('combos.saveAsNew')
    expect(saveCombo).toHaveBeenCalledTimes(2)
    expect(saveCombo).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Line' }))
    expect(screen.queryByText('combos.conflict.title')).toBeNull()
    expect(unsaved()).toBe(false)
    expect(hand()).toHaveLength(6) // the line is the one just saved
  })

  it('a rename that meets a conflict keeps its title: Save as new posts it', async () => {
    await saved()
    await more('toolbar.saveAs')
    await retitle('Renamed')
    vi.mocked(updateCombo).mockRejectedValueOnce(new ComboConflictError(2))
    await click('combos.save')
    expect(screen.getByText('combos.conflict.title')).toBeTruthy()
    vi.mocked(saveCombo).mockResolvedValue({ id: 'c2', revision: 1 })
    await click('combos.saveAsNew')
    expect(saveCombo).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Renamed' }))
  })

  it('a combo deleted elsewhere: the update answers 404, and the title dialog posts a new one', async () => {
    await saved()
    await click('toolbar.draw')
    vi.mocked(updateCombo).mockRejectedValueOnce(new ComboApiError(404, 'NOT_FOUND'))
    await click('toolbar.save')
    expect(saveDialog()).toBeTruthy()
    vi.mocked(saveCombo).mockResolvedValue({ id: 'c2', revision: 1 })
    await click('combos.save')
    expect(saveCombo).toHaveBeenCalledTimes(2)
    expect(updateCombo).toHaveBeenCalledTimes(1)
    expect(unsaved()).toBe(false)
    await play('zones.m2')
    await click('toolbar.save')
    expect(updateCombo).toHaveBeenLastCalledWith('c2', expect.anything(), 1)
  })

  it('Save on a tied line that has not changed sends nothing; after a step it updates', async () => {
    await saved()
    await click('toolbar.save')
    expect(updateCombo).not.toHaveBeenCalled()
    expect(saveDialog()).toBeNull()
    await click('toolbar.draw')
    await click('toolbar.save')
    expect(updateCombo).toHaveBeenCalledTimes(1)
  })

  it('Share on a tied line that has not changed copies its link in the click and sends nothing', async () => {
    const writeText = clipboard(async () => {})
    await saved()
    await click('toolbar.more')
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'toolbar.share' }))
      expect(writeText).toHaveBeenCalledWith(LINK('c1')) // before anything is awaited: still inside the user's gesture
    })
    expect(screen.getByText('combos.copied')).toBeTruthy()
    expect(updateCombo).not.toHaveBeenCalled()
  })

  it('Share on a tied line that has not changed shows the link when the clipboard refuses', async () => {
    clipboard(async () => {
      throw new Error('denied')
    })
    await saved()
    await more('toolbar.share')
    expect(screen.getByDisplayValue<HTMLInputElement>(LINK('c1')).readOnly).toBe(true)
    expect(updateCombo).not.toHaveBeenCalled()
  })

  it('a saved line survives a reload with no unsaved dot, and still tied', async () => {
    // A draft keeps only a tie with a real id, as the server's.
    vi.mocked(saveCombo).mockResolvedValue({ id: 'fedcba9876543210', revision: 1 })
    vi.mocked(updateCombo).mockResolvedValue({ id: 'fedcba9876543210', revision: 2 })
    await saved()
    await play('zones.m2')
    await click('toolbar.save')
    expect(updateCombo).toHaveBeenCalledTimes(1)
    expect(unsaved()).toBe(false)

    cleanup() // the draft is written as the simulator unmounts
    await open('/simulator')
    expect(cardsIn('m2')).toHaveLength(1)
    expect(await tied()).toBe(true)
    expect(unsaved()).toBe(false)
  })

  it('Share saves an unsaved session first, then copies its link; a saved one is copied at once', async () => {
    const writeText = clipboard(async () => {})
    await open(NAMED)
    await click('toolbar.newHand')
    await more('toolbar.share')
    expect(writeText).not.toHaveBeenCalled() // the title first
    await click('combos.save')
    expect(saveCombo).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith(LINK('c1'))
    expect(screen.getByText('combos.copied')).toBeTruthy()

    await more('toolbar.share')
    expect(writeText).toHaveBeenCalledTimes(2)
    expect(updateCombo).not.toHaveBeenCalled()

    await click('toolbar.draw')
    await more('toolbar.share')
    expect(updateCombo).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledTimes(3)
  })

  it('Record video saves an unsaved line first, then opens the video dialog; a step since drops the ask', async () => {
    await open(NAMED)
    await click('toolbar.newHand')
    await more('video.open')
    expect(screen.queryByRole('heading', { name: 'video.title' })).toBeNull() // the title first
    await click('combos.save')
    expect(saveCombo).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('heading', { name: 'video.title' })).toBeTruthy()
    await click('Close')
    expect(screen.queryByRole('heading', { name: 'video.title' })).toBeNull()

    await more('video.open') // tied and unchanged: at once, nothing sent
    expect(screen.getByRole('heading', { name: 'video.title' })).toBeTruthy()
    expect(updateCombo).not.toHaveBeenCalled()
    await click('Close')

    // changed since: the tied combo is updated first (no dialog for that), then the video dialog opens
    await click('toolbar.draw')
    await more('video.open')
    expect(updateCombo).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('heading', { name: 'video.title' })).toBeTruthy()
    await click('Close')
    // a new board drops the ask: a later Save opens nothing by itself
    await click('toolbar.newHand')
    await click('confirm.discard')
    await click('toolbar.save')
    expect(screen.queryByRole('heading', { name: 'video.title' })).toBeNull()
  })

  it('a plain Save copies nothing, and closing the title dialog drops the share', async () => {
    const writeText = clipboard(async () => {})
    await open(NAMED)
    await click('toolbar.newHand')
    await more('toolbar.share')
    await click('Close')
    await click('toolbar.save')
    await click('combos.save')
    expect(saveCombo).toHaveBeenCalledTimes(1)
    expect(writeText).not.toHaveBeenCalled()
  })

  it('a clipboard that refuses shows the link in a read-only field', async () => {
    clipboard(async () => {
      throw new Error('denied')
    })
    await open(NAMED)
    await click('toolbar.newHand')
    await more('toolbar.share')
    await click('combos.save')
    expect(screen.getByText('combos.copyFailed')).toBeTruthy()
    expect(screen.getByDisplayValue<HTMLInputElement>(LINK('c1')).readOnly).toBe(true)
  })

  it('the combo limit and a refused combo each say so, and nothing is tied', async () => {
    await open(NAMED)
    await click('toolbar.newHand')
    vi.mocked(saveCombo).mockRejectedValueOnce(new ComboApiError(409, 'LIMIT'))
    await click('toolbar.save')
    await click('combos.save')
    expect(screen.getByText('combos.limit')).toBeTruthy()
    expect(saveDialog()).toBeNull()

    vi.mocked(saveCombo).mockRejectedValueOnce(new ComboApiError(400, 'BAD_REQUEST'))
    await click('toolbar.save') // still a first save: the title again
    await click('combos.save')
    expect(screen.getByText('combos.saveFailed')).toBeTruthy()
    expect(screen.queryByText('combos.limit')).toBeNull()
    expect(unsaved()).toBe(true)
  })

  it('a network failure shows Retry and changes nothing; Retry saves the line as it is then', async () => {
    await open(NAMED)
    await click('toolbar.newHand')
    vi.mocked(saveCombo).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await click('toolbar.save')
    await click('combos.save')
    expect(screen.getByText('combos.failed')).toBeTruthy()
    expect(unsaved()).toBe(true)
    expect(hand()).toHaveLength(5)
    await click('toolbar.draw')
    await act(async () => void fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'retry' })))
    expect(saveCombo).toHaveBeenCalledTimes(2)
    expect(saveCombo).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Line' }))
    expect(vi.mocked(saveCombo).mock.lastCall![0].payload.actions).toHaveLength(3) // the draw played after the failure
    expect(screen.queryByText('combos.failed')).toBeNull()
    expect(unsaved()).toBe(false)
  })

  it('a failed save is retried only on its own session: a new deck or a new hand takes the Retry away', async () => {
    await saved()
    await click('toolbar.draw')
    vi.mocked(updateCombo).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await click('toolbar.save')
    expect(screen.getByText('combos.failed')).toBeTruthy()
    await pickDeck(toYdke({ main: [11, 12, 13, 14, 15, 16, 17], extra: [], side: [] }))
    await click('confirm.discard')
    expect(screen.queryByText('combos.failed')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull() // no Retry left

    await click('toolbar.newHand')
    vi.mocked(saveCombo).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await click('toolbar.save')
    await retitle('Second') // a pasted deck has no name to start from
    await click('combos.save')
    expect(screen.getByText('combos.failed')).toBeTruthy()
    await click('toolbar.newHand')
    expect(screen.queryByRole('alert')).toBeNull()
    // the first save, the failed update, the failed first save: nothing since
    expect(saveCombo).toHaveBeenCalledTimes(2)
    expect(updateCombo).toHaveBeenCalledTimes(1)
  })

  it('Retry is off while a replay plays', async () => {
    await saved()
    await click('toolbar.draw')
    vi.mocked(updateCombo).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await click('toolbar.save')
    const retry = () => within(screen.getByRole('alert')).getByRole<HTMLButtonElement>('button', { name: 'retry' })
    expect(retry().disabled).toBe(false)
    vi.useFakeTimers()
    await click('replay.play')
    expect(retry().disabled).toBe(true)
  })

  it('a Retry of the reload takes its alert away while it runs, so it cannot run twice', async () => {
    await saved()
    await click('toolbar.draw')
    vi.mocked(updateCombo).mockRejectedValueOnce(new ComboConflictError(2))
    vi.mocked(getCombo).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await click('toolbar.save')
    await click('combos.conflict.reload')
    expect(screen.getByText('combos.failed')).toBeTruthy()
    vi.mocked(getCombo).mockReturnValue(new Promise(() => {})) // still on its way
    await act(async () => void fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'retry' })))
    expect(getCombo).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('Save, Save as and Share are off while a replay plays', async () => {
    await saved()
    await click('toolbar.draw')
    vi.useFakeTimers()
    await click('replay.play')
    expect(button('toolbar.save').disabled).toBe(true)
    expect(button('toolbar.more').disabled).toBe(true) // Save as and Share with it
  })
})

describe('Simulator my combos', () => {
  const DECK_ID = '0123456789abcdef'
  const NAMED = `${DECK}&name=Line&deck=${DECK_ID}`
  const summary = (id: string, title: string): ComboSummary => ({ id, title, deckName: 'Line', steps: 3, visibility: 'link', coverCards: [], tags: [], archetype: null, updatedAt: '2026-10-19T00:00:00Z' })
  /** As the server sends it: jsonb reorders the keys, so the hash of this payload is not the session's. */
  const stored = (id: string): SharedCombo => ({
    id,
    title: `Combo ${id}`,
    deckId: DECK_ID,
    owner: { id: 'u1', name: 'Me' },
    visibility: 'link',
    coverCards: [],
    tags: [],
    archetype: null,
    revision: 3,
    updatedAt: '2026-10-19T00:00:00Z',
    payload: { start: 1, name: 'Line', actions: [{ n: 3, t: 'draw' }, { n: 1, t: 'draw' }], deck: { side: [], extra: [7], main: [1, 2, 3, 4, 5, 6] } } as never,
  })
  /** The next first page: one combo per title, `c1`, `c2`… */
  const listing = (...titles: string[]) =>
    vi.mocked(listMyCombos).mockResolvedValueOnce({ combos: titles.map((title, i) => summary(`c${i + 1}`, title)), nextCursor: null })
  const showList = async () => {
    await more('toolbar.myCombos')
    await wait(10)
  }
  const list = () => within(screen.getByRole('list', { name: 'myCombos.title' }))
  const listShown = () => screen.queryByRole('list', { name: 'myCombos.title' }) !== null
  const rowButton = (row: number, name: string) => within(list().getAllByRole('listitem')[row]!).getByRole('button', { name })
  const openRow = (row: number) => act(async () => void fireEvent.click(rowButton(row, 'myCombos.openNamed')))
  /** Delete on the row, then Delete in the confirm. */
  const removeRow = async (row: number) => {
    await act(async () => void fireEvent.click(rowButton(row, 'myCombos.deleteNamed')))
    await click('myCombos.delete')
  }
  const unsaved = () => button('toolbar.save').title === 'toolbar.unsaved'

  beforeEach(() => {
    // `clearAllMocks` keeps implementations: a promise left hanging by one test must not reach the next.
    vi.mocked(getCombo).mockReset()
    vi.mocked(listMyCombos).mockReset()
    vi.mocked(deleteCombo).mockReset()
  })

  it('lists title, deck, steps and date, and Load more asks for the next page', async () => {
    vi.mocked(listMyCombos)
      .mockResolvedValueOnce({ combos: [summary('c1', 'Opening'), summary('c2', 'Backrow')], nextCursor: 'n1' })
      .mockResolvedValueOnce({ combos: [summary('c3', 'Floodgate')], nextCursor: null })
    await open(DECK)
    await showList()
    const items = list().getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]!.textContent).toContain('Opening')
    expect(items[0]!.textContent).toContain('Line · myCombos.steps · now')
    expect(items[1]!.textContent).toContain('Backrow')
    await click('myCombos.more')
    expect(listMyCombos).toHaveBeenLastCalledWith('n1')
    expect(list().getAllByRole('listitem')).toHaveLength(3)
    expect(screen.queryByText('myCombos.more')).toBeNull() // the last page
  })

  it('Open loads the combo: hand and history match, nothing is unsaved, and Save updates it', async () => {
    listing('Opening')
    vi.mocked(getCombo).mockResolvedValue(stored('c1'))
    await open(DECK)
    await showList()
    await openRow(0)
    expect(getCombo).toHaveBeenCalledWith('c1')
    expect(listShown()).toBe(false)
    expect(hand()).toHaveLength(4)
    expect(steps()).toEqual(['history.start', 'history.draw', 'history.draw'])
    expect(unsaved()).toBe(false) // the hash is of the session as parsed, not of the payload as the server ordered it

    await click('toolbar.draw')
    expect(unsaved()).toBe(true)
    await click('toolbar.save')
    expect(screen.queryByText('combos.dialogTitle')).toBeNull()
    expect(updateCombo).toHaveBeenCalledWith('c1', { title: 'Combo c1', deckId: DECK_ID, payload: expect.objectContaining({ name: 'Line', start: 1 }) }, 3)
    expect(vi.mocked(updateCombo).mock.calls[0]![1].payload.actions).toHaveLength(3)
    expect(saveCombo).not.toHaveBeenCalled()
  })

  it('Open while the session has actions asks to discard it first', async () => {
    listing('Opening')
    vi.mocked(getCombo).mockResolvedValue(stored('c1'))
    await open(DECK)
    await click('toolbar.newHand')
    await showList()
    await openRow(0)
    expect(screen.getByText('confirm.title')).toBeTruthy()
    expect(hand()).toHaveLength(5)
    await click('confirm.cancel')
    expect(hand()).toHaveLength(5)
    expect(listShown()).toBe(true) // Keep playing leaves the list as it was

    await openRow(0)
    await click('confirm.discard')
    expect(hand()).toHaveLength(4)
    expect(listShown()).toBe(false)
  })

  it('opening a combo takes the alert of a failed save, and its Retry, away', async () => {
    vi.mocked(saveCombo).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    listing('Opening')
    vi.mocked(getCombo).mockResolvedValue(stored('c1'))
    await open(NAMED)
    await click('toolbar.newHand')
    await click('toolbar.save')
    await click('combos.save')
    expect(screen.getByText('combos.failed')).toBeTruthy()
    await showList()
    await openRow(0)
    await click('confirm.discard')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('deleting the tied combo lets go of it: Save asks for a title and posts a new one', async () => {
    listing('Opening', 'Backrow')
    vi.mocked(deleteCombo).mockResolvedValue(undefined)
    await open(NAMED)
    await click('toolbar.newHand')
    await click('toolbar.save')
    await click('combos.save') // tied to c1, revision 1
    await showList()

    await removeRow(1) // c2 is not the tied one
    expect(deleteCombo).toHaveBeenLastCalledWith('c2')
    expect(list().getAllByRole('listitem')).toHaveLength(1)
    expect(await tied()).toBe(true)

    await removeRow(0)
    expect(deleteCombo).toHaveBeenLastCalledWith('c1')
    expect(list().queryAllByRole('listitem')).toHaveLength(0)
    expect(await tied()).toBe(false)
    expect(unsaved()).toBe(true)
    await click('Close')

    await click('toolbar.save')
    expect(screen.getByText('combos.dialogTitle')).toBeTruthy()
    await click('combos.save')
    expect(saveCombo).toHaveBeenCalledTimes(2)
    expect(updateCombo).not.toHaveBeenCalled()
  })

  it('a combo already deleted elsewhere (404) counts as deleted: the row goes and the tie with it', async () => {
    listing('Opening')
    vi.mocked(deleteCombo).mockRejectedValue(new ComboApiError(404, 'NOT_FOUND'))
    await open(NAMED)
    await click('toolbar.newHand')
    await click('toolbar.save')
    await click('combos.save') // tied to c1
    await showList()
    await removeRow(0)
    expect(screen.queryByText('myCombos.deleteFailed')).toBeNull()
    expect(list().queryAllByRole('listitem')).toHaveLength(0)
    expect(await tied()).toBe(false) // untied
    expect(unsaved()).toBe(true)
  })

  it('a delete that lands after another combo was opened leaves that tie alone, so Save updates the one opened', async () => {
    listing('Opening', 'Backrow')
    let landed: () => void = () => {}
    vi.mocked(deleteCombo).mockReturnValue(new Promise<void>((resolve) => void (landed = resolve)))
    vi.mocked(getCombo).mockResolvedValue(stored('c2'))
    await open(NAMED)
    await click('toolbar.newHand')
    await click('toolbar.save')
    await click('combos.save') // tied to c1
    await showList()
    await act(async () => void fireEvent.click(rowButton(0, 'myCombos.deleteNamed')))
    await click('myCombos.delete') // the DELETE of c1 is on its way
    await click('Close') // the list goes, the delete does not

    vi.mocked(listMyCombos).mockResolvedValueOnce({ combos: [summary('c2', 'Backrow')], nextCursor: null })
    await showList()
    await openRow(0)
    await click('confirm.discard')
    expect(hand()).toHaveLength(4)
    await act(async () => landed()) // c1 is gone, and the session is tied to c2

    await click('toolbar.draw')
    await click('toolbar.save')
    expect(screen.queryByText('combos.dialogTitle')).toBeNull()
    expect(updateCombo).toHaveBeenCalledWith('c2', expect.objectContaining({ title: 'Combo c2' }), 3)
    expect(saveCombo).toHaveBeenCalledTimes(1)
  })

  it('Open does nothing while a delete is on its way', async () => {
    listing('Opening', 'Backrow')
    let landed: () => void = () => {}
    vi.mocked(deleteCombo).mockReturnValue(new Promise<void>((resolve) => void (landed = resolve)))
    vi.mocked(getCombo).mockResolvedValue(stored('c2'))
    await open(DECK)
    await showList()
    await act(async () => void fireEvent.click(rowButton(0, 'myCombos.deleteNamed')))
    await click('myCombos.delete')
    await openRow(1)
    expect(getCombo).not.toHaveBeenCalled()
    await act(async () => landed())
    expect(list().getAllByRole('listitem')).toHaveLength(1)
    await openRow(0) // the delete is over: Open works again
    expect(getCombo).toHaveBeenCalledWith('c2')
    expect(hand()).toHaveLength(4)
  })

  it('Delete does nothing while an open is on its way', async () => {
    listing('Opening')
    vi.mocked(getCombo).mockReturnValue(new Promise(() => {}))
    await open(DECK)
    await showList()
    await openRow(0)
    await act(async () => void fireEvent.click(rowButton(0, 'myCombos.deleteNamed')))
    expect(screen.queryByText('myCombos.deleteBody')).toBeNull() // no confirm to answer
    expect(deleteCombo).not.toHaveBeenCalled()
  })

  it('Delete asks first: Cancel leaves the combo alone', async () => {
    listing('Opening')
    await open(DECK)
    await showList()
    await act(async () => void fireEvent.click(rowButton(0, 'myCombos.deleteNamed')))
    expect(screen.getByText('myCombos.deleteBody')).toBeTruthy()
    expect(deleteCombo).not.toHaveBeenCalled()
    await click('myCombos.cancel')
    expect(deleteCombo).not.toHaveBeenCalled()
    expect(rowButton(0, 'myCombos.deleteNamed')).toBeTruthy()
  })

  it('a combo that cannot be deleted stays in the list and says so', async () => {
    listing('Opening')
    vi.mocked(deleteCombo).mockRejectedValue(new TypeError('Failed to fetch'))
    await open(DECK)
    await showList()
    await removeRow(0)
    expect(screen.getByText('myCombos.deleteFailed')).toBeTruthy()
    expect(list().getAllByRole('listitem')).toHaveLength(1)
  })

  it('a damaged combo says so and loads nothing', async () => {
    listing('Opening')
    vi.mocked(getCombo).mockResolvedValue({ ...stored('c1'), payload: { ...stored('c1').payload, actions: [{ t: 'move', card: 99, to: 'hand' }] } })
    await open(DECK)
    await click('toolbar.newHand')
    await showList()
    await openRow(0)
    expect(screen.getByText('combos.damaged')).toBeTruthy()
    expect(screen.queryByText('confirm.title')).toBeNull() // nothing to discard for: nothing is loaded
    expect(hand()).toHaveLength(5)
  })

  it('a combo that is gone or cannot be reached says so in the list, and the session stays', async () => {
    listing('Opening', 'Backrow')
    await open(DECK)
    await showList()
    vi.mocked(getCombo).mockResolvedValueOnce(null)
    await openRow(0)
    expect(screen.getByText('myCombos.gone')).toBeTruthy()
    expect(list().getAllByRole('listitem')).toHaveLength(1) // c1 left the list

    vi.mocked(getCombo).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await openRow(0)
    expect(screen.getByText('myCombos.openFailed')).toBeTruthy()
    expect(screen.queryByText('myCombos.gone')).toBeNull()
    expect(listShown()).toBe(true)
    expect(hand()).toHaveLength(0)
  })

  it('a list that fails to load shows Retry', async () => {
    vi.mocked(listMyCombos).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    listing('Opening')
    await open(DECK)
    await showList()
    expect(screen.getByText('myCombos.failed')).toBeTruthy()
    await click('retry')
    await wait(10)
    expect(list().getAllByRole('listitem')).toHaveLength(1)
    expect(screen.queryByText('myCombos.failed')).toBeNull()
  })

  it('closing the list while a combo loads cancels the open', async () => {
    listing('Opening')
    let arrive: (combo: SharedCombo) => void = () => {}
    vi.mocked(getCombo).mockReturnValue(new Promise((resolve) => void (arrive = resolve)))
    await open(DECK)
    await showList()
    await openRow(0)
    await click('Close')
    await act(async () => arrive(stored('c1')))
    expect(hand()).toHaveLength(0)
    expect(steps()).toEqual(['history.start'])
  })

  it('signed out, My combos asks to sign in and lists nothing', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as ReturnType<typeof useAuth>)
    await open(DECK)
    await more('toolbar.myCombos')
    expect(screen.getByText('combos.signIn')).toBeTruthy()
    expect(listShown()).toBe(false)
    expect(listMyCombos).not.toHaveBeenCalled()
  })

  it('My combos is off while a replay plays', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await click('toolbar.draw')
    vi.useFakeTimers()
    await click('replay.play')
    expect(button('toolbar.more').disabled).toBe(true) // My combos is under it
  })
})
