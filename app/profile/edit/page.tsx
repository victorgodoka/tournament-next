import { noIndexMetadata } from '@lib/page-metadata'

export const metadata = noIndexMetadata(
  'Edit Profile',
  '/profile/edit',
  'Edit your YGO Omega player profile settings.',
)

export default function ProfileEditPage() {
  return (
    <div className="omega-container">
      <h1>Edit Profile</h1>
      <p>Profile editing is coming soon.</p>
    </div>
  )
}
