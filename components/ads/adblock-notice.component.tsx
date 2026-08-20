'use client'

import { useState } from 'react'
import IconComponent from '../icon/icon.component'
import './ads.styles.css'

const DISMISSAL_KEY = 'duelistsunite-adblock-notice-dismissed'

function wasAdBlocked(): boolean {
  const bait = document.createElement('div')
  bait.className = 'ad-banner adsbox pub_300x250'
  bait.setAttribute('aria-hidden', 'true')
  bait.style.cssText =
    'position:absolute;left:-10000px;top:-10000px;width:1px;height:1px;'

  document.body.appendChild(bait)

  const styles = window.getComputedStyle(bait)
  const blocked =
    bait.offsetHeight === 0 ||
    bait.offsetWidth === 0 ||
    styles.display === 'none' ||
    styles.visibility === 'hidden'

  bait.remove()
  return blocked
}

function wasDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISSAL_KEY) === 'true'
  } catch {
    return false
  }
}

const AdblockNotice = () => {
  const [blocked] = useState(
    () => typeof document !== 'undefined' && wasAdBlocked(),
  )
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && wasDismissed(),
  )

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(DISMISSAL_KEY, 'true')
    } catch {
      // Storage can be unavailable in private browsing modes.
    }
    setDismissed(true)
  }

  if (!blocked || dismissed) return null

  return (
    <aside className="adblock-notice" role="status" aria-live="polite">
      <div className="adblock-notice__signal" aria-hidden="true">
        <IconComponent icon="mdi:shield-alert-outline" width={22} height={22} />
      </div>
      <div className="adblock-notice__content">
        <h2>Ads are being blocked</h2>
        <p>
          Ads help keep Duelists Unite free. Please allow ads for this site to
          support the service.
        </p>
      </div>
      <button
        type="button"
        className="adblock-notice__close"
        aria-label="Dismiss ad blocker notice"
        onClick={dismiss}
      >
        <IconComponent icon="mdi:close" width={20} height={20} aria-hidden />
      </button>
    </aside>
  )
}

export default AdblockNotice