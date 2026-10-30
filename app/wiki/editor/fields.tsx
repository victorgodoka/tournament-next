'use client'

import Image from 'next/image'
import { useId, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Lookup, type LookupOption } from '@ui/lookup'
import { API_URL } from '@utils/auth'
import { searchCardArts } from '@utils/cards'
import { CARD_ART_URL } from '@utils/const'
import { cardLoader } from '@utils/image-loader'
import { DOC_LIMITS, imageSource, isUploadDate, parseYouTube, toAnchor, type WikiAsset, type WikiBlock, type WikiCardRef } from '@utils/wiki-doc'
import { FIELD, HELP, LABEL } from '../ArticleForm'
import { Check, FieldHead, Frame, Help, INPUT, type Tone } from './ui'

export const MINI = 'inline-flex min-h-8 min-w-8 items-center justify-center border border-line bg-surface-100 px-2 text-ink-dim signal-sm hover:border-cyan hover:text-cyan disabled:pointer-events-none disabled:opacity-40'

/** Labelled input or textarea in a chamfered frame. `rows` makes it a textarea. */
export const TextField = ({
  label,
  value,
  onChange,
  onBlur,
  rows,
  help,
  mono,
  maxLength,
  placeholder,
  meta,
  metaTone,
  tone,
  type,
  className,
}: {
  label: React.ReactNode
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  rows?: number
  help?: React.ReactNode
  mono?: boolean
  maxLength?: number
  placeholder?: string
  meta?: React.ReactNode
  metaTone?: 'muted' | 'warn' | 'pass' | 'fix'
  tone?: Tone
  type?: 'text' | 'date' | 'search'
  /** Extra classes for the input itself (type size). */
  className?: string
}) => {
  const id = useId()
  const shared = {
    id,
    value,
    maxLength,
    placeholder,
    onBlur,
    className: twMerge(INPUT, 'body-sm', mono && 'data', rows && 'resize-y', className),
  }
  return (
    <div className="min-w-0">
      <FieldHead htmlFor={id} label={label} meta={meta} metaTone={metaTone} />
      <Frame tone={tone}>
        {rows ? (
          <textarea {...shared} rows={rows} onChange={(event) => onChange(event.target.value)} />
        ) : (
          <input {...shared} type={type} onChange={(event) => onChange(event.target.value)} />
        )}
      </Frame>
      {help ? <Help>{help}</Help> : null}
    </div>
  )
}

