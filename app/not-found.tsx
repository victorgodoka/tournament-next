import { pageMetadata } from '@lib/page-metadata'
import NotFoundPage from './not-found-page'

export const metadata = pageMetadata('Page Not Found')

export default function NotFound() {
  return <NotFoundPage />
}
