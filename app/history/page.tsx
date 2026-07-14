import { pageMetadata } from '@lib/page-metadata'
import { getTournaments } from './history.api'
import { HISTORY_PAGE_LIMIT } from './history.const'
import HistoryPageClient from './history-page.client'
import './history.styles.css'

export const metadata = pageMetadata({
  title: 'Tournament History',
  path: '/history',
  description:
    'Browse past and live Yu-Gi-Oh! tournaments on YGO Omega — rounds, banlists, and results.',
})

export default async function HistoryPage() {
  const result = await getTournaments({ page: 1, limit: HISTORY_PAGE_LIMIT })

  return (
    <HistoryPageClient
      initialData={result.ok ? result.data.data : null}
      initialError={result.ok ? null : result.message}
    />
  )
}
