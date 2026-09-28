import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { AnalyticsShell, defaultSegment, duelistLabel, loadPastSeasons, personOf, segmentOptions } from '@app/profile/analytics/AnalyticsShell'
import { ExplorationBuilder } from '@omega/analytics/explorer/builder'
import { PrivateNotice } from '@omega/profile/private-notice'
import { listPeriods } from '@utils/analytics'
import { getExplorations, getVariables } from '@utils/explorations'
import { getProfile } from '@utils/profile'
import { pageMetadata } from '@utils/metadata'

type AnalyticsRouteProps = { params: Promise<{ id: string }> }

const loadProfile = async (id: string) => getProfile(id, (await headers()).get('cookie'))

export async function generateMetadata({ params }: AnalyticsRouteProps) {
  const { id } = await params
  const profile = await loadProfile(id)
  const path = `/profile/${id}/analytics`
  if (!profile) return pageMetadata({ title: 'Profile not found', path, noIndex: true })
  const name = duelistLabel(profile)
  return pageMetadata({
    title: `${name} · Analytics`,
    path,
    description: `Explorations ${name} built from their ranked games: matchups, decks, card usage, hand traps and rating.`,
    noIndex: profile.isPrivate,
  })
}

const AnalyticsRoute = async ({ params }: AnalyticsRouteProps) => {
  const { id } = await params
  const cookie = (await headers()).get('cookie')
  const profile = await loadProfile(id)
  if (!profile) notFound()
  // Public explorations are listed even on a private profile: publishing is the owner's call.
  const [list, variables, past, periods] = await Promise.all([getExplorations(id, cookie), getVariables(), loadPastSeasons(), listPeriods()])
  if (list === null) notFound()
  const shown = list === 'forbidden' ? null : list
  const owner = !!shown?.editable

  return (
    <AnalyticsShell
      person={personOf(profile)}
      eyebrow="Duelist analytics"
      back={{ href: `/profile/${id}`, label: 'Back to profile' }}
      meta="Live · updates within 5 minutes"
      aside={
        shown ? (
          <div className={twMerge('w-full max-w-[330px] border px-3.5 py-3', owner ? 'border-cyan bg-ground-cyan' : 'border-line bg-surface-100')}>
            <p className={twMerge('signal-sm', owner ? 'text-cyan' : 'text-ink-muted')}>{owner ? 'Your page · you build here' : 'Read only'}</p>
            <p className="mt-1.5 text-ink-dim caption">
              {owner
                ? 'Each exploration is private, shared by link, or public on this page and the public feed. Unsaved changes stay with you.'
                : `Explorations ${duelistLabel(profile)} made public. Only the owner can change them.`}{' '}
              <Link href={`/profile/${id}/explorations`} className="text-cyan hover:text-cyan">All explorations →</Link>
            </p>
          </div>
        ) : null
      }
    >
      {!shown ? (
        <PrivateNotice />
      ) : (
        <ExplorationBuilder
          playerId={id}
          name={duelistLabel(profile)}
          list={shown}
          variables={variables}
          options={profile.isPrivate ? [] : segmentOptions(profile, past, periods)}
          defaultSegment={profile.isPrivate ? 'current:tcg' : defaultSegment(profile)}
        />
      )}
    </AnalyticsShell>
  )
}

export default AnalyticsRoute
