import { pageMetadata } from '@lib/page-metadata'
import TermsPage from './terms-page'

export const metadata = pageMetadata({
  title: 'Terms of Service',
  path: '/terms',
  description:
    'Terms of Service for the YGO Omega tournament platform operated by Duelists Unite.',
})

export default function TermsRoute() {
  return <TermsPage />
}
