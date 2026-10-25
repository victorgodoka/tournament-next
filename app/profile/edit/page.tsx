import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { pageMetadata } from '@utils/metadata'
import { EditProfile } from './EditProfile'

export const metadata = pageMetadata({ title: 'Edit profile', path: '/profile/edit', noIndex: true })

const EditProfileRoute = () => {
  return (
    <>
      <Header />
      <main className="min-h-dvh bg-space-000 pt-16">
        <EditProfile />
      </main>
      <Footer className="pb-32 sm:pb-32" />
    </>
  )
}

export default EditProfileRoute
