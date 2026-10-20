// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNitroPlacement } from '@utils/nitro-ads'
import { VIDEO_NC_AD_OPTIONS, WIKI_BODY_ID } from '@utils/nitro-ads.const'
import type { NitroAdOptions } from '@utils/nitro-ads.types'
import { AdArticle } from './ad-article'
import { AdBanner } from './ad-banner'
import { AdVideo } from './ad-video'
import type { AdsMode } from './ads-mode'
import { NonVipOnly } from './non-vip-only'
import { VipPromo } from './vip-promo'

type State = { mode: AdsMode; layout: AdsMode; promo: boolean; promoHeld: boolean; pathname: string }
const state: State = { mode: 'all', layout: 'all', promo: true, promoHeld: true, pathname: '/decks' }
/** Auth has answered: what the page holds is what it shows. */
const settled = (patch: Partial<State>) =>
  Object.assign(state, patch.mode ? { layout: patch.mode } : {}, patch.promo === undefined ? {} : { promoHeld: patch.promo }, patch)

vi.mock('./ads-mode', () => ({
  useAdsMode: () => state.mode,
  useAdsLayout: () => state.layout,
  usePromoVisible: () => state.promo,
  usePromoLayout: () => state.promoHeld,
}))
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }))
vi.mock('@utils/nitro-ads', async (original) => ({
  ...(await original<typeof import('@utils/nitro-ads')>()),
  createNitroPlacement: vi.fn(async () => ({})),
  removeNitroPlacement: vi.fn(),
}))
vi.mock('next-intl', () => {
  const t = Object.assign((key: string) => key, { rich: (key: string) => key })
  return { useTranslations: () => t }
})

const settle = () => act(() => vi.runAllTimersAsync())

beforeEach(() => {
  vi.useFakeTimers()
  settled({ mode: 'all', promo: true, pathname: '/decks' })
  // happy-dom lays nothing out: every slot measures as a 1280px desktop column unless a test says otherwise.
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1280)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('AdBanner', () => {
  it.each(['none', 'rail'] as const)('renders nothing in mode %s', async (mode) => {
    settled({ mode })
    const { container } = render(<AdBanner id="ad-top" placement="content" />)
    await settle()
    expect(container.innerHTML).toBe('')
    expect(createNitroPlacement).not.toHaveBeenCalled()
  })

  it('reserves the slot and links to the VIP perks', async () => {
    const { container } = render(<AdBanner id="ad-top" placement="content" />)
    await settle()
    expect(container.querySelector('#ad-top')).toBeTruthy()
    expect(screen.getByText('removeWithVip').closest('a')?.getAttribute('href')).toBe('/download#donations')
    expect(vi.mocked(createNitroPlacement).mock.calls[0]?.[0]).toBe('ad-top')
  })

  it('stays off phones in the aside, where the wiki aside sits above the article', () => {
    const { container } = render(<AdBanner id="ad-aside" placement="aside" />)
    expect((container.firstElementChild as HTMLElement).className).toContain('max-lg:hidden')
  })

  it('pins to the bottom of the scrolling aside, which would otherwise keep it below the fold', () => {
    const { container } = render(<AdBanner id="ad-aside" placement="aside" />)
    expect((container.firstElementChild as HTMLElement).className).toMatch(/lg:sticky.*lg:bottom-0/)
  })

  it('holds its box while auth loads, without asking Nitro yet', async () => {
    Object.assign(state, { mode: 'none', layout: 'all' })
    const { container } = render(<AdBanner id="ad-top" placement="content" />)
    await settle()
    expect(screen.getByText('label')).toBeTruthy()
    expect([...container.querySelectorAll('div')].some((d) => d.className.includes('min-h-[250px]'))).toBe(true)
    expect(container.querySelector('#ad-top')).toBeNull()
    expect(createNitroPlacement).not.toHaveBeenCalled()
  })

  it('asks only for creatives that fit the slot', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800)
    render(<AdBanner id="ad-top" placement="content" />)
    await settle()
    const sizes = (vi.mocked(createNitroPlacement).mock.calls[0]?.[1] as unknown as { sizes: [number, number][] }).sizes
    expect(sizes.length).toBeGreaterThan(0)
    expect(sizes.every(([width]) => width <= 800)).toBe(true)
  })

  it('shows our VIP promo when Nitro is blocked', async () => {
    vi.mocked(createNitroPlacement).mockRejectedValueOnce(new Error('blocked'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container } = render(<AdBanner id="ad-top" placement="content" />)
    await settle()
    expect(screen.getByText('eyebrow')).toBeTruthy()
    expect(container.querySelector('#ad-top')).toBeNull()
  })
})

