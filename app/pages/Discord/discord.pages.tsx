'use client'

import { useDocumentTitle } from '@hooks/use-document-title'
import './discord.styles.css'
import DiscordLoadingView from './discord-loading.view'
import { useDiscordLogin } from './use-discord-login'

const DiscordPage = () => {
  useDocumentTitle('Sign in')
  const { loadingState, errorMessage } = useDiscordLogin()

  return (
    <DiscordLoadingView
      loadingState={loadingState}
      errorMessage={errorMessage}
    />
  )
}

export default DiscordPage
