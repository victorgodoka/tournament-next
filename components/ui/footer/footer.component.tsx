import Image from "next/image";
import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { FOOTER_DISCLAIMER, FOOTER_LINKS, FOOTER_MEDIA_NOTE } from "@utils/const";

export const Footer = ({ className }: { className?: string }) => (
  <footer id="site-footer" className={twMerge("border-t border-line bg-space-000 px-gutter pt-8 pb-30 sm:pb-8", className)}>
    <div className="flex flex-wrap items-center justify-between gap-5">
      <div className="flex items-center gap-3">
        <Image src="/omega-mark.png" alt="" width={30} height={28} />
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
    <p className="mt-4 max-w-[72ch] text-ink-muted mono-note opacity-70">{FOOTER_MEDIA_NOTE}</p>
  </footer>
)
