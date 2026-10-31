/**
 * One JSON line per event, the shape the API's pino writes: `docker logs` of the front and of
 * the API read the same way, and a field (`event`, `call`, `status`) can be grepped. Meant for
 * server code; in the browser the line still prints, as a string.
 *
 * `err` is reduced to name, message, status and stack: never the object itself, which may carry
 * the request (URL, cookie) it came from.
 */
type Level = 'info' | 'warn' | 'error'

const errFields = (error: unknown) =>
  error instanceof Error
    ? { name: error.name, message: error.message, status: (error as { status?: unknown }).status, stack: error.stack }
    : { message: String(error) }

export const log = (level: Level, event: string, { err, ...fields }: Record<string, unknown> = {}) => {
  console[level](JSON.stringify({ level, time: new Date().toISOString(), event, ...fields, ...(err === undefined ? {} : { err: errFields(err) }) }))
}
