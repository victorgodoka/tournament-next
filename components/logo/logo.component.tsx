import Link from 'next/link'
import { OG_IMAGE } from '@lib/site-config'
import './logo.styles.css'

const LOGO_MARK_SIZE = 40

const LogoComponent = () => {
  return (
    <Link href="/" className="logo" aria-label="YGO Omega — Home">
      <span className="logo__mark-wrap">
        <img
          className="logo__mark"
          src={OG_IMAGE.url}
          alt=""
          width={LOGO_MARK_SIZE}
          height={LOGO_MARK_SIZE}
          decoding="async"
        />
      </span>
      <span className="logo__wordmark">Omega</span>
    </Link>
  )
}

export default LogoComponent
