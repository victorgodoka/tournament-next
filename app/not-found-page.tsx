import Link from 'next/link'
import './not-found.styles.css'
import BackdropComponent from '@components/backdrop/backdrop.component'

const NotFoundPage = () => {
  return (
    <div className="not-found" aria-labelledby="not-found-title">
      <BackdropComponent />

      <div className="not-found__content omega-container omega-container--narrow">
        <span className="not-found__eyebrow omega-badge omega-badge--secondary">
          Error 404
        </span>

        <p className="not-found__code" aria-hidden="true">
          404
        </p>

        <h1 id="not-found-title" className="not-found__title">
          This path doesn&apos;t exist in the Omega network
        </h1>

        <p className="not-found__description">
          The route you followed was banished outside the known zones. Return to
          headquarters and pick another destination.
        </p>

        <div className="not-found__actions">
          <Link href="/" className="not-found__action omega-btn omega-btn--primary">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default NotFoundPage
