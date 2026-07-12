import { vi } from 'vitest'

export const pathnameState = { value: '/' }
export const searchParamsState = { value: '' }

export const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
}

export function resetNextNavigationMocks() {
  pathnameState.value = '/'
  searchParamsState.value = ''
  mockRouter.push.mockReset()
  mockRouter.replace.mockReset()
  mockRouter.refresh.mockReset()
  mockRouter.back.mockReset()
  mockRouter.forward.mockReset()
  mockRouter.prefetch.mockReset()
}
