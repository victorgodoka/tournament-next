'use client'

import dynamic from 'next/dynamic'
import { SPEEDS } from '@app/simulator/replay-bar'

// Client only, as the player: the board measures itself, and `window.__render` is all the renderer talks to.
const ComboRender = dynamic(() => import('@app/simulator/combo-render').then((m) => m.ComboRender), { ssr: false })

/**
 * `speed` as the URL has it: one of the replay's speeds, anything else 1x. Read here, not in the page: a server component
 * only gets a reference to a client module's `SPEEDS`, never the array.
 */
export const RenderLoader = ({ id, speed }: { id: string; speed?: string | string[] }) => (
  <ComboRender id={id} speed={SPEEDS.find((s) => String(s) === speed) ?? 1} />
)
