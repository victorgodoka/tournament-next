import { noIndexMetadata } from '@lib/page-metadata'
import NotFoundPage from './not-found-page'

export const metadata = noIndexMetadata(
  'Page Not Found',
  '/404',
  'The page you are looking for could not be found on YGO Omega.',
)

export default function NotFound() {
  return <NotFoundPage />
}
