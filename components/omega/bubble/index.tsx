import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import { bubbleVars, type BubbleStyle } from '@utils/bubble'
import './bubble.css'

type ChatBubbleProps = {
  style: BubbleStyle
  /** The item's image (`assetUrl`). */
  sticker?: string | null
  /** Your own message: right-aligned, sticker mirrored. */
  mine?: boolean
  className?: string
  children: ReactNode
}

/** A message in someone's equipped bubble, as the messenger draws it. */
export const ChatBubble = ({ style, sticker, mine, className, children }: ChatBubbleProps) => (
  <div className={twMerge('bubble', mine && 'is-mine', className)} style={bubbleVars(style, mine)}>
    {children}
    {sticker ? (
      // eslint-disable-next-line @next/next/no-img-element -- Cloudinary asset at 16–64px, like the frame it skips the optimiser
      <img src={sticker} alt="" className={twMerge('bubble-sticker', style.sticker.animate !== 'none' && `is-${style.sticker.animate}`)} />
    ) : null}
  </div>
)
