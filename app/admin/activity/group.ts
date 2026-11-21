import type { AuditEntry } from '@utils/panel'

/** A row of the table: one entry, or the head of a run of repeats (`n` > 1) that opens to its entries. */
export type Row = { id: string; entry: AuditEntry; n: number; targets: string[]; child: boolean }

const minute = (iso: string) => iso.slice(0, 16)

/**
 * Consecutive entries with the same actor, action and outcome within the same minute collapse into one row.
 * Client-side, over the loaded page: a run cut by a page break shows as two.
 */
export const groupRepeats = (entries: readonly AuditEntry[], open: ReadonlySet<string>): Row[] => {
  const rows: Row[] = []
  for (let i = 0; i < entries.length; ) {
    const head = entries[i]!
    let j = i + 1
    while (j < entries.length && entries[j]!.actor.id === head.actor.id && entries[j]!.action === head.action && entries[j]!.outcome === head.outcome && minute(entries[j]!.at) === minute(head.at)) j++
    const run = entries.slice(i, j)
    rows.push({ id: head.id, entry: head, n: run.length, targets: run.flatMap((e) => (e.target ? [e.target] : [])), child: false })
    if (run.length > 1 && open.has(head.id)) rows.push(...run.map((e) => ({ id: `${head.id}:${e.id}`, entry: e, n: 1, targets: [], child: true })))
    i = j
  }
  return rows
}
