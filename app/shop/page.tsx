import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
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

/** The page still renders with the API down; the empty state says there is nothing on sale. */
const catalog = () =>
  getCatalog().catch((error) => {
    console.error(error)
    return EMPTY
  })

const ShopPageRoute = async () => (
  <>
    <Header />
    <main className="flex min-h-dvh flex-col overflow-x-hidden pt-16 pb-[clamp(56px,7vw,96px)]">
      <ShopBrowser catalog={await catalog()} />
    </main>
    <Footer />
  </>
)

export default ShopPageRoute
