import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@ui/icon'
import { cardId, cardName, direction, STATUS_TONE, wikiPath, type BanStatus } from '@utils/banlist'
import { CARD_IMAGE_URL } from '@utils/const'

/** A status as a pill: filled for where a card lands, outlined and struck through for where it was. */
export const StatusPill = ({ code, was, short }: { code: BanStatus; was?: boolean; short?: boolean }) => {
  const t = useTranslations('Banlist')
  const tone = STATUS_TONE[code]
  return (
    <span
      title={short ? t(`status.${code}`) : undefined}
      className={twMerge(
        'inline-flex items-center justify-center px-1.5 py-0.5 font-bold whitespace-nowrap signal-sm',
        short && 'min-w-6',
        was ? twMerge('border border-current line-through decoration-1 opacity-80', tone.text) : twMerge(tone.fill, tone.on),
      )}
    >
      {short ? code : t(`status.${code}`)}
    </span>
  )
}

/** `Unlimited → Forbidden`: the arrow is red when the card tightens, green when it loosens. */
export const StatusShift = ({ from, to, short, className }: { from: BanStatus; to: BanStatus; short?: boolean; className?: string }) => {
  const t = useTranslations('Banlist')
  const down = direction({ from, to }) === 'down'
  return (
    <span className={twMerge('flex shrink-0 items-center gap-1.5', className)}>
      <StatusPill code={from} was short={short} />
      <Icon name="right" size={14} className={down ? 'text-crimson-lift' : 'text-win'} />
      <span className="sr-only">{t('timeline.to')}</span>
      <StatusPill code={to} short={short} />
    </span>
  )
}

/** A card's scan linking to its wiki page, with the change it took on this list when there is one. */
export const CardTile = ({ card, from, to }: { card: number; from?: BanStatus; to?: BanStatus }) => (
  <li className="flex min-w-0 flex-col gap-1.5">
    <Link href={wikiPath(card)} target="_blank" rel="noopener" className="group flex flex-col gap-1.5">
      <span
        className={twMerge(
          'relative block aspect-[59/86] overflow-hidden bg-surface-300 motion-safe:transition-transform group-hover:-translate-y-0.5',
          to && 'ring-2',
          to && STATUS_TONE[to].text,
        )}
      >
        {/* 160 CSS px resolves to the common scan at 1x and 2x alike. */}
        <Image src={CARD_IMAGE_URL(cardId(card))} alt={cardName(card)} fill sizes="160px" className="object-cover" />
        {from && to ? <StatusShift from={from} to={to} short className="absolute inset-x-0 bottom-0 justify-center bg-space-000/85 py-1.5" /> : null}
      </span>
      <span className="line-clamp-2 text-ink-dim body-sm group-hover:text-cyan">{cardName(card)}</span>
    </Link>
  </li>
)

/** Tiles for many cards. */
export const CardGrid = ({ children }: { children: React.ReactNode }) => (
  <ul className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-x-3 gap-y-4">{children}</ul>
)
