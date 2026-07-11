import { pageMetadata } from '@lib/page-metadata'
import ProfileIndexClient from './profile-index.client'
import './profile.styles.css'

export const metadata = pageMetadata(
  'Profile',
  'View player profiles, ratings, and tournament records.',
)

export default function ProfilePage() {
  return <ProfileIndexClient />
}
