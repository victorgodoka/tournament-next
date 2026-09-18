import Image from 'next/image'
import { twMerge } from 'tailwind-merge'
import { CARD_ART_URL } from '@utils/const'
import type { CardArt as CardArtType } from '@utils/types'

type CardArtProps = {
  art: CardArtType
  /** Overrides the default `<card name> card artwork` description. */
  alt?: string
  /** Sizes hint for the responsive loader. Always pass the real rendered width. */
  sizes: string
  className?: string
  imageClassName?: string
  priority?: boolean
  children?: React.ReactNode
}

/** Card artwork filling its container. The wrapper owns the size, the image only fills it. */
export const CardArt = ({ art, alt, sizes, className, imageClassName, priority, children }: CardArtProps) => (
  <div className={twMerge('relative overflow-hidden bg-surface-000', className)}>
    <Image
      src={CARD_ART_URL(art.id)}
      alt={alt ?? (art.name ? `${art.name} card artwork` : 'Card artwork')}
      fill
      sizes={sizes}
      priority={priority}
      className={twMerge('object-cover object-center', imageClassName)}
    />
    {children}
  </div>
)
