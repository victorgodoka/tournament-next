// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MetaCarousel, STEP_MS, type MetaDeck } from './meta-carousel'

vi.mock('next/image', () => ({ default: () => null }))

// Two decks share a face card on purpose: `A` and `A>B` in the ranked data.
const DECKS: MetaDeck[] = [
  { id: 1, name: 'Branded', note: '10.0% of ranked games' },
  { id: 1, name: 'Branded Despia', note: '6.0% of ranked games' },
  { id: 3, name: 'Sky Striker', note: '4.0% of ranked games' },
]

const reducedMotion = (matches: boolean) =>
  vi.stubGlobal('matchMedia', () => ({ matches, addEventListener() {}, removeEventListener() {} }))

const current = () => screen.getAllByRole('button', { name: /^Show / }).findIndex((dot) => dot.getAttribute('aria-current') === 'true')
const step = () => act(() => { vi.advanceTimersByTime(STEP_MS) })

describe('MetaCarousel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    reducedMotion(false)
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('advances one deck per step and wraps around', () => {
    render(<MetaCarousel decks={DECKS} />)
    expect(current()).toBe(0)
    step()
    expect(current()).toBe(1)
    step()
    step()
    expect(current()).toBe(0)
  })

  it('renders every deck even when two share a face card', () => {
    render(<MetaCarousel decks={DECKS} />)
    expect(screen.getAllByRole('link', { hidden: true })).toHaveLength(3)
  })

  it('holds still while hovered and resumes after', () => {
    render(<MetaCarousel decks={DECKS} />)
    const region = screen.getByRole('region')
    fireEvent.mouseEnter(region)
    step()
    expect(current()).toBe(0)
    fireEvent.mouseLeave(region)
    step()
    expect(current()).toBe(1)
  })

  it('stops for good with the pause button', () => {
    render(<MetaCarousel decks={DECKS} />)
    const toggle = screen.getByRole('button', { name: 'Pause carousel' })
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    step()
    step()
    expect(current()).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Play carousel' }))
    step()
    expect(current()).toBe(1)
  })

  it('never moves on reduced motion', () => {
    reducedMotion(true)
    render(<MetaCarousel decks={DECKS} />)
    step()
    expect(current()).toBe(0)
  })

  it('centres a side card on click instead of following it', () => {
    render(<MetaCarousel decks={DECKS} />)
    const side = screen.getByRole('link', { name: /Sky Striker/, hidden: true })
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    act(() => { side.dispatchEvent(click) })
    expect(click.defaultPrevented).toBe(true)
    expect(current()).toBe(2)
  })

  it('makes no rank claims for the static fallback list', () => {
    render(<MetaCarousel decks={DECKS} ranked={false} />)
    expect(screen.queryByText('#1')).toBeNull()
    expect(screen.getByRole('region').getAttribute('aria-label')).toBe('Popular decks')
  })
})