describe('AdVideo', () => {
  it('reserves a 16:9 player and asks Nitro for video-nc', async () => {
    const { container } = render(<AdVideo id="ad-video" />)
    await settle()
    expect(container.querySelector('#ad-video')?.className).toContain('aspect-video')
    expect(createNitroPlacement).toHaveBeenCalledWith('ad-video', VIDEO_NC_AD_OPTIONS)
  })

  it('holds its 16:9 box while auth loads, without asking Nitro yet', async () => {
    Object.assign(state, { mode: 'none', layout: 'all' })
    const { container } = render(<AdVideo id="ad-video" />)
    await settle()
    expect(container.querySelector('.aspect-video')).toBeTruthy()
    expect(container.querySelector('#ad-video')).toBeNull()
    expect(createNitroPlacement).not.toHaveBeenCalled()
  })

  it('keeps its box and shows our VIP promo when Nitro is blocked', async () => {
    vi.mocked(createNitroPlacement).mockRejectedValueOnce(new Error('blocked'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container } = render(<AdVideo id="ad-video" />)
    await settle()
    expect(container.querySelector('.aspect-video')).toBeTruthy()
    expect(screen.getByText('eyebrow')).toBeTruthy()
    expect(container.querySelector('#ad-video')).toBeNull()
  })

  it('renders nothing on a rail-only page', async () => {
    settled({ mode: 'rail' })
    const { container } = render(<AdVideo id="ad-video" />)
    await settle()
    expect(container.innerHTML).toBe('')
    expect(createNitroPlacement).not.toHaveBeenCalled()
  })
})

describe('AdArticle', () => {
  const Page = () => (
    <>
      <div id={WIKI_BODY_ID}>
        <p>body</p>
      </div>
      <AdArticle targetId={WIKI_BODY_ID} />
    </>
  )

  it('names the article without an ad-like id, which EasyList would hide', () => {
    expect(WIKI_BODY_ID).not.toMatch(/(^|[-_])ads?([-_]|$)/)
  })

  it('wraps the article with Nitro placements that fit its column', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(700)
    render(<Page />)
    await settle()
    const [id, options] = vi.mocked(createNitroPlacement).mock.calls[0] as unknown as [string, NitroAdOptions & { sizes: [number, number][] }]
    expect(id).toBe(WIKI_BODY_ID)
    expect(options).toMatchObject({ format: 'article' })
    expect(options.sizes.every(([width]) => width <= 700)).toBe(true)
  })

  it('never touches the article without ads', async () => {
    settled({ mode: 'none' })
    const { container } = render(<Page />)
    await settle()
    expect(createNitroPlacement).not.toHaveBeenCalled()
    expect(container.querySelector('#' + WIKI_BODY_ID + ' p')?.textContent).toBe('body')
  })
})

describe('VipPromo', () => {
  it('pitches VIP on a page with ads', () => {
    render(<VipPromo />)
    expect(screen.getByText('eyebrow')).toBeTruthy()
    expect(screen.getByText('cta').closest('a')?.getAttribute('href')).toBe('/download#donations')
  })

  it('holds its place while auth loads', () => {
    Object.assign(state, { mode: 'none', layout: 'all', promo: false, promoHeld: true })
    render(<VipPromo />)
    expect(screen.getByText('eyebrow')).toBeTruthy()
  })

  it('shows on a rail-only tool page', () => {
    settled({ mode: 'rail', pathname: '/calculator' })
    render(<VipPromo />)
    expect(screen.getByText('eyebrow')).toBeTruthy()
  })

  it.each([
    ['a VIP', { promo: false }],
    ['a page without ads', { mode: 'none' as const }],
    ['the download page, which already is the pitch', { pathname: '/download' }],
  ])('stays hidden for %s', (_, patch) => {
    settled(patch)
    const { container } = render(<VipPromo />)
    expect(container.innerHTML).toBe('')
  })
})

describe('NonVipOnly', () => {
  it('shows its children to everyone but a VIP', () => {
    render(<NonVipOnly>vip band</NonVipOnly>)
    expect(screen.getByText('vip band')).toBeTruthy()
  })

  it('holds them while auth loads', () => {
    Object.assign(state, { promo: false, promoHeld: true })
    render(<NonVipOnly>vip band</NonVipOnly>)
    expect(screen.getByText('vip band')).toBeTruthy()
  })

  it('hides them from a VIP', () => {
    settled({ promo: false })
    const { container } = render(<NonVipOnly>vip band</NonVipOnly>)
    expect(container.innerHTML).toBe('')
  })
})
