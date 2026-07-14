'use client'

import { useEffect } from 'react'
import { refreshCcpaOptOutLink } from '@lib/nitro-privacy'

const CcpaOptOutLink = () => {
  useEffect(() => {
    refreshCcpaOptOutLink()
  }, [])

  // data-ccpa-link is NitroPay's required marker: it injects a "Do Not
  // Sell or Share My Personal Information" link here for CA residents
  // and renders nothing for everyone else.
  return <span data-ccpa-link="1" />
}

export default CcpaOptOutLink
