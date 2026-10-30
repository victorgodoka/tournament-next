/** A render takes ~33 s on production and Cloudflare gives up at 100 s: a fourth in line would be drawn for nobody. */
const MAX_IN_LINE = 3

let turn: Promise<unknown> = Promise.resolve()
let inLine = 0

/**
 * Runs jobs strictly in order, whatever each one's outcome. For work too heavy to overlap: two infographic
 * renders at once are what takes the container past its memory limit. Past `MAX_IN_LINE` it answers `busy` instead.
 * ponytail: one queue per process. Several replicas would each draw their own.
 */
export const oneAtATime = <T>(job: () => Promise<T>, busy: () => T): Promise<T> => {
  if (inLine >= MAX_IN_LINE) return Promise.resolve(busy())
  inLine++
  const run = turn.then(job).finally(() => inLine--)
  turn = run.catch(() => undefined)
  return run
}
