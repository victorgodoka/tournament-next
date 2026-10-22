import { getLocale } from 'next-intl/server'
import { LegalPage } from '@omega/legal/legal-page'
import { LEGAL_UPDATED } from '@utils/const'
import { pageMetadata } from '@utils/metadata'
import { en } from './privacy.en'
import { pt } from './privacy.pt'

const localDoc = async () => ((await getLocale()) === 'pt' ? pt : en)

export async function generateMetadata() {
  const { title, description } = await localDoc()
  return pageMetadata({ title, path: '/privacy', description })
}

const PrivacyPage = async () => <LegalPage doc={await localDoc()} updated={LEGAL_UPDATED.privacy} />

export default PrivacyPage
