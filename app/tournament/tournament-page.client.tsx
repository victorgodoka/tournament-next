'use client'

import { useMemo, useState } from 'react'
import type { TournamentDetail, TournamentUser } from './tournament.types'
import {
  buildUserMap,
  isTournamentFinished,
  parseTournamentSettings,
} from './tournament-page.utils'
import TournamentError from './tournament-error.component'
import TournamentHeader from './tournament-header.component'
import TournamentPlayers from './tournament-players.component'
import TournamentTabs, { type TournamentTabId } from './tournament-tabs.component'
import TournamentBrackets from './tournament-brackets.component'
import TournamentTable from './tournament-table.component'
import TournamentTopCut from './tournament-topcut.component'
import TournamentData from './tournament-data.component'
import TournamentRefreshButton from './tournament-refresh-button.component'
import { BackdropComponent } from '@components'

type TournamentPageClientProps = {
  detail: TournamentDetail | null
  error: string | null
}

const TournamentPageClient = ({ detail, error }: TournamentPageClientProps) => {
  const [activeTab, setActiveTab] = useState<TournamentTabId>('brackets')

  const userMap = useMemo(
    () => buildUserMap(detail?.users ?? ([] as TournamentUser[])),
    [detail],
  )

  if (error || !detail) {
    return (
      <TournamentError message={error || 'This tournament could not be found.'} />
    )
  }

  const { tournament, rounds, users } = detail
  const finished = isTournamentFinished(tournament)
  const settings = parseTournamentSettings(tournament.settings)

  return (
    <div className="tournament">
      <BackdropComponent />

      <div className="tournament__content omega-container">
        {!finished && (
          <div className="tournament__toolbar">
            <TournamentRefreshButton />
          </div>
        )}

        <section
          className="tournament__hero omega-surface"
          aria-label="Tournament overview"
        >
          <TournamentHeader
            tournament={tournament}
            settings={settings}
            finished={finished}
          />
          <TournamentPlayers users={users} />
        </section>

        <TournamentTabs
          finished={finished}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <div
          className="tournament__panel"
          role="tabpanel"
          id="tournament-panel"
          aria-labelledby={`tournament-tab-${activeTab}`}
        >
          {activeTab === 'brackets' ? (
            <TournamentBrackets rounds={rounds} users={userMap} />
          ) : null}
          {activeTab === 'table' ? <TournamentTable detail={detail} /> : null}
          {activeTab === 'topcut' ? <TournamentTopCut {...detail} /> : null}
          {activeTab === 'data' ? (
            <TournamentData data={detail.topcutData} />
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default TournamentPageClient
