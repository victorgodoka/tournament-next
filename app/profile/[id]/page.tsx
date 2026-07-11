import type { Metadata } from 'next'
import { pageMetadata } from '@lib/page-metadata'
import ProfilePageClient from './profile-page.client'
import { ProfilePageProps } from '../profile.types'
import '../profile.styles.css'

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { id } = await params
  return pageMetadata('Profile', `Player profile for ${id}`)
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params

  return <ProfilePageClient profileId={id} />
}
