/**
 * What moves over the field. A tilted plane has no straight way to slide a card in screen px, so a move is a flight: a
 * copy of the card crosses a flat layer over the board while the card itself stays hidden, and shows through as the copy
 * lands. What belongs on the table (a ripple, a riffle) sits in the plane instead, in the ground layer, so it lies exactly
 * on its zone. Everything runs on the Web Animations API, so the video's `seek` (`document.getAnimations()`) holds it at
 * any time; what is left over stays invisible in its layer until the next step clears it.
 */

/** Where a card stands, relative to the board: its centre, its scale over its laid-out size, the turn of DEF and the plane's tilt. */
export type Pose = { x: number; y: number; scale: number; turn: number; tilt: number }
type Size = { w: number; h: number }

/** Where effects go, for one step. `k` scales their length with the replay's speed; `marks` are the overlays a card carries, removed on the next step. */
export type Stage = { flat: HTMLElement; ground: HTMLElement; k: number; marks: Element[] }

export type Flight = {
  delay?: number
  /** What shows first: the copy turns over from this to its own look on the way. */
  under?: HTMLElement
  /** It lands dimmed: a card on its way to the GY. */
  dim?: boolean
  /** It lands flattened to a line: a card being banished. */
  squash?: boolean
}

const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
/** How far a card rises over its straight line, in card heights, and how much it grows at the top of the arc. */
const ARC = 0.3
const GROW = 1.12
/** Where in the flight the card on the board starts to show through the copy. */
const SHOW = 0.84
/** How thin a banished card gets. */
const LINE = 0.04

const spawn = (host: HTMLElement, className: string) => {
  const el = document.createElement('div')
  el.className = className
  host.append(el)
  return el
}

/** A piece of effect lying exactly on a zone, in the plane. */
const onCell = (ground: HTMLElement, cell: HTMLElement, className: string) => {
  const el = spawn(ground, className)
  el.style.left = `${cell.offsetLeft}px`
  el.style.top = `${cell.offsetTop}px`
  el.style.width = `${cell.offsetWidth}px`
  el.style.height = `${cell.offsetHeight}px`
  return el
}

export const sizeOf = (el: HTMLElement): Size => ({ w: el.offsetWidth, h: el.offsetHeight })

/** `el` as it stands: a card (`data-pos="def"` when turned) or a zone's cell. By width, which the tilt leaves alone. */
export const poseOf = (el: HTMLElement, origin: DOMRect, tilt: number): Pose => {
  const box = el.getBoundingClientRect()
  const turned = el.dataset.pos === 'def'
  const across = (turned ? el.offsetHeight : el.offsetWidth) || box.width || 1
  return { x: box.left + box.width / 2 - origin.left, y: box.top + box.height / 2 - origin.top, scale: box.width / across, turn: turned ? 90 : 0, tilt }
}

/** A copy of the card and what shows with it (the back of a set card), rid of everything that marks it on the board. */
export const lookOf = (card: HTMLElement): HTMLElement => {
  const look = card.parentElement!.cloneNode(true) as HTMLElement
  look.className = 'relative size-full'
  for (const mark of look.querySelectorAll('span[aria-hidden], .sim-mark')) mark.remove()
  for (const tile of look.querySelectorAll('[data-card]')) tile.removeAttribute('data-card')
  return look
}

/** The back of a card, for a copy that turns over. */
export const backFace = () => {
  const img = document.createElement('img')
  img.src = '/back.webp'
  img.alt = ''
  img.className = 'size-full object-cover'
  return img
}

const place = (p: Pose, { w, h }: Size, camera: number, squash = 1) =>
  `translate(${p.x - w / 2}px, ${p.y - h / 2}px) perspective(${camera}px) rotateX(${p.tilt}deg) rotate(${p.turn}deg) scale(${p.scale}) scaleY(${squash})`

