import { useMemo } from 'react'
import Link from 'next/link'
import { Icon } from '@iconify/react/offline'
import AvatarComponent from '@components/avatar/avatar.component'
import { discordAvatar } from '@assets/discord.avatar'
import type { TournamentDetail } from './tournament.types'
import { calculateTiebreakers } from './tournament.utils'
import { getUserDisplayName } from './tournament-page.utils'
import { cn } from "@sglara/cn";

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
            <th scope="col" className="tournament-table__position-header omega-hide-md-down">
              #
            </th>
            <th scope="col">Player</th>
            <th scope="col" className="omega-hide-md-down">
              <abbr title="Wins–Losses–Draws">W-L-D</abbr>
            </th>
            <th scope="col" className="omega-hide-md-down">
              <abbr title="Win rate">W/R</abbr>
            </th>
            <th scope="col" className="omega-hide-md-down">Rating</th>
            <th scope="col">Tiebreaker</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((player, index) => {
            const position = index + 1
            const name = getUserDisplayName(player)
            const roundLabel = player.droppedRounds === 1 ? 'round' : 'rounds'

            return (
              <tr
                key={player.id}
                className={
                  cn({ "tournament-table__row--dropped": player.dropped })
                }
              >
                <td
                  className={
                    cn("tournament-table__position omega-hide-md-down", {
                      "tournament-table__position--podium": position <= 3
                    })
                  }
                >
                  {position}
                </td>
                <td>
                  <div className="tournament-table__player-stack">
                    <div className="tournament-table__player-cell">
                      <Link
                        href={`/profile/${player.id}`}
                        className="tournament-table__player"
                      >
                        <AvatarComponent
                          src={discordAvatar(player.id, player.avatar ?? '')}
                          alt={name}
                          size="sm"
                          shape="circle"
                        />
                        <div className="tournament-table__player-names">
                          <span className="tournament-table__player-name">
                            {name}
                          </span>
                          <span className="tournament-table__player-username">
                            @{player.username}
                          </span>
                        </div>
                      </Link>
                      {player.dropped ? (
                        <span
                          className="tournament-table__drop"
                          title={`Dropped — ${player.droppedRounds} missed ${roundLabel} counted as losses`}
                        >
                          <Icon
                            icon="mdi:exit-run"
                            width={13}
                            height={13}
                            aria-hidden="true"
                          />
                          Dropped
                        </span>
                      ) : null}
                    </div>
                    <div className="omega-cluster omega-hide-md-up tournament-table__meta">
                      <span className="tournament-table__record">
                        <span className="visually-hidden">Record </span>
                        <span className="tournament-table__record-wins">
                          {player.wins}
                        </span>
                        <span aria-hidden="true">-</span>
                        <span
                          className="tournament-table__record-losses"
                          title={
                            player.dropped
                              ? `Includes ${player.droppedRounds} drop ${roundLabel}`
                              : undefined
                          }
                        >
                          {player.losses}
                        </span>
                        <span aria-hidden="true">-</span>
                        <span className="tournament-table__record-draws">
                          {player.draws}
                        </span>
                      </span>
                      <span className="tournament-table__numeric">
                        <span className="visually-hidden">Win rate </span>
                        {player.winPercentage}%
                      </span>
                      <span className="tournament-table__numeric">
                        <span className="visually-hidden">Rating </span>
                        {Math.round(player.rating)}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="tournament-table__record omega-hide-md-down">
                  <span className="tournament-table__record-wins">
                    {player.wins}
                  </span>
                  <span aria-hidden="true">-</span>
                  <span
                    className="tournament-table__record-losses"
                    title={
                      player.dropped
                        ? `Includes ${player.droppedRounds} drop ${roundLabel}`
                        : undefined
                    }
                  >
                    {player.losses}
                  </span>
                  <span aria-hidden="true">-</span>
                  <span className="tournament-table__record-draws">
                    {player.draws}
                  </span>
                </td>
                <td className="tournament-table__numeric omega-hide-md-down">
                  {player.winPercentage}%
                </td>
                <td className="tournament-table__numeric omega-hide-md-down">
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
