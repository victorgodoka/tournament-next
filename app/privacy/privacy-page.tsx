import Link from 'next/link'
import { PRIVACY_META, PRIVACY_SECTION_NAV } from './privacy.const'
import './privacy.styles.css'
import { BackdropComponent } from '@components'

const PrivacyEmailLink = () => (
  <a href={`mailto:${PRIVACY_META.email}`}>{PRIVACY_META.email}</a>
)

const PrivacyPage = () => {
  return (
    <article className="privacy" aria-labelledby="privacy-title">
      <BackdropComponent />

      <div className="privacy__content omega-container omega-container--narrow">
        <header className="privacy__header">
          <span className="privacy__eyebrow omega-badge omega-badge--secondary">
            Legal
          </span>
          <h1 id="privacy-title" className="privacy__title">
            Privacy Policy
          </h1>
          <p className="privacy__updated">
            Last updated:{' '}
            <time dateTime={PRIVACY_META.lastUpdated}>
              {PRIVACY_META.lastUpdatedLabel}
            </time>
          </p>
        </header>

        <div className="privacy__intro">
          <p>
            This Privacy Policy explains how Duelists Unite (&quot;we,&quot;
            &quot;us,&quot; or &quot;our&quot;) collects, uses, and protects
            information when you use the YGO Omega tournament platform at{' '}
            <strong>{PRIVACY_META.siteHostname}</strong> (the &quot;Service&quot;).
          </p>
          <p>
            By using the Service, you agree to the practices described in this
            policy. If you do not agree, please do not use the Service.
          </p>
        </div>

        <nav className="privacy__toc" aria-label="Privacy Policy sections">
          <h2 className="privacy__toc-title">On this page</h2>
          <ol className="privacy__toc-list">
            {PRIVACY_SECTION_NAV.map((section, index) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="privacy__toc-link">
                  {index + 1}. {section.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="privacy__body">
          <section
            id="who-we-are"
            className="privacy__section"
            aria-labelledby="who-we-are-title"
          >
            <h2 id="who-we-are-title" className="privacy__section-title">
              1. Who We Are
            </h2>
            <p>
              Duelists Unite is a community project that operates YGO Omega and
              its related services, including this tournament platform. For
              privacy-related questions, you can contact us at{' '}
              <PrivacyEmailLink /> or through our Discord server.
            </p>
          </section>

          <section
            id="information-we-collect"
            className="privacy__section"
            aria-labelledby="information-we-collect-title"
          >
            <h2
              id="information-we-collect-title"
              className="privacy__section-title"
            >
              2. Information We Collect
            </h2>

            <h3 className="privacy__subsection-title">Account Information</h3>
            <p>
              When you sign in through Discord, we receive certain information
              from your Discord account, such as your Discord user ID, username,
              and avatar. We use this to create and manage your account on the
              Service. We do not receive your Discord password.
            </p>

            <h3 className="privacy__subsection-title">
              Gameplay and Tournament Data
            </h3>
            <p>
              When you participate in tournaments or ranked play, we collect and
              store data generated through your use of the Service, including
              tournament registrations, match results and scores, win/loss
              records and rating or ranking data, deck lists submitted for
              tournaments, and match replays where applicable.
            </p>

            <h3 className="privacy__subsection-title">Technical Information</h3>
            <p>
              Like most websites, we automatically collect certain technical
              data when you visit, including your IP address, browser type and
              version, device and operating system information, pages visited and
              time spent on the Service, and server logs. This information helps
              us keep the Service secure, prevent abuse, and diagnose technical
              problems.
            </p>

            <h3 className="privacy__subsection-title">Cookies</h3>
            <p>
              We use cookies and similar technologies to keep you signed in,
              remember your preferences, and understand how the Service is used.
              You can control cookies through your browser settings, though
              disabling them may prevent parts of the Service (such as staying
              logged in) from working properly.
            </p>
          </section>

          <section
            id="how-we-use"
            className="privacy__section"
            aria-labelledby="how-we-use-title"
          >
            <h2 id="how-we-use-title" className="privacy__section-title">
              3. How We Use Your Information
            </h2>
            <p>
              We use the information we collect to operate and maintain the
              Service; register you for tournaments and run brackets, pairings,
              and standings; calculate and display rankings, ratings, and match
              histories; detect and prevent cheating, multi-accounting, and
              other abuse; enforce our Terms of Service and tournament rules;
              respond to questions and support requests; and improve the Service
              and fix technical issues.
            </p>
            <p>We do not sell your personal information.</p>
          </section>

          <section
            id="public-information"
            className="privacy__section"
            aria-labelledby="public-information-title"
          >
            <h2
              id="public-information-title"
              className="privacy__section-title"
            >
              4. Information That Is Public
            </h2>
            <p>
              Because this is a competitive tournament platform, some of your
              information is visible to other users and to the public by design.
              This includes your username and avatar, your placement in
              tournament brackets and standings, your match results and ranking
              or rating, and deck lists associated with tournament results (for
              example, top-performing decks).
            </p>
            <p>
              Please keep this in mind when choosing your username. If you have
              concerns about publicly displayed data, contact us at{' '}
              <PrivacyEmailLink />.
            </p>
          </section>

          <section
            id="how-we-share"
            className="privacy__section"
            aria-labelledby="how-we-share-title"
          >
            <h2 id="how-we-share-title" className="privacy__section-title">
              5. How We Share Information
            </h2>
            <p>
              We do not sell or rent your personal information. We share
              information only in the following limited circumstances:
            </p>
            <div className="privacy__details">
              <p>
                <strong>Service providers.</strong> We use third-party providers
                for hosting, infrastructure, and security (for example, web
                hosting and content delivery services). These providers process
                data on our behalf only as needed to run the Service.
              </p>
              <p>
                <strong>Discord.</strong> Signing in is handled through
                Discord&apos;s authentication system. Your use of Discord is
                governed by Discord&apos;s own Terms of Service and Privacy
                Policy, which we encourage you to review.
              </p>
              <p>
                <strong>Legal requirements.</strong> We may disclose information
                if required by law, or if we believe in good faith that
                disclosure is necessary to protect our rights, protect user
                safety, or respond to a valid legal request.
              </p>
              <p>
                <strong>Community moderation.</strong> Tournament staff and
                moderators may access relevant account and match data to
                investigate rule violations, disputes, or suspected cheating.
              </p>
            </div>
          </section>

          <section
            id="data-retention"
            className="privacy__section"
            aria-labelledby="data-retention-title"
          >
            <h2 id="data-retention-title" className="privacy__section-title">
              6. Data Retention
            </h2>
            <p>
              We keep your account information for as long as your account is
              active. Tournament results, standings, and rankings may be retained
              indefinitely as part of the historical competitive record, even
              after an account is deleted, though we will remove or anonymize
              personal identifiers where feasible upon request. Server logs and
              technical data are kept for a limited period for security and
              troubleshooting purposes.
            </p>
          </section>

          <section
            id="security"
            className="privacy__section"
            aria-labelledby="security-title"
          >
            <h2 id="security-title" className="privacy__section-title">
              7. Security
            </h2>
            <p>
              We take reasonable technical and organizational measures to
              protect your information from unauthorized access, loss, or misuse.
              However, no online service can guarantee absolute security, and
              you use the Service at your own risk.
            </p>
          </section>

          <section
            id="childrens-privacy"
            className="privacy__section"
            aria-labelledby="childrens-privacy-title"
          >
            <h2
              id="childrens-privacy-title"
              className="privacy__section-title"
            >
              8. Children&apos;s Privacy
            </h2>
            <p>
              The Service is not directed to children under the age of 13 (or
              the minimum age required in your country, if higher). We do not
              knowingly collect personal information from children under this
              age. Note that Discord itself requires users to be at least 13
              years old. If you believe a child under the applicable age has
              created an account, please contact us at <PrivacyEmailLink /> and
              we will delete the account and associated data.
            </p>
          </section>

          <section
            id="your-rights"
            className="privacy__section"
            aria-labelledby="your-rights-title"
          >
            <h2 id="your-rights-title" className="privacy__section-title">
              9. Your Rights
            </h2>
            <p>
              Depending on where you live, you may have rights regarding your
              personal information, including the right to access the personal
              data we hold about you, request correction of inaccurate data,
              request deletion of your account and personal data, object to or
              restrict certain processing, and receive a copy of your data in a
              portable format.
            </p>
            <p>
              To exercise any of these rights, contact us at{' '}
              <PrivacyEmailLink />. We will respond within a reasonable timeframe
              and in accordance with applicable law. If you are in the European
              Economic Area or the United Kingdom, you also have the right to
              lodge a complaint with your local data protection authority.
            </p>
          </section>

          <section
            id="international-users"
            className="privacy__section"
            aria-labelledby="international-users-title"
          >
            <h2
              id="international-users-title"
              className="privacy__section-title"
            >
              10. International Users
            </h2>
            <p>
              The Service is operated from {PRIVACY_META.jurisdiction} and may be
              hosted on servers in other countries. By using the Service, you
              understand that your information may be transferred to and processed
              in countries other than your own, which may have different data
              protection laws.
            </p>
          </section>

          <section
            id="third-party-links"
            className="privacy__section"
            aria-labelledby="third-party-links-title"
          >
            <h2
              id="third-party-links-title"
              className="privacy__section-title"
            >
              11. Third-Party Links
            </h2>
            <p>
              The Service may contain links to third-party websites, such as our
              forum, Discord server, or GitHub. This policy does not apply to
              those sites, and we are not responsible for their privacy
              practices.
            </p>
          </section>

          <section
            id="changes"
            className="privacy__section"
            aria-labelledby="changes-title"
          >
            <h2 id="changes-title" className="privacy__section-title">
              12. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. When we do,
              we will revise the &quot;Last updated&quot; date at the top of
              this page and, for significant changes, make reasonable efforts to
              notify users (for example, through the Service or our Discord).
              Continued use of the Service after changes take effect means you
              accept the updated policy.
            </p>
          </section>

          <section
            id="contact-us"
            className="privacy__section privacy__section--contact"
            aria-labelledby="contact-us-title"
          >
            <h2 id="contact-us-title" className="privacy__section-title">
              13. Contact Us
            </h2>
            <p>
              If you have questions about this Privacy Policy or how we handle
              your data, contact us at:
            </p>
            <ul className="privacy__contact-list">
              <li>
                <strong>Email:</strong>{' '}
                <a href={`mailto:${PRIVACY_META.email}`}>
                  {PRIVACY_META.email}
                </a>
              </li>
              <li>
                <strong>Discord:</strong>{' '}
                <a
                  href={PRIVACY_META.discordLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  discord.gg/duelistsunite
                  <span className="visually-hidden"> (opens in new tab)</span>
                </a>
              </li>
            </ul>
            <p className="privacy__back">
              <Link href="/terms" className="privacy__back-link">
                Terms of Service
              </Link>
              {' · '}
              <Link href="/" className="privacy__back-link">
                Back to Home
              </Link>
            </p>
          </section>
        </div>
      </div>
    </article>
  )
}

export default PrivacyPage
