import HomePage from './home'
import { pageMetadata } from '@utils/metadata'

export const metadata = pageMetadata({
  title: 'YGO Omega: Free Yu-Gi-Oh! Simulator with Automatic Tournaments',
  path: '/',
  description:
    'Free Yu-Gi-Oh! simulator with every card unlocked, Bo3 ranked with Elo, automatic Swiss tournaments, and TCG, OCG, GOAT and Edison formats.',
  absoluteTitle: true,
})

export default function Home() {
  return <HomePage />
}
