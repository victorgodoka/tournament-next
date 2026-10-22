import { getTranslations } from 'next-intl/server'
import { Header } from '@ui/header'
import { pageMetadata } from '@utils/metadata'
import { SimulatorLoader } from './simulator.loader'
import { VipPromo } from '@omega/ads/vip-promo'

export async function generateMetadata() {
  const t = await getTranslations('Simulator')
  return pageMetadata({ title: t('title'), path: '/simulator', description: t('meta') })
}

const SimulatorPage = () => (
  <>
    <Header />
    {/* Clipped sideways at the viewport edge, not the board's: a card sliding in from a pile would widen the page for a
        moment, and the edge cards' focus rings still fit in the gutter. `clip` scrolls nothing and keeps `sticky` working. */}
    <main data-clear-gutters className="min-h-dvh overflow-x-clip pt-16">
      <SimulatorLoader />
      {/* No footer on this page: our VIP pitch goes at the end instead. */}
      <VipPromo className="mx-auto my-12 w-[min(var(--container-page),calc(100%-32px))]" />
    </main>
  </>
)

export default SimulatorPage
