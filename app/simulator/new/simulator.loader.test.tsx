// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@contexts/auth/auth.context'
import { metadata } from './page'
import { SimulatorLoader } from './simulator.loader'

vi.mock('next/dynamic', () => ({ default: () => () => <p>the stage</p> }))
vi.mock('next/navigation', () => ({ usePathname: () => '/simulator/new' }))
vi.mock('@contexts/auth/auth.context', () => ({ useAuth: vi.fn() }))

const as = (user: unknown) => {
  vi.mocked(useAuth).mockReturnValue({ user } as ReturnType<typeof useAuth>)
  render(<SimulatorLoader />)
}

afterEach(cleanup)

describe('/simulator/new', () => {
  it('stays out of search engines', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })

  it('opens for an admin', () => {
    as({ permissions: ['system.manage'] })
    expect(screen.getByText('the stage')).toBeTruthy()
  })

  it.each([
    ['while the session is checked', undefined, 'Checking your session'],
    ['signed out', null, 'Sign in first'],
    ['for anyone else', { permissions: ['wiki.write'] }, 'Not your door'],
  ])('stays shut %s', (_, user, heading) => {
    as(user)
    expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
    expect(screen.queryByText('the stage')).toBeNull()
  })
})
