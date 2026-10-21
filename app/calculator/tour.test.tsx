// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { markTourSeen, Tour, tourAfter, tourSeen } from './tour'

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

const noop = () => {}
const renderTour = (step: number, over: Partial<React.ComponentProps<typeof Tour>> = {}) =>
  render(<Tour state={{ step, paints: 0 }} onBack={noop} onNext={noop} onClose={noop} {...over} />)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('tour state', () => {
  it('tourAfter advances on the awaited events only', () => {
    const s1 = { step: 1, paints: 0 }
    expect(tourAfter(s1, 'paint')).toBe(s1)
    const s2 = tourAfter(s1, 'brush')
    expect(s2).toEqual({ step: 2, paints: 0 })
    expect(tourAfter(tourAfter(s2, 'paint'), 'paint')).toEqual({ step: 3, paints: 0 })
    expect(tourAfter({ step: 3, paints: 0 }, 'menu')).toEqual({ step: 4, paints: 0 })
    expect(tourAfter({ step: 4, paints: 0 }, 'menu')).toEqual({ step: 4, paints: 0 })
    expect(tourAfter(null, 'brush')).toBeNull()
  })

  it('tourSeen and markTourSeen survive a throwing storage', () => {
    const denied = () => {
      throw new Error('denied')
    }
    vi.stubGlobal('localStorage', { getItem: denied, setItem: denied })
    expect(tourSeen()).toBe(false)
    expect(() => markTourSeen()).not.toThrow()
  })

  it('markTourSeen is what tourSeen reads', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) })
    expect(tourSeen()).toBe(false)
    markTourSeen()
    expect(store.get('calc-tour')).toBe('done')
    expect(tourSeen()).toBe(true)
  })
})

describe('Tour', () => {
  it('renders the step with its buttons: doIt while waiting, Next on 4, Done on 5', () => {
    const { unmount } = renderTour(1)
    expect(screen.getByText('tour.s1Title')).toBeTruthy()
    expect(screen.getByText('tour.s1')).toBeTruthy()
    expect(screen.getByText('tour.doIt')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'tour.back' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'tour.next' })).toBeNull()
    unmount()

    const four = renderTour(4)
    expect(screen.getByRole('button', { name: 'tour.next' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'tour.back' })).toBeTruthy()
    expect(screen.queryByText('tour.doIt')).toBeNull()
    four.unmount()

    renderTour(5)
    expect(screen.getByRole('button', { name: 'tour.done' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'tour.next' })).toBeNull()
  })

  it('is a non-modal dialog named by its title, announced politely', () => {
    renderTour(2)
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('false')
    expect(dialog.getAttribute('aria-labelledby')).toBe(screen.getByText('tour.s2Title').id)
    expect(dialog.querySelector('[aria-live="polite"]')?.textContent).toContain('tour.s2Title')
  })

  it('Skip, Back, Next and Done call their handlers', () => {
    const onBack = vi.fn()
    const onNext = vi.fn()
    const onClose = vi.fn()
    const four = renderTour(4, { onBack, onNext, onClose })
    fireEvent.click(screen.getByRole('button', { name: 'tour.skip' }))
    fireEvent.click(screen.getByRole('button', { name: 'tour.back' }))
    fireEvent.click(screen.getByRole('button', { name: 'tour.next' }))
    expect([onClose.mock.calls.length, onBack.mock.calls.length, onNext.mock.calls.length]).toEqual([1, 1, 1])
    four.unmount()

    renderTour(5, { onClose })
    fireEvent.click(screen.getByRole('button', { name: 'tour.done' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('scrolls the anchor into view only when it differs from the previous step: grid → grid stays put', () => {
    const scrolls = Object.fromEntries(['grid', 'odds'].map((name) => [name, vi.fn()]))
    for (const [name, scroll] of Object.entries(scrolls)) {
      const el = document.createElement('div')
      el.dataset.tour = name
      el.scrollIntoView = scroll!
      document.body.append(el)
    }
    const tour = (step: number) => <Tour state={{ step, paints: 0 }} onBack={noop} onNext={noop} onClose={noop} />
    const { rerender } = render(tour(2))
    expect(scrolls.grid).toHaveBeenCalledTimes(1) // the first step always scrolls
    rerender(tour(3)) // grid → grid, as when step 2's second paint lands mid-drag
    expect(scrolls.grid).toHaveBeenCalledTimes(1)
    rerender(tour(4)) // grid → odds
    expect(scrolls.odds).toHaveBeenCalledTimes(1)
    expect(scrolls.grid).toHaveBeenCalledTimes(1)
  })

  it('the spotlight sits over the anchor with 8px of padding; no anchor hides it', () => {
    const anchor = document.createElement('div')
    anchor.dataset.tour = 'strip'
    anchor.getBoundingClientRect = () => ({ top: 100, left: 40, width: 300, height: 50, right: 340, bottom: 150, x: 40, y: 100, toJSON: () => ({}) })
    document.body.append(anchor)
    const { container, unmount } = renderTour(1)
    const spot = container.firstElementChild as HTMLElement
    expect([spot.style.top, spot.style.left, spot.style.width, spot.style.height]).toEqual(['92px', '32px', '316px', '66px'])
    expect(spot.style.display).not.toBe('none')
    unmount()

    anchor.remove()
    const missing = renderTour(1)
    expect((missing.container.firstElementChild as HTMLElement).style.display).toBe('none')
  })
})
