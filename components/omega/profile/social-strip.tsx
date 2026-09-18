'use client'

import { Icon } from "@iconify/react";
import { twMerge } from "tailwind-merge";
import type { ProfileSocial } from "@utils/types";
import { SOCIAL } from "./labels";

const host = (href: string) => {
  try {
    return new URL(href).host
  } catch {
    return href
  }
}

/** Hairline-gapped strip of external profiles, one icon plus handle each. */
export const SocialStrip = ({ socials, className }: { socials: ProfileSocial[]; className?: string }) => (
  <ul className={twMerge("flex w-fit max-w-full flex-wrap gap-px border border-line bg-line", className)}>
    {socials.map(({ network, handle, href }) => (
      <li key={network} className="flex-1">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={SOCIAL[network].label}
          className="flex h-full items-center gap-2.5 bg-surface-000 px-3.5 py-2.5 text-ink hover:bg-gold hover:text-gold-on"
        >
          <Icon icon={SOCIAL[network].icon} aria-hidden className="text-base" />
          <span className="whitespace-nowrap mono-data">{handle ?? host(href)}</span>
          <span className="sr-only">on {SOCIAL[network].label}</span>
        </a>
      </li>
    ))}
  </ul>
)
