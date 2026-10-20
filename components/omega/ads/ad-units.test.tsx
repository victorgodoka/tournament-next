// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNitroPlacement } from '@utils/nitro-ads'
import { ARTICLE_AD_OPTIONS, VIDEO_NC_AD_OPTIONS } from '@utils/nitro-ads.const'
import { AdArticle } from './ad-article'
import { AdBanner } from './ad-banner'
import { AdVideo } from './ad-video'
import type { AdsMode } from './ads-mode'
import { NonVipOnly } from './non-vip-only'
import { VipPromo } from './vip-promo'

const state: { mode: AdsMode; promo: boolean; pathname: string } = { mode: 'all', promo: true, pathname: '/decks' }

vi.mock('./ads-mode', () => ({ useAdsMode: () => state.mode, usePromoVisible: () => state.promo }))
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }))
vi.mock('@utils/nitro-ads', () => ({ createNitroPlacement: vi.fn(async () => ({})), removeNitroPlacement: vi.fn() }))
vi.mock('next-intl', () => {
  const t = Object.assign((key: string) => key, { rich: (key: string) => key })
  return { useTranslations: () => t }
})

const settle = () => act(() => vi.runAllTimersAsync())

beforeEach(() => {
  vi.useFakeTimers()
  Object.assign(state, { mode: 'all', promo: true, pathname: '/decks' })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('AdBanner', () => {
  it.each(['none', 'rail'] as const)('renders nothing in mode %s', async (mode) => {
    state.mode = mode
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

  it('renders nothing on a rail-only page', async () => {
    state.mode = 'rail'
    const { container } = render(<AdVideo id="ad-video" />)
    await settle()
    expect(container.innerHTML).toBe('')
    expect(createNitroPlacement).not.toHaveBeenCalled()
  })
})

describe('AdArticle', () => {
  const Page = () => (
    <>
      <div id="ad-article">
        <p>body</p>
      </div>
      <AdArticle targetId="ad-article" />
    </>
  )

  it('wraps the article with Nitro placements', async () => {
    render(<Page />)
    await settle()
    expect(createNitroPlacement).toHaveBeenCalledWith('ad-article', ARTICLE_AD_OPTIONS)
  })

  it('never touches the article without ads', async () => {
    state.mode = 'none'
    const { container } = render(<Page />)
    await settle()
    expect(createNitroPlacement).not.toHaveBeenCalled()
    expect(container.querySelector('#ad-article p')?.textContent).toBe('body')
  })
})

describe('VipPromo', () => {
  it('pitches VIP on a page with ads', () => {
    render(<VipPromo />)
    expect(screen.getByText('eyebrow')).toBeTruthy()
    expect(screen.getByText('cta').closest('a')?.getAttribute('href')).toBe('/download#donations')
  })

  it('shows on a rail-only tool page', () => {
    Object.assign(state, { mode: 'rail', pathname: '/calculator' })
    render(<VipPromo />)
    expect(screen.getByText('eyebrow')).toBeTruthy()
  })

  it.each([
    ['a VIP', { promo: false }],
    ['a page without ads', { mode: 'none' as const }],
    ['the download page, which already is the pitch', { pathname: '/download' }],
  ])('stays hidden for %s', (_, patch) => {
    Object.assign(state, patch)
    const { container } = render(<VipPromo />)
    expect(container.innerHTML).toBe('')
  })
})

describe('NonVipOnly', () => {
  it('shows its children to everyone but a VIP', () => {
    render(<NonVipOnly>vip band</NonVipOnly>)
    expect(screen.getByText('vip band')).toBeTruthy()
  })

  it('hides them from a VIP', () => {
    state.promo = false
    const { container } = render(<NonVipOnly>vip band</NonVipOnly>)
    expect(container.innerHTML).toBe('')
  })
})
