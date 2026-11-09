'use client'

import Image from 'next/image'
import { useId, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { DOC_LIMITS, isShareSize, shareAsset, toAnchor, type WikiAsset, type WikiDoc, type WikiInfobox } from '@utils/wiki-doc'
import { SNIPPET_CHARS } from '@utils/wiki-seo'
import { FIELD, LABEL } from '../ArticleForm'
import { AssetPicker, MINI, TextField } from './fields'
import { Check, FieldHead, Frame, Help, INPUT, Meter, Panel, Pill } from './ui'
import { StatisticsDeckPicker } from './StatisticsDeckPicker'

/** What `GET /wiki/{slug}` said about the address being typed (WIKI_API §4.2). */
export type SlugStatus = 'current' | 'free' | 'taken' | 'moved' | 'checking' | 'invalid' | 'empty' | 'error'

const STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'how', 'what', 'is', 'e', 'o', 'de', 'da', 'do'])

export const slugWords = (slug: string) => slug.split('-').filter(Boolean)
export const hasStopWords = (slug: string) => slugWords(slug).some((word) => STOP_WORDS.has(word))

const SLUG_STATE: Record<SlugStatus, { text: string; className: string } | null> = {
  current: { text: 'Current', className: 'text-ink-muted' },
  free: { text: '✓ Free', className: 'text-win' },
  taken: { text: '✕ Taken', className: 'text-loss' },
  moved: { text: '! Former address', className: 'text-gold' },
  checking: { text: 'Checking…', className: 'text-ink-muted' },
  invalid: { text: '✕ Lowercase-words-only', className: 'text-loss' },
  error: { text: "Couldn't check", className: 'text-ink-muted' },
  empty: null,
}

export type SlugProps = {
  slug: string
  onSlug: (slug: string) => void
  status: SlugStatus
  /** Edit mode: the address it is live under. */
  original?: string
  /** The article is published: a rename breaks links unless it redirects. */
  live?: boolean
  liveDays?: number
  redirect: boolean
  onRedirect: (redirect: boolean) => void
  takeover: boolean
  onTakeover: (takeover: boolean) => void
}

/** `/wiki/` + the address, its availability, and the rename warning on a live article. */
export const SlugField = ({ slug, onSlug, status, original, live, liveDays, redirect, onRedirect, takeover, onTakeover, help }: SlugProps & { help?: React.ReactNode }) => {
  const id = useId()
  const renamed = !!original && slug !== original
  const state = SLUG_STATE[status]
  return (
    <div className="min-w-0">
      <FieldHead htmlFor={id} label="Address" />
      <Frame tone={renamed && live ? 'danger' : status === 'taken' || status === 'invalid' ? 'warn' : 'default'}>
        <span aria-hidden className="pl-3 text-ink-muted data">
          /wiki/
        </span>
        <input
          id={id}
          value={slug}
          maxLength={DOC_LIMITS.slug}
          spellCheck={false}
          onChange={(event) => onSlug(event.target.value.toLowerCase().replace(/\s+/g, '-'))}
          className={twMerge(INPUT, 'pl-0.5 data')}
        />
        {renamed ? (
          <button type="button" onClick={() => onSlug(original)} className="cursor-pointer px-3 whitespace-nowrap text-cyan signal-sm hover:text-ink">
            Undo
          </button>
        ) : state ? (
          <span aria-live="polite" className={twMerge('pr-3 whitespace-nowrap signal-sm', state.className)}>
            {state.text}
          </span>
        ) : null}
      </Frame>

      {status === 'moved' ? (
        <div className="mt-2.5 flex flex-col gap-2 border border-gold bg-surface-200 px-4 py-3">
          <p className="text-ink body-sm">
            <span className="text-gold signal-strong">Former address · </span>
            Another article used to live at /wiki/{slug}. Taking it over removes that redirect: its old links open this article instead.
          </p>
          <Check id={`${id}-takeover`} checked={takeover} onChange={onTakeover}>
            Take over this address
          </Check>
        </div>
      ) : null}

      {renamed && live && status !== 'taken' ? (
        <div className="mt-2.5 flex flex-col gap-2.5 border border-crimson-lift bg-surface-200 px-4 py-3.5">
          <p className="text-ink body-sm">
            <span className="text-crimson-lift signal-strong">Breaks links · </span>
            /wiki/{original} has been live for {liveDays ?? 0} day{liveDays === 1 ? '' : 's'}. Every link to it, in Discord, other articles and
            search results, stops working unless it redirects, and the page starts its ranking from zero.
          </p>
          <Check id={`${id}-redirect`} checked={redirect} onChange={onRedirect}>
            Send the old address to the new one (permanent redirect)
          </Check>
        </div>
      ) : help ? (
        <Help>{help}</Help>
      ) : null}
    </div>
  )
}

