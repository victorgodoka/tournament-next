'use client'

import dynamic from 'next/dynamic'
import { SPEEDS } from '@app/simulator/replay-bar'

// Client only, as the player: the board measures itself, and the capture is the browser's.
const ComboRecorder = dynamic(() => import('@app/simulator/combo-recorder').then((m) => m.ComboRecorder), { ssr: false })

type Param = string | string[] | undefined

/**
 * `shape` and `speed` as the URL has them: `portrait` or 16:9, and one of the replay's speeds or 1x. Read here, not in
 * the page: a server component only gets a reference to a client module's `SPEEDS`, never the array.
 */
export const RenderLoader = ({ id, shape, speed }: { id: string; shape?: Param; speed?: Param }) => (
  <ComboRecorder id={id} shape={shape === 'portrait' ? 'portrait' : 'landscape'} speed={SPEEDS.find((s) => String(s) === speed) ?? 1} />
)
