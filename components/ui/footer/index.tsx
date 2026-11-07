import Image from "next/image";
import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { FOOTER_DISCLAIMER, FOOTER_GROUPS, FOOTER_MEDIA_NOTE } from "@utils/const";
import { CcpaOptOutLink } from "@omega/ads/ccpa-link";
import { ConsentManagementLink } from "@omega/ads/consent-link";
import { VipPromo } from "@omega/ads/vip-promo";

export const Footer = ({ className }: { className?: string }) => (
  <footer id="site-footer" className={twMerge("border-t border-line bg-space-000 px-gutter pt-8 pb-30 sm:pb-8", className)}>
    {/* Our own ad: on every page with ads, gone for a VIP. */}
    <VipPromo className="mb-8" />
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <Image src="/omega-mark.png" alt="" width={30} height={30} />
        <span className="text-ink-muted mono-note">{FOOTER_DISCLAIMER}</span>
      </div>
      <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
        {FOOTER_GROUPS.map(({ title, links }) => (
          <div key={title} className="flex min-w-0 flex-col gap-3">
            <h2 className="text-ink signal-strong">{title}</h2>
            <ul className="flex flex-col gap-1">
              {links.map(({ item, to }) => (
                <li key={to}>
                  <Link href={to} className="inline-flex min-h-11 items-center text-ink-muted signal-strong hover:text-ink sm:min-h-8">
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
    {/* NitroPay fills these for the visitors its privacy rules cover (CCPA, GDPR) and leaves them empty for everyone else. */}
    <div className="mt-4 flex flex-wrap items-center gap-4 text-ink-muted mono-note">
      <CcpaOptOutLink />
      <ConsentManagementLink />
    </div>
    <p className="mt-4 max-w-[72ch] text-ink-muted mono-note">{FOOTER_MEDIA_NOTE}</p>
  </footer>
)
