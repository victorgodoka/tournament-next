import { pageMetadata } from '@lib/page-metadata'
import HomePage from './home/home.pages'

export const metadata = pageMetadata(
  'Home',
  'The competitive hub for tournaments, player rankings, and powerful tools.',
)

export default function Home() {
  return <HomePage />
}
