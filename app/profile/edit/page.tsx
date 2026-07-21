import WipComponent from '@components/wip/wip.component'
import { noIndexMetadata } from '@lib/page-metadata'
import './profile-edit.styles.css'
export const metadata = noIndexMetadata(
  'Edit Profile',
  '/profile/edit',
  'Edit your YGO Omega player profile settings.',
)

const ProfileEditPage = () => {
  return (
    <WipComponent
      title="Edit Profile"
      description="Profile editing is coming soon."
    />
  )
}

export default ProfileEditPage;