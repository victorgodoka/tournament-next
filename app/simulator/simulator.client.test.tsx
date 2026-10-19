// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@hooks/index'
import { cardsByIds } from '@utils/cards'
import { ComboApiError, ComboConflictError, getCombo, saveCombo, updateCombo } from '@utils/combos'
import { toYdke } from '@utils/deck/codecs/ydke'
import type { CardData } from '@utils/deck/types'
import { listMyDecks } from '@utils/decks'
import { DRAFT_KEY } from '@utils/simulator/draft'
import Simulator from './simulator.client'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
  useFormatter: () => ({ relativeTime: () => 'now' }),
  useNow: () => new Date(),
}))
vi.mock('@hooks/index', () => ({ useAuth: vi.fn() }))
vi.mock('@utils/cards', () => ({ cardsByIds: vi.fn(async () => new Map()) }))
// Iconify fetches its icons from the network: here each one is a span that names its icon.
vi.mock('@iconify/react', () => ({ Icon: ({ icon, className }: { icon: string; className?: string }) => <span data-icon={icon} className={className} /> }))
vi.mock('@utils/decks', async (original) => ({ ...(await original<typeof import('@utils/decks')>()), listMyDecks: vi.fn() }))
// The errors and `comboUrl` stay real: the client tells them apart and builds the link with them.
vi.mock('@utils/combos', async (original) => ({
  ...(await original<typeof import('@utils/combos')>()),
  saveCombo: vi.fn(),
  updateCombo: vi.fn(),
  getCombo: vi.fn(),
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
const hand = () => within(zone('hand')).queryAllByRole('button')
const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name })
const click = (name: string) => act(async () => fireEvent.click(button(name)))

const menu = () => screen.getByRole('menu')
const names = () => within(menu()).getAllByRole('menuitem').map((el) => el.textContent)
const choose = (name: string) => act(async () => fireEvent.click(within(menu()).getByRole('menuitem', { name })))
const rightClick = (el: HTMLElement) => act(async () => void fireEvent.contextMenu(el))
/** A mouse click on the element: `detail` 1, as a browser sends it (the default is a keyboard click, 0). */
const mouseClick = (el: HTMLElement) => act(async () => void fireEvent.click(el, { detail: 1 }))
const cardsIn = (key: string) => within(zone(key)).getAllByRole('button')
/** The counter badges in a zone. A card prints its own passcode (a number too) inside its button, so those are left out. */
const counters = (key: string) =>
  within(zone(key))
    .queryAllByText(/^\d+$/)
    .filter((el) => !el.closest('button'))
    .map((el) => el.textContent)

/** New hand, then the first card of the hand through Move to… into `to`. */
const play = async (to: string) => {
  await rightClick(hand()[0]!)
  await choose('menu.moveTo')
  await choose(to)
}

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
    const cursor = () => JSON.parse(localStorage.getItem(DRAFT_KEY)!).cursor
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
    localStorage.setItem(DRAFT_KEY, saved)
    await open('/simulator?d=garbage!!')
    expect(screen.getByText('damagedLink')).toBeTruthy()
    await wait(350)
    cleanup()
    expect(localStorage.getItem(DRAFT_KEY)).toBe(saved)
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
    expect(names()).toEqual(['menu.activate', 'menu.activateTargets', 'menu.moveTo', 'menu.details'])
    await choose('menu.moveTo')
    await choose('zones.m0')
    await rightClick(cardsIn('m0')[0]!)
    // no counters yet: no counterDown
    expect(names()).toEqual(['menu.activate', 'menu.activateTargets', 'menu.flip', 'menu.position', 'menu.negate', 'menu.counterUp', 'menu.moveTo', 'menu.details'])
    await choose('menu.counterUp')
    await rightClick(cardsIn('m0')[0]!)
    expect(names()).toContain('menu.counterDown')
  })

  it('a spell or trap slot card gets flip but no ATK/DEF position', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await play('zones.s0')
    await rightClick(cardsIn('s0')[0]!)
    expect(names()).toEqual(['menu.activate', 'menu.activateTargets', 'menu.flip', 'menu.negate', 'menu.counterUp', 'menu.moveTo', 'menu.details'])
  })

  it('focus goes to the pile button when the keyboard moved the card into a pile', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    // Pile cards have no [data-card] on the board, so the card itself is not there to take the focus back.
    for (const [item, pile] of [['zones.gy', 'gy'], ['zones.banished', 'banished'], ['zones.deck — move.top', 'deck'], ['zones.extra', 'extra']] as const) {
      const card = hand()[0]!
      card.focus()
      await act(async () => void fireEvent.click(card)) // detail 0: Enter on the focused card
      await choose('menu.moveTo')
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
    await choose('menu.flip')
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
    await choose('menu.counterUp')
    await rightClick(cardsIn('m2')[0]!)
    await choose('menu.counterUp')
    expect(counters('m2')).toEqual(['2'])
    await rightClick(cardsIn('m2')[0]!)
    await choose('menu.counterDown')
    expect(counters('m2')).toEqual(['1'])
  })

  it('Move to leaves out the card’s own pile but keeps the deck top and bottom', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await rightClick(hand()[0]!)
    await choose('menu.moveTo')
    const moves = names()
    expect(moves[0]).toBe('menu.back')
    expect(moves).not.toContain('zones.hand')
    expect(moves).toEqual(expect.arrayContaining(['zones.deck — move.top', 'zones.deck — move.bottom', 'zones.gy', 'zones.m0', 'zones.m0 — move.set', 'zones.s0 — move.set']))
    await choose('menu.back')
    expect(names()).toContain('menu.moveTo')
  })

  it('Details shows the card in the card panel', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    expect(screen.getByText('cardPanel.empty')).toBeTruthy()
    const card = hand()[1]!
    await rightClick(card)
    await choose('menu.details')
    expect(screen.queryByText('cardPanel.empty')).toBeNull()
    expect(screen.getByRole('heading', { name: card.title })).toBeTruthy()
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
    await click('toolbar.reset')
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
    await choose('menu.moveTo')
    await choose('zones.hand')
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
    const card = within(await openPile('deck')).getAllByRole('button')[0]!
    await mouseClick(card)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('heading', { name: card.title })).toBeTruthy()
    await act(async () => void fireEvent.pointerDown(card, { pointerType: 'touch' }))
    await mouseClick(card)
    expect(names()).toContain('menu.moveTo')
  })

  it('the x N badge opens the materials, and the menu works on each of them', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await play('zones.m0')
    await play('zones.m0') // an occupied monster zone: the second card goes under as a material
    const materials = within(await openMaterials('m0')).getAllByRole('button')
    expect(materials).toHaveLength(1)
    await rightClick(materials[0]!)
    // a material is not a field card: no flip, position, negate or counters
    expect(names()).toEqual(['menu.activate', 'menu.activateTargets', 'menu.moveTo', 'menu.details'])
    await choose('menu.moveTo')
    await choose('zones.gy')
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
    await choose('menu.moveTo')
    await choose('zones.gy') // the last material leaves: the slot is a lone monster again
    expect(screen.queryByRole('list', { name: 'pile.materials' })).toBeNull()
    expect(screen.queryByText('pile.empty')).toBeNull()
    await play('zones.m0') // a new material in the same slot does not bring the closed panel back
    expect(within(zone('m0')).getByRole('button', { name: 'pile.materials' })).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'pile.materials' })).toBeNull()
  })
})

