import IconComponent from '../icon/icon.component'
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
              aria-label={`${link.label} (opens in new tab)`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconComponent icon={link.icon} width={24} height={24} />
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}

export default FooterComponent
