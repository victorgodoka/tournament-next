import { describe, expect, it, vi } from 'vitest'
import { render, screen, userEvent } from '../../test/test-utils'
import MenulinksComponent from './menulinks.component'

describe('MenulinksComponent', () => {
  it('opens and closes a desktop dropdown menu', async () => {
    const user = userEvent.setup()

    render(<MenulinksComponent />)

    const playTrigger = screen.getByRole('button', { name: 'Play' })
    expect(playTrigger).toHaveAttribute('aria-expanded', 'false')

    await user.click(playTrigger)

    expect(playTrigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu', { name: 'Play' })).toBeVisible()

    await user.keyboard('{Escape}')

    expect(playTrigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes a desktop dropdown when clicking outside', async () => {
    const user = userEvent.setup()

    render(
      <div>
        <MenulinksComponent />
        <button type="button">Outside</button>
      </div>,
    )

    const playTrigger = screen.getByRole('button', { name: 'Play' })
    await user.click(playTrigger)
    await user.click(screen.getByRole('button', { name: 'Outside' }))

    expect(playTrigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens and closes the mobile navigation drawer', async () => {
    const user = userEvent.setup()

    render(<MenulinksComponent />)

    const toggle = screen.getByRole('button', {
      name: /open navigation menu/i,
    })

    await user.click(toggle)

    expect(screen.getByRole('dialog', { name: /navigation menu/i })).toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('expands a mobile accordion section', async () => {
    const user = userEvent.setup()

    render(<MenulinksComponent />)

    await user.click(
      screen.getByRole('button', { name: /open navigation menu/i }),
    )

    const playSection = screen.getAllByRole('button', { name: 'Play' })[1]
    expect(playSection).toHaveAttribute('aria-expanded', 'false')

    await user.click(playSection)

    expect(playSection).toHaveAttribute('aria-expanded', 'true')
  })
})
