import { twMerge } from 'tailwind-merge'
import { CardImage } from '@omega/card-art'
import { CARD_ART_URL } from '@utils/const'
import type { WikiStatisticsDeck } from '@utils/wiki-doc'
import { statisticsDeckHref } from '@utils/wiki-statistics-deck'
import { WIKI_TILE } from './wiki'

export const StatisticsDeckArt = ({ deck, className }: { deck: WikiStatisticsDeck; className?: string }) => (
  <span className={twMerge('relative block aspect-square w-full overflow-hidden border border-line-mid bg-surface-200', className)}>
    {deck.faces.map((id, index) => (
      <span key={id} style={index ? { width: `${Math.min(48, 90 / (deck.faces.length - 1))}%`, right: `${(index - 1) * Math.min(48, 90 / (deck.faces.length - 1))}%` } : undefined} className={index ? 'absolute bottom-0 z-1 aspect-square overflow-hidden border-2 border-surface-200 bg-surface-200' : 'absolute inset-0 overflow-hidden'}>
        <CardImage src={CARD_ART_URL(id)} alt={`${deck.name} cover${deck.faces.length > 1 ? ` ${index + 1} of ${deck.faces.length}` : ''}`} fill sizes="(min-width: 640px) 240px, 50vw" className="object-cover" />
      </span>
    ))}
    {!deck.faces.length ? <span className="flex h-full items-center justify-center p-3 text-center text-ink-muted signal-sm">{deck.name || 'Select a deck'}</span> : null}
  </span>
)

export const StatisticsDeck = ({ deck, caption }: { deck: WikiStatisticsDeck; caption?: string }) => (
  <figure className="clear-both my-5">
    <a href={statisticsDeckHref(deck)} className={twMerge(WIKI_TILE, 'grid grid-cols-[96px_minmax(0,1fr)] items-center gap-4 p-3 text-ink hover:text-ink sm:grid-cols-[144px_minmax(0,1fr)] sm:gap-5 sm:p-4')}>
      <StatisticsDeckArt deck={deck} />
      <span className="flex min-w-0 flex-col gap-2">
        <span className="text-cyan signal-sm">{deck.ladder === 'tcg' ? 'TCG' : 'Genesys'} · Statistics →</span>
        <span className="text-xl/[1.1] display-3 sm:text-2xl">{deck.name}</span>
      </span>
    </a>
    {caption ? <figcaption className="mt-2 text-ink-dim body-sm">{caption}</figcaption> : null}
  </figure>
)
