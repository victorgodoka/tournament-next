import Link from 'next/link'
import { Section, type LegalDoc } from '@omega/legal/legal-page'

const CONTACT = 'admin@duelistsunite.org'

export const en: LegalDoc = {
  title: 'Terms of Service',
  description: 'The rules for using the YGO Omega hub: accounts, conduct, what you post, moderation, VIP, and liability.',
  eyebrow: 'Legal',
  updatedLabel: 'Last updated:',
  Body: () => (
    <>
      <p>
        These terms are an agreement between you and Duelists Unite (&quot;we&quot;, &quot;us&quot;), the fan project that runs YGO Omega,
        for your use of omega.duelistsunite.org and the API behind it (the &quot;Hub&quot;). By using the Hub you accept them. If you
        don&apos;t, please don&apos;t use it. Our <Link href="/privacy">Privacy Policy</Link> explains how we handle your data.
      </p>

      <Section id="eligibility" title="Who can use the Hub">
        <ul>
          <li>
            You must be at least 13. If your country sets a higher age for agreeing to these terms on your own, you need a parent&apos;s or
            guardian&apos;s permission.
          </li>
          <li>
            Anyone can read the Hub. To sign in, you need a Discord account linked to a YGO Omega account, and that account must not be
            suspended or banned.
          </li>
        </ul>
      </Section>

      <Section id="account" title="Your account">
        <p>
          You sign in with Discord, so keeping your Discord account secure keeps your Hub account secure. You are responsible for what happens
          under your account. If you think someone else is using it, sign out and tell us.
        </p>
      </Section>

      <Section id="conduct" title="Rules of conduct">
        <p>On the Hub, including your profile, messages, wiki edits and comments, don&apos;t:</p>
        <ul>
          <li>harass, threaten, insult or impersonate anyone, or post hate speech;</li>
          <li>share someone&apos;s personal information without their permission;</li>
          <li>post sexual content, graphic violence, or anything illegal;</li>
          <li>post content you don&apos;t have the right to share;</li>
          <li>spam, advertise, or send unsolicited messages;</li>
          <li>vandalise the wiki or add content you know is false;</li>
          <li>
            attack, probe or overload the Hub, get around its limits or security, scrape it at a rate that burdens our servers, or use it to
            cheat in YGO Omega;
          </li>
          <li>dodge a suspension or ban with another account.</li>
        </ul>
      </Section>

      <Section id="content" title="What you post">
        <p>
          You keep the rights to what you post. You give us a worldwide, non-exclusive, royalty-free licence to host, store, copy, display,
          adapt and distribute it in order to run and promote the Hub. The licence ends when the content leaves the Hub, except for content
          that stays as part of the wiki&apos;s history, and for content other people have already shared or quoted.
        </p>
        <p>
          The wiki is collaborative. Other editors and staff may edit, reorganise or remove your contributions, and your revisions stay in the
          article&apos;s history. Only post what you have the right to share. We don&apos;t check everything before it goes up, and
          we&apos;re not responsible for what users post.
        </p>
      </Section>

      <Section id="moderation" title="Moderation">
        <p>
          We may remove content, limit features, or suspend or ban accounts that break these terms or put other people or the Hub at risk.
          When we can, we&apos;ll tell you why. If you think we got it wrong, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </Section>

      <Section id="ip" title="Fan project and intellectual property">
        <p>
          YGO Omega and the Hub are a free fan project. We are not affiliated with, endorsed by or sponsored by Konami. Yu-Gi-Oh!, its card
          names, text and artwork belong to Konami and their respective owners. Album covers, artwork and songs belong to their artists and
          labels. The Hub&apos;s own code, design and writing belong to Duelists Unite.
        </p>
        <p>
          If you own rights to something on the Hub and want it removed, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> with the page,
          the work in question and how to reach you. We remove infringing content, and we ban accounts that infringe again and again.
        </p>
      </Section>

      <Section id="vip" title="Ads and VIP">
        <ul>
          <li>The Hub is free. Ads pay for the servers.</li>
          <li>
            VIP comes with a donation through PayPal and removes ads, among other perks. Perks can change. Refunds follow PayPal&apos;s rules
            and the law that applies to you. Questions about a donation: email us.
          </li>
        </ul>
      </Section>

      <Section id="availability" title="Availability">
        <p>
          We run the Hub on volunteer time and donated money. Features may change, pause or stop, and the Hub may be unavailable at times. We
          try not to lose your data, but we can&apos;t promise it: keep your own copy of anything important, such as your decks.
        </p>
      </Section>

      <Section id="disclaimer" title="Disclaimer">
        <p>
          The Hub is provided &quot;as is&quot; and &quot;as available&quot;. To the extent the law allows, we make no promises about it,
          including that it will be accurate, uninterrupted, error-free or fit for a particular purpose. Card text, rulings, statistics and
          wiki articles may contain mistakes.
        </p>
      </Section>

      <Section id="liability" title="Limitation of liability">
        <p>
          To the extent the law allows, we are not liable for indirect, incidental, special or consequential damages, or for lost data,
          profits or goodwill. Our total liability for any claim about the Hub is limited to the greater of 50 US dollars and what you paid
          us in the 12 months before the claim. Nothing in these terms limits liability that the law doesn&apos;t allow us to limit, or takes
          away rights you have as a consumer.
        </p>
      </Section>

      <Section id="termination" title="Ending the agreement">
        <p>
          You can stop using the Hub at any time, and ask us to delete your account as the <Link href="/privacy#rights">Privacy Policy</Link>{' '}
          explains. We may suspend or end your access if you break these terms. The sections on what you post, intellectual property,
          disclaimer, liability and governing law keep applying after that.
        </p>
      </Section>

      <Section id="law" title="Governing law">
        <p>
          These terms are governed by the laws of Ontario and the federal laws of Canada that apply there. Disputes go to the courts of
          Toronto, Ontario. If you are a consumer in another country, you keep the protections of your local law that can&apos;t be waived,
          and you can bring a claim in your local courts.
        </p>
      </Section>

      <Section id="changes" title="Changes to these terms">
        <p>
          When these terms change, the date at the top changes too. Before a significant change takes effect, we announce it on the Hub or on
          our <a href="https://discord.gg/duelistsunite">Discord</a>. If you keep using the Hub after a change takes effect, you accept the
          new terms. If a part of these terms turns out to be unenforceable, the rest still applies.
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
