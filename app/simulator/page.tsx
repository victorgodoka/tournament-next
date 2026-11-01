import { getTranslations } from 'next-intl/server'
import { pageMetadata } from '@utils/metadata'
import { SimulatorLoader } from './simulator.loader'

export async function generateMetadata() {
  const t = await getTranslations('Simulator')
  return pageMetadata({ title: t('title'), path: '/simulator', description: t('meta') })
}

/** The stage is the whole page: no site header, no footer, no ads. Its Home button leads back. */
const SimulatorPage = () => <SimulatorLoader />

export default SimulatorPage
