import { Icon } from '@iconify/react'
import { FOOTER_SOCIAL_LINKS } from './footer.const'
import './footer.styles.css'

const FooterComponent = () => {
  return (
    <footer className="footer">
      <div className="footer__content">
        <p className="footer__copyright">
          Duelists Unite &copy; {new Date().getFullYear()} All rights reserved.
        </p>
        <nav className="footer__links" aria-label="Social media">
          {FOOTER_SOCIAL_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="footer__links-link"
              aria-label={link.label}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon icon={link.icon} width={24} height={24} aria-hidden />
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}

export default FooterComponent
