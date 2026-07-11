'use client'

import './discord.styles.css'
import DiscordLoadingView from './discord-loading.view'
import { useDiscordLogin } from '@hooks/use-discord-login'

const DiscordPageClient = () => {
  const { loadingState, errorMessage } = useDiscordLogin()

  return (
    <DiscordLoadingView
      loadingState={loadingState}
      errorMessage={errorMessage}
    />
  )
}

export default DiscordPageClient
