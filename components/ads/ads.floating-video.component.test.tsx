import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  FLOATING_OUTSTREAM_AD_OPTIONS,
  NITRO_AD_SLOT_IDS,
} from '@lib/nitro-ads.const'
import FloatingOutstreamVideoPlayerAd from './ads.floating-video.component'

describe('FloatingOutstreamVideoPlayerAd', () => {
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

  it('renders an advertisement landmark with the floating outstream slot id', () => {
    render(<FloatingOutstreamVideoPlayerAd />)

    const adRegion = screen.getByRole('complementary', {
      name: /advertisement/i,
    })

    expect(adRegion).toBeInTheDocument()
    expect(adRegion).toHaveAttribute('id', NITRO_AD_SLOT_IDS.floatingOutstream)
    expect(adRegion).toHaveClass('ads--floating-outstream')
  })

  it('creates a Nitro placement for the floating outstream slot', async () => {
    vi.useFakeTimers()

    render(<FloatingOutstreamVideoPlayerAd />)

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(window.nitroAds?.createAd).toHaveBeenCalledWith(
      NITRO_AD_SLOT_IDS.floatingOutstream,
      FLOATING_OUTSTREAM_AD_OPTIONS,
    )
  })
})
