import { pageMetadata } from '@lib/page-metadata'
import { SITE_TITLE } from '@lib/site-config'
import HomePage from './home/home.pages'

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
