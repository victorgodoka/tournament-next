// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toYdke } from '@utils/deck/codecs/ydke'
import { listMyDecks } from '@utils/decks'
import Simulator from './simulator.client'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
  useFormatter: () => ({ relativeTime: () => 'now' }),
  useNow: () => new Date(),
}))
vi.mock('@hooks/index', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('@utils/cards', () => ({ cardsByIds: vi.fn(async () => new Map()) }))
vi.mock('@utils/decks', async (original) => ({ ...(await original<typeof import('@utils/decks')>()), listMyDecks: vi.fn() }))

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
  vi.mocked(listMyDecks).mockResolvedValue({ decks: [], nextCursor: null })
})
afterEach(() => {
  cleanup()
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
})

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
