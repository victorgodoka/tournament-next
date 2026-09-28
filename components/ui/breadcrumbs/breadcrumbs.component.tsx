import Link from 'next/link'
import { Fragment } from 'react'
import { twMerge } from 'tailwind-merge'

type BreadcrumbsProps = {
  /** Root first. The last one is where you are: bold ink, never a link. */
  items: { label: React.ReactNode; href?: string }[]
  className?: string
}

/** Mono trail split by slashes. */
export const Breadcrumbs = ({ items, className }: BreadcrumbsProps) => (
  <nav aria-label="Breadcrumb" className={twMerge('flex min-w-0 flex-wrap items-center gap-4 text-ink-muted signal', className)}>
    {items.map((item, i) => {
      const last = i === items.length - 1
      return (
        <Fragment key={i}>
          {i > 0 ? <span aria-hidden>/</span> : null}
          {last ? (
            <span aria-current="page" className="font-bold text-ink">{item.label}</span>
          ) : item.href ? (
            <Link href={item.href} className="text-ink-muted hover:text-cyan">{item.label}</Link>
          ) : (
            <span>{item.label}</span>
          )}
        </Fragment>
      )
    })}
  </nav>
)
