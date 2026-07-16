import { Icon } from '@iconify/react'
import type { Round, TournamentUser } from './tournament.types'
import { getUserDisplayName, sortRoundsDescending } from './tournament-page.utils'
import TournamentDuel from './tournament-duel.component'
import IconComponent from '../../components/icon/icon.component'

type TournamentBracketsProps = {
  rounds: Round[]
  users: Map<string, TournamentUser>
}

const TournamentBrackets = ({ rounds, users }: TournamentBracketsProps) => {
  const sortedRounds = sortRoundsDescending(rounds)

  if (sortedRounds.length === 0) {
    return (
      <div className="tournament__panel-empty" role="status">
        <IconComponent
          icon="mdi:tournament"
          className="tournament__panel-empty-icon"
          aria-hidden="true"
        />
        <p>No rounds have been played yet.</p>
      </div>
    )
  }

  return (
    <div className="tournament__rounds">
      {sortedRounds.map((round, index) => (
        <details
          key={round.id}
          className="tournament-round"
          open={index === 0}
        >
          <summary className="tournament-round__summary">
            <span className="tournament-round__label">Round {round.phase}</span>
            <span className="tournament-round__meta">
              {round.duels.length} {round.duels.length === 1 ? 'duel' : 'duels'}
            </span>
            <IconComponent
              icon="mdi:chevron-down"
              className="tournament-round__chevron"
              aria-hidden="true"
            />
          </summary>

          {round.bye ? (
            <p className="tournament-round__bye">
              <IconComponent icon="mdi:seat-outline" aria-hidden="true" />
              Bye: {getUserDisplayName(users.get(round.bye))}
            </p>
          ) : null}

          <ul className="tournament-round__duels">
            {round.duels.map((duel) => (
              <li key={duel.room_id}>
                <TournamentDuel duel={duel} users={users} />
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  )
}

export default TournamentBrackets