/** The top of the arc: half way, above both ends, a little bigger, half way into the plane. */
const peak = (from: Pose, to: Pose, { h }: Size): Pose => ({
  x: (from.x + to.x) / 2,
  y: Math.min(from.y, to.y) - h * ARC,
  scale: Math.max(from.scale, to.scale) * GROW,
  turn: (from.turn + to.turn) / 2,
  tilt: (from.tilt + to.tilt) / 2,
})

const copyOf = (layer: HTMLElement, size: Size) => {
  const copy = spawn(layer, 'sim-flight')
  copy.inert = true
  copy.style.width = `${size.w}px`
  copy.style.height = `${size.h}px`
  return copy
}

/** Flies `look` over `layer` from one pose to the other. */
export const fly = (layer: HTMLElement, look: HTMLElement, from: Pose, to: Pose, size: Size, camera: number, ms: number, { delay = 0, under, dim, squash }: Flight = {}) => {
  const copy = copyOf(layer, size)
  const body = spawn(copy, 'sim-flight-body')
  spawn(body, 'sim-face').append(look)
  if (under) {
    spawn(body, 'sim-face sim-face-under').append(under)
    body.animate([{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(0deg)' }], { duration: ms, delay, easing: EASE, fill: 'both' })
  }
  copy.animate(
    [
      { offset: 0, transform: place(from, size, camera), opacity: 1, filter: 'brightness(1)' },
      { offset: 0.5, transform: place(peak(from, to, size), size, camera) },
      { offset: SHOW, opacity: 1 },
      { offset: 1, transform: place(to, size, camera, squash ? LINE : 1), opacity: 0, filter: dim ? 'brightness(0.5)' : 'brightness(1)' },
    ],
    { duration: ms, delay, easing: EASE, fill: 'both' },
  )
}

/** Keeps the real card out of sight until its copy lands on it. */
export const sink = (el: Element | null | undefined, ms: number, delay = 0) =>
  el?.animate(
    [
      { offset: 0, opacity: 0 },
      { offset: SHOW, opacity: 0 },
      { offset: 1, opacity: 1 },
    ],
    { duration: ms, delay, easing: EASE, fill: 'backwards' },
  )

/** A card touching down: square rings running out from its zone, and the zone's glass lighting up. */
export const ripple = ({ ground, k }: Stage, cell: HTMLElement, delay: number) => {
  for (const [grow, wait] of [[1.5, 0], [1.26, 90]] as const) {
    onCell(ground, cell, 'sim-ripple').animate(
      [
        { transform: 'scale(1)', opacity: 0.9 },
        { transform: `scale(${grow})`, opacity: 0 },
      ],
      { duration: 460 * k, delay: delay + wait * k, easing: 'ease-out' },
    )
  }
  cell.querySelector('.sim-plate')?.animate([{ filter: 'brightness(2.4)' }, { filter: 'brightness(1)' }], { duration: 420 * k, delay })
}

/** A pile taking a card: its glass lights up and its count jumps. */
export const pileGain = ({ k }: Stage, cell: HTMLElement, delay: number) => {
  cell.querySelector('.sim-plate')?.animate([{ filter: 'brightness(2.4)' }, { filter: 'brightness(1)' }], { duration: 420 * k, delay })
  cell.querySelector('[data-count]')?.animate([{ scale: '1.7' }, { scale: '1' }], { duration: 340 * k, delay, easing: EASE })
}

/** A card reaching the hand: it stands out of the fan, lit up, then settles back in. */
export const handGain = ({ k }: Stage, host: HTMLElement | null, delay: number) => {
  const lit = { translate: '0 -24%', filter: 'brightness(1.35) drop-shadow(0 0 12px var(--color-cyan))' }
  host?.animate(
    [
      { offset: 0, translate: '0 0', filter: 'brightness(1)', easing: EASE },
      { offset: 0.2, ...lit },
      { offset: 0.78, ...lit, easing: EASE },
      { offset: 1, translate: '0 0', filter: 'brightness(1)' },
    ],
    { duration: 1000 * k, delay },
  )
}

/** A shaft of light rising from a card, in the hero's rays. */
export const pillar = ({ flat, k }: Stage, at: Pose, size: Size, delay: number) => {
  const w = size.w * at.scale * 1.3
  const h = size.h * at.scale * 3
  const shaft = spawn(flat, 'sim-pillar')
  shaft.style.left = `${at.x - w / 2}px`
  shaft.style.top = `${at.y - h}px`
  shaft.style.width = `${w}px`
  shaft.style.height = `${h}px`
  shaft.animate(
    [
      { offset: 0, transform: 'scaleY(0.1)', opacity: 0, easing: EASE },
      { offset: 0.3, transform: 'scaleY(1)', opacity: 1, easing: 'ease-in' },
      { offset: 1, transform: 'scaleY(1.06) scaleX(0.5)', opacity: 0 },
    ],
    { duration: 680 * k, delay },
  )
}

/** Panes of glass flying out from a point. Laid out by index, never at random: a replay shows the same thing twice. */
export const burst = ({ flat, k }: Stage, at: Pose, size: Size, tone: 'cyan' | 'crimson', delay: number, count = 12) => {
  const reach = size.w * at.scale * 1.15
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.21
    const far = reach * (0.7 + ((i * 7) % 5) / 7)
    const pane = spawn(flat, `sim-pane sim-pane-${tone}`)
    pane.style.left = `${at.x}px`
    pane.style.top = `${at.y}px`
    pane.animate(
      [
        { offset: 0, transform: 'translate(-50%, -50%) rotate(0deg) scale(1)', opacity: 1 },
        { offset: 0.6, opacity: 1 },
        { offset: 1, transform: `translate(calc(-50% + ${Math.cos(angle) * far}px), calc(-50% + ${Math.sin(angle) * far}px)) rotate(${(i % 2 ? 1 : -1) * (120 + i * 20)}deg) scale(0.4)`, opacity: 0 },
      ],
      { duration: (620 + (i % 4) * 50) * k, delay, easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)' },
    )
  }
}

/** A word in Anton over a card: what just happened to it. */
export const label = ({ flat, k }: Stage, at: Pose, size: Size, text: string, delay: number) => {
  const word = spawn(flat, 'sim-label dock-title')
  word.textContent = text
  word.style.left = `${at.x}px`
  word.style.top = `${at.y - (size.h * at.scale) / 2}px`
  word.animate(
    [
      { offset: 0, transform: 'translate(-50%, -30%)', opacity: 0 },
      { offset: 0.14, transform: 'translate(-50%, -60%)', opacity: 1 },
      { offset: 0.82, transform: 'translate(-50%, -60%)', opacity: 1 },
      { offset: 1, transform: 'translate(-50%, -80%)', opacity: 0 },
    ],
    { duration: 900 * k, delay },
  )
}

/** An overlay a card carries while its step is on screen. */
const mark = ({ marks }: Stage, host: HTMLElement, className: string) => {
  const el = spawn(host, `sim-mark ${className}`)
  marks.push(el)
  return el
}

/** An effect read off a card: a band of light down its face. */
export const scan = (stage: Stage, host: HTMLElement, delay: number) => {
  spawn(mark(stage, host, 'sim-scan'), 'sim-scan-band').animate([{ transform: 'translateY(-120%)' }, { transform: 'translateY(120%)' }], { duration: 560 * stage.k, delay, easing: 'ease-in-out', fill: 'both' })
}

/** A negation: a stroke drawn across the card, as the home page strikes a word. */
export const strike = (stage: Stage, host: HTMLElement) => {
  mark(stage, host, 'sim-strike').animate([{ transform: 'rotate(-56deg) scaleX(0)' }, { transform: 'rotate(-56deg) scaleX(1)' }], { duration: 320 * stage.k, easing: EASE, fill: 'both' })
}

/** Six pieces along the cracks `DestroyMark` draws: `[clip, how far out across, how far out down, turn]`, in card sizes. */
const PIECES: [string, number, number, number][] = [
  ['polygon(0 0, 52% 0, 46% 28%, 14% 19%, 0 24%)', -0.5, -0.45, -40],
  ['polygon(52% 0, 100% 0, 100% 38%, 88% 38%, 61% 50%, 46% 28%)', 0.55, -0.5, 35],
  ['polygon(0 24%, 14% 19%, 46% 28%, 61% 50%, 41% 70%, 10% 79%, 0 74%)', -0.7, 0.05, -25],
  ['polygon(61% 50%, 88% 38%, 100% 38%, 100% 72%, 68% 65%)', 0.7, 0.1, 30],
  ['polygon(0 74%, 10% 79%, 41% 70%, 56% 100%, 0 100%)', -0.45, 0.55, 22],
  ['polygon(41% 70%, 61% 50%, 68% 65%, 100% 72%, 100% 100%, 56% 100%)', 0.5, 0.6, -30],
]

/** A destroyed card: it holds a moment, cracked, then flies apart along its cracks. */
export const shatter = (stage: Stage, look: HTMLElement, at: Pose, size: Size, camera: number) => {
  for (const [clip, across, down, spin] of PIECES) {
    const piece = copyOf(stage.flat, size)
    piece.style.clipPath = clip
    piece.append(look.cloneNode(true))
    const out = { ...at, x: at.x + across * size.w * at.scale, y: at.y + down * size.h * at.scale, turn: at.turn + spin }
    piece.animate(
      [
        { offset: 0, transform: place(at, size, camera), opacity: 1 },
        { offset: 0.28, transform: place(at, size, camera), opacity: 1 },
        { offset: 1, transform: place(out, size, camera), opacity: 0 },
      ],
      { duration: 820 * stage.k, easing: 'cubic-bezier(0.3, 0.1, 0.3, 1)', fill: 'both' },
    )
  }
  burst(stage, at, size, 'crimson', 230 * stage.k, 10)
}

/** A shuffle: backs cut apart either side of the pile and fall together, twice. */
export const riffle = ({ ground, k }: Stage, cell: HTMLElement, delay: number) => {
  for (let i = 0; i < 4; i++) {
    const side = i % 2 ? 1 : -1
    onCell(ground, cell, 'sim-riffle').animate(
      [
        { offset: 0, transform: 'translateX(0)', opacity: 1 },
        { offset: 0.3, transform: `translateX(${side * 54}%) rotate(${side * 4}deg)`, opacity: 1 },
        { offset: 0.6, transform: 'translateX(0)', opacity: 1 },
        { offset: 0.8, transform: `translateX(${side * 26}%)`, opacity: 1 },
        { offset: 1, transform: 'translateX(0)', opacity: 1 },
      ],
      { duration: 560 * k, delay: delay + i * 30 * k, easing: 'ease-in-out' },
    )
  }
}

/** Light running out along every vein from the core. */
export const sweep = ({ k }: Stage, root: HTMLElement, delay: number) => {
  for (const vein of root.querySelectorAll('.sim-vein-pulse')) {
    vein.animate(
      [
        { offset: 0, strokeDashoffset: 100, opacity: 0 },
        { offset: 0.15, opacity: 1 },
        { offset: 1, strokeDashoffset: 0, opacity: 0 },
      ],
      { duration: 680 * k, delay, easing: 'ease-out' },
    )
  }
}

/** A thin band crossing the table with a word on it: a new turn. */
export const banner = ({ flat, k }: Stage, text: string) => {
  const band = spawn(flat, 'sim-banner')
  spawn(band, 'text-ink display-1').textContent = text
  band.animate(
    [
      { offset: 0, clipPath: 'inset(0 100% 0 0)', opacity: 1, easing: EASE },
      { offset: 0.25, clipPath: 'inset(0 0 0 0)', opacity: 1 },
      { offset: 0.78, clipPath: 'inset(0 0 0 0)', opacity: 1, easing: 'ease-in' },
      { offset: 1, clipPath: 'inset(0 0 0 100%)', opacity: 1 },
    ],
    { duration: 680 * k },
  )
}
