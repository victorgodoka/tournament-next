import Link from 'next/link'
import { AnalyticsShell } from '@app/profile/analytics/AnalyticsShell'
import { ExplorationCard } from '@omega/analytics/explorer/exploration-card'
import { EmptyBox } from '@omega/profile/empty-box'
import { getGlobalVariables, globalPath, listGlobalExplorations } from '@utils/global-explorer'
import { pageMetadata } from '@utils/metadata'

export const metadata = pageMetadata({
  title: 'Analytics',
  path: '/analytics',
  description: 'Server-wide ranked analytics — meta share, matchups, engines and hand traps.',
})

/** The staff-built server-wide explorations. Duelists' own published ones live on /analytics/explorations. */
const AnalyticsPage = async () => {
  const [global, variables] = await Promise.all([listGlobalExplorations(), getGlobalVariables()])

  return (
    <AnalyticsShell
      eyebrow="Server-wide analytics"
      meta="Ranked games · updated once a day"
      title="Server-wide"
      aside={
        <p className="max-w-[46ch] text-ink-dim body-sm">
          Every ranked duel, one sample per deck per game: meta share, matchups, engines, techs and hand traps. Built by staff.
          Duelists&apos; own explorations are on <Link href="/analytics/explorations" className="text-cyan hover:underline">Explorations</Link>.
        </p>
      }
    >
      {global.length ? (
        <ul className="mt-8 grid gap-px border border-line bg-line md:grid-cols-2 xl:grid-cols-3">
          {global.map((e) => (
            <ExplorationCard key={e.id} exploration={e} variables={variables} href={globalPath(e.id)} />
          ))}
        </ul>
      ) : (
        <EmptyBox title="Nothing published yet" className="mt-8">
          Server-wide explorations show up here as soon as staff publish one.
        </EmptyBox>
      )}
    </AnalyticsShell>
  )
}

export default AnalyticsPage
