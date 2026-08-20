import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdblockNotice from './adblock-notice.component'

describe('AdblockNotice', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(1)
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not show when the ad bait is visible', async () => {
    render(<AdblockNotice />)

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })

  it('shows and can be dismissed when the ad bait is blocked', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(0)
    const user = userEvent.setup()

    render(<AdblockNotice />)

    const notice = await screen.findByRole('status')
    expect(notice).toHaveTextContent(/ads are being blocked/i)

    await user.click(
      screen.getByRole('button', { name: /dismiss ad blocker notice/i }),
    )

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(sessionStorage.getItem('duelistsunite-adblock-notice-dismissed')).toBe(
      'true',
    )
  })
})