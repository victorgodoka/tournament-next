import Link from 'next/link'
import { TERMS_META, TERMS_SECTION_NAV } from './terms.const'
import './terms.styles.css'
import { BackdropComponent } from '@components'

const TermsPage = () => {
  return (
    <article className="terms" aria-labelledby="terms-title">
      <BackdropComponent />
      <div className="terms__content omega-container omega-container--narrow">
        <header className="terms__header">
          <span className="terms__eyebrow omega-badge omega-badge--secondary">
            Legal
          </span>
          <h1 id="terms-title" className="terms__title">
            Terms of Service
          </h1>
          <p className="terms__updated">
            Last updated:{' '}
            <time dateTime={TERMS_META.lastUpdated}>
              {TERMS_META.lastUpdatedLabel}
            </time>
          </p>
        </header>

        <div className="terms__intro">
          <p>
            Welcome to the YGO Omega tournament platform at{' '}
            <strong>{TERMS_META.siteHostname}</strong> (the &quot;Service&quot;),
            operated by Duelists Unite (&quot;we,&quot; &quot;us,&quot; or
            &quot;our&quot;). These Terms of Service (&quot;Terms&quot;) govern
            your access to and use of the Service.
          </p>
          <p>
            By creating an account or using the Service, you agree to these
            Terms. If you do not agree, do not use the Service.
          </p>
        </div>

        <nav className="terms__toc" aria-label="Terms of Service sections">
          <h2 className="terms__toc-title">On this page</h2>
          <ol className="terms__toc-list">
            {TERMS_SECTION_NAV.map((section, index) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="terms__toc-link">
                  {index + 1}. {section.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="terms__body">
          <section
            id="the-service"
            className="terms__section"
            aria-labelledby="the-service-title"
          >
            <h2 id="the-service-title" className="terms__section-title">
              1. The Service
            </h2>
            <p>
              The Service is a competitive hub for YGO Omega, providing
              tournament organization and registration, live brackets, pairings,
              and standings, player rankings and match histories, and deck and
              match statistics. The Service is provided free of charge as a
              community project.
            </p>
          </section>

          <section
            id="eligibility"
            className="terms__section"
            aria-labelledby="eligibility-title"
          >
            <h2 id="eligibility-title" className="terms__section-title">
              2. Eligibility
            </h2>
            <p>
              You must be at least 13 years old (or the minimum age required in
              your country, if higher) to use the Service. Because sign-in is
              handled through Discord, you must also have a Discord account in
              good standing and comply with Discord&apos;s own Terms of Service.
            </p>
          </section>

          <section
            id="accounts"
            className="terms__section"
            aria-labelledby="accounts-title"
          >
            <h2 id="accounts-title" className="terms__section-title">
              3. Accounts
            </h2>
            <p>
              You sign in to the Service using your Discord account. You are
              responsible for all activity that occurs under your account. You
              agree to maintain only one account per person, unless we
              explicitly permit otherwise; not share your account with others or
              use another person&apos;s account; and notify us promptly if you
              believe your account has been compromised.
            </p>
            <p>
              We reserve the right to reclaim, rename, suspend, or remove
              accounts that violate these Terms.
            </p>
          </section>

          <section
            id="code-of-conduct"
            className="terms__section"
            aria-labelledby="code-of-conduct-title"
          >
            <h2 id="code-of-conduct-title" className="terms__section-title">
              4. Code of Conduct
            </h2>
            <p>
              To keep the Service fair and welcoming for everyone, you agree
              that you will not:
            </p>
            <ul className="terms__list">
              <li>
                Cheat, exploit bugs, or use any tool, modification, or automation
                that provides an unfair competitive advantage;
              </li>
              <li>
                Manipulate matches, rankings, or ratings, including win
                trading, intentional losses to affect standings, or colluding
                with other players;
              </li>
              <li>
                Create or use multiple accounts to evade bans, manipulate
                pairings, or otherwise abuse the Service;
              </li>
              <li>
                Harass, threaten, or abuse other users, or use hate speech,
                slurs, or discriminatory language, including in usernames and
                deck names;
              </li>
              <li>
                Impersonate other players, staff, or Duelists Unite
                representatives;
              </li>
              <li>
                Attempt to gain unauthorized access to the Service, other
                accounts, or our systems, or interfere with the Service&apos;s
                operation (including scraping at disruptive volumes,
                denial-of-service attempts, or probing for vulnerabilities);
              </li>
              <li>Use the Service for any unlawful purpose.</li>
            </ul>
            <p>
              Violations may result in warnings, disqualification from
              tournaments, rating resets, temporary suspension, or permanent
              bans, at our discretion.
            </p>
          </section>

          <section
            id="tournaments-and-fair-play"
            className="terms__section"
            aria-labelledby="tournaments-and-fair-play-title"
          >
            <h2
              id="tournaments-and-fair-play-title"
              className="terms__section-title"
            >
              5. Tournaments and Fair Play
            </h2>
            <p>
              By registering for a tournament on the Service, you agree to the
              following:
            </p>
            <h3 className="terms__subsection-title">Rules and formats.</h3>
            <p>
              Each tournament may have its own format, banlist, deck requirements,
              and schedule. It is your responsibility to read and follow the
              rules of any tournament you enter.
            </p>
            <h3 className="terms__subsection-title">Deck submission.</h3>
            <p>
              Where deck lists are required, you must submit accurate lists and
              play the deck you registered, subject to the rules of the specific
              event.
            </p>
            <h3 className="terms__subsection-title">Staff decisions.</h3>
            <p>
              Tournament organizers and moderators are responsible for running
              events, resolving disputes, and enforcing rules. Their rulings,
              including pairings, results, penalties, and disqualifications, are
              final.
            </p>
            <h3 className="terms__subsection-title">Punctuality and conduct.</h3>
            <p>
              You are expected to show up for your matches on time and behave
              respectfully toward opponents and staff. No-shows may be recorded
              as losses or result in removal from the event.
            </p>
            <h3 className="terms__subsection-title">Prizes.</h3>
            <p>
              Some events may offer prizes provided by Duelists Unite or by
              third-party community organizers. For events run by third parties,
              the organizer, not Duelists Unite, is responsible for delivering
              any advertised prizes. Prizes have no guaranteed cash value unless
              explicitly stated, and we may withhold prizes from players found
              to have violated these Terms or event rules.
            </p>
          </section>

          <section
            id="rankings-and-match-data"
            className="terms__section"
            aria-labelledby="rankings-and-match-data-title"
          >
            <h2
              id="rankings-and-match-data-title"
              className="terms__section-title"
            >
              6. Rankings and Match Data
            </h2>
            <p>
              Match results, standings, rankings, and associated deck data are a
              core part of the Service and are displayed publicly. By
              participating in ranked play or tournaments, you agree that this
              competitive data may be recorded, displayed, and retained as part
              of the historical record of the Service, even if you later stop
              using the Service.
            </p>
          </section>

          <section
            id="user-content"
            className="terms__section"
            aria-labelledby="user-content-title"
          >
            <h2 id="user-content-title" className="terms__section-title">
              7. User Content
            </h2>
            <p>
              You may submit content to the Service, such as usernames, deck
              names, and deck lists (&quot;User Content&quot;). You retain any
              rights you have in your User Content, but you grant us a
              non-exclusive, worldwide, royalty-free license to host, display, and
              distribute it as needed to operate the Service (for example,
              showing your deck list on a tournament results page).
            </p>
            <p>
              You are responsible for your User Content. We may remove or edit
              User Content that violates these Terms.
            </p>
          </section>

          <section
            id="intellectual-property"
            className="terms__section"
            aria-labelledby="intellectual-property-title"
          >
            <h2
              id="intellectual-property-title"
              className="terms__section-title"
            >
              8. Intellectual Property
            </h2>
            <p>
              The Service&apos;s own software, design, branding, and original
              content are the property of Duelists Unite and its contributors,
              and are protected by applicable intellectual property laws. You may
              not copy, modify, or redistribute them except as permitted by us
              or by an applicable open-source license.
            </p>
            <div className="terms__disclaimer">
              <p>
                <strong>Yu-Gi-Oh! disclaimer.</strong> Yu-Gi-Oh! is a trademark
                of Konami Holdings Corporation. All Yu-Gi-Oh! card names, card
                text, characters, artwork, and related intellectual property are
                the property of Konami, Studio Dice, and Kazuki Takahashi.
                Duelists Unite and the Service are fan-made community projects
                and are <strong>not affiliated with, endorsed by, or sponsored
                by Konami</strong> or any of its subsidiaries. No copyright or
                trademark infringement is intended. The Service is provided free
                of charge for non-commercial community play.
              </p>
            </div>
          </section>

          <section
            id="third-party-services"
            className="terms__section"
            aria-labelledby="third-party-services-title"
          >
            <h2
              id="third-party-services-title"
              className="terms__section-title"
            >
              9. Third-Party Services
            </h2>
            <p>
              The Service relies on third-party services, most notably Discord
              for authentication. We are not responsible for the availability,
              content, or practices of third-party services, and your use of them
              is governed by their own terms and policies.
            </p>
          </section>

          <section
            id="availability-and-changes"
            className="terms__section"
            aria-labelledby="availability-and-changes-title"
          >
            <h2
              id="availability-and-changes-title"
              className="terms__section-title"
            >
              10. Availability and Changes to the Service
            </h2>
            <p>
              The Service is a community-run project provided free of charge. We
              do not guarantee that the Service will be available at all times
              or free of errors, and we may modify, suspend, or discontinue any
              part of the Service at any time without liability. We may also
              change tournament schedules, formats, ranking systems, and features
              at our discretion.
            </p>
          </section>

          <section
            id="disclaimer-of-warranties"
            className="terms__section"
            aria-labelledby="disclaimer-of-warranties-title"
          >
            <h2
              id="disclaimer-of-warranties-title"
              className="terms__section-title"
            >
              11. Disclaimer of Warranties
            </h2>
            <div className="terms__notice">
              <p>
                THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS
                AVAILABLE,&quot; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS
                OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF
                MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
                NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE
                UNINTERRUPTED, SECURE, OR ERROR-FREE, OR THAT ANY DATA
                (INCLUDING RANKINGS AND MATCH HISTORIES) WILL BE PRESERVED
                WITHOUT LOSS.
              </p>
            </div>
          </section>

          <section
            id="limitation-of-liability"
            className="terms__section"
            aria-labelledby="limitation-of-liability-title"
          >
            <h2
              id="limitation-of-liability-title"
              className="terms__section-title"
            >
              12. Limitation of Liability
            </h2>
            <div className="terms__notice">
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, DUELISTS UNITE AND ITS
                VOLUNTEERS, STAFF, AND CONTRIBUTORS SHALL NOT BE LIABLE FOR ANY
                INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
                OR ANY LOSS OF DATA, RATINGS, PRIZES, OR GOODWILL, ARISING OUT OF
                OR RELATED TO YOUR USE OF (OR INABILITY TO USE) THE SERVICE. IN
                NO EVENT SHALL OUR TOTAL LIABILITY TO YOU EXCEED THE AMOUNT YOU
                PAID US TO USE THE SERVICE (WHICH, FOR THIS FREE SERVICE, IS
                ZERO) OR THE MINIMUM AMOUNT PERMITTED BY APPLICABLE LAW.
              </p>
            </div>
            <p>
              Some jurisdictions do not allow certain limitations of liability,
              so some of the above limitations may not apply to you.
            </p>
          </section>

          <section
            id="termination"
            className="terms__section"
            aria-labelledby="termination-title"
          >
            <h2 id="termination-title" className="terms__section-title">
              13. Termination
            </h2>
            <p>
              You may stop using the Service at any time and may request deletion
              of your account by contacting us. We may suspend or terminate your
              access to the Service at any time, with or without notice, if you
              violate these Terms, disrupt the community, or if we discontinue
              the Service. Sections that by their nature should survive
              termination (including Sections 6, 8, 11, and 12) will survive.
            </p>
          </section>

          <section
            id="changes-to-these-terms"
            className="terms__section"
            aria-labelledby="changes-to-these-terms-title"
          >
            <h2
              id="changes-to-these-terms-title"
              className="terms__section-title"
            >
              14. Changes to These Terms
            </h2>
            <p>
              We may update these Terms from time to time. When we do, we will
              revise the &quot;Last updated&quot; date above and, for
              significant changes, make reasonable efforts to notify users through
              the Service or our Discord. Continued use of the Service after
              changes take effect means you accept the updated Terms.
            </p>
          </section>

          <section
            id="governing-law"
            className="terms__section"
            aria-labelledby="governing-law-title"
          >
            <h2 id="governing-law-title" className="terms__section-title">
              15. Governing Law
            </h2>
            <p>
              These Terms are governed by the laws of{' '}
              <strong>{TERMS_META.country}</strong>, without regard to its
              conflict of law principles. Any disputes arising from these Terms
              or the Service shall be resolved in the courts of{' '}
              <strong>{TERMS_META.jurisdiction}</strong>, unless applicable law
              requires otherwise.
            </p>
          </section>

          <section
            id="contact"
            className="terms__section terms__section--contact"
            aria-labelledby="contact-title"
          >
            <h2 id="contact-title" className="terms__section-title">
              16. Contact
            </h2>
            <p>Questions about these Terms can be sent to:</p>
            <ul className="terms__contact-list">
              <li>
                <strong>Email:</strong>{' '}
                <a href={`mailto:${TERMS_META.email}`}>{TERMS_META.email}</a>
              </li>
              <li>
                <strong>Discord:</strong>{' '}
                <a
                  href={TERMS_META.discordLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  discord.gg/duelistsunite
                  <span className="visually-hidden"> (opens in new tab)</span>
                </a>
              </li>
            </ul>
            <p className="terms__back">
              <Link href="/privacy" className="terms__back-link">
                Privacy Policy
              </Link>
              {' · '}
              <Link href="/" className="terms__back-link">
                Back to Home
              </Link>
            </p>
          </section>
        </div>
      </div>
    </article>
  )
}

export default TermsPage
