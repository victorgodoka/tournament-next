import { noIndexMetadata } from '@lib/page-metadata'
import DiscordPageClient from './discord-page.client'

export const metadata = noIndexMetadata(
  'Sign in',
  '/discord',
  'Sign in to YGO Omega with your Discord account.',
)

export default function DiscordPage() {
  return <DiscordPageClient />
}
