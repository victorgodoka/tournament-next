import { pageMetadata } from '@lib/page-metadata'
import ProfileIndexClient from './profile-index.client'
import './profile.styles.css'

export const metadata = pageMetadata({
  title: 'Profile',
  path: '/profile',
  description:
    'Find Yu-Gi-Oh! player profiles, ratings, match history, and saved decks on YGO Omega.',
})

export default function ProfilePage() {
  return <ProfileIndexClient />
}
