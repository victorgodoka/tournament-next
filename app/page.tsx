import HomePage from './home'
import { pageMetadata } from '@utils/metadata'

export const metadata = pageMetadata({
  title: 'YGO Omega: Free Yu-Gi-Oh! Simulator with Automatic Tournaments',
  path: '/',
  description:
    'Download YGO Omega, the free Yu-Gi-Oh! simulator for Windows, Mac, Linux, Android and iOS: every card unlocked, Elo ranked and automatic tournaments.',
  absoluteTitle: true,
})

export default function Home() {
  return <HomePage />
}
