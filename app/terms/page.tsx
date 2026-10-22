import { getLocale } from 'next-intl/server'
import { LegalPage } from '@omega/legal/legal-page'
import { LEGAL_UPDATED } from '@utils/const'
import { pageMetadata } from '@utils/metadata'
import { en } from './terms.en'
import { pt } from './terms.pt'

const localDoc = async () => ((await getLocale()) === 'pt' ? pt : en)

export async function generateMetadata() {
  const { title, description } = await localDoc()
  return pageMetadata({ title, path: '/terms', description })
}

const TermsPage = async () => <LegalPage doc={await localDoc()} updated={LEGAL_UPDATED.terms} />

export default TermsPage