/** Chips with a trailing input. Enter or a comma adds; Backspace on an empty input removes the last. */
export const TagInput = ({
  id,
  values,
  max,
  onChange,
  normalise,
  placeholder,
  chipClassName,
}: {
  id: string
  values: string[]
  max: number
  onChange: (values: string[]) => void
  normalise: (value: string) => string
  placeholder: string
  chipClassName?: string
}) => {
  const [text, setText] = useState('')
  const add = () => {
    const value = normalise(text)
    setText('')
    if (!value || values.length >= max || values.some((other) => other.toLowerCase() === value.toLowerCase())) return
    onChange([...values, value])
  }
  return (
    <Frame className="flex-wrap gap-1.5 px-2 py-1.75">
      {values.map((value) => (
        <Pill key={value} tone="neutral" className={chipClassName}>
          {value}
          <button type="button" aria-label={`Remove ${value}`} onClick={() => onChange(values.filter((other) => other !== value))} className="cursor-pointer text-ink-muted hover:text-loss">
            ×
          </button>
        </Pill>
      ))}
      <input
        id={id}
        value={text}
        disabled={values.length >= max}
        placeholder={values.length >= max ? '' : placeholder}
        onChange={(event) => {
          if (event.target.value.endsWith(',')) {
            setText(event.target.value.slice(0, -1))
            return
          }
          setText(event.target.value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault()
            add()
          } else if (event.key === 'Backspace' && !text && values.length) onChange(values.slice(0, -1))
        }}
        onBlur={add}
        className="min-w-15 flex-1 bg-transparent p-1 text-ink body-sm placeholder:text-ink-muted focus-visible:outline-none"
      />
    </Frame>
  )
}

/** Library image or Statistics Deck. Its own radio group name, so two infobox forms on one page never share a group. */
const ImageSource = ({ infobox, onChange }: { infobox: WikiInfobox; onChange: (infobox: WikiInfobox) => void }) => {
  const name = useId()
  return (
    <fieldset>
      <legend className={LABEL}>Infobox image source</legend>
      <div className="mt-2 flex gap-4 text-ink body-sm">
        <label><input type="radio" name={name} checked={!infobox.statisticsDeck} onChange={() => onChange({ ...infobox, statisticsDeck: undefined })} className="mr-2 accent-cyan" />Library image</label>
        <label><input type="radio" name={name} checked={!!infobox.statisticsDeck} onChange={() => onChange({ ...infobox, asset: undefined, statisticsDeck: { key: '', name: '', ladder: 'tcg', faces: [] } })} className="mr-2 accent-cyan" />Statistics Deck</label>
      </div>
    </fieldset>
  )
}

