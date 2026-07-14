import { useMemo } from 'react'
import Link from 'next/link'
import { Icon } from '@iconify/react'
import { AvatarComponent } from '@components'
import { discordAvatar } from '@assets/discord.avatar'
import type { TournamentDetail } from './tournament.types'
import { calculateTiebreakers } from './tournament.utils'

type TournamentTableProps = {
  detail: TournamentDetail
}

const TournamentTable = ({ detail }: TournamentTableProps) => {
  const standings = useMemo(() => calculateTiebreakers(detail), [detail])

  if (standings.length === 0) {
    return (
      <div className="tournament__panel-empty" role="status">
        <Icon
          icon="mdi:podium"
          className="tournament__panel-empty-icon"
          aria-hidden="true"
        />
        <p>No standings available yet.</p>
      </div>
    )
  }

  return (
    <div className="tournament-table__scroll">
      <table className="tournament-table">
        <caption className="visually-hidden">
          Tournament standings sorted by tiebreaker
        </caption>
        <thead>
          <tr>
            <th scope="col" className="tournament-table__position-header">
              #
            </th>
            <th scope="col">Player</th>
            <th scope="col">
              <abbr title="Wins–Losses–Draws">W-L-D</abbr>
            </th>
            <th scope="col">
              <abbr title="Win rate">W/R</abbr>
            </th>
            <th scope="col">Rating</th>
            <th scope="col">Tiebreaker</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((player, index) => {
            const position = index + 1

            return (
              <tr key={player.id}>
                <td
                  className={
                    position <= 3
                      ? 'tournament-table__position tournament-table__position--podium'
                      : 'tournament-table__position'
                  }
                >
                  {position}
                </td>
                <td>
                  <Link
                    href={`/profile/${player.id}`}
                    className="tournament-table__player"
                  >
                    <AvatarComponent
                      src={discordAvatar(player.id, player.avatar ?? '')}
                      alt={player.displayname || player.username}
                      size="sm"
                      shape="circle"
                    />
                    <span className="tournament-table__player-names">
                      <span className="tournament-table__player-name">
                        {player.displayname || player.username}
                      </span>
                      <span className="tournament-table__player-username">
                        @{player.username}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="tournament-table__record">
                  <span className="tournament-table__record-wins">
                    {player.wins}
                  </span>
                  <span aria-hidden="true">-</span>
                  <span className="tournament-table__record-losses">
                    {player.losses}
                  </span>
                  <span aria-hidden="true">-</span>
                  <span className="tournament-table__record-draws">
                    {player.draws}
                  </span>
                </td>
                <td className="tournament-table__numeric">
                  {player.winPercentage}%
                </td>
                <td className="tournament-table__numeric">
                  {Math.round(player.rating)}
                </td>
                <td className="tournament-table__tiebreaker">
                  {player.tiebreaker}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default TournamentTable
