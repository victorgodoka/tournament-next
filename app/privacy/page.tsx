import { pageMetadata } from '@lib/page-metadata'
import PrivacyPage from './privacy-page'

export const metadata = pageMetadata({
  title: 'Privacy Policy',
  path: '/privacy',
  description:
    'How Duelists Unite collects, uses, and protects your information on the YGO Omega tournament platform.',
})

export default function PrivacyRoute() {
  return <PrivacyPage />
}
