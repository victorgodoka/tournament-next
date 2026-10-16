import { useCallback, useRef } from 'react'

/** Where to go back to after signing in: a same-origin path in sessionStorage, read once. */
const KEY = 'return-to'

// Same-origin rooted paths only: no `//host` or `/\host`, and no control/whitespace characters
// (URL parsers strip tab/newline, so `/\t/evil.test` would navigate to `//evil.test`).
const isSafePath = (path: string | null): path is string =>
  !!path && /^\/(?![/\\])/.test(path) && !/[\u0000-\u001f\u007f\s]/.test(path)

export const setReturnTo = (path: string): void => {
  try {
    if (isSafePath(path)) sessionStorage.setItem(KEY, path)
  } catch {} // storage missing or blocked: the user lands on the default page instead
}

/** Reads and clears the stored path; returns it only if still safe. */
export const takeReturnTo = (): string | null => {
  try {
    const path = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    return isSafePath(path) ? path : null
  } catch {
    return null
  }
}

/**
 * `takeReturnTo` once per component: later calls give the same answer, so an effect that runs twice
 * (StrictMode) can't take the path on the first run and fall through to the default on the second.
 */
export const useReturnTo = () => {
  const taken = useRef<string | null | undefined>(undefined)
  return useCallback(() => (taken.current === undefined ? (taken.current = takeReturnTo()) : taken.current), [])
}
