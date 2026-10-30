let turn: Promise<unknown> = Promise.resolve()

/**
 * Runs jobs strictly in order, whatever each one's outcome. For work too heavy to overlap: two infographic
 * renders at once are what takes the container past its memory limit.
 * ponytail: one queue per process with no length cap, so a burst waits instead of being refused.
 */
export const oneAtATime = <T>(job: () => Promise<T>): Promise<T> => {
  const run = turn.then(job)
  turn = run.catch(() => undefined)
  return run
}
