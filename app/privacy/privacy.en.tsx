import Link from 'next/link'
import { Section, type LegalDoc } from '@omega/legal/legal-page'

const CONTACT = 'admin@duelistsunite.org'

export const en: LegalDoc = {
  title: 'Privacy Policy',
  description: 'What the YGO Omega hub collects, why, who else receives it, how long it stays, and how to see, change or delete it.',
  eyebrow: 'Legal',
  updatedLabel: 'Last updated:',
  Body: () => (
    <>
      <p>
        This policy explains what Duelists Unite (&quot;we&quot;, &quot;us&quot;) collects when you use omega.duelistsunite.org (the
        &quot;Hub&quot;) and the API behind it, why we collect it, who else receives it, and what you can do about it. Duelists Unite is the fan
        project that runs YGO Omega. We are not affiliated with Konami. The forum at forum.duelistsunite.org has its own policy.
      </p>
      <p>
        The short version: you sign in with Discord, and we only get your Discord ID, username and avatar. We keep what you create on the Hub
        so we can show it back to you and to the people you share it with. Ads pay for the servers, and our ad partner uses cookies to run
        them. We never sell your data for money. You can ask us for a copy of your data or for its deletion at any time.
      </p>

      <Section id="collect" title="What we collect">
        <p>
          <strong>When you browse without signing in</strong>
        </p>
        <ul>
          <li>Your language, in a cookie, if you pick one.</li>
          <li>
            What every web server receives with a request: your IP address, your browser&apos;s user agent, the page you asked for and the
            time. Our servers write this to their logs.
          </li>
          <li>
            A daily view count for wiki articles. For a visitor who isn&apos;t signed in, the count uses a keyed hash of the IP address. We
            don&apos;t store the IP address itself for it.
          </li>
          <li>
            Whatever our ad partner collects. See <a href="#ads">Ads</a>.
          </li>
        </ul>

        <p>
          <strong>When you sign in with Discord</strong>
        </p>
        <p>
          Only a Discord account that already has a YGO Omega account can sign in. We ask Discord for the <code>identify</code> permission
          only. It gives us your Discord user ID, username and avatar. We never see your Discord password, email address, servers or messages,
          and we don&apos;t keep the access token Discord gives us. Each sign-in creates a session. For each session we store a hash of its
          token, the IP address and user agent you signed in from, and when it was created, last used and set to expire.
        </p>

        <p>
          <strong>Your YGO Omega game data</strong>
        </p>
        <p>
          Your Hub account is your YGO Omega account. The Hub reads from the game&apos;s servers and shows your in-game name, rating, rank and
          VIP status, the duels you played (opponent, region, results, the decks used and the cards played in each game), and your season and
          tournament results.
        </p>

        <p>
          <strong>What you add on the Hub</strong>
        </p>
        <ul>
          <li>
            Your profile: bio, region, status message, cover image, favourite card and deck, social links, a &quot;now playing&quot; YouTube
            video, who can see your profile, and whether you appear online.
          </li>
          <li>
            The messenger: your contacts (friend or rival, plus the private nickname and note you give them), the people you block, and the
            messages you send and receive, with their read status.
          </li>
          <li>Decks and combos you save in the deck builder and simulator, with their revision history.</li>
          <li>Wiki articles and their revisions, images you upload, comments and likes.</li>
          <li>Tournament registrations.</li>
        </ul>
        <p>
          When staff use the admin tools, we log each action, its target and result, and the staff member&apos;s IP address and user agent.
        </p>

        <p>
          <strong>What stays on your device</strong>
        </p>
        <p>
          Unsaved drafts (deck builder, simulator, wiki editor) and small preferences (the banlist view you chose, whether you finished the
          calculator tour) stay in your browser&apos;s storage. We only receive a draft when you save it.
        </p>

        <p>
          <strong>Donations</strong>
        </p>
        <p>
          VIP comes with a donation made through PayPal. PayPal processes the payment under its own privacy statement. We never see your card
          or bank details.
        </p>
      </Section>

      <Section id="use" title="How we use it">
        <ul>
          <li>To run the Hub: sign you in, show your profile, deliver your messages, save your decks, publish your wiki edits.</li>
          <li>To show game results: leaderboards, match history, tournament pages and player profiles.</li>
          <li>
            To build statistics: meta reports, card and archetype usage, win rates. Site-wide statistics are aggregates. A player&apos;s own
            statistics appear on their profile.
          </li>
          <li>To keep the Hub safe: limit request rates, detect abuse, investigate reports and enforce our Terms.</li>
          <li>To show the ads that pay for the servers, unless you are VIP.</li>
        </ul>
        <p>
          We don&apos;t sell your personal information for money. Some US state laws count letting ad partners collect data for personalised
          ads as &quot;selling&quot; or &quot;sharing&quot;. You can opt out of that; see <a href="#ads">Ads</a>.
        </p>
      </Section>

      <Section id="legal-bases" title="Legal bases">
        <p>If you are in the EEA, the UK or Brazil, we rely on these legal bases:</p>
        <ul>
          <li>
            <strong>Contract:</strong> to provide the account and the features you ask for (sign-in, profile, messenger, decks, wiki).
          </li>
          <li>
            <strong>Legitimate interests:</strong> security and abuse prevention, server logs, wiki view counts, statistics and public game
            results. You can object to these; see <a href="#rights">Your rights</a>.
          </li>
          <li>
            <strong>Consent:</strong> personalised ads and the cookies behind them, where the law requires consent. You can withdraw it at
            any time with &quot;Manage consent&quot; at the bottom of the page.
          </li>
          <li>
            <strong>Legal obligation:</strong> when the law requires us to keep or disclose data.
          </li>
        </ul>
      </Section>

      <Section id="sharing" title="Who receives your data">
        <ul>
          <li>
            <strong>Other players</strong> see what your profile shows, within the visibility you chose, plus your wiki contributions under
            your name, leaderboard and match results, and the messages you send them.
          </li>
          <li>
            <strong>Discord</strong>, to sign you in (<a href="https://discord.com/privacy">privacy policy</a>).
          </li>
          <li>
            <strong>Cloudinary</strong> stores and serves profile covers and wiki images, and screens uploaded covers with automated
            moderation (<a href="https://cloudinary.com/privacy">privacy policy</a>).
          </li>
          <li>
            <strong>Nitro</strong> (NitroPay, owned by Overwolf Ltd) and its advertising partners serve the ads (
            <a href="https://nitropay.com/privacy">privacy policy</a>).
          </li>
          <li>
            <strong>YouTube</strong> (Google) receives your IP address when you play an embedded video. Players load from
            youtube-nocookie.com, YouTube&apos;s privacy-enhanced mode, and only when you press play. Before that, a wiki page loads only the
            video&apos;s thumbnail from YouTube&apos;s image server (<a href="https://policies.google.com/privacy">privacy policy</a>).
          </li>
          <li>
            <strong>PayPal</strong>, for donations (<a href="https://www.paypal.com/legalhub/privacy-full">privacy statement</a>).
          </li>
          <li>
            <strong>Hosting providers</strong> that run our servers and databases, only to provide that service.
          </li>
          <li>
            <strong>Authorities</strong>, when the law requires it, or when we need to protect someone&apos;s safety.
          </li>
          <li>
            <strong>A successor</strong>, if the project changes hands. This policy would keep applying to your data.
          </li>
        </ul>
      </Section>

      <Section id="ads" title="Ads">
        <p>
          The Hub shows ads through Nitro. Nitro and its partners use cookies and similar technologies to show ads, limit how often you see the
          same one, measure them and, with your consent where the law requires it, personalise them.
        </p>
        <ul>
          <li>
            <strong>EEA, UK and Switzerland:</strong> Nitro&apos;s consent tool asks before any personalised ads. Change your choice any time
            with &quot;Manage consent&quot; at the bottom of the page.
          </li>
          <li>
            <strong>US states with privacy laws</strong> (such as California): use &quot;Do Not Sell or Share My Personal Information&quot;
            at the bottom of the page to opt out.
          </li>
        </ul>
        <p>
          These links appear only where the law covers you. VIP accounts see no ads, and some pages never carry any: sign-in, the messenger,
          profile editing, the wiki editor and the admin pages.
        </p>
      </Section>

      <Section id="cookies" title="Cookies and local storage">
        <ul>
          <li>
            <code>omega_session</code>: set by our API on duelistsunite.org when you sign in. It keeps you signed in. Your browser&apos;s
            scripts can&apos;t read it, and it lasts 30 days. Strictly necessary.
          </li>
          <li>
            Sign-in cookies: set by our API during Discord sign-in, to protect it from forgery. They expire after 10 minutes. Strictly
            necessary.
          </li>
          <li>
            <code>NEXT_LOCALE</code>: the language you picked. It lasts one year. Functional.
          </li>
          <li>
            Nitro and its partners: advertising and consent cookies. See <a href="#ads">Ads</a>.
          </li>
          <li>Local and session storage: drafts, preferences, and the page to return to after you sign in. These stay in your browser.</li>
        </ul>
        <p>
          The Hub can&apos;t work without the strictly necessary cookies. You can delete any cookie in your browser; deleting{' '}
          <code>omega_session</code> signs you out.
        </p>
      </Section>

      <Section id="retention" title="How long we keep it">
        <ul>
          <li>Your account, profile, decks, combos, contacts and messages: for as long as your account exists.</li>
          <li>
            Clearing a conversation in the messenger hides it for you. The other person keeps their copy until they clear it too.
          </li>
          <li>
            Sessions stop working after 30 days or when you sign out. The session record, with its IP address and user agent, stays with your
            account until the account is deleted.
          </li>
          <li>
            Wiki articles and revisions are part of the wiki&apos;s history and stay published. If your account is deleted, they stay
            credited to a deleted account.
          </li>
          <li>Server logs: only as long as we need them for security and debugging.</li>
        </ul>
        <p>
          When you ask us to delete your account, we delete or anonymise your data within 30 days. We keep only what the law requires, or what
          we need to enforce a ban. Copies in backups disappear as backups are replaced.
        </p>
      </Section>

      <Section id="rights" title="Your rights">
        <p>
          Depending on where you live (for example under the GDPR, the UK GDPR, Brazil&apos;s LGPD, Canada&apos;s PIPEDA or the CCPA), you
          can ask us to:
        </p>
        <ul>
          <li>tell you what data we hold about you and give you a copy, in a portable format;</li>
          <li>correct data that is wrong;</li>
          <li>delete your data or your account;</li>
          <li>stop or restrict a use of your data, or object to it;</li>
          <li>withdraw a consent you gave;</li>
          <li>stop selling or sharing your data for personalised ads.</li>
        </ul>
        <p>
          Many changes you can make yourself: edit your profile and who can see it, delete decks and combos, remove contacts and sign out.
          For the rest, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. To confirm the request is yours, we may ask you to message us
          from the Discord account linked to your YGO Omega account. We answer within 30 days, or sooner if your law requires it. It costs
          nothing, and using these rights never changes how the Hub treats you.
        </p>
        <p>
          You can also complain to your data protection authority, such as your EU country&apos;s authority, the UK ICO, Brazil&apos;s
          ANPD, the Office of the Privacy Commissioner of Canada or the California Privacy Protection Agency.
        </p>
      </Section>

      <Section id="children" title="Children">
        <p>
          The Hub is for people 13 and older. If your country sets a higher age for agreeing to this on your own (up to 16 in parts of the
          EU), you need a parent&apos;s or guardian&apos;s permission. If you think a child under 13 has an account, email us and we will
          delete it.
        </p>
      </Section>

      <Section id="transfers" title="International transfers">
        <p>
          Our servers and the providers above may process your data outside your country, including in Canada, the United States, the EU and
          Israel. Where the law requires it, we rely on our providers&apos; safeguards for these transfers, such as standard contractual
          clauses.
        </p>
      </Section>

      <Section id="security" title="Security">
        <p>
          The Hub runs on HTTPS. The session cookie is out of reach of page scripts and only travels over HTTPS, and we store only a hash of
          each session token. Discord sign-in uses PKCE, and we never handle your Discord password. Every admin action is logged. Messages
          are not end-to-end encrypted. No system is perfectly secure: if a breach affects your data, we will tell you as the law requires.
        </p>
      </Section>

      <Section id="changes" title="Changes to this policy">
        <p>
          When this policy changes, the date at the top changes too. Before a significant change takes effect, we announce it on the Hub or
          on our <a href="https://discord.gg/duelistsunite">Discord</a>. The <Link href="/terms">Terms of Service</Link> cover the rest of
          the rules for using the Hub.
        </p>
      </Section>

      <Section id="contact" title="Contact">
        <p>
          Duelists Unite: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </Section>
    </>
  ),
}
