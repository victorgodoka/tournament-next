/**
 * What moves over the field. A tilted plane has no straight way to slide a card in screen px, so a move is a flight: a
 * copy of the card crosses a flat layer over the board while the card itself stays hidden, and shows through as the copy
 * lands. Everything runs on the Web Animations API, so the video's `seek` (`document.getAnimations()`) holds it at any
 * time; a copy fades out at its end and stays in the layer until the next step clears it.
 */

/** Where a card stands, relative to the board: its centre, its scale over its laid-out size, the turn of DEF and the plane's tilt. */
export type Pose = { x: number; y: number; scale: number; turn: number; tilt: number }
type Size = { w: number; h: number }

const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
/** How far a card rises over its straight line, in card heights, and how much it grows at the top of the arc. */
const ARC = 0.3
const GROW = 1.12
/** Where in the flight the card on the board starts to show through the copy. */
const SHOW = 0.84

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
  for (const mark of look.querySelectorAll('span[aria-hidden]')) mark.remove()
  for (const tile of look.querySelectorAll('[data-card]')) tile.removeAttribute('data-card')
  return look
}

const place = (p: Pose, { w, h }: Size, camera: number) =>
  `translate(${p.x - w / 2}px, ${p.y - h / 2}px) perspective(${camera}px) rotateX(${p.tilt}deg) rotate(${p.turn}deg) scale(${p.scale})`

/** The top of the arc: half way, above both ends, a little bigger, half way into the plane. */
const peak = (from: Pose, to: Pose, { h }: Size): Pose => ({
  x: (from.x + to.x) / 2,
  y: Math.min(from.y, to.y) - h * ARC,
  scale: Math.max(from.scale, to.scale) * GROW,
  turn: (from.turn + to.turn) / 2,
  tilt: (from.tilt + to.tilt) / 2,
})

/** Flies `look` over `layer` from one pose to the other. */
export const fly = (layer: HTMLElement, look: HTMLElement, from: Pose, to: Pose, size: Size, camera: number, ms: number) => {
  const copy = document.createElement('div')
  copy.className = 'sim-flight'
  copy.inert = true
  copy.style.width = `${size.w}px`
  copy.style.height = `${size.h}px`
  copy.append(look)
  layer.append(copy)
  copy.animate(
    [
      { offset: 0, transform: place(from, size, camera), opacity: 1 },
      { offset: 0.5, transform: place(peak(from, to, size), size, camera) },
      { offset: SHOW, opacity: 1 },
      { offset: 1, transform: place(to, size, camera), opacity: 0 },
    ],
    { duration: ms, easing: EASE, fill: 'forwards' },
  )
}

/** Keeps the real card out of sight until its copy lands on it. */
export const sink = (el: Element | null, ms: number) =>
  el?.animate(
    [
      { offset: 0, opacity: 0 },
      { offset: SHOW, opacity: 0 },
      { offset: 1, opacity: 1 },
    ],
    { duration: ms, easing: EASE },
  )
