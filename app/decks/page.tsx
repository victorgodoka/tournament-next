import { noIndexMetadata } from '@lib/page-metadata'
import { getSessionToken } from '@lib/session.server'
import DecksPageClient from './decks.client'
import './decks.styles.css'
import { getDecksInfo, getSavedDecks } from './decks.api'
import { EMPTY_DECK_INFO } from './decks.const'
import { firstParam, parseDeckQueryParams } from './decks.utils'

export const metadata = noIndexMetadata(
  'Decks',
  '/decks',
  'Browse and manage your Yu-Gi-Oh! decks on YGO Omega.',
)

/** Next may repeat a key (`?x=a&x=b`) — every value is string | string[]. */
type DecksSearchParams = Record<string, string | string[] | undefined>

const DecksPage = async ({
  searchParams,
}: {
  searchParams: Promise<DecksSearchParams>
}) => {
  const [params, token] = await Promise.all([searchParams, getSessionToken()])
  const query = parseDeckQueryParams(params)
  const notice = firstParam(params.notice)

  const [result, infoResult] = await Promise.all([
    getSavedDecks(query, token),
    getDecksInfo(),
  ])

  return (
    <DecksPageClient
      initialData={result.ok ? result.data : null}
      initialError={result.ok ? null : result.message}
      initialInfo={infoResult.ok ? infoResult.data : EMPTY_DECK_INFO}
      initialQuery={query}
      initialNotice={notice ?? null}
    />
  )
}

export default DecksPage
