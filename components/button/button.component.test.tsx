import { describe, expect, it, vi } from 'vitest'
import { render, screen, userEvent } from '../../test/test-utils'
import ButtonComponent from './button.component'

describe('ButtonComponent', () => {
  it('renders a button and handles clicks', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(
      <ButtonComponent onClick={onClick}>Sign in</ButtonComponent>,
    )

    const button = screen.getByRole('button', { name: /sign in/i })
    await user.click(button)

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('disables the button and sets aria-busy when loading', () => {
    render(<ButtonComponent loading>Loading</ButtonComponent>)

    const button = screen.getByRole('button', { name: /loading/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('renders an external anchor when href is provided', () => {
    render(
      <ButtonComponent href="https://example.com">External</ButtonComponent>,
    )

    const link = screen.getByRole('link', { name: /external/i })
    expect(link).toHaveAttribute('href', 'https://example.com')
  })

  it('renders an internal link when to is provided', () => {
    render(<ButtonComponent to="/leaderboards">Leaderboards</ButtonComponent>)

    const link = screen.getByRole('link', { name: /leaderboards/i })
    expect(link).toHaveAttribute('href', '/leaderboards')
  })
})