/** The infobox's image, caption and facts. A fact's several values live in its one `value`, a line each. */
export const InfoboxFields = ({ infobox, assets, onChange }: { infobox: WikiInfobox; assets: WikiAsset[]; onChange: (infobox: WikiInfobox) => void }) => (
  <div className="flex flex-col gap-4 border-t border-line p-4">
    <ImageSource infobox={infobox} onChange={onChange} />
    {infobox.statisticsDeck ? <StatisticsDeckPicker value={infobox.statisticsDeck} onChange={(statisticsDeck) => onChange({ ...infobox, asset: undefined, statisticsDeck: statisticsDeck ?? { key: '', name: '', ladder: infobox.statisticsDeck!.ladder, faces: [] } })} /> :
      <AssetPicker optional label="Infobox image" assets={assets} selected={infobox.asset ? [infobox.asset] : []} onChange={([asset]) => onChange({ ...infobox, asset })} />}
    <TextField label="Image caption" value={infobox.caption ?? ''} maxLength={DOC_LIMITS.short} onChange={(caption) => onChange({ ...infobox, caption: caption || undefined })} />
    <div>
      <p className={LABEL}>Facts</p>
      <ul className="mt-2 flex flex-col gap-2">
        {infobox.facts.map((fact, i) => {
          const setFact = (patch: Partial<typeof fact>) => onChange({ ...infobox, facts: infobox.facts.map((f, j) => (j === i ? { ...f, ...patch } : f)) })
          const values = fact.value.split('\n')
          const setValues = (next: string[]) => setFact({ value: next.join('\n') })
          return (
            <li key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-start gap-2">
              <input aria-label={`Fact ${i + 1} label`} placeholder="Label" value={fact.label} onChange={(event) => setFact({ label: event.target.value })} className={FIELD} />
              <div className="flex min-w-0 flex-col gap-1.5">
                {values.map((value, k) => (
                  <div key={k} className="flex gap-1.5">
                    <input
                      aria-label={`Fact ${i + 1} value ${k + 1}`}
                      placeholder="Value"
                      value={value}
                      onChange={(event) => setValues(values.map((v, m) => (m === k ? event.target.value.replace(/\n/g, ' ') : v)))}
                      className={twMerge(FIELD, 'min-w-0 flex-1')}
                    />
                    {values.length > 1 ? (
                      <button type="button" aria-label={`Remove value ${k + 1} of fact ${i + 1}`} onClick={() => setValues(values.filter((_, m) => m !== k))} className={MINI}>
                        −
                      </button>
                    ) : null}
                  </div>
                ))}
                <button type="button" onClick={() => setValues([...values, ''])} className={twMerge(MINI, 'self-start px-2.5')}>
                  + Value
                </button>
              </div>
              <button type="button" aria-label={`Remove fact ${i + 1}`} onClick={() => onChange({ ...infobox, facts: infobox.facts.filter((_, j) => j !== i) })} className={MINI}>
                ✕
              </button>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        disabled={infobox.facts.length >= DOC_LIMITS.facts}
        onClick={() => onChange({ ...infobox, facts: [...infobox.facts, { label: '', value: '' }] })}
        className={twMerge(MINI, 'mt-2 px-3')}
      >
        + Fact
      </button>
    </div>
  </div>
)

type HeaderPanelProps = {
  doc: WikiDoc
  edit: (next: (doc: WikiDoc) => WikiDoc) => void
  assets: WikiAsset[]
  slugProps: SlugProps
  /** New article: the address follows the title until someone types in it. */
  autoSlug: boolean
  selected: boolean
  onSelect: () => void
}

/** Panel 00: what readers and search see first, laid out like the published page's header. */
export const HeaderPanel = ({ doc, edit, assets, slugProps, autoSlug, selected, onSelect }: HeaderPanelProps) => {
  const [coverOpen, setCoverOpen] = useState(false)
  const [infoboxOpen, setInfoboxOpen] = useState(false)
  const cover = doc.cover ? doc.assets[doc.cover.asset] : undefined
  const share = shareAsset(doc)
  const smallShare = !doc.seo?.image && (!share || !isShareSize(share))
  const summary = doc.summary.length
  const infobox = doc.infobox
  const ids = { title: useId(), summary: useId(), tags: useId(), infobox: useId() }
  const words = slugWords(slugProps.slug).length

  return (
    <Panel
      id="block-header"
      aria-labelledby="h-header"
      onFocusCapture={onSelect}
      className={twMerge('scroll-mt-48', selected && '[--edge:var(--color-cyan)]')}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 id="h-header" className="text-ink-muted signal-strong">
          <span className="text-gold">00</span> Article header
        </h2>
        <span className="text-ink-muted signal-sm">What readers and search see first</span>
      </div>

      <div className="dots relative flex min-h-55 flex-col justify-end border-b border-line bg-surface-200 p-5">
        {cover ? (
          <>
            <Image
              src={cover.src}
              alt=""
              fill
              unoptimized
              sizes="860px"
              style={{ objectPosition: cover.focal ? `${cover.focal.x}% ${cover.focal.y}%` : undefined }}
              className="object-cover brightness-[.55]"
            />
            {cover.focal ? (
              <span aria-hidden style={{ left: `${cover.focal.x}%`, top: `${cover.focal.y}%` }} className="absolute size-3.5 -translate-1/2 border-2 border-cyan bg-scrim" />
            ) : null}
          </>
        ) : null}
        <div className="relative flex flex-wrap items-end gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-ink-muted signal-sm">{cover ? `Cover · ${cover.id} · ${cover.width}×${cover.height}` : 'No cover'}</span>
            <span className="truncate text-ink-dim body-sm">{cover ? cover.alt : 'The header shows the title on the dot field.'}</span>
          </div>
          {smallShare ? (
            <span className="cut px-2 py-1.25 text-loss signal-sm [--cut:var(--cut-xs)] [--edge:var(--color-loss)]">
              Fix · under {DOC_LIMITS.shareWidth} px for link previews
            </span>
          ) : null}
          <button
            type="button"
            aria-expanded={coverOpen}
            onClick={() => setCoverOpen((open) => !open)}
            className="cut min-h-8.5 cursor-pointer px-3.5 text-ink signal-strong [--edge:var(--color-line-strong)] hover:[--fill:var(--color-surface-300)]"
          >
            {cover ? 'Change' : 'Pick cover'}
          </button>
        </div>
      </div>
      {coverOpen ? (
        <div className="border-b border-line p-4">
          <AssetPicker
            optional
            label="Cover image · from the Library"
            assets={assets}
            selected={doc.cover ? [doc.cover.asset] : []}
            onChange={([asset]) => edit((d) => ({ ...d, cover: asset ? { asset } : undefined }))}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-5 p-5">
        <div>
          <FieldHead htmlFor={ids.title} label="Title · H1" meta={`${doc.title.length} / ${DOC_LIMITS.title}`} />
          <Frame>
            <input
              id={ids.title}
              value={doc.title}
              maxLength={DOC_LIMITS.title}
              placeholder="Article title"
              onChange={(event) => edit((d) => ({ ...d, title: event.target.value }))}
              className={twMerge(INPUT, 'px-4 py-3.5 text-[30px] display-2')}
            />
          </Frame>
          {slugProps.original ? <Help>A new title never moves the address.</Help> : null}
        </div>

        <div>
          <FieldHead
            htmlFor={ids.summary}
            label="Summary"
            meta={`${summary} / ${DOC_LIMITS.summary}${summary > SNIPPET_CHARS ? ` · search shows ~${SNIPPET_CHARS}` : ''}`}
            metaTone={summary > SNIPPET_CHARS ? 'warn' : summary ? 'pass' : 'muted'}
          />
          <Frame>
            <textarea
              id={ids.summary}
              rows={3}
              value={doc.summary}
              maxLength={DOC_LIMITS.summary}
              onChange={(event) => edit((d) => ({ ...d, summary: event.target.value.replace(/\n/g, ' ') }))}
              className={twMerge(INPUT, 'resize-y text-ink-dim lead')}
            />
          </Frame>
          <Meter value={summary} limit={SNIPPET_CHARS} max={DOC_LIMITS.summary} />
          <Help>
            The lead under the title, the index card and the meta description. Past the gold mark, search results cut it — set a separate description in
            SEO or trim it.
          </Help>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <SlugField
            {...slugProps}
            help={
              slugProps.slug
                ? `${autoSlug ? 'Filled from the title until you edit it. ' : ''}${words} word${words === 1 ? '' : 's'}${hasStopWords(slugProps.slug) ? ', has stop words' : ', no stop words'}.`
                : 'Lowercase words joined by hyphens.'
            }
          />
          <div className="min-w-0">
            <FieldHead htmlFor={ids.tags} label="Tags" meta={`${doc.tags.length} / ${DOC_LIMITS.tags}`} />
            <TagInput
              id={ids.tags}
              values={doc.tags}
              max={DOC_LIMITS.tags}
              normalise={(value) => toAnchor(value).slice(0, DOC_LIMITS.tag).replace(/-$/, '')}
              onChange={(tags) => edit((d) => ({ ...d, tags }))}
              placeholder="Add tag"
            />
            <Help>Lowercase, hyphens for spaces. They build the tag hubs.</Help>
          </div>
        </div>

        <div className="border border-line bg-surface-200">
          <div className="flex flex-wrap items-center gap-3.5 px-3.5 py-3">
            <input
              id={ids.infobox}
              type="checkbox"
              checked={!!infobox}
              onChange={(event) => {
                edit((d) => ({ ...d, infobox: event.target.checked ? { facts: [{ label: '', value: '' }] } : undefined }))
                setInfoboxOpen(event.target.checked)
              }}
              className="m-0 size-4 accent-cyan"
            />
            <label htmlFor={ids.infobox} className="text-ink body-strong">
              Infobox
            </label>
            <span className="min-w-0 flex-1 truncate text-ink-muted body-sm">
              {infobox
                ? [
                    `${infobox.facts.length} fact${infobox.facts.length === 1 ? '' : 's'}`,
                    infobox.statisticsDeck ? `deck ${infobox.statisticsDeck.name || 'unselected'}` : infobox.asset ? `image ${infobox.asset}` : 'no image',
                    infobox.facts.map((fact) => fact.label).filter(Boolean).join(', '),
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : 'Facts beside the article: type, size, key card…'}
            </span>
            {infobox ? (
              <button
                type="button"
                aria-expanded={infoboxOpen}
                onClick={() => setInfoboxOpen((open) => !open)}
                className="cut min-h-7.5 cursor-pointer px-3 text-ink signal-strong [--edge:var(--color-line-strong)] [--fill:var(--color-surface-200)] hover:[--fill:var(--color-surface-300)]"
              >
                {infoboxOpen ? 'Done' : 'Edit'}
              </button>
            ) : null}
          </div>
          {infobox && infoboxOpen ? <InfoboxFields infobox={infobox} assets={assets} onChange={(next) => edit((d) => ({ ...d, infobox: next }))} /> : null}
        </div>
      </div>
    </Panel>
  )
}
