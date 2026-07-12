import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NITRO_AD_SLOT_IDS,
  STICKY_RAIL_AD_OPTIONS,
} from '@lib/nitro-ads.const'
import StickySideRailAd from './ads.sticky-side-rail.component'

describe('StickySideRailAd', () => {
  beforeEach(() => {
    window.nitroAds = {
      createAd: vi.fn().mockResolvedValue({}),
      queue: [],
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    delete window.nitroAds
  })

  it('renders an advertisement landmark with the sticky rail slot id', () => {
    render(<StickySideRailAd />)

    const adRegion = screen.getByRole('complementary', {
      name: /advertisement/i,
    })

    expect(adRegion).toBeInTheDocument()
    expect(adRegion).toHaveAttribute('id', NITRO_AD_SLOT_IDS.stickyRail)
    expect(adRegion).toHaveClass('ads--sticky-rail')
  })

  it('creates a Nitro placement for the sticky rail slot', async () => {
    vi.useFakeTimers()

    render(<StickySideRailAd />)

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(window.nitroAds?.createAd).toHaveBeenCalledWith(
      NITRO_AD_SLOT_IDS.stickyRail,
      STICKY_RAIL_AD_OPTIONS,
    )
  })
})
