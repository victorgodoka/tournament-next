import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { pageMetadata } from '@utils/metadata'
import { getCatalog } from '@utils/shop'
import { Inventory } from './Inventory'

export const metadata = pageMetadata({ title: 'Inventory', path: '/inventory', noIndex: true })

/** The catalog only lends the type labels and slots; with the API down the grid still lists raw types. */
const InventoryRoute = async () => {
  const types = await getCatalog()
    .then((c) => c.types)
    .catch((error) => {
      console.error(error)
      return []
    })
  return (
    <>
      <Header />
      <Inventory types={types} />
      <Footer />
    </>
  )
}

export default InventoryRoute
