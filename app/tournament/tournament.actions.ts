'use server'

import { revalidatePath } from 'next/cache'

/**
 * Invalidate the cached server data for a tournament route so the next render
 * refetches it. Called by the hard-refresh button on ongoing tournaments.
 */
export async function refreshTournament(path: string) {
  revalidatePath(path)
}