/** Radio group drawn as a segmented control. Arrow keys move between options natively. */
const Segmented = <T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) => {
  const name = useId()
  return (
    <fieldset className="min-w-0">
      <legend className={LABEL}>{label}</legend>
      <div className="mt-2 flex w-fit flex-wrap gap-px border border-line bg-line">
        {options.map((option) => (
          <label
            key={String(option.value)}
            className="cursor-pointer bg-surface-200 px-3 py-2.25 text-ink-dim signal-sm hover:text-ink has-checked:bg-ground-cyan has-checked:text-ink has-checked:outline has-checked:-outline-offset-1 has-checked:outline-cyan has-focus-visible:outline-2 has-focus-visible:outline-cyan"
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** Library thumbnail. `unoptimized`: the editor may hold an upload from a host the optimiser doesn't know yet. */
const Thumb = ({ asset, className }: { asset: WikiAsset; className?: string }) => (
  <Image
    src={imageSource(asset, 200).src}
    alt=""
    width={64}
    height={64}
    unoptimized
    style={{ objectPosition: asset.focal ? `${asset.focal.x}% ${asset.focal.y}%` : undefined }}
    className={twMerge('aspect-square w-full object-cover', className)}
  />
)

/**
 * Pick images from the library. Single mode is a radio group (with "none" when `optional`);
 * multi mode toggles, and the badge shows the order the images will appear in.
 */
export const AssetPicker = ({
  label,
  assets,
  selected,
  onChange,
  multiple,
  optional,
}: {
  label: string
  assets: WikiAsset[]
  selected: string[]
  onChange: (ids: string[]) => void
  multiple?: boolean
  optional?: boolean
}) => {
  const toggle = (id: string) => {
    if (!multiple) return onChange([id])
    onChange(selected.includes(id) ? selected.filter((other) => other !== id) : [...selected, id])
  }

  return (
    <fieldset className="min-w-0">
      <legend className={LABEL}>{label}</legend>
      {assets.length ? (
        <ul className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
          {optional ? (
            <li>
              <button
                type="button"
                aria-pressed={!selected.length}
                onClick={() => onChange([])}
                className="flex aspect-square w-full items-center justify-center border border-line text-ink-muted signal-sm hover:border-cyan aria-pressed:border-cyan aria-pressed:text-cyan"
              >
                None
              </button>
            </li>
          ) : null}
          {assets.map((asset) => {
            const order = selected.indexOf(asset.id)
            return (
              <li key={asset.id}>
                <button
                  type="button"
                  aria-pressed={order >= 0}
                  aria-label={asset.alt || asset.id}
                  onClick={() => toggle(asset.id)}
                  className="relative block w-full border border-line opacity-60 hover:opacity-100 aria-pressed:border-cyan aria-pressed:opacity-100 aria-pressed:outline-2 aria-pressed:outline-cyan"
                >
                  <Thumb asset={asset} />
                  {multiple && order >= 0 ? (
                    <span className="absolute top-1 left-1 bg-cyan px-1.5 text-cyan-on mono-note">{order + 1}</span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className={HELP}>The library is empty. Add images in the Library panel first.</p>
      )}
    </fieldset>
  )
}

/** Module-level, so `Lookup` gets a stable search. A passcode of an alternate artwork resolves to its card. */
const findCards = (text: string, signal: AbortSignal): Promise<LookupOption[]> =>
  searchCardArts(text, 8, signal).then((cards) => cards.map((card) => ({ key: card.id, label: card.name, meta: card.id })))

/** Passcode, name and note per card. A new passcode fills an empty name from the card API; the search adds a card by name. */
const CardRows = ({ cards, onChange }: { cards: WikiCardRef[]; onChange: (cards: WikiCardRef[]) => void }) => {
  const set = (i: number, patch: Partial<WikiCardRef>) =>
    onChange(cards.map((card, j) => (j === i ? { ...card, ...patch } : card)))

  const lookup = (i: number, id: number) => {
    if (!id || cards[i]?.name) return
    fetch(`${API_URL}/cards/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((card: { name?: string } | null) => {
        if (card?.name) set(i, { name: card.name })
      })
      .catch(() => {})
  }

  return (
    <div>
      <p className={LABEL}>Cards</p>
      <ul className="mt-2 flex flex-col gap-2">
        {cards.map((card, i) => (
          <li key={i} className="grid grid-cols-[48px_110px_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
            <span className="relative aspect-square border border-line bg-surface-200">
              {card.id > 0 ? (
                <Image loader={cardLoader} src={CARD_ART_URL(card.id)} alt="" fill sizes="48px" className="object-cover" />
              ) : null}
            </span>
            <input
              aria-label={`Card ${i + 1} passcode`}
              inputMode="numeric"
              placeholder="Passcode"
              value={card.id || ''}
              onChange={(event) => set(i, { id: Number(event.target.value.replace(/\D/g, '')) || 0 })}
              onBlur={() => lookup(i, card.id)}
              className={twMerge(FIELD, 'font-mono')}
            />
            <input
              aria-label={`Card ${i + 1} name`}
              placeholder="Name"
              value={card.name}
              onChange={(event) => set(i, { name: event.target.value })}
              className={FIELD}
            />
            <input
              aria-label={`Card ${i + 1} note`}
              placeholder="Note (optional)"
              value={card.note ?? ''}
              onChange={(event) => set(i, { note: event.target.value || undefined })}
              className={FIELD}
            />
            <button type="button" onClick={() => onChange(cards.filter((_, j) => j !== i))} aria-label={`Remove card ${i + 1}`} className={MINI}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      {cards.length < DOC_LIMITS.cards ? (
        <Lookup
          label="Add card"
          placeholder="Add a card by name or passcode"
          search={findCards}
          exclude={cards.map((card) => card.id)}
          onPick={(option) =>
            !cards.some((card) => card.id === option.key) && onChange([...cards, { id: Number(option.key), name: String(option.label) }])
          }
          className="mt-2"
        />
      ) : null}
    </div>
  )
}

const MD_HELP = 'Markdown · no raw HTML · links must be full http(s) or a /wiki/ path · [card:passcode] shows the card name linked to its page · [text]{#4fdc8c} colours text.'

/** Wrap the selection (or a placeholder) in Markdown, then put the caret back inside it. */
type Edit = (text: string, start: number, end: number) => { text: string; start: number; end: number }

const wrap =
  (before: string, after: string, fallback: string): Edit =>
  (text, start, end) => {
    const inner = text.slice(start, end) || fallback
    return { text: text.slice(0, start) + before + inner + after + text.slice(end), start: start + before.length, end: start + before.length + inner.length }
  }

const insert =
  (snippet: string): Edit =>
  (text, start, end) => {
    const lead = start > 0 && text[start - 1] !== '\n' ? '\n\n' : ''
    return { text: text.slice(0, start) + lead + snippet + text.slice(end), start: start + lead.length, end: start + lead.length + snippet.length }
  }

const listLines: Edit = (text, start, end) => {
  const from = text.lastIndexOf('\n', start - 1) + 1
  const lines = text.slice(from, end).split('\n').map((line) => (line.startsWith('- ') ? line : `- ${line}`)).join('\n')
  return { text: text.slice(0, from) + lines + text.slice(end), start: from, end: from + lines.length }
}

const TOOLS: { label: string; aria?: string; className?: string; edit: Edit }[] = [
  { label: 'B', aria: 'Bold', className: 'w-8 px-0 font-bold', edit: wrap('**', '**', 'bold') },
  { label: 'I', aria: 'Italic', className: 'w-8 px-0 italic', edit: wrap('*', '*', 'italic') },
  { label: 'Link', edit: wrap('[', '](https://)', 'text') },
  { label: 'Wiki link', edit: wrap('[', '](/wiki/)', 'article') },
  { label: 'Card', edit: wrap('[card:', ']', 'passcode') },
  { label: 'List', edit: listLines },
  { label: 'Table', edit: insert('| Column | Column |\n| --- | --- |\n| Cell | Cell |\n') },
]

const TOOL = 'h-7.5 cursor-pointer border border-line bg-surface-200 px-2.5 text-ink-dim signal-sm hover:border-cyan hover:text-cyan'

/** Markdown textarea with the formatting bar. Every button edits the text through `onChange`. */
const MarkdownField = ({ label, value, onChange, rows = 6 }: { label: string; value: string; onChange: (md: string) => void; rows?: number }) => {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [color, setColor] = useState('#4fdc8c')

  const apply = (edit: Edit) => {
    const area = ref.current
    if (!area) return
    const next = edit(value, area.selectionStart, area.selectionEnd)
    onChange(next.text)
    requestAnimationFrame(() => {
      area.focus()
      area.setSelectionRange(next.start, next.end)
    })
  }

  return (
    <div className="min-w-0">
      <div role="toolbar" aria-label={`${label} formatting`} className="mb-2 flex flex-wrap gap-0.5">
        {TOOLS.map((tool) => (
          <button
            key={tool.label}
            type="button"
            aria-label={tool.aria}
            onClick={() => apply(tool.edit)}
            className={twMerge(TOOL, tool.className)}
          >
            {tool.label}
          </button>
        ))}
        <input
          type="color"
          aria-label="Text colour to apply"
          value={color}
          onChange={(event) => setColor(event.target.value)}
          className="h-7.5 w-8 cursor-pointer border border-line bg-surface-200 p-0.5"
        />
        <button type="button" onClick={() => apply(wrap('[', `]{${color}}`, 'text'))} className={TOOL}>
          Colour
        </button>
      </div>
      <Frame>
        <textarea
          ref={ref}
          aria-label={label}
          rows={rows}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={twMerge(INPUT, 'resize-y text-ink-dim data')}
        />
      </Frame>
      <Help>{MD_HELP}</Help>
    </div>
  )
}

type BlockFieldsProps = {
  block: WikiBlock
  assets: WikiAsset[]
  onChange: (block: WikiBlock) => void
  /** The heading is live under this anchor: links point at it, so its text no longer moves it. */
  keepAnchor?: boolean
}

/** The inputs for one block. Every change hands back a whole new block. */
export const BlockFields = ({ block, assets, onChange, keepAnchor }: BlockFieldsProps) => {
  switch (block.type) {
    case 'text':
      return <MarkdownField label="Text" rows={8} value={block.md} onChange={(md) => onChange({ ...block, md })} />

    case 'heading': {
      // The anchor follows the text until someone edits it by hand, or once it is live.
      const auto = !keepAnchor && block.anchor === toAnchor(block.text)
      return (
        <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,220px)]">
          <Segmented
            label="Level"
            value={block.level}
            options={[
              { value: 2, label: 'H2' },
              { value: 3, label: 'H3' },
            ]}
            onChange={(level) => onChange({ ...block, level })}
          />
          <TextField
            label="Heading"
            value={block.text}
            onChange={(text) => onChange({ ...block, text, anchor: auto ? toAnchor(text) : block.anchor })}
          />
          <TextField
            label="Anchor"
            mono
            value={block.anchor}
            onChange={(anchor) => onChange({ ...block, anchor })}
            help={
              keepAnchor && block.anchor !== toAnchor(block.text)
                ? `Anchor kept: links to #${block.anchor} still land here.`
                : `#${block.anchor || '…'}`
            }
          />
        </div>
      )
    }

    case 'figure':
      return <FigureFields block={block} assets={assets} onChange={onChange} />

    case 'gallery':
      return (
        <div className="flex flex-col gap-4">
          <Segmented
            label="Layout"
            value={block.layout}
            options={[
              { value: 'grid', label: 'Grid' },
              { value: 'masonry', label: 'Masonry' },
              { value: 'strip', label: 'Strip' },
            ]}
            onChange={(layout) => onChange({ ...block, layout })}
          />
          <AssetPicker multiple label={`Images (${block.assets.length}) — in the order you pick them`} assets={assets} selected={block.assets} onChange={(ids) => onChange({ ...block, assets: ids })} />
          <TextField label="Caption" value={block.caption ?? ''} maxLength={DOC_LIMITS.short} onChange={(caption) => onChange({ ...block, caption: caption || undefined })} />
        </div>
      )

    case 'cards':
      return (
        <div className="flex flex-col gap-4">
          <CardRows cards={block.cards} onChange={(cards) => onChange({ ...block, cards })} />
          <div className="flex flex-wrap gap-4">
            <Segmented
              label="Per row"
              value={block.perRow ?? 4}
              options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))}
              onChange={(perRow) => onChange({ ...block, perRow })}
            />
            <Segmented
              label="Short last row"
              value={block.align ?? 'left'}
              options={[
                { value: 'left', label: 'Left' },
                { value: 'center', label: 'Centre' },
                { value: 'right', label: 'Right' },
              ]}
              onChange={(align) => onChange({ ...block, align })}
            />
          </div>
          <TextField label="Caption" value={block.caption ?? ''} maxLength={DOC_LIMITS.short} onChange={(caption) => onChange({ ...block, caption: caption || undefined })} />
        </div>
      )

    case 'callout':
      return (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
            <Segmented
              label="Tone"
              value={block.tone}
              options={[
                { value: 'gold', label: 'Note' },
                { value: 'cyan', label: 'Info' },
                { value: 'negative', label: 'Warning' },
              ]}
              onChange={(tone) => onChange({ ...block, tone })}
            />
            <TextField label="Title" value={block.title ?? ''} maxLength={DOC_LIMITS.short} onChange={(title) => onChange({ ...block, title: title || undefined })} />
          </div>
          <MarkdownField label="Text" rows={4} value={block.md} onChange={(md) => onChange({ ...block, md })} />
        </div>
      )

    case 'quote':
      return (
        <div className="flex flex-col gap-4">
          <TextField label="Quote" rows={3} value={block.text} maxLength={DOC_LIMITS.short} onChange={(text) => onChange({ ...block, text })} />
          <TextField label="Source" value={block.cite ?? ''} maxLength={DOC_LIMITS.short} onChange={(cite) => onChange({ ...block, cite: cite || undefined })} />
        </div>
      )

    case 'video':
      return <VideoFields block={block} onChange={onChange} />

    case 'faq':
      return <FaqFields block={block} onChange={onChange} />

    default:
      // A new block type fails to compile here until it is handled.
      return block satisfies never
  }
}

type FigureBlock = Extract<WikiBlock, { type: 'figure' }>

/** The image, its phone version and where it sits. `undefined` keeps the optional keys out of the doc. */
const FigureFields = ({ block, assets, onChange }: { block: FigureBlock; assets: WikiAsset[]; onChange: (block: WikiBlock) => void }) => {
  const shareId = useId()
  return (
    <div className="flex flex-col gap-4">
      <AssetPicker label="Image" assets={assets} selected={block.asset ? [block.asset] : []} onChange={([asset]) => onChange({ ...block, asset: asset ?? '' })} />
      <AssetPicker
        optional
        label="Mobile image · shown instead on screens under 640px"
        assets={assets}
        selected={block.mobileAsset ? [block.mobileAsset] : []}
        onChange={([mobileAsset]) => onChange({ ...block, mobileAsset })}
      />
      <Segmented
        label="Placement"
        value={block.align}
        options={[
          { value: 'left', label: 'Float left' },
          { value: 'right', label: 'Float right' },
          { value: 'center', label: 'Centre' },
          { value: 'wide', label: 'Wide' },
        ]}
        onChange={(align) => onChange({ ...block, align })}
      />
      <Check id={shareId} checked={!!block.share} onChange={(share) => onChange({ ...block, share: share || undefined })}>
        With share: buttons above the image that link straight to it
      </Check>
      <TextField
        label="Caption"
        value={block.caption ?? ''}
        maxLength={DOC_LIMITS.short}
        onChange={(caption) => onChange({ ...block, caption: caption || undefined })}
        help="A float sits beside the blocks that follow it, until a heading or a wide block."
      />
    </div>
  )
}

type VideoBlock = Extract<WikiBlock, { type: 'video' }>

/**
 * Paste any YouTube link; the id and start time are read out of it, and an empty title is
 * filled from YouTube's oEmbed. The raw text stays local so a half-typed link isn't lost.
 */
const VideoFields = ({ block, onChange }: { block: VideoBlock; onChange: (block: WikiBlock) => void }) => {
  const [link, setLink] = useState(() =>
    block.videoId ? `https://youtu.be/${block.videoId}${block.start ? `?t=${block.start}` : ''}` : '',
  )
  const parsed = parseYouTube(link)

  const change = (text: string) => {
    setLink(text)
    const next = parseYouTube(text)
    if (!next) return
    onChange({ ...block, videoId: next.videoId, start: next.start })
    if (block.title) return
    fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${next.videoId}`)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((video: { title?: string } | null) => {
        if (video?.title) onChange({ ...block, videoId: next.videoId, start: next.start, title: video.title })
      })
      .catch(() => {})
  }

  return (
    <div className="flex flex-col gap-4">
      <TextField
        label="YouTube link"
        mono
        value={link}
        onChange={change}
        placeholder="https://www.youtube.com/watch?v=…"
        help={
          link && !parsed
            ? "That isn't a YouTube link."
            : block.videoId
              ? `Video ${block.videoId}${block.start ? ` · starts at ${block.start}s` : ''}. Add &t=90 to the link to start later.`
              : 'watch, youtu.be, shorts and embed links all work.'
        }
      />
      <TextField label="Title" value={block.title} maxLength={DOC_LIMITS.short} onChange={(title) => onChange({ ...block, title })} help="Read out by screen readers and shown on the thumbnail." />
      <div className="grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
        <TextField
          label="Upload date · optional"
          type="date"
          value={block.uploadDate ?? ''}
          tone={block.uploadDate && !isUploadDate(block.uploadDate) ? 'danger' : undefined}
          onChange={(uploadDate) => onChange({ ...block, uploadDate: uploadDate || undefined })}
          help="The date under the title on YouTube. Without it, no video rich result."
        />
        <TextField label="Caption" value={block.caption ?? ''} maxLength={DOC_LIMITS.short} onChange={(caption) => onChange({ ...block, caption: caption || undefined })} />
      </div>
    </div>
  )
}

type FaqBlock = Extract<WikiBlock, { type: 'faq' }>

/** Questions in plain text, answers in Markdown. The server turns every FAQ block into one FAQPage. */
const FaqFields = ({ block, onChange }: { block: FaqBlock; onChange: (block: WikiBlock) => void }) => {
  const set = (i: number, patch: Partial<FaqBlock['items'][number]>) =>
    onChange({ ...block, items: block.items.map((item, j) => (j === i ? { ...item, ...patch } : item)) })

  return (
    <div className="flex flex-col gap-3">
      {block.items.map((item, i) => (
        <div key={i} className="grid grid-cols-[28px_minmax(0,1fr)_auto] gap-3 border border-line bg-surface-200 p-3">
          <span className="text-gold stat">Q{i + 1}</span>
          <div className="flex min-w-0 flex-col gap-2">
            <input
              aria-label={`Question ${i + 1}`}
              placeholder="Question"
              value={item.q}
              maxLength={DOC_LIMITS.short}
              onChange={(event) => set(i, { q: event.target.value.replace(/\n/g, ' ') })}
              className="w-full border border-line-mid bg-surface-100 px-2.5 py-2 text-ink body-strong placeholder:text-ink-muted focus-visible:border-cyan focus-visible:outline-none"
            />
            <textarea
              aria-label={`Answer ${i + 1}`}
              placeholder="Answer, in Markdown"
              rows={2}
              value={item.md}
              maxLength={DOC_LIMITS.faqMd}
              onChange={(event) => set(i, { md: event.target.value })}
              className="w-full resize-y border border-line-mid bg-surface-100 px-2.5 py-2 text-ink-dim body-sm placeholder:text-ink-muted focus-visible:border-cyan focus-visible:outline-none"
            />
          </div>
          <button
            type="button"
            aria-label={`Remove question ${i + 1}`}
            disabled={block.items.length === 1}
            onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}
            className={MINI}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={block.items.length >= DOC_LIMITS.faqItems}
        onClick={() => onChange({ ...block, items: [...block.items, { q: '', md: '' }] })}
        className="cut self-start px-3 py-2 text-ink signal-strong [--cut:var(--cut-xs)] hover:[--fill:var(--color-surface-300)] disabled:opacity-40"
      >
        + Question
      </button>
    </div>
  )
}

/** One line per block, for the collapsed view. */
export const blockSummary = (block: WikiBlock) => {
  switch (block.type) {
    case 'text':
    case 'callout':
      return block.md.replace(/\s+/g, ' ').slice(0, 90)
    case 'heading':
    case 'quote':
      return block.text
    case 'figure':
      return [block.asset || 'no image', block.align, block.mobileAsset && 'mobile image', block.share && 'share'].filter(Boolean).join(' · ')
    case 'gallery':
      return `${block.assets.length} images · ${block.layout}`
    case 'cards':
      return block.cards.map((card) => card.name).filter(Boolean).join(', ')
    case 'video':
      return `${block.title || block.videoId}${block.start ? ` · starts ${Math.floor(block.start / 60)}:${String(block.start % 60).padStart(2, '0')}` : ''}`
    case 'faq':
      return `${block.items.length} question${block.items.length === 1 ? '' : 's'} · ${block.items[0]?.q ?? ''}`
    default:
      // A new block type fails to compile here until it is handled.
      return block satisfies never
  }
}
