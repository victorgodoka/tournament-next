'use client'

import { ButtonComponent } from '@components'
import { trackCtaClick } from '@lib/gtm'
import { DISCORD_SERVER_LINK } from '@lib/site-config'

const HomeHeroActions = () => {
  return (
    <div className="home__actions">
      <ButtonComponent
        to="/tournament/live"
        variant="primary"
        size="lg"
        icon="fluent:live-20-filled"
        onClick={() => {
          trackCtaClick({
            cta_name: 'Live Tournament',
            cta_location: 'home_hero',
            link_url: '/tournament/live',
          })
        }}
      >
        Live Tournament
      </ButtonComponent>

      <ButtonComponent
        href={DISCORD_SERVER_LINK}
        variant="secondary"
        size="lg"
        icon="mdi:discord"
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          trackCtaClick({
            cta_name: 'Join Discord',
            cta_location: 'home_hero',
            link_url: DISCORD_SERVER_LINK,
          })
        }}
      >
        Join Discord
        <span className="visually-hidden"> (opens in new tab)</span>
      </ButtonComponent>
    </div>
  )
}

export default HomeHeroActions
