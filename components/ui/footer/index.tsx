import Image from "next/image";
import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { FOOTER_DISCLAIMER, FOOTER_LINKS, FOOTER_MEDIA_NOTE } from "@utils/const";
import { CcpaOptOutLink } from "@omega/ads/ccpa-link";
import { ConsentManagementLink } from "@omega/ads/consent-link";
import { VipPromo } from "@omega/ads/vip-promo";

export const Footer = ({ className }: { className?: string }) => (
  <footer id="site-footer" className={twMerge("border-t border-line bg-space-000 px-gutter pt-8 pb-30 sm:pb-8", className)}>
    {/* Our own ad: on every page with ads, gone for a VIP. */}
    <VipPromo className="mb-8" />
    <div className="flex flex-wrap items-center justify-between gap-5">
      <div className="flex items-center gap-3">
        <Image src="/omega-mark.png" alt="" width={30} height={30} />
        <span className="text-ink-muted mono-note">{FOOTER_DISCLAIMER}</span>
      </div>
      <nav aria-label="Footer" className="flex flex-wrap gap-6 signal-strong">
        {FOOTER_LINKS.map(({ item, to }) => (
          <Link key={to} href={to} className="text-ink-muted hover:text-ink">
            {item}
          </Link>
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
