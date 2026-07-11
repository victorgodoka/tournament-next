import { pageMetadata } from '@lib/page-metadata'
import DiscordPageClient from './discord-page.client'

export const metadata = pageMetadata('Sign in')

export default function DiscordPage() {
  return <DiscordPageClient />
}
