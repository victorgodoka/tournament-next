import AvatarComponent from '@components/avatar/avatar.component'
import { discordAvatar } from '@assets/discord.avatar'
import type { Duel, TournamentDuelProps, TournamentUser } from './tournament.types'
import { getDuelOutcome, getUserDisplayName } from './tournament-page.utils'
import Link from 'next/dist/client/link'
import Image from 'next/image'
import { cn } from '@sglara/cn'

type DuelSeatResult = 'winner' | 'loser' | 'bye' | null

type TournamentDuelSeatProps = {
  userId: string
  user: TournamentUser | undefined
  result: DuelSeatResult
  isBye?: boolean
}

const TournamentDuelSeat = ({ userId, user, result, isBye }: TournamentDuelSeatProps) => {
  const name = getUserDisplayName(user)

  if (user?.isBye || isBye) return;

  return (
    <Link
      href={`/profile/${userId}`}
      className={cn(
        "tournament-duel__seat",
        result && `tournament-duel__seat--${result}`,
      )}
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
      {result === 'bye' ? (
        <span className="tournament-duel__chip tournament-duel__chip--bye">
          BYE
        </span>
      ) : null}
    </Link>
  )
}

const TournamentDuel = ({ duel, users }: TournamentDuelProps) => {
  const outcome = getDuelOutcome(duel)
  const ongoing = outcome.status === 'ongoing'
  const isBye = duel.duelist2 === 'bye'

  const seatResult = (duelistId: string): DuelSeatResult => {
    if (outcome.status === 'ongoing') return null
    if (outcome.status === 'bye') return 'bye'
    return outcome.winnerId === duelistId ? 'winner' : 'loser'
  }

  return (
    <article
      className={cn("tournament-duel", {
        "tournament-duel--ongoing": ongoing,
      })}
    >
      <div 
        className={cn("tournament-duel__players", {
          "tournament-duel__players--with-bye": isBye,
        })}
      >
        <TournamentDuelSeat
          userId={duel.duelist1}
          user={users.get(duel.duelist1)}
          result={seatResult(duel.duelist1)}
        />
        {!isBye && (
          <Image width={64} height={64} className="tournament-duel__vs" aria-hidden="true" src="/vs.png" alt="vs" />
        )}
        <TournamentDuelSeat
          isBye={isBye}
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
