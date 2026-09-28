'use client'

import { useState } from 'react'
import { ChatBubble } from '@omega/bubble'
import { Field, Segmented, Select } from '@ui/index'
import { BUBBLE_ANIMATIONS, BUBBLE_CORNERS, BUBBLE_SHAPES, DEFAULT_BUBBLE, isHex, parseBubble, type BubbleStyle } from '@utils/bubble'

type BubbleDesignerProps = {
  /** The item's `data` as the editor holds it: JSON text. */
  value: string
  onChange: (value: string) => void
  /** The item's image, drawn as the sticker. */
  sticker: string | null
}

const read = (value: string): { style: BubbleStyle; broken: boolean } => {
  try {
    return { style: parseBubble(value.trim() ? JSON.parse(value) : {}), broken: false }
  } catch {
    return { style: DEFAULT_BUBBLE, broken: true }
  }
}

/** `<input type="color">` only takes `#rrggbb`. Alpha from a hand-written `#rrggbbaa` is dropped on edit. */
const sixDigits = (hex: string) =>
  hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex.slice(0, 7)

/** Swatch picker plus a hex box. The box commits only a valid hex (`#rgb`, `#rrggbb`, `#rrggbbaa`, `#` optional). */
const ColorField = ({ label, value, onChange, optional }: { label: string; value: string | null; onChange: (v: string | null) => void; optional?: string }) => {
  // What's being typed; `null` shows the saved value. Blur drops a half-typed hex.
  const [text, setText] = useState<string | null>(null)
  const type = (raw: string) => {
    setText(raw)
    const hex = (raw.startsWith('#') ? raw : `#${raw}`).toLowerCase()
    if (isHex(hex)) onChange(hex)
  }
  const off = value === null
  return (
    <div className="flex flex-col gap-1.5 text-ink-dim body-sm">
      <label className="flex items-center gap-2">
        {optional ? (
          <input type="checkbox" checked={!off} onChange={(e) => { setText(null); onChange(e.target.checked ? optional : null) }} className="size-4 accent-cyan" />
        ) : null}
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} swatch`}
          disabled={off}
          value={sixDigits(value ?? optional ?? '#000000')}
          onChange={(e) => { setText(null); onChange(e.target.value) }}
          className="h-9 w-10 shrink-0 cursor-pointer border border-line-mid bg-transparent disabled:cursor-not-allowed disabled:opacity-40"
        />
        <input
          type="text"
          aria-label={`${label} hex`}
          aria-invalid={text !== null && !isHex(text.startsWith('#') ? text : `#${text}`)}
          disabled={off}
          spellCheck={false}
          maxLength={9}
          placeholder="#rrggbb"
          value={off ? '' : (text ?? value)}
          onChange={(e) => type(e.target.value.trim())}
          onBlur={() => setText(null)}
          className="h-9 w-full min-w-0 border border-line-mid bg-surface-200 px-2 text-ink data outline-none focus:border-cyan disabled:opacity-40 aria-invalid:border-loss"
        />
      </div>
    </div>
  )
}

const Range = ({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) => (
  <label className="flex flex-col gap-1 text-ink-dim body-sm">
    <span className="flex justify-between">
      {label}
      <span className="text-ink-muted data">{value}px</span>
    </span>
    <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-cyan" />
  </label>
)

/** Form for a `MSGBUBBLE` item's `data` (docs/MSGBUBBLE.md), with the bubble as the messenger draws it. */
export const BubbleDesigner = ({ value, onChange, sticker }: BubbleDesignerProps) => {
  const { style, broken } = read(value)
  const set = (patch: Partial<BubbleStyle>) => onChange(JSON.stringify({ ...style, ...patch }, null, 2))
  const setSticker = (patch: Partial<BubbleStyle['sticker']>) => set({ sticker: { ...style.sticker, ...patch } })

  return (
    <div className="flex flex-col gap-4 border border-line-mid p-4">
      <span className="text-ink-muted signal-sm">Bubble designer</span>

      <div className="flex flex-col gap-4 bg-space-000 px-5 py-6" aria-label="Preview">
        <ChatBubble style={style} sticker={sticker}>gg, that was close 😅</ChatBubble>
        <ChatBubble style={style} sticker={sticker} mine className="self-end">
          rematch?
        </ChatBubble>
      </div>

      {broken ? <span className="text-loss caption">The JSON below doesn’t parse. Changing anything here replaces it.</span> : null}

      <div className="grid grid-cols-2 gap-3">
        <ColorField label="Fill" value={style.bg} onChange={(bg) => set({ bg: bg ?? DEFAULT_BUBBLE.bg })} />
        <ColorField label="Gradient to" value={style.bg2} optional="#ffffff" onChange={(bg2) => set({ bg2 })} />
        <ColorField label="Text" value={style.text} onChange={(text) => set({ text: text ?? DEFAULT_BUBBLE.text })} />
        <ColorField label="Border" value={style.border} optional="#ffffff" onChange={(border) => set({ border })} />
      </div>

      <Field label="Shape">
        <Segmented label="Shape" size="sm" value={style.shape} onChange={(shape) => set({ shape })} options={BUBBLE_SHAPES.map((s) => ({ value: s, label: s }))} />
      </Field>

      <Field label="Sticker" hint={sticker ? 'The item image, on the corner you pick. Mirrored on your own messages.' : 'Add a transparent PNG or WebP as the item image to put a sticker on the bubble.'}>
        <div className="grid grid-cols-2 gap-3">
          <Select block aria-label="Corner" prefix="Corner" value={style.sticker.at} onChange={(e) => setSticker({ at: e.target.value as BubbleStyle['sticker']['at'] })} options={[...BUBBLE_CORNERS]} />
          <Select block aria-label="Motion" prefix="Motion" value={style.sticker.animate} onChange={(e) => setSticker({ animate: e.target.value as BubbleStyle['sticker']['animate'] })} options={[...BUBBLE_ANIMATIONS]} />
        </div>
        <Range label="Size" value={style.sticker.size} min={16} max={64} onChange={(size) => setSticker({ size })} />
        <div className="grid grid-cols-2 gap-3">
          <Range label="Nudge ←→" value={style.sticker.dx} min={-32} max={32} onChange={(dx) => setSticker({ dx })} />
          <Range label="Nudge ↑↓" value={style.sticker.dy} min={-32} max={32} onChange={(dy) => setSticker({ dy })} />
        </div>
      </Field>
    </div>
  )
}
