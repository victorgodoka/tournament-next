'use client'

import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { trackOutboundClick } from '@lib/gtm'

type FooterSocialLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
  label: string
  children: ReactNode
}

const FooterSocialLink = ({
  href,
  label,
  children,
  onClick,
  ...props
}: FooterSocialLinkProps) => {
  return (
    <a
      href={href}
      aria-label={`${label} (opens in new tab)`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => {
        trackOutboundClick({
          link_url: href,
          link_text: label,
          link_location: 'footer',
        })
        onClick?.(event)
      }}
      {...props}
    >
      {children}
    </a>
  )
}

export default FooterSocialLink
