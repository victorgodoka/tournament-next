import { Icon } from '@iconify/react/offline'

import ButtonComponent from '@components/button/button.component'
import IconComponent from '../../components/icon/icon.component'

type TournamentErrorProps = {
  message: string
}

const TournamentError = ({ message }: TournamentErrorProps) => {
  return (
    <div
      className="tournament tournament--empty"
      aria-labelledby="tournament-error-title"
    >
      

      <div className="tournament__empty omega-container omega-container--narrow">
        <span className="tournament__empty-icon-wrap" aria-hidden="true">
          <IconComponent icon="mdi:trophy-broken" className="tournament__empty-icon" />
        </span>
        <h1 id="tournament-error-title" className="tournament__empty-title">
          Tournament unavailable
        </h1>
        <p className="tournament__empty-description">{message}</p>
        <div className="tournament__empty-actions">
          <ButtonComponent to="/history" variant="primary" icon="mdi:trophy-outline">
            Tournament History
          </ButtonComponent>
          <ButtonComponent to="/" variant="secondary" icon="mdi:home">
            Back to Home
          </ButtonComponent>
        </div>
      </div>
    </div>
  )
}

export default TournamentError
