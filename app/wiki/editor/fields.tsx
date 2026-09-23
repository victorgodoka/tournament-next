'use client'

import Image from 'next/image'
import { useId, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { API_URL } from '@utils/auth'
import { CARD_ART_URL } from '@utils/const'
import { DOC_LIMITS, imageSource, parseYouTube, toAnchor, type WikiAsset, type WikiBlock, type WikiCardRef } from '@utils/wiki-doc'
import { FIELD, HELP, LABEL } from '../ArticleForm'

export const MINI = 'inline-flex min-h-8 min-w-8 items-center justify-center border border-line bg-surface-100 px-2 text-ink-dim signal-sm hover:border-gold hover:text-gold disabled:pointer-events-none disabled:opacity-40'

/** Labelled input or textarea. `rows` makes it a textarea. */
export const TextField = ({
  label,
  value,
  onChange,
  rows,
  help,
  mono,
  maxLength,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
  help?: React.ReactNode
  mono?: boolean
  maxLength?: number
  placeholder?: string
}) => {
  const id = useId()
  const shared = {
    id,
    value,
    maxLength,
    placeholder,
    className: twMerge(FIELD, 'mt-2', mono && 'font-mono', rows && 'resize-y'),
  }
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      {rows ? (
        <textarea {...shared} rows={rows} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input {...shared} onChange={(event) => onChange(event.target.value)} />
      )}
      {help ? <p className={HELP}>{help}</p> : null}
    </div>
  )
}

/** Radio group drawn as a segmented control. Arrow keys move between options natively. */
export const Segmented = <T extends string | number>({
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
            className="cursor-pointer bg-surface-100 px-3 py-2 text-ink-muted signal-sm hover:text-ink has-checked:bg-gold has-checked:text-gold-on has-focus-visible:outline-2 has-focus-visible:outline-cyan"
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
export const Thumb = ({ asset, className }: { asset: WikiAsset; className?: string }) => (
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
                className="flex aspect-square w-full items-center justify-center border border-line text-ink-muted signal-sm hover:border-gold aria-pressed:border-gold aria-pressed:text-gold"
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
                  className="relative block w-full border border-line opacity-60 hover:opacity-100 aria-pressed:border-gold aria-pressed:opacity-100 aria-pressed:outline-2 aria-pressed:outline-gold"
                >
                  <Thumb asset={asset} />
                  {multiple && order >= 0 ? (
                    <span className="absolute top-1 left-1 bg-gold px-1.5 text-gold-on mono-note">{order + 1}</span>
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

/** Passcode, name and note per card. A new passcode fills an empty name from the card API. */
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
                <Image src={CARD_ART_URL(card.id)} alt="" fill sizes="48px" className="object-cover" />
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
      <button
        type="button"
        disabled={cards.length >= DOC_LIMITS.cards}
        onClick={() => onChange([...cards, { id: 0, name: '' }])}
        className={twMerge(MINI, 'mt-2 px-3')}
      >
        + Card
      </button>
    </div>
  )
}

const MD_HELP = 'Markdown: **bold**, *italic*, [link](https://…), lists, | tables |. No raw HTML.'

type BlockFieldsProps = {
  block: WikiBlock
  assets: WikiAsset[]
  onChange: (block: WikiBlock) => void
}

/** The inputs for one block. Every change hands back a whole new block. */
export const BlockFields = ({ block, assets, onChange }: BlockFieldsProps) => {
  switch (block.type) {
    case 'text':
      return (
        <TextField label="Text" rows={8} mono value={block.md} onChange={(md) => onChange({ ...block, md })} help={MD_HELP} />
      )

    case 'heading': {
      // The anchor follows the text until someone edits it by hand.
      const auto = block.anchor === toAnchor(block.text)
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
            help={`#${block.anchor || '…'}`}
          />
        </div>
      )
    }

    case 'figure':
      return (
        <div className="flex flex-col gap-4">
          <AssetPicker label="Image" assets={assets} selected={block.asset ? [block.asset] : []} onChange={([asset]) => onChange({ ...block, asset: asset ?? '' })} />
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
          <TextField
            label="Caption"
            value={block.caption ?? ''}
            maxLength={DOC_LIMITS.short}
            onChange={(caption) => onChange({ ...block, caption: caption || undefined })}
            help="A float sits beside the blocks that follow it, until a heading or a wide block."
          />
        </div>
      )

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
          <TextField label="Text" rows={4} mono value={block.md} onChange={(md) => onChange({ ...block, md })} help={MD_HELP} />
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

    default:
      // A new block type fails to compile here until it is handled.
      return block satisfies never
  }
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
      <TextField label="Caption" value={block.caption ?? ''} maxLength={DOC_LIMITS.short} onChange={(caption) => onChange({ ...block, caption: caption || undefined })} />
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
      return `${block.asset || 'no image'} · ${block.align}`
    case 'gallery':
      return `${block.assets.length} images · ${block.layout}`
    case 'cards':
      return block.cards.map((card) => card.name).filter(Boolean).join(', ')
    case 'video':
      return block.title || block.videoId
    default:
      // A new block type fails to compile here until it is handled.
      return block satisfies never
  }
}
