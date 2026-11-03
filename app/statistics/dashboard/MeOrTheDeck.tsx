import { headers } from 'next/headers'
import { getMeServer, SESSION_COOKIE, type AuthUser } from '@utils/auth'
import { getPlayerStatistics, type Scope } from '@utils/statistics'
import { MeMessage, MeTable, SignInPrompt } from './MeTable'

type MeProps = { session: AuthUser | null; scope: Scope; cookie: string | null; faces?: Record<string, number | null> }

/** Signed out: the prompt, and no request to the player route, which would only answer 403. */
export const MeOrTheDeck = async ({ session, scope, cookie, faces = {} }: MeProps) => {
  if (!session) return <SignInPrompt />
  const result = await getPlayerStatistics(session.id, scope, cookie)
  if (!result.ok) return <MeMessage text={result.status === 404 ? 'empty' : 'failed'} />
  const { decks, record } = result.data
  return decks.length ? <MeTable decks={decks} scope={scope} faces={faces} who={session.profile?.username ?? null} games={record?.games ?? 0} /> : <MeMessage text="empty" />
}

/** Behind its own Suspense: the rest of the page doesn't wait for the session or the live games. */
export const MeSection = async ({ scope, faces }: { scope: Scope; faces: Record<string, number | null> }) => {
  const cookie = (await headers()).get('cookie')
  const session = cookie?.includes(SESSION_COOKIE) ? await getMeServer(cookie).catch(() => null) : null
  return <MeOrTheDeck session={session} scope={scope} cookie={cookie} faces={faces} />
}
