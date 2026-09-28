import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { pageMetadata } from '@utils/metadata'
import { getCatalog } from '@utils/shop'
import { EditProfile } from './EditProfile'

export const metadata = pageMetadata({ title: 'Edit profile', path: '/profile/edit', noIndex: true })

/** The catalog only lends the loadout its slot names; with the shop API down the section lists nothing. */
const EditProfileRoute = async () => {
  const types = await getCatalog()
    .then((c) => c.types)
    .catch((error) => {
      console.error(error)
      return []
    })
  return (
    <>
      <Header />
      <main className="min-h-dvh bg-space-000 pt-16">
        <EditProfile types={types} />
      </main>
      <Footer className="pb-32 sm:pb-32" />
    </>
  )
}

export default EditProfileRoute
