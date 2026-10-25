import Image from 'next/image'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { Chip } from '@ui/chip'
import { Coins } from '@ui/coins'
import { Eyebrow } from '@ui/eyebrow'

type TournamentCardProps = {
  name: string
  players: number
  capacity: number
  bestOf?: 1 | 3
  structure: string
  formatTag?: 'TCG' | 'OCG' | 'Genesys'
  /** Time or state for the Eyebrow: "Sat 28 Sep · 19:00". */
  when: React.ReactNode
  /** "TCG 21.09.2026". */
  banlist: React.ReactNode
  status?: 'open' | 'live' | 'done'
  /** Key art, shown as supplied. Without it the band shows the dot field and the mark. */
  art?: string | null
  custom?: boolean
  prize?: number
  /** Switches the card to steel. One per grid. */
  featured?: boolean
  href: string
  className?: string
}

const FORMAT_TONE = { TCG: 'tcg', OCG: 'ocg', Genesys: 'genesys' } as const

/** No key art: a cyan glow in the corner over a faint 16px dot field. */
const EMPTY_ART: React.CSSProperties = {
  backgroundImage:
    'radial-gradient(ellipse 70% 90% at 80% 0%, rgba(0, 253, 255, 0.16), rgba(0, 0, 0, 0) 70%), radial-gradient(rgba(142, 166, 199, 0.18) 1px, rgba(0, 0, 0, 0) 1.5px)',
  backgroundSize: 'auto, 16px 16px',
}

const Meta = ({ label, children, featured }: { label: string; children: React.ReactNode; featured?: boolean }) => (
  <div className={twMerge('min-w-0 px-2.5 py-2', featured ? 'bg-steel' : 'bg-surface-100')}>
    <span className={twMerge('block font-mono text-[9px] leading-3 tracking-[0.16em] uppercase', featured ? 'text-ink-dim' : 'text-ink-muted')}>{label}</span>
    <b className="mt-0.5 block truncate font-sans text-[13px] leading-4.5 font-bold text-ink">{children}</b>
  </div>
)

/** A tournament in a grid: key-art band with chips, Eyebrow, Anton name, three-cell meta, seat bar, footer. 360px wide. */
export const TournamentCard = ({
  name, players, capacity, bestOf = 3, structure, formatTag, when, banlist, status = 'open', art, custom, prize, featured, href, className,
}: TournamentCardProps) => {
  const pct = Math.min(100, Math.round((players / Math.max(capacity, 1)) * 100))

  return (
    <Link
      href={href}
      className={twMerge(
        'cut notch flex w-full max-w-90 flex-col text-ink [--cut:var(--cut-md)] hover:-translate-y-0.5 hover:[--edge:var(--color-line-strong)] motion-safe:transition-transform motion-safe:duration-120',
        featured && '[--edge:var(--color-line-strong)] [--fill:var(--color-steel)]',
        className,
      )}
    >
      <div style={art ? undefined : EMPTY_ART} className="notch-clip relative mx-px mt-px h-32 overflow-hidden bg-surface-200">
        {art ? (
          <Image src={art} alt="" fill sizes="360px" unoptimized className="object-cover" />
        ) : (
          <Image src="/omega-mark.png" alt="" width={64} height={64} className="absolute right-4 bottom-3 opacity-90" />
        )}
        <div className="absolute top-4 left-4 flex gap-1.5">
          {status === 'live' ? <Chip tone="live">Live</Chip> : null}
          {formatTag ? <Chip tone={FORMAT_TONE[formatTag]}>{formatTag}</Chip> : null}
          {custom ? <Chip tone="custom">Custom</Chip> : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 px-5 pt-4 pb-5">
        <Eyebrow tone={status === 'live' ? 'negative' : 'gold'} live={status === 'live'} rule={false}>{when}</Eyebrow>
        <h3 className="font-display text-2xl leading-[1.05] uppercase">{name}</h3>
        <div className={twMerge('grid grid-cols-[0.8fr_0.8fr_1.5fr] gap-px border', featured ? 'border-line-strong bg-line-strong' : 'border-line bg-line')}>
          <Meta label="Players" featured={featured}>{players}/{capacity}</Meta>
          <Meta label="Games" featured={featured}>{bestOf === 1 ? 'Single' : 'Match'}</Meta>
          <Meta label="Structure" featured={featured}>{structure}</Meta>
        </div>
        <div role="img" aria-label={`${pct}% of seats filled`} className="h-1 bg-surface-300">
          <i className="block h-full bg-cyan" style={{ width: `${pct}%` }} />
        </div>
        <div className={twMerge('flex items-center justify-between gap-3 signal-sm', featured ? 'text-ink-dim' : 'text-ink-muted')}>
          <span>{banlist}</span>
          {prize ? <Coins amount={prize} /> : null}
        </div>
      </div>
    </Link>
  )
}
