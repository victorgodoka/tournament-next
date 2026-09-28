import Image from 'next/image'
import { twMerge } from 'tailwind-merge'
import { Eyebrow } from '@ui/eyebrow'

type NoticeProps = {
  title?: React.ReactNode
  date?: React.ReactNode
  version?: React.ReactNode
  /** Shows the Omega mark in the footer. */
  mark?: boolean
  tone?: React.ComponentProps<typeof Eyebrow>['tone']
  className?: string
  children: React.ReactNode
}

/** An announcement, one per page: Eyebrow, one or two sentences, a footer with the mark and version. */
export const Notice = ({ title = 'Notice', date, version, mark, tone = 'gold', className, children }: NoticeProps) => (
  <aside role="note" className={twMerge('cut notch flex max-w-105 flex-col gap-3 p-5 [--cut:var(--cut-md)]', className)}>
    <Eyebrow tone={tone} meta={date}>{title}</Eyebrow>
    <p className="text-ink body">{children}</p>
    {version || mark ? (
      <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-ink-muted signal-sm">
        {mark ? <Image src="/omega-mark.png" alt="" width={26} height={24} /> : <span />}
        <span>{version}</span>
      </div>
    ) : null}
  </aside>
)
