import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '../../test/test-utils'
import AvatarComponent from './avatar.component'

describe('AvatarComponent', () => {
  it('renders an image when src is provided', () => {
    render(
      <AvatarComponent
        src="https://cdn.discordapp.com/avatars/1/abc.png"
        alt="Test Duelist"
      />,
    )

    expect(screen.getByRole('img', { name: 'Test Duelist' })).toBeInTheDocument()
  })

  it('falls back to initials when the image fails to load', () => {
    render(
      <AvatarComponent
        src="https://cdn.discordapp.com/avatars/1/broken.png"
        alt="Test Duelist"
      />,
    )

    const image = screen.getByRole('img', { name: 'Test Duelist' })
    fireEvent.error(image)

    // The wrapper keeps the accessible name (role="img") once the <img> is
    // replaced by decorative initials — the avatar must never go nameless.
    const fallback = screen.getByRole('img', { name: 'Test Duelist' })
    expect(fallback.tagName).toBe('SPAN')
    expect(screen.getByText('TD')).toBeInTheDocument()
  })

  it('shows initials when no src is provided', () => {
    render(<AvatarComponent src="" alt="Jane Doe" />)

    expect(screen.getByText('JD')).toBeInTheDocument()
  })
})
