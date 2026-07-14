import { AvatarComponent } from '@components'
import { discordAvatar } from '@assets/discord.avatar'
import type { TournamentUser } from './tournament.types'
import {
  getOverflowPlayerCount,
  getUserDisplayName,
  getVisiblePlayers,
} from './tournament-page.utils'

type TournamentPlayersProps = {
  users: TournamentUser[]
}

const TournamentPlayers = ({ users }: TournamentPlayersProps) => {
  const visiblePlayers = getVisiblePlayers(users)
  const overflowCount = getOverflowPlayerCount(users)

  return (
    <section className="tournament__players" aria-label="Players">
      <header className="tournament__players-header">
        <h2 className="tournament__players-title">Players</h2>
        <span className="tournament__players-count">{users.length}</span>
      </header>

      {users.length === 0 ? (
        <p className="tournament__players-empty">No players registered yet.</p>
      ) : (
        <ul className="tournament__players-stack">
          {visiblePlayers.map((user) => {
            const name = getUserDisplayName(user)

            return (
              <li
                key={user.user_id}
                className="tournament__players-item"
                title={name}
              >
                <AvatarComponent
                  src={discordAvatar(user.user_id, user.avatar)}
                  alt={name}
                  size="md"
                  shape="circle"
                />
              </li>
            )
          })}
          {overflowCount > 0 ? (
            <li className="tournament__players-item">
              <span
                className="tournament__players-overflow"
                aria-label={`${overflowCount} more players`}
              >
                +{overflowCount}
              </span>
            </li>
          ) : null}
        </ul>
      )}
    </section>
  )
}

export default TournamentPlayers
