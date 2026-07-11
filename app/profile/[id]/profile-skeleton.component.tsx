const ProfileSkeleton = () => {
  return (
    <div className="profile-skeleton" aria-busy="true" aria-label="Loading profile">
      <div className="profile-skeleton__banner" />

      <div className="profile-skeleton__body omega-container">
        <div className="profile-skeleton__command omega-surface">
          <div className="profile-skeleton__identity">
            <span className="profile-skeleton__avatar" />
            <div className="profile-skeleton__identity-text">
              <span className="profile-skeleton__line profile-skeleton__line--short" />
              <span className="profile-skeleton__line profile-skeleton__line--title" />
              <span className="profile-skeleton__line profile-skeleton__line--medium" />
            </div>
            <div className="profile-skeleton__actions">
              <span className="profile-skeleton__pill" />
              <span className="profile-skeleton__icon" />
            </div>
          </div>

          <div className="profile-skeleton__divider" />

          <div className="profile-skeleton__stats">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="profile-skeleton__stat">
                <span className="profile-skeleton__line profile-skeleton__line--label" />
                <span className="profile-skeleton__line profile-skeleton__line--value" />
                <span className="profile-skeleton__line profile-skeleton__line--bar" />
              </div>
            ))}
          </div>
        </div>

        <div className="profile-skeleton__tabs">
          <span className="profile-skeleton__pill profile-skeleton__pill--wide" />
          <span className="profile-skeleton__pill" />
        </div>

        <div className="profile-skeleton__grid">
          <section className="profile-skeleton__panel omega-surface">
            <div className="profile-skeleton__panel-header">
              <span className="profile-skeleton__line profile-skeleton__line--short" />
              <span className="profile-skeleton__line profile-skeleton__line--medium" />
            </div>
            <div className="profile-skeleton__match-grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <span key={index} className="profile-skeleton__match-card" />
              ))}
            </div>
          </section>

          <aside className="profile-skeleton__sidebar">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="profile-skeleton__panel omega-surface">
                <span className="profile-skeleton__line profile-skeleton__line--short" />
                <div className="profile-skeleton__sidebar-lines">
                  {Array.from({ length: 4 }).map((__, lineIndex) => (
                    <span
                      key={lineIndex}
                      className="profile-skeleton__line profile-skeleton__line--full"
                    />
                  ))}
                </div>
              </div>
            ))}
          </aside>
        </div>
      </div>
    </div>
  )
}

export default ProfileSkeleton
