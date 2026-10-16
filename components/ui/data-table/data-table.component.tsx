import { twMerge } from 'tailwind-merge'

export type Column<R> = {
  key: string
  label: React.ReactNode
  /** Right-aligned and tabular. */
  numeric?: boolean
  /** The column that names the row: ink, bold. */
  strong?: boolean
  width?: number | string
  render?: (row: R) => React.ReactNode
  /** Set on a sortable column (put the sort button in `label`); lands on the header as `aria-sort`. */
  sort?: 'ascending' | 'descending' | 'none'
}

type DataTableProps<R> = {
  columns: Column<R>[]
  rows: R[]
  caption?: React.ReactNode
  rowKey?: (row: R, index: number) => React.Key
  /** The row being worked on elsewhere (an open editor): ground-cyan with the selected bar. */
  isSelected?: (row: R) => boolean
  /** Shown in a single full-width cell when there are no rows. */
  empty?: React.ReactNode
  /** A ledger or log read line by line: 40px header, 64px rows, 20px sides. */
  roomy?: boolean
  className?: string
}

/** Dense table for standings, decklists and logs. surface-200 mono header, hairline rows, no zebra. */
export const DataTable = <R,>({ columns, rows, caption, rowKey = (_, i) => i, isSelected, empty, roomy, className }: DataTableProps<R>) => (
  <table className={twMerge('w-full border-collapse border border-line text-sm', className)}>
    {caption ? <caption className="caption-top pb-3 text-left text-ink-muted signal-sm">{caption}</caption> : null}
    <thead>
      <tr>
        {columns.map((c) => (
          <th
            key={c.key}
            scope="col"
            aria-sort={c.sort}
            style={c.width ? { width: c.width } : undefined}
            className={twMerge('border-b border-line-mid bg-surface-200 px-4 py-2.5 text-left font-normal whitespace-nowrap text-ink-muted signal-sm', roomy && 'h-10 px-5 py-0 signal', c.numeric && 'text-right')}
          >
            {c.label}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.length === 0 && empty ? (
        <tr>
          <td colSpan={columns.length} className="bg-surface-100 px-4 py-8 text-center text-ink-muted body-sm">
            {empty}
          </td>
        </tr>
      ) : null}
      {rows.map((row, i) => {
        const selected = isSelected?.(row)
        return (
          <tr key={rowKey(row, i)} data-selected={selected || undefined} className="group">
            {columns.map((c, ci) => (
              <td
                key={c.key}
                className={twMerge(
                  'border-b border-line bg-surface-100 px-4 py-3 text-ink-dim group-last:border-b-0 group-hover:bg-surface-300 group-hover:text-ink',
                  roomy && 'h-16 px-5 py-2.5 group-hover:bg-surface-200',
                  c.numeric && 'text-right tabular-nums',
                  c.strong && 'font-bold text-ink',
                  selected && 'bg-ground-cyan group-hover:bg-ground-cyan',
                  selected && ci === 0 && 'shadow-selected',
                )}
              >
                {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
              </td>
            ))}
          </tr>
        )
      })}
    </tbody>
  </table>
)
