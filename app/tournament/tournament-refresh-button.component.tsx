'use client'

import { useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import ButtonComponent from '@components/button/button.component'
import { clearCache } from '@lib/client-cache'
import { refreshTournament } from './tournament.actions'

/**
 * Hard-refresh control for ongoing tournaments: busts the server data cache
 * (via revalidatePath) and the client decklist cache, then re-renders with
 * fresh data. Ended tournaments don't change, so this isn't rendered for them.
 */
const TournamentRefreshButton = () => {
  const router = useRouter()
  const pathname = usePathname()
  const [isRefreshing, startRefresh] = useTransition()

  const handleRefresh = () => {
    // Decklists are cached permanently on the client; drop them so a refresh
    // of a still-running tournament can pick up newly submitted decks.
    clearCache('deck:')

    startRefresh(async () => {
      await refreshTournament(pathname)
      router.refresh()
    })
  }

  return (
    <ButtonComponent
      variant="secondary"
      size="sm"
      icon="mdi:refresh"
      loading={isRefreshing}
      onClick={handleRefresh}
      className="tournament__refresh"
    >
      {isRefreshing ? 'Refreshing…' : 'Refresh'}
    </ButtonComponent>
  )
}

export default TournamentRefreshButton
