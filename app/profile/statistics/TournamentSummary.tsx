import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { Panel } from '@ui/panel'
import { StatGrid } from '@ui/stat-grid'
import type { PlayerTournaments } from '@utils/types'

/** The profile's tournament totals and its 3 latest entries, above the detailed report. */
export const TournamentSummary = async ({ tournaments }: { tournaments: PlayerTournaments }) => {
  const t = await getTranslations('PlayerStatistics.tournaments')
  const locale = await getLocale()
  if (!tournaments.played) return null
  const { wins, loses, draws } = tournaments
  const total = wins + loses + draws
  return (
    <div className="grid grid-cols-1 gap-4 min-[1200px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <StatGrid
        columns={3}
        items={[
          { label: t('played'), value: tournaments.played },
          { label: t('titles'), value: tournaments.titles },
          { label: t('record'), value: `${wins}-${loses}-${draws}`, hint: total ? `${((wins / total) * 100).toFixed(1)}%` : undefined },
        ]}
      />
      <Panel title={t('recent')}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-ink-muted signal-sm">
              <tr>
                <th className="pb-2 font-normal">{t('cols.tournament')}</th>
                <th className="pb-2 font-normal">{t('cols.format')}</th>
                <th className="pb-2 text-right font-normal">{t('cols.place')}</th>
                <th className="pb-2 text-right font-normal">{t('cols.players')}</th>
                <th className="pb-2 text-right font-normal">{t('cols.date')}</th>
              </tr>
            </thead>
            <tbody>
              {tournaments.recent.map(({ tournament, standing }) => (
                <tr key={tournament.id} className="border-t border-line">
                  <td className="py-2"><Link href={`/tournament/${tournament.id}`} className="font-semibold text-ink hover:text-cyan">#{tournament.id}</Link></td>
                  <td className="py-2 text-ink-dim">{tournament.format}</td>
                  <td className={standing.rank <= 3 ? 'py-2 text-right font-bold text-gold' : 'py-2 text-right text-ink'}>{t('place', { rank: standing.rank })}</td>
                  <td className="py-2 text-right text-ink-dim tabular-nums">{tournament.players}</td>
                  <td className="py-2 text-right font-mono text-xs text-ink-muted">
                    {new Date(tournament.endedAt ?? tournament.startedAt).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
