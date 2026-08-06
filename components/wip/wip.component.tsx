import ButtonComponent from '../button/button.component'
import IconComponent from '../icon/icon.component'
import { WipComponentProps } from './wip.types'
import './wip.styles.css'
import BackdropComponent from '../backdrop/backdrop.component'

const WipComponent = ({
  title = "This zone is still being built",
  description = "We're wiring up the last few systems behind the scenes. Check back soon, this feature is on its way.",
  backHref = '/',
  backLabel = 'Back to Home',
}: WipComponentProps) => {
  return (
    <div className="wip" aria-labelledby="wip-title">
      

      <div className="wip__content omega-container omega-container--narrow">
        <span className="wip__eyebrow">
          <IconComponent icon="mdi:progress-wrench" width={14} height={14} />
          In Development
        </span>

        <div className="wip__icon-ring" aria-hidden="true">
          <span className="wip__icon-glow" />
          <IconComponent className="wip__icon" icon="mdi:hammer-wrench" width={40} height={40} />
        </div>

        <h1 id="wip-title" className="wip__title">
          {title}
        </h1>

        <p className="wip__description">{description}</p>

        <div className="wip__progress" role="progressbar" aria-label="Feature progress" aria-busy="true">
          <span className="wip__progress-bar" />
        </div>

        <div className="wip__actions">
          <ButtonComponent to={backHref} variant="primary">
            {backLabel}
          </ButtonComponent>
        </div>
      </div>
    </div>
  )
}

export default WipComponent
