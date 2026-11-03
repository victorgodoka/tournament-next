'use client'

import { useSyncExternalStore } from "react";

const MINUTE = 60_000

/** Rounded to the minute, so the snapshot stays the same between renders of that minute. */
const read = () => Math.floor(Date.now() / MINUTE) * MINUTE

const subscribe = (notify: () => void) => {
  const timer = setInterval(notify, MINUTE)
  return () => clearInterval(timer)
}

/**
 * The current time in the browser, `null` on the server (which can't know the reader's day or
 * zone): what "today" and "yesterday" labels compare against without breaking hydration.
 */
export const useNow = (): number | null => useSyncExternalStore(subscribe, read, () => null)

/** `YYYY-MM-DD` of `at` in `timeZone` (the reader's when undefined). */
export const dayKey = (at: number | Date, timeZone?: string) => new Date(at).toLocaleDateString('en-CA', timeZone ? { timeZone } : {})

export const DAY_MS = 86_400_000
