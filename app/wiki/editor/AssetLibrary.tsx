'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { uploadWikiAsset } from '@utils/articles'
import { searchCardArts, type CardArts } from '@utils/cards'
import { CARD_ART_URL } from '@utils/const'
import { imageSource, type WikiAsset } from '@utils/wiki-doc'
import { FIELD, HELP, failure } from '../ArticleForm'
import { MINI } from './fields'

/** The only credits a Yu-Gi-Oh! artwork may carry: the original manga, or the later anime series. */
const YUGIOH_CREDITS: readonly string[] = ['©1996 KAZUKI TAKAHASHI', '©2020 Studio Dice/SHUEISHA, TV TOKYO, KONAMI']

/** The last answer the server gave, tagged with the query that asked for it. */
type Answer = { query: string; cards: CardArts[]; failed: boolean }

/**
 * Card art by name or passcode. Each result lists every artwork of the card as
 * `[art] Name (passcode)`, so an alternate art is one click, not a passcode lookup.
 */
const CardArtSearch = ({ added, onPick }: { added: Set<string>; onPick: (id: number, name: string) => void }) => {
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState<Answer | null>(null)

  const text = query.trim()
  const ready = /^\d+$/.test(text) || text.length >= 2
  const shown = answer?.query === text ? answer : null

  // Debounced like the wiki bar; stale answers vanish because they're tagged with their query.
  useEffect(() => {
    if (!ready) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchCardArts(text, 8, controller.signal)
        .then((cards) => setAnswer({ query: text, cards, failed: false }))
        .catch((error: Error) => {
          if (error.name !== 'AbortError') setAnswer({ query: text, cards: [], failed: true })
        })
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [text, ready])

  const rows = shown?.cards.flatMap((card) => card.arts.map((art) => ({ art, name: card.name }))) ?? []

  return (
    <div>
      <input
        type="search"
        aria-label="Search card art by name or passcode"
        placeholder="Card art: name or passcode"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className={FIELD}
      />
      {ready ? (
        <div aria-live="polite" className="mt-1.5 max-h-72 overflow-y-auto border border-line bg-surface-100">
          {!shown ? (
            <p className="px-2.5 py-2 text-ink-muted body-sm">Searching…</p>
          ) : shown.failed ? (
            <p className="px-2.5 py-2 text-cyan body-sm">Card search is unavailable right now.</p>
          ) : !rows.length ? (
            <p className="px-2.5 py-2 text-ink-muted body-sm">No cards match “{text}”.</p>
          ) : (
            <ul>
              {rows.map(({ art, name }) => {
                const taken = added.has(`card-${art}`)
                return (
                  <li key={art}>
                    <button
                      type="button"
                      disabled={taken}
                      onClick={() => {
                        onPick(art, name)
                        setQuery('')
                      }}
                      className="flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left hover:bg-ground-soft disabled:opacity-40"
                    >
                      <Image src={CARD_ART_URL(art)} alt="" width={40} height={40} unoptimized className="size-10 shrink-0 border border-line object-cover" />
                      <span className="min-w-0 truncate text-ink body-sm">
                        {name} <span className="text-ink-muted mono-note">({art})</span>
                      </span>
                      {taken ? <span className="ml-auto shrink-0 text-ink-muted mono-note">Added</span> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}

type AssetLibraryProps = {
  assets: WikiAsset[]
  /** Ids some block, the cover or the infobox still points at. */
  used: Set<string>
  onAdd: (asset: WikiAsset) => void
  onChange: (asset: WikiAsset) => void
  onRemove: (id: string) => void
}

/**
 * Every image the article can use. Blocks only reference ids from here, so an image edited
 * once (alt, credit, focal point) changes everywhere it appears.
 */
export const AssetLibrary = ({ assets, used, onAdd, onChange, onRemove }: AssetLibraryProps) => {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addCard = (id: number, name: string) =>
    onAdd({ id: `card-${id}`, src: CARD_ART_URL(id), width: 624, height: 624, alt: `${name} artwork`, credit: YUGIOH_CREDITS[0] })

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      // The select shows the first credit by default; store it so the page prints what the editor saw.
      const asset = await uploadWikiAsset(file, file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '))
      onAdd({ ...asset, credit: asset.credit || YUGIOH_CREDITS[0] })
    } catch (cause) {
      console.error(cause)
      setError(failure(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3">
        <label className={twMerge(MINI, 'relative min-h-10 cursor-pointer px-3', busy && 'pointer-events-none opacity-40')}>
          {busy ? 'Working…' : 'Upload image'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => {
              void upload(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </label>

        <CardArtSearch added={new Set(assets.map((asset) => asset.id))} onPick={addCard} />

        <p aria-live="polite" className="text-cyan body-sm empty:hidden">
          {error ?? ''}
        </p>
      </div>

      <ul className="mt-4 flex flex-col gap-3">
        {assets.map((asset) => (
          <li key={asset.id} className="border border-line bg-surface-100 p-2.5">
            <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2.5">
              {/* Click the image to set the focal point: the part that survives every crop. */}
              <button
                type="button"
                aria-label={`Set focal point of ${asset.id}`}
                onClick={(event) => {
                  const box = event.currentTarget.getBoundingClientRect()
                  const x = Math.round(((event.clientX - box.left) / box.width) * 100)
                  const y = Math.round(((event.clientY - box.top) / box.height) * 100)
                  onChange({ ...asset, focal: { x, y } })
                }}
                className="relative block cursor-crosshair self-start border border-line"
              >
                <Image src={imageSource(asset, 200).src} alt="" width={asset.width} height={asset.height} unoptimized className="h-auto w-full" />
                {asset.focal ? (
                  <span
                    aria-hidden
                    style={{ left: `${asset.focal.x}%`, top: `${asset.focal.y}%` }}
                    className="absolute size-3 -translate-1/2 border-2 border-cyan bg-scrim"
                  />
                ) : null}
              </button>
              <div className="min-w-0">
                <p className="truncate text-ink-muted mono-note">
                  {asset.id} · {asset.width}×{asset.height}
                </p>
                <input
                  aria-label={`Alt text for ${asset.id}`}
                  placeholder="Alt text (required)"
                  value={asset.alt}
                  onChange={(event) => onChange({ ...asset, alt: event.target.value })}
                  className={twMerge(FIELD, 'mt-1.5 py-1.5', !asset.alt.trim() && 'border-cyan')}
                />
                <select
                  aria-label={`Credit for ${asset.id}`}
                  value={asset.credit ?? YUGIOH_CREDITS[0]}
                  onChange={(event) => onChange({ ...asset, credit: event.target.value })}
                  className={twMerge(FIELD, 'mt-1.5 py-1.5')}
                >
                  {/* An older article may carry another credit; keep it visible until someone picks. */}
                  {asset.credit && !YUGIOH_CREDITS.includes(asset.credit) ? <option>{asset.credit}</option> : null}
                  {YUGIOH_CREDITS.map((credit) => (
                    <option key={credit}>{credit}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onRemove(asset.id)}
                  disabled={used.has(asset.id)}
                  title={used.has(asset.id) ? 'In use: remove it from the article first' : undefined}
                  className={twMerge(MINI, 'mt-1.5 px-2.5')}
                >
                  {used.has(asset.id) ? 'In use' : 'Remove'}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {assets.length ? null : <p className={twMerge(HELP, 'mt-4')}>No images yet.</p>}
      <p className="mt-4 text-ink-muted micro">Click an image to set its focal point.</p>
    </div>
  )
}
