import { redirect } from 'next/navigation'

/** `/profile` carries no player, so there is nothing to show: send them home. */
const ProfileIndex = () => redirect('/')

export default ProfileIndex
