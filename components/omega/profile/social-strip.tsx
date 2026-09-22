import { twMerge } from "tailwind-merge";
import type { ProfileSocial } from "@utils/types";
import { SOCIAL } from "./labels";

/** The API sends no label for a bare website, so fall back to the URL host (PROFILE_API.md §4.6). */
const hostOf = (href: string) => {
  try {
    return new URL(href).host.replace(/^www\./, '')
  } catch {
    return href
  }
}

/** Row of outlined mono links to the duelist's external profiles. */
export const SocialStrip = ({ socials, className }: { socials: ProfileSocial[]; className?: string }) => (
  <ul className={twMerge("flex flex-wrap gap-1.5", className)}>
    {socials.map(({ network, handle, href }) => (
      <li key={network}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={handle ?? hostOf(href)}
          className="inline-flex min-h-11 items-center border border-line-strong px-3 text-ink-dim signal-sm hover:border-gold hover:text-gold"
        >
          {network === 'website' ? hostOf(href) : SOCIAL[network].label}
        </a>
      </li>
    ))}
  </ul>
)
