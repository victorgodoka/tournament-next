import { AvatarComponent } from '@components'
import { discordAvatar } from '@assets/discord.avatar'
import type { Duel, TournamentUser } from './tournament.types'
import { getDuelOutcome, getUserDisplayName } from './tournament-page.utils'

type DuelSeatResult = 'winner' | 'loser' | null

type TournamentDuelSeatProps = {
  userId: string
  user: TournamentUser | undefined
  result: DuelSeatResult
}

const TournamentDuelSeat = ({ userId, user, result }: TournamentDuelSeatProps) => {
  const name = getUserDisplayName(user)

  return (
    <div
      className={
        result
          ? `tournament-duel__seat tournament-duel__seat--${result}`
          : 'tournament-duel__seat'
      }
    >
      <AvatarComponent
        src={user ? discordAvatar(userId, user.avatar) : ''}
        alt={name}
        size="sm"
        shape="circle"
      />
      <span className="tournament-duel__name">{name}</span>
      {result === 'winner' ? (
        <span className="tournament-duel__chip tournament-duel__chip--winner">
          Winner
        </span>
      ) : null}
      {result === 'loser' ? (
        <span className="tournament-duel__chip tournament-duel__chip--loser">
          Defeated
        </span>
      ) : null}
    </div>
  )
}

type TournamentDuelProps = {
  duel: Duel
  users: Map<string, TournamentUser>
}

const TournamentDuel = ({ duel, users }: TournamentDuelProps) => {
  const outcome = getDuelOutcome(duel)
  const ongoing = outcome.status === 'ongoing'

  const seatResult = (duelistId: string): DuelSeatResult => {
    if (outcome.status === 'ongoing') return null
    return outcome.winnerId === duelistId ? 'winner' : 'loser'
  }

  return (
    <article
      className={
        ongoing ? 'tournament-duel tournament-duel--ongoing' : 'tournament-duel'
      }
    >
      <div className="tournament-duel__players">
        <TournamentDuelSeat
          userId={duel.duelist1}
          user={users.get(duel.duelist1)}
          result={seatResult(duel.duelist1)}
        />
        <span className="tournament-duel__vs" aria-hidden="true">
          vs
        </span>
        <TournamentDuelSeat
          userId={duel.duelist2}
          user={users.get(duel.duelist2)}
          result={seatResult(duel.duelist2)}
        />
      </div>

      {ongoing ? (
        <p className="tournament-duel__live">
          <span className="tournament-duel__live-dot" aria-hidden="true" />
          In progress
        </p>
      ) : null}
    </article>
  )
}

export default TournamentDuel
