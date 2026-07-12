import { describe, expect, it, vi } from 'vitest'
import {
  authenticatedUser,
  fireEvent,
  render,
  screen,
  userEvent,
} from '../../test/test-utils'
import AvatarmenuComponent from './avatarmenu.component'

describe('AvatarmenuComponent', () => {
  it('opens the account menu when the trigger is clicked', async () => {
    const user = userEvent.setup()

    render(
      <AvatarmenuComponent
        user={authenticatedUser}
        logout={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('button', {
      name: /test duelist account menu/i,
    })

    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu', { name: /account menu/i })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: /my profile/i })).toBeVisible()
  })

  it('closes the menu when Escape is pressed', async () => {
    const user = userEvent.setup()

    render(
      <AvatarmenuComponent
        user={authenticatedUser}
        logout={vi.fn()}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: /test duelist account menu/i }),
    )
    await user.keyboard('{Escape}')

    expect(
      screen.getByRole('button', { name: /test duelist account menu/i }),
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes the menu when clicking outside', async () => {
    const user = userEvent.setup()

    render(
      <div>
        <AvatarmenuComponent user={authenticatedUser} logout={vi.fn()} />
        <button type="button">Outside</button>
      </div>,
    )

    fireEvent.click(
      screen.getByRole('button', { name: /test duelist account menu/i }),
    )
    await user.click(screen.getByRole('button', { name: 'Outside' }))

    expect(
      screen.getByRole('button', { name: /test duelist account menu/i }),
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it('calls logout from the menu', async () => {
    const user = userEvent.setup()
    const logout = vi.fn()

    render(
      <AvatarmenuComponent user={authenticatedUser} logout={logout} />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: /test duelist account menu/i }),
    )
    await user.click(screen.getByRole('menuitem', { name: /logout/i }))

    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('does not open the menu while signing out', async () => {
    const user = userEvent.setup()

    render(
      <AvatarmenuComponent
        user={authenticatedUser}
        logout={vi.fn()}
        isLoggingOut
      />,
    )

    const trigger = screen.getByRole('button', {
      name: /test duelist account menu/i,
    })

    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menuitem', { name: /logout/i })).not.toBeInTheDocument()
  })
})
