import { Footer } from '@ui/footer'
import { pageMetadata } from '@utils/metadata'
import { getCatalog } from '@utils/shop'
import type { ShopCatalog } from '@utils/types'
import { ShopBrowser } from './ShopBrowser'

export const metadata = pageMetadata({
  title: 'Shop',
  path: '/shop',
  description:
    'Spend Duel Points on YGO Omega cosmetics: profile frames, page backgrounds, songs, messenger bubbles, custom ranked badges and animated favorites.',
})

const EMPTY: ShopCatalog = { items: [], types: [], categories: [] }

/** The page still renders with the API down; the empty state says there is nothing on sale. `readAt` stamps the read. */
const catalog = () =>
  getCatalog()
    .catch((error) => {
      console.error(error)
      return EMPTY
    })
    .then((data) => ({ data, readAt: new Date().toISOString() }))

const ShopPageRoute = async () => {
  const { data, readAt } = await catalog()
  return (
    <>
      <ShopBrowser catalog={data} readAt={readAt} />
      <Footer />
    </>
  )
}

export default ShopPageRoute
