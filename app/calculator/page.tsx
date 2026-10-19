import { getTranslations } from 'next-intl/server'
import { Header } from '@ui/header'
import { pageMetadata } from '@utils/metadata'
import { CalculatorLoader } from './calculator.loader'

export async function generateMetadata() {
  const t = await getTranslations('Calculator')
  return pageMetadata({ title: t('title'), path: '/calculator', description: t('meta') })
}

const CalculatorPage = () => (
  <>
    <Header />
    <main className="min-h-dvh pt-16">
      <CalculatorLoader />
    </main>
  </>
)

export default CalculatorPage
