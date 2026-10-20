import { getTranslations } from 'next-intl/server'
import { Header } from '@ui/header'
import { pageMetadata } from '@utils/metadata'
import { CalculatorLoader } from './calculator.loader'
import { VipPromo } from '@omega/ads/vip-promo'

export async function generateMetadata() {
  const t = await getTranslations('Calculator')
  return pageMetadata({ title: t('title'), path: '/calculator', description: t('meta') })
}

const CalculatorPage = () => (
  <>
    <Header />
    <main className="min-h-dvh pt-16">
      <CalculatorLoader />
      {/* No footer on this page: our VIP pitch goes at the end instead. */}
      <VipPromo className="mx-auto my-12 w-[min(1280px,calc(100%-32px))]" />
    </main>
  </>
)

export default CalculatorPage
