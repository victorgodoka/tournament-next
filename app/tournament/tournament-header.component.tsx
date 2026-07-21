import { Icon } from '@iconify/react/offline'
import type { Tournament, TournamentSettings } from './tournament.types'
import { formatTournamentDateTime } from './tournament-page.utils'
import IconComponent from '../../components/icon/icon.component'

type TournamentHeaderProps = {
  tournament: Tournament
  settings: TournamentSettings | null
  finished: boolean
}

const TournamentHeader = ({
  tournament,
  settings,
  finished,
}: TournamentHeaderProps) => {
  return (
    <header className="tournament__info">
      <span
        className={
          finished
            ? 'tournament__status tournament__status--completed'
            : 'tournament__status tournament__status--live'
        }
      >
        {finished ? null : (
          <span className="tournament__status-dot" aria-hidden="true" />
        )}
        {finished ? 'Completed' : 'Live'}
      </span>

      <h1 className="tournament__title">Tournament #{tournament.id}</h1>

      <div className="tournament__schedule">
        <div className="tournament__schedule-row">
          <IconComponent icon="mdi:calendar-start" aria-hidden="true" />
          <span>Started</span>
          <span>{formatTournamentDateTime(tournament.starttime)}</span>
        </div>
        <div className="tournament__schedule-row">
          <IconComponent icon="mdi:calendar-check" aria-hidden="true" />
          {finished ? (
            <>
              <span>Ended</span>
              <span>{formatTournamentDateTime(tournament.endtime)}</span>
            </>
          ) : (
            <span>In progress</span>
          )}
        </div>
      </div>

      <ul className="tournament__badges" aria-label="Tournament rules">
        <li className="omega-badge omega-badge--secondary">
          <IconComponent icon="mdi:shield-outline" aria-hidden="true" />
          {tournament.banlist}
        </li>
        {settings ? (
          <li className="omega-badge omega-badge--secondary">
            <IconComponent icon="mdi:earth" aria-hidden="true" />
            {settings.region}
          </li>
        ) : null}
        {settings ? (
          <li className="omega-badge omega-badge--secondary">
            <IconComponent icon="mdi:book-open-variant" aria-hidden="true" />
            Master Rule {settings.mr}
          </li>
        ) : null}
      </ul>
    </header>
  )
}

export default TournamentHeader
