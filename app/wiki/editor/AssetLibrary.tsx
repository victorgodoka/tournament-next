'use client'

import Image from 'next/image'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { uploadWikiAsset } from '@utils/articles'
import { CARD_ART_URL } from '@utils/const'
import { imageSource, isAllowedSrc, type WikiAsset } from '@utils/wiki-doc'
import { FIELD, HELP, failure } from '../ArticleForm'
import { MINI } from './fields'

/** Natural size of an image the browser can load. The server re-measures anything it stores. */
const measure = (src: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error(`Couldn't load ${src}`))
    img.src = src
  })

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
  const [passcode, setPasscode] = useState('')
  const [path, setPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addCard = () => {
    const id = Number(passcode)
    if (!id) return setError('Type a passcode.')
    onAdd({ id: `card-${id}`, src: CARD_ART_URL(id), width: 624, height: 624, alt: `Card artwork ${id}`, credit: 'Artwork © Konami' })
    setPasscode('')
    setError(null)
  }

  const addPath = async () => {
    const src = path.trim()
    if (!isAllowedSrc(src)) return setError('Use a site path like /banners/… or a card-art URL. Other images: upload them.')
    setBusy(true)
    try {
      const size = await measure(src)
      onAdd({ id: `img-${crypto.randomUUID().slice(0, 8)}`, src, ...size, alt: '' })
      setPath('')
      setError(null)
    } catch {
      setError("That image didn't load.")
    } finally {
      setBusy(false)
    }
  }

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onAdd(await uploadWikiAsset(file, file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')))
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
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(event) => {
              void upload(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </label>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            addCard()
          }}
          className="flex gap-2"
        >
          <input aria-label="Card passcode" inputMode="numeric" placeholder="Card passcode" value={passcode} onChange={(event) => setPasscode(event.target.value.replace(/\D/g, ''))} className={twMerge(FIELD, 'font-mono')} />
          <button type="submit" className={twMerge(MINI, 'px-3')}>
            Add
          </button>
        </form>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            void addPath()
          }}
          className="flex gap-2"
        >
          <input aria-label="Image path" placeholder="/banners/…" value={path} onChange={(event) => setPath(event.target.value)} className={twMerge(FIELD, 'font-mono')} />
          <button type="submit" disabled={busy} className={twMerge(MINI, 'px-3')}>
            Add
          </button>
        </form>

        <p aria-live="polite" className="text-gold body-sm empty:hidden">
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
                  className={twMerge(FIELD, 'mt-1.5 py-1.5', !asset.alt.trim() && 'border-gold')}
                />
                <input
                  aria-label={`Credit for ${asset.id}`}
                  placeholder="Credit"
                  value={asset.credit ?? ''}
                  onChange={(event) => onChange({ ...asset, credit: event.target.value || undefined })}
                  className={twMerge(FIELD, 'mt-1.5 py-1.5')}
                />
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
