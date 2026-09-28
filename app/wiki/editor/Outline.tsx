'use client'

import { twMerge } from 'tailwind-merge'
import { BLOCK_CATALOG, type WikiBlock, type WikiBlockType } from '@utils/wiki-doc'
import { Flag, Help, Panel } from './ui'

const ALIGN = { left: 'float left', right: 'float right', center: 'centre', wide: 'wide' } as const
const TONE = { gold: 'Note', cyan: 'Info', negative: 'Warning' } as const

/** One outline line: `H2 · History`, `Image · float right`, `FAQ · 2 questions`. */
export const outlineLabel = (block: WikiBlock, first: boolean) => {
  switch (block.type) {
    case 'text':
      return first ? 'Text · intro' : 'Text'
    case 'heading':
      return `H${block.level} · ${block.text || 'Untitled'}`
    case 'figure':
      return `Image · ${ALIGN[block.align]}`
    case 'gallery':
      return `Gallery · ${block.assets.length}`
    case 'cards':
      return `Cards · ${block.cards.length}`
    case 'callout':
      return `Callout · ${TONE[block.tone]}`
    case 'quote':
      return 'Quote'
    case 'video':
      return `Video · ${block.title || 'untitled'}`
    case 'faq':
      return `FAQ · ${block.items.length} question${block.items.length === 1 ? '' : 's'}`
  }
}

export const no = (i: number) => String(i).padStart(2, '0')

type OutlineProps = {
  blocks: WikiBlock[]
  selected: string | null
  onSelect: (id: string) => void
  /** Edit mode: ids changed since the last save (`header` for panel 00). */
  changed?: Set<string>
}

type RowProps = {
  id: string
  n: string
  label: string
  strong?: boolean
  indent?: boolean
  active: boolean
  dot: boolean
  onSelect: (id: string) => void
}

const Row = ({ id, n, label, strong, indent, active, dot, onSelect }: RowProps) => (
      <li>
        <button
          type="button"
          aria-current={active ? 'true' : undefined}
          onClick={() => onSelect(id)}
          className={twMerge(
            'flex w-full cursor-pointer gap-2.5 border border-transparent px-4 py-1.75 text-left text-ink-dim hover:text-ink',
            strong && 'text-ink',
            indent && 'pl-8',
            active && 'border-cyan bg-ground-cyan text-ink',
          )}
        >
          <span className={twMerge('w-4.5 shrink-0 pt-0.5 signal-sm', active || id === 'header' ? 'text-cyan' : 'text-ink-muted')}>{n}</span>
          <span className={twMerge('min-w-0 flex-1 truncate body-sm', strong && 'font-bold')}>{label}</span>
          {dot ? (
            <span aria-label="changed" className="text-gold signal-sm">
              ●
            </span>
          ) : null}
        </button>
      </li>
)

/** Every block in page order; a click scrolls the page to it. */
export const Outline = ({ blocks, selected, onSelect, changed }: OutlineProps) => {
  const firstText = blocks.find((block) => block.type === 'text')?.id
  const shared = (id: string) => ({ id, active: selected === id, dot: !!changed?.has(id), onSelect })

  return (
    <Panel title="Outline" meta={`${blocks.length} block${blocks.length === 1 ? '' : 's'}`} edge="line">
      <nav aria-label="Outline">
        <ol className="max-h-[50dvh] overflow-y-auto py-1.5">
          <Row {...shared('header')} n="00" label="Header" strong />
          {blocks.map((block, i) => (
            <Row
              key={block.id}
              {...shared(block.id)}
              n={no(i + 1)}
              label={outlineLabel(block, block.id === firstText)}
              strong={block.type === 'heading'}
              indent={block.type === 'heading' && block.level === 3}
            />
          ))}
        </ol>
      </nav>
      {changed ? (
        <Help className="mt-0 border-t border-line px-4 py-3">
          <span className="text-gold">●</span> changed since the last save
        </Help>
      ) : null}
    </Panel>
  )
}

type PaletteProps = {
  onAdd: (type: WikiBlockType) => void
  onDragStart: (type: WikiBlockType, event: React.DragEvent) => void
  onDragEnd: () => void
}

/** Drag a block into the page, or click to add it after the selected one. */
export const Palette = ({ onAdd, onDragStart, onDragEnd }: PaletteProps) => (
  <Panel title="Add block" edge="line">
    <div className="grid grid-cols-2 gap-px bg-line">
      {BLOCK_CATALOG.map((entry) => (
        <button
          key={entry.type}
          type="button"
          draggable
          onDragStart={(event) => onDragStart(entry.type, event)}
          onDragEnd={onDragEnd}
          onClick={() => onAdd(entry.type)}
          className={twMerge(
            'group flex cursor-grab flex-col gap-0.5 bg-surface-100 px-3.5 py-3 text-left hover:bg-surface-200 active:cursor-grabbing',
            entry.type === 'faq' && 'col-span-2',
          )}
        >
          <span className="flex items-center gap-2">
            <span className="text-[14px] text-ink body-strong group-hover:text-cyan">{entry.label}</span>
            {entry.type === 'faq' ? <Flag>New</Flag> : null}
          </span>
          <span className="text-ink-muted signal-sm">{entry.hint}</span>
        </button>
      ))}
    </div>
    <Help className="mt-0 border-t border-line px-4 py-3">Drag into the page, or click to add after the selected block.</Help>
  </Panel>
)
