'use client'

import { twMerge } from 'tailwind-merge'
import { BLOCK_CATALOG, DOC_LIMITS, type WikiAsset, type WikiBlock } from '@utils/wiki-doc'
import { BlockFields, blockSummary } from './fields'
import { no } from './Outline'
import { Flag, ICON, Panel } from './ui'

/** A short note on a block row: `✓` good, `!` worth a look, or neutral. */
export type Hint = { text: string; tone: 'pass' | 'warn' | 'muted' }

const HINT_TONE = { pass: 'text-win', warn: 'text-gold', muted: 'text-ink-muted' } as const

type BlockListProps = {
  blocks: WikiBlock[]
  assets: WikiAsset[]
  open: Set<string>
  selected: string | null
  over: number | null
  hints: Map<string, Hint[]>
  changed?: Set<string>
  keepAnchors: Set<string>
  words: number
  blockers: string[]
  onSelect: (id: string) => void
  onToggle: (id: string) => void
  onChange: (block: WikiBlock) => void
  onMove: (id: string, to: number) => void
  onDuplicate: (id: string) => void
  onRemove: (id: string) => void
  onOver: (at: number | null) => void
  onDrop: () => void
  onDragBlock: (id: string | null, event?: React.DragEvent) => void
  dragging: () => boolean
  register: (id: string, node: HTMLLIElement | null) => void
}

