const PREFIX = 'omega:draft:'

/**
 * Best-effort form drafts in sessionStorage, keyed per form. Survives a
 * navigation/logout+redirect so a user doesn't lose typed input if their
 * session expires on submit. Reads return `unknown` — callers must validate
 * the shape before trusting it (the stored value is untrusted at read time).
 */
export function readFormDraft(key: string | undefined): unknown {
  if (!key || typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function writeFormDraft(key: string | undefined, value: unknown): void {
  if (!key || typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // storage full / disabled — drafts are best-effort, never block the form
  }
}

export function clearFormDraft(key: string | undefined): void {
  if (!key || typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(PREFIX + key)
  } catch {
    // ignore
  }
}