/** New hand, the first card to m0, then the next card of the hand in target mode: the activating card and the one on the field. */
const targetMode = async () => {
  await click('toolbar.newHand')
  await play('zones.m0')
  const source = hand()[0]!
  await rightClick(source)
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
      await play('zones.gy') // the first card of the hand goes to the graveyard
      const source = hand()[0]!
      await rightClick(source)
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
    expect(names()).toContain('menu.moveTo')
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
    await click('toolbar.reset') // the confirm dialog
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

  describe('FLIP', () => {
    let motion = true
    let animate = vi.fn()
    beforeEach(() => {
      motion = true
      vi.stubGlobal('matchMedia', () => ({ matches: motion }))
      animate = vi.fn()
      Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true })
      // The hand sits at y 300, each of its cards 50 px right of the one before; m0 at x 200, the deck at x 600;
      // everything else at the origin.
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
    const slide = (dx: number, dy: number) => [
      [
        { translate: `${dx}px ${dy}px`, scale: '1.08', zIndex: '20' },
        { translate: '0 0', scale: '1', zIndex: '20' },
      ],
      { duration: 450, easing: 'ease-out' },
    ]

    it('a move slides the card from where it was, unless motion is reduced', async () => {
      await open(DECK)
      await click('toolbar.newHand')
      animate.mockClear()
      await play('zones.m0')
      expect(animate).toHaveBeenCalledTimes(1)
      expect(animate.mock.contexts[0]).toBe(cardsIn('m0')[0]!.parentElement) // the wrapper DEF turns, not the button inside it
      expect(animate.mock.calls[0]).toEqual(slide(-200, 300))
      motion = false
      await play('zones.m1')
      expect(animate).toHaveBeenCalledTimes(1)
    })

    it('a draw from the deck slides the new hand card from the deck pile', async () => {
      await open(DECK)
      await click('toolbar.newHand')
      animate.mockClear()
      await click('toolbar.draw')
      expect(animate).toHaveBeenCalledTimes(1) // the cards already in the hand stay put
      expect(animate.mock.contexts[0]).toBe(hand()[5]!.parentElement)
      expect(animate.mock.calls[0]).toEqual(slide(350, -300))
    })

    it('only the card of the step slides: the hand closing the gap it left does not', async () => {
      await open(DECK)
      await click('toolbar.newHand')
      animate.mockClear()
      await play('zones.m0') // the four cards after it each shift 50 px left
      expect(animate).toHaveBeenCalledTimes(1)
      expect(animate.mock.contexts[0]).toBe(cardsIn('m0')[0]!.parentElement)
    })

    it('a card sent to a pile slides in as the pile’s top card', async () => {
      await open(DECK)
      await click('toolbar.newHand')
      animate.mockClear()
      await play('zones.gy') // from the hand at (0, 300) to the GY at the origin
      expect(animate).toHaveBeenCalledTimes(1)
      expect(animate.mock.contexts[0]).toBe(zone('gy').firstElementChild)
      expect(animate.mock.calls[0]).toEqual(slide(0, 300))
    })

    it('a step back slides the card back to where it came from', async () => {
      await open(DECK)
      await click('toolbar.newHand')
      await play('zones.m0')
      animate.mockClear()
      await click('replay.prev')
      expect(animate).toHaveBeenCalledTimes(1)
      expect(animate.mock.contexts[0]).toBe(hand()[0]!.parentElement)
      expect(animate.mock.calls[0]).toEqual(slide(200, -300))
    })

    it('a card dropped by drag lands where it was dropped, with no slide', async () => {
      await open(DECK)
      await click('toolbar.newHand')
      animate.mockClear()
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(zone('m0'))
      const card = hand()[0]!
      for (const [type, x] of [['pointerDown', 0], ['pointerMove', 50], ['pointerUp', 50]] as const)
        await act(async () => void fireEvent[type](card, { clientX: x, clientY: x, pointerId: 1, pointerType: 'mouse' }))
      expect(cardsIn('m0')).toHaveLength(1)
      expect(animate).not.toHaveBeenCalled()
    })
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
    await rightClick(moved)
    await choose('menu.moveTo')
    await choose('zones.m0')
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
    expect(icon('gy')).toBe('mdi:grave-stone')
    expect(icon('banished')).toBe('foundation:x')
    expect(icon('s0')).toBe('mage:gem-b-fill')
    expect(icon('s4')).toBe('mage:gem-b-fill')
    expect(zone('s0').querySelector('[data-icon]')!.className).toContain('text-azure')
    expect(zone('s4').querySelector('[data-icon]')!.className).toContain('text-crimson')
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
    expect(saveCombo).toHaveBeenCalledWith({ title: 'Opening', deckId: DECK_ID, payload: expect.objectContaining({ name: 'Line', start: 2 }) })
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
    expect(screen.queryByRole('button', { name: 'toolbar.saveAs' })).toBeNull() // nothing to save as yet
    await click('toolbar.save')
    await click('combos.saveAsNew')
    expect(saveCombo).toHaveBeenCalledTimes(1)

    vi.mocked(saveCombo).mockResolvedValue({ id: 'c2', revision: 1 })
    await click('toolbar.draw')
    await click('toolbar.saveAs')
    expect(titleField().value).toBe('Line') // the combo's title
    await retitle('Line, again')
    await click('combos.saveAsNew')
    expect(saveCombo).toHaveBeenCalledTimes(2)
    expect(saveCombo).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Line, again' }))
    expect(updateCombo).not.toHaveBeenCalled()

    await click('toolbar.draw') // tied to the new one now
    await click('toolbar.save')
    expect(updateCombo).toHaveBeenCalledWith('c2', expect.objectContaining({ title: 'Line, again' }), 1)
  })

  it('Save in the Save as dialog renames the tied combo', async () => {
    await saved()
    await click('toolbar.saveAs')
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
    await click('toolbar.draw')
    await click('toolbar.save')
    expect(updateCombo).toHaveBeenLastCalledWith('c2', expect.anything(), 1)
  })

  it('Share saves an unsaved session first, then copies its link; a saved one is copied at once', async () => {
    const writeText = clipboard(async () => {})
    await open(NAMED)
    await click('toolbar.newHand')
    await click('toolbar.share')
    expect(writeText).not.toHaveBeenCalled() // the title first
    await click('combos.save')
    expect(saveCombo).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith(LINK('c1'))
    expect(screen.getByText('combos.copied')).toBeTruthy()

    await click('toolbar.share')
    expect(writeText).toHaveBeenCalledTimes(2)
    expect(updateCombo).not.toHaveBeenCalled()

    await click('toolbar.draw')
    await click('toolbar.share')
    expect(updateCombo).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledTimes(3)
  })

  it('a plain Save copies nothing, and closing the title dialog drops the share', async () => {
    const writeText = clipboard(async () => {})
    await open(NAMED)
    await click('toolbar.newHand')
    await click('toolbar.share')
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
    await click('toolbar.share')
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

  it('Save, Save as and Share are off while a replay plays', async () => {
    await saved()
    await click('toolbar.draw')
    vi.useFakeTimers()
    await click('replay.play')
    expect(button('toolbar.save').disabled).toBe(true)
    expect(button('toolbar.saveAs').disabled).toBe(true)
    expect(button('toolbar.share').disabled).toBe(true)
  })
})
