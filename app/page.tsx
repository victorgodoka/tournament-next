import HomePage from './home'
import { pageMetadata } from '@utils/metadata'
import { SITE_TITLE } from '@utils/config'

export const metadata = pageMetadata({
  title: SITE_TITLE,
  path: '/',
  description:
    'The competitive hub for Yu-Gi-Oh! tournaments, player rankings, deck tools, and live events on YGO Omega.',
  absoluteTitle: true,
})

export default function Home() {
  return <HomePage />
}
