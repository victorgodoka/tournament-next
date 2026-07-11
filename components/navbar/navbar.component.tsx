import AuthComponent from '../auth/auth.component'
import I18nComponent from '../i18n/i18n.component'
import LogoComponent from '../logo/logo.component'
import MenulinksComponent from '../menulinks/menulinks.component'
import './navbar.styles.css'

const NavbarComponent = () => {
  return (
    <header className="navbar">
      <LogoComponent />
      <div className="navbar__menu">
        <MenulinksComponent />
      </div>
      <div className="navbar__actions">
        <div className="navbar__i18n">
          <I18nComponent />
        </div>
        <AuthComponent />
      </div>
    </header>
  )
}

export default NavbarComponent
