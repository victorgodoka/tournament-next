import { describe, expect, it } from 'vitest'
import { render, screen } from '../test/test-utils'
import NotFoundPage from './not-found-page'

describe('NotFoundPage', () => {
  it('renders the 404 heading and home link', () => {
    render(<NotFoundPage />)

    expect(
      screen.getByRole('heading', {
        name: /this path doesn't exist in the omega network/i,
      }),
    ).toBeInTheDocument()

    const homeLink = screen.getByRole('link', { name: /back to home/i })
    expect(homeLink).toHaveAttribute('href', '/')
  })
})
