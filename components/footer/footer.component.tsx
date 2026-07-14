import Link from 'next/link'
import IconComponent from '../icon/icon.component'
import CcpaOptOutLink from '../ads/ads.ccpa-link.component'
import ConsentManagementLink from '../ads/ads.consent-link.component'
import FooterSocialLink from './footer-social-link.component'
import { FOOTER_LEGAL_LINKS, FOOTER_SOCIAL_LINKS } from './footer.const'
import './footer.styles.css'

const FooterComponent = () => {
  return (
    <footer className="footer">
      <div className="footer__content">
        <div className="footer__meta">
          <p className="footer__copyright">
            Duelists Unite &copy; {new Date().getFullYear()} All rights reserved.
          </p>
          <nav className="footer__legal" aria-label="Legal">
            {FOOTER_LEGAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="footer__legal-link">
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="footer__privacy-controls">
            <CcpaOptOutLink />
            <ConsentManagementLink />
          </div>
        </div>
        <nav className="footer__links" aria-label="Social media">
          {FOOTER_SOCIAL_LINKS.map((link) => (
            <FooterSocialLink
              key={link.href}
              href={link.href}
              label={link.label}
              className="footer__links-link"
            >
              <IconComponent icon={link.icon} width={24} height={24} />
            </FooterSocialLink>
          ))}
        </nav>
      </div>
    </footer>
  )
}

export default FooterComponent
