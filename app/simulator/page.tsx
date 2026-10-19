import { getTranslations } from 'next-intl/server'
import { Header } from '@ui/header'
import { pageMetadata } from '@utils/metadata'
import { SimulatorLoader } from './simulator.loader'

export async function generateMetadata() {
  const t = await getTranslations('Simulator')
  return pageMetadata({ title: t('title'), path: '/simulator', description: t('meta') })
}

const SimulatorPage = () => (
  <>
    <Header />
    <main className="min-h-dvh pt-16">
      <SimulatorLoader />
    </main>
  </>
)

export default SimulatorPage
