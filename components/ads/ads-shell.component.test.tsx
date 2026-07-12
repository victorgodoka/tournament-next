import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NITRO_AD_SLOT_IDS } from '@lib/nitro-ads.const'
import * as nitroAds from '@lib/nitro-ads'
import AdsShell from './ads-shell.component'

const pathnameState = vi.hoisted(() => ({ value: '/home' }))
const searchParamsState = vi.hoisted(() => ({ value: '' }))

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.value,
  useSearchParams: () => new URLSearchParams(searchParamsState.value),
}))

describe('AdsShell', () => {
  beforeEach(() => {
    pathnameState.value = '/home'
    searchParamsState.value = ''
    window.nitroAds = {
      createAd: vi.fn().mockResolvedValue({}),
      onNavigate: vi.fn(),
      queue: [],
    }
    vi.spyOn(nitroAds, 'refreshNitroAdsOnNavigate').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    delete window.nitroAds
  })

  it('renders both advertisement landmarks', () => {
    render(<AdsShell />)

    const adRegions = screen.getAllByRole('complementary', {
      name: /advertisement/i,
    })

    expect(adRegions).toHaveLength(2)
    expect(adRegions[0]).toHaveAttribute('id', NITRO_AD_SLOT_IDS.stickyRail)
    expect(adRegions[1]).toHaveAttribute(
      'id',
      NITRO_AD_SLOT_IDS.floatingOutstream,
    )
  })

  it('refreshes ads when navigation changes after mount', async () => {
    vi.useFakeTimers()

    const { rerender } = render(<AdsShell />)

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(nitroAds.refreshNitroAdsOnNavigate).toHaveBeenCalledTimes(1)

    act(() => {
      pathnameState.value = '/tournaments'
      rerender(<AdsShell />)
    })

    expect(nitroAds.refreshNitroAdsOnNavigate).toHaveBeenCalledTimes(2)
  })
})
