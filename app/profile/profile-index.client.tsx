'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ButtonComponent } from '@components'
import IconComponent from '../../components/icon/icon.component'
import { useAuthContext } from '@contexts/Auth/auth.context'
import { isAuthenticatedUser } from '@contexts/Auth/auth.const'

const ProfileIndexClient = () => {
  const { user, isLoading } = useAuthContext()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && isAuthenticatedUser(user)) {
      router.replace(`/profile/${user.id}`)
    }
  }, [isLoading, user, router])

  if (isLoading || isAuthenticatedUser(user)) {
    return (
      <div className="profile">
        <div className="profile__content omega-container">
          <div className="page-fallback" aria-busy="true" aria-label="Loading profile" />
        </div>
      </div>
    )
  }

  return (
    <div className="profile profile--empty" aria-labelledby="profile-empty-title">
      <div className="profile__backdrop" aria-hidden="true">
        <span className="profile__grid" />
        <span className="profile__orb profile__orb--secondary" />
        <span className="profile__orb profile__orb--accent" />
      </div>

      <div className="profile__empty omega-container omega-container--narrow">
        <span className="profile__eyebrow omega-badge omega-badge--secondary">
          Player Profile
        </span>

        <span className="profile__empty-icon-wrap" aria-hidden="true">
          <IconComponent
            className="profile__empty-icon"
            icon="mdi:account-off"
            width={40}
            height={40}
          />
        </span>

        <h1 id="profile-empty-title" className="profile__empty-title">
          The profile you&apos;re looking for doesn&apos;t exist
        </h1>

        <p className="profile__empty-description">
          No player ID was provided, or this account hasn&apos;t been registered
          in the Omega network yet. Browse the leaderboards or return home to
          find a duelist.
        </p>

        <div className="profile__empty-actions">
          <ButtonComponent to="/" variant="primary" icon="mdi:home">
            Back to Home
          </ButtonComponent>

          <ButtonComponent
            to="/leaderboards"
            variant="secondary"
            icon="mdi:trophy"
          >
            Leaderboards
          </ButtonComponent>
        </div>
      </div>
    </div>
  )
}

export default ProfileIndexClient