/** Panel "Content": one row per block, collapsed to a line or open to its fields. */
export const BlockList = (props: BlockListProps) => {
  const { blocks, assets, open, selected, over, hints, changed, keepAnchors, words, blockers } = props
  const minutes = Math.max(1, Math.round(words / 220))

  return (
    <Panel
      title="Content"
      meta={`${blocks.length} / ${DOC_LIMITS.blocks} blocks · ${words.toLocaleString('en-US')} words · ${minutes} min read`}
    >
      <ol
        onDragOver={(event) => {
          if (!props.dragging()) return
          event.preventDefault()
          if (!blocks.length) props.onOver(0)
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) props.onOver(null)
        }}
        onDrop={(event) => {
          event.preventDefault()
          props.onDrop()
        }}
        className="flex min-h-40 flex-col gap-2.5 p-4"
      >
        {blocks.map((block, i) => {
          const isOpen = open.has(block.id)
          const active = selected === block.id
          const label = block.type === 'heading' ? `H${block.level}` : BLOCK_CATALOG.find((item) => item.type === block.type)?.label
          const rowHints = hints.get(block.id) ?? []
          return (
            <li
              key={block.id}
              id={`block-${block.id}`}
              ref={(node) => props.register(block.id, node)}
              onFocusCapture={() => props.onSelect(block.id)}
              onDragOver={(event) => {
                if (!props.dragging()) return
                const box = event.currentTarget.getBoundingClientRect()
                props.onOver(event.clientY < box.top + box.height / 2 ? i : i + 1)
              }}
              className="relative scroll-mt-48"
            >
              {over === i ? <InsertLine /> : null}
              <div className={twMerge('border border-line bg-surface-100', active && 'border-2 border-cyan')}>
                <div
                  className={twMerge(
                    'flex items-center gap-2.5 px-2 py-1.5',
                    isOpen && 'border-b border-line',
                    !isOpen && block.type === 'heading' && block.level === 3 && 'pl-8',
                  )}
                >
                  <span
                    draggable
                    role="img"
                    aria-label="Drag to reorder"
                    title="Drag to reorder"
                    onDragStart={(event) => props.onDragBlock(block.id, event)}
                    onDragEnd={() => props.onDragBlock(null)}
                    className={twMerge('w-6 shrink-0 cursor-grab text-center text-ink-muted hover:text-cyan active:cursor-grabbing', active && 'text-cyan')}
                  >
                    ⋮⋮
                  </span>
                  <span className="text-cyan signal-sm">{no(i + 1)}</span>
                  <span className={twMerge('shrink-0 text-ink signal-strong', !isOpen && (['statistics-deck', 'article-preview'].includes(block.type) ? 'w-28' : 'w-16'))}>{label}</span>
                  {block.type === 'faq' ? <Flag>New block</Flag> : null}
                  {isOpen ? (
                    <span className="flex-1" />
                  ) : (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => props.onToggle(block.id)}
                      className={twMerge(
                        'min-w-0 flex-1 cursor-pointer truncate text-left',
                        block.type === 'heading' ? 'text-ink body-strong' : 'text-ink-muted body-sm',
                      )}
                    >
                      {block.type === 'heading' ? block.text || 'Untitled' : blockSummary(block) || 'Empty'}
                    </button>
                  )}
                  {!isOpen && block.type === 'heading' && !rowHints.length ? <span className="hidden text-ink-muted data sm:inline">#{block.anchor}</span> : null}
                  {rowHints.map((hint) => (
                    <span key={hint.text} className={twMerge('hidden whitespace-nowrap signal-sm md:inline', HINT_TONE[hint.tone])}>
                      {hint.text}
                    </span>
                  ))}
                  {changed?.has(block.id) ? <span className="text-gold signal-sm">Edited</span> : null}
                  {active ? (
                    <>
                      <button type="button" onClick={() => props.onMove(block.id, i - 1)} disabled={i === 0} aria-label={`Move block ${i + 1} up`} className={ICON}>
                        ↑
                      </button>
                      <button type="button" onClick={() => props.onMove(block.id, i + 2)} disabled={i === blocks.length - 1} aria-label={`Move block ${i + 1} down`} className={ICON}>
                        ↓
                      </button>
                      <button type="button" onClick={() => props.onDuplicate(block.id)} aria-label={`Duplicate block ${i + 1}`} className={ICON}>
                        ⧉
                      </button>
                      <button type="button" onClick={() => props.onRemove(block.id)} aria-label={`Delete block ${i + 1}`} className={twMerge(ICON, 'text-loss hover:border-loss hover:text-loss')}>
                        ✕
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      props.onToggle(block.id)
                    }}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? 'Collapse' : 'Expand'} block ${i + 1}`}
                    className={ICON}
                  >
                    {isOpen ? '−' : '+'}
                  </button>
                </div>
                {isOpen ? (
                  <div className="px-4 pt-3.5 pb-4">
                    <BlockFields block={block} assets={assets} onChange={props.onChange} keepAnchor={keepAnchors.has(block.id)} />
                  </div>
                ) : null}
              </div>
              {over === i + 1 && i === blocks.length - 1 ? <InsertLine after /> : null}
            </li>
          )
        })}

        {blocks.length ? null : (
          <li
            className={twMerge(
              'flex min-h-32 items-center justify-center border border-dashed border-line px-6 text-center text-ink-muted body-sm',
              over === 0 && 'border-cyan bg-ground-cyan text-cyan',
            )}
          >
            Drag a block here, or click one in Add block.
          </li>
        )}
      </ol>

      <div aria-live="polite" className="flex items-start gap-3 border-t border-line px-5 py-3.5">
        <span className={twMerge('rounded-xs px-1.5 py-0.75 signal-sm', blockers.length ? 'bg-crimson text-ink' : 'bg-win text-cyan-on')}>{blockers.length}</span>
        {blockers.length ? (
          <div className="min-w-0">
            <p className="text-ink body-sm">Blockers. The server refuses the save until these are fixed.</p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {blockers.map((problem) => (
                <li key={problem} className="text-loss body-sm">
                  {problem}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-ink-dim body-sm">Blockers. The doc passes every server rule; the server checks again on save.</p>
        )}
      </div>
    </Panel>
  )
}

const InsertLine = ({ after }: { after?: boolean }) => (
  <div aria-hidden className={twMerge('pointer-events-none absolute inset-x-0 flex h-2.5 items-center gap-2.5', after ? '-bottom-2.5' : '-top-2.5')}>
    <span className="h-px flex-1 bg-cyan/50" />
    <span className="text-cyan signal-sm">+ Add block here</span>
    <span className="h-px flex-1 bg-cyan/50" />
  </div>
)
