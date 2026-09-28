import { twMerge } from 'tailwind-merge'

/** Solid 24px stand-ins for the client's white icon set. Swap in the exported glyphs under the same names. */
const PATHS = {
  close: 'M5.3 3.9 12 10.6l6.7-6.7 1.4 1.4-6.7 6.7 6.7 6.7-1.4 1.4-6.7-6.7-6.7 6.7-1.4-1.4 6.7-6.7-6.7-6.7z',
  plus: 'M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z',
  search: 'M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
  star: 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z',
  trophy: 'M6 3h12v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A5 5 0 0 1 7.3 12H7a4 4 0 0 1-4-4V5h3zm0 4H5v1a2 2 0 0 0 1 1.7zm12 0v2.7A2 2 0 0 0 19 8V7z',
  cart: 'M2 3h3.2l.7 3H21l-2.2 8H7.6l.5 2H19v2H6.5L3.6 5H2zm6 16.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm9 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z',
  chart: 'M4 20V10h3v10zm6.5 0V4h3v16zM17 20v-7h3v7z',
  chat: 'M4 4h16v12H9l-5 4z',
  gear: 'M10.5 2h3l.5 2.6 1.8.8 2.2-1.5 2.1 2.1-1.5 2.2.8 1.8 2.6.5v3l-2.6.5-.8 1.8 1.5 2.2-2.1 2.1-2.2-1.5-1.8.8-.5 2.6h-3l-.5-2.6-1.8-.8-2.2 1.5-2.1-2.1 1.5-2.2-.8-1.8L2 13.5v-3l2.6-.5.8-1.8-1.5-2.2 2.1-2.1 2.2 1.5 1.8-.8zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  sword: 'M20.5 3.5 20 8 10.8 17.2l1.6 1.6-1.4 1.4-1.6-1.6-3.3 3.3-2.1-2.1 3.3-3.3-1.6-1.6 1.4-1.4 1.6 1.6L16 3.9z',
  user: 'M12 3a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm-8 18c0-4 3.6-7 8-7s8 3 8 7z',
  host: 'M9 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM2 20c0-3.5 3.1-6 7-6s7 2.5 7 6zM18 7h2v3h3v2h-3v3h-2v-3h-3v-2h3z',
  send: 'M3 20.5V14l9-2-9-2V3.5L22 12z',
  down: 'M5 9l1.4-1.4 5.6 5.6 5.6-5.6L19 9l-7 7z',
  right: 'M9 5l7 7-7 7-1.4-1.4 5.6-5.6-5.6-5.6z',
  left: 'M15 5l1.4 1.4-5.6 5.6 5.6 5.6L15 19l-7-7z',
  bell: 'M12 3a6 6 0 0 1 6 6v4l2 3v1H4v-1l2-3V9a6 6 0 0 1 6-6zm-2.5 15h5a2.5 2.5 0 0 1-5 0z',
  deck: 'M7 3h12v15H7zM4 6h2v14h11v2H4z',
  calendar: 'M7 2h2v2h6V2h2v2h4v17H3V4h4zm-2 7v10h14V9z',
  filter: 'M3 4h18l-7 8.5V19l-4 2v-8.5z',
  copy: 'M8 3h11a2 2 0 0 1 2 2v11h-3V6H8V3zM3 8h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z',
  upload: 'M11 16V7.8L7.4 11.4 6 10l6-6 6 6-1.4 1.4L13 7.8V16h-2zM4 20v-5h2v3h12v-3h2v5H4z',
  download: 'M11 4v8.2L7.4 8.6 6 10l6 6 6-6-1.4-1.4-3.6 3.6V4h-2zM4 20v-5h2v3h12v-3h2v5H4z',
  grip: 'M8 4h3v3H8zM13 4h3v3h-3zM8 10.5h3v3H8zM13 10.5h3v3h-3zM8 17h3v3H8zM13 17h3v3h-3z',
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
  arrow: 'M12 4l-1.4 1.4 5.6 5.6H4v2h12.2l-5.6 5.6L12 20l8-8z',
  play: 'M7 4v16l13-8z',
  pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
  volume: 'M3 9h4l5-4v14l-5-4H3zM15 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2z',
  muted: 'M3 9h4l5-4v14l-5-4H3zM15.3 8.9l2.2 2.2 2.2-2.2 1.4 1.4-2.2 2.2 2.2 2.2-1.4 1.4-2.2-2.2-2.2 2.2-1.4-1.4 2.2-2.2-2.2-2.2z',
  menu: 'M3 6h18v2H3zM3 11h18v2H3zM3 16h18v2H3z',
  frame: 'M3 3h18v18H3zM7 7v10h10V7z',
  image: 'M2 4h20v16H2zM4 6v8.5l4.5-4.5 4.5 4.5 3-3 4 4V6zM16 7.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z',
  song: 'M8 3h12v4h-8v10a4 4 0 1 1-4-4z',
  bubble: 'M3 4h18v12H10l-5 4v-4H3z',
  badge: 'M12 2l8 3v6c0 5-3.4 9.2-8 11-4.6-1.8-8-6-8-11V5z',
  cards: 'M8 2h12v16H8zM4 6h2v14h10v2H4z',
  coin: 'M12 2l8.66 5v10L12 22l-8.66-5V7zM12 5.5 6.4 8.75v6.5L12 18.5l5.6-3.25v-6.5zM12 9l2.6 1.5v3L12 15l-2.6-1.5v-3z',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3h2v12H5V10zm2.5 0h5V7a2.5 2.5 0 0 0-5 0z',
}

export type IconName = keyof typeof PATHS

type IconProps = {
  name: IconName
  /** Only when the icon stands alone; otherwise it is hidden from screen readers. */
  label?: string
  /** Pixel size; defaults to 18. */
  size?: number
  className?: string
}

/** One solid glyph in currentColor. Put a word next to it, or give its button an aria-label. */
export const Icon = ({ name, label, size = 18, className }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    aria-hidden={label ? undefined : true}
    role={label ? 'img' : undefined}
    aria-label={label}
    className={twMerge('shrink-0 fill-current', className)}
  >
    <path d={PATHS[name]} fillRule="evenodd" />
  </svg>
)
