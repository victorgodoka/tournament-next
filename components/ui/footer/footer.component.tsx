import Image from "next/image";
import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { FOOTER_DISCLAIMER, FOOTER_LINKS } from "@utils/const";

export const Footer = ({ className }: { className?: string }) => (
  <footer className={twMerge("border-t border-line bg-surface-000 px-5.5 pt-8 pb-30 sm:pb-8 lg:px-11", className)}>
    <div className="flex flex-wrap items-center justify-between gap-5">
      <div className="flex items-center gap-3">
        <Image src="/logo.png" alt="" width={24} height={24} className="w-6 h-6" />
        <span className="text-ink-muted mono-handle text-[11px]">{FOOTER_DISCLAIMER}</span>
      </div>
      <nav aria-label="Footer" className="flex flex-wrap gap-6 signal-nav">
        {FOOTER_LINKS.map(({ item, to }) => (
          <Link key={to} href={to} className="text-ink-muted hover:text-gold">
            {item}
          </Link>
        ))}
      </nav>
    </div>
  </footer>
)
