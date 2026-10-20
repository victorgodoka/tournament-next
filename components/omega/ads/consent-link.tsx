'use client'

import { useEffect } from 'react'
import { refreshConsentManagementLink } from '@utils/nitro-privacy'

export const ConsentManagementLink = () => {
  useEffect(() => {
    refreshConsentManagementLink()
  }, [])

  // ncmp-consent-link is NitroPay's required container id: the CMP
  // injects a styled "Manage Consent" button here for applicable visitors.
  return <div id="ncmp-consent-link" />
}
