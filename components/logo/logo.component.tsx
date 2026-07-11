import { Link } from 'react-router'
import './logo.styles.css'

const LogoComponent = () => {
  return (
    <Link to="/" className="logo" aria-label="YGO Omega — Home">
      <img
        className="logo__mark"
        src="/logo.png"
        alt=""
        width={40}
        height={40}
        decoding="async"
      />
      <span className="logo__wordmark">Omega</span>
    </Link>
  )
}

export default LogoComponent
