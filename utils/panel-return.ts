/**
 * Where "Back to site" in the admin panel returns to: the public path the admin was on when they
 * entered. Its own sessionStorage key: `return-to` (utils/return-to.ts) is taken once after sign-in
 * and cleared, while this one is read as long as the admin moves inside the panel.
 */
const KEY = 'panel-return-to'

// Same check as utils/return-to.ts: a same-origin rooted path with no control characters. Never the panel itself.
export const isPanelReturn = (path: string | null): path is string =>
  !!path && /^\/(?![/\\])/.test(path) && !/[\u0000-\u001f\u007f\s]/.test(path) && !path.startsWith('/admin')

/** Call before linking into the panel from the site. */
export const storePanelReturn = (path: string): void => {
  try {
    if (isPanelReturn(path)) sessionStorage.setItem(KEY, path)
  } catch {} // storage missing or blocked: "Back to site" goes home
}

/** Read, not taken. `null` when the panel was opened by URL. */
export const readPanelReturn = (): string | null => {
  try {
    const path = sessionStorage.getItem(KEY)
    return isPanelReturn(path) ? path : null
  } catch {
    return null
  }
}
