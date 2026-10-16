// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { SignIn } from './SignIn'

const router = { replace: vi.fn() }
vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@iconify/react', () => ({ Icon: () => null }))
vi.mock('@hooks/index', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('a signed-in visitor goes to the stored page, never falling through to /welcome on the second effect run', () => {
  const store = new Map([['return-to', '/deck-editor']])
  vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })
  render(<StrictMode><SignIn redirectIfSignedIn /></StrictMode>)
  expect(router.replace).toHaveBeenCalled()
  for (const [path] of router.replace.mock.calls) expect(path).toBe('/deck-editor')
})
