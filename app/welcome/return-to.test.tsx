// @vitest-environment happy-dom
import { act, cleanup, render } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ReturnAfterSignIn } from './return-to'

const router = { replace: vi.fn() }
const auth: { user: { id: string } | null | undefined } = { user: undefined }
vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@hooks/index', () => ({ useAuth: () => auth }))

const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

const mount = () => render(<StrictMode><ReturnAfterSignIn /></StrictMode>)

it('goes back to the stored page once signed in, even with effects run twice', () => {
  store.set('return-to', '/deck-builder')
  auth.user = undefined
  const view = mount()
  expect(router.replace).not.toHaveBeenCalled() // session still loading: nothing taken
  expect(store.get('return-to')).toBe('/deck-builder')
  auth.user = { id: 'u1' }
  act(() => view.rerender(<StrictMode><ReturnAfterSignIn /></StrictMode>))
  expect(router.replace).toHaveBeenCalled()
  for (const [path] of router.replace.mock.calls) expect(path).toBe('/deck-builder')
  expect(store.has('return-to')).toBe(false)
})

it('signed out, leaves the stored page for later', () => {
  store.set('return-to', '/deck-builder')
  auth.user = null
  mount()
  expect(router.replace).not.toHaveBeenCalled()
  expect(store.get('return-to')).toBe('/deck-builder')
})

it('stays on /welcome when nothing was stored', () => {
  auth.user = { id: 'u1' }
  mount()
  expect(router.replace).not.toHaveBeenCalled()
})
