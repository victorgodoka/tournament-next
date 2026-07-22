'use client'

import { useCallback, useEffect, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import ButtonComponent from '@components/button/button.component'
import IconComponent from '@components/icon/icon.component'

// .profile__banner (profile.styles.css) renders full-bleed at
// `clamp(14rem, 32vw, 22rem)` tall — past ~1100px wide the height plateaus at
// 22rem while width keeps growing, so there's no single "true" aspect ratio.
// 1600px is a representative desktop width; matching its aspect here (instead
// of a boxy 3:1) keeps the crop close to how most visitors actually see it.
const REFERENCE_WIDTH = 1600
const MAX_BANNER_HEIGHT = 22 * 16 // 22rem
const ASPECT = REFERENCE_WIDTH / MAX_BANNER_HEIGHT // ≈ 4.55
const OUTPUT_WIDTH = REFERENCE_WIDTH
const OUTPUT_HEIGHT = MAX_BANNER_HEIGHT

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', reject)
    image.src = src
  })

/** Draw the selected crop region onto a fixed-size canvas and export a JPEG
 * blob — the already-cropped banner, so no crop metadata needs storing. */
async function cropToFile(src: string, area: Area, name: string): Promise<File> {
  const image = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_WIDTH
  canvas.height = OUTPUT_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    OUTPUT_WIDTH,
    OUTPUT_HEIGHT,
  )

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Export failed'))),
      'image/jpeg',
      0.9,
    ),
  )

  return new File([blob], name, { type: 'image/jpeg' })
}

type CoverCropperProps = {
  src: string
  fileName: string
  onCancel: () => void
  onCropped: (file: File) => void
}

const CoverCropper = ({ src, fileName, onCancel, onCropped }: CoverCropperProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [areaPixels, setAreaPixels] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)

  const onCropComplete = useCallback((_: Area, pixels: Area) => setAreaPixels(pixels), [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  const handleApply = async () => {
    if (!areaPixels) return
    setSaving(true)
    try {
      onCropped(await cropToFile(src, areaPixels, fileName))
    } catch {
      setSaving(false)
    }
  }

  return (
    <div
      className="cover-cropper"
      role="dialog"
      aria-modal="true"
      aria-label="Crop cover image"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div className="cover-cropper__dialog">
        <header className="cover-cropper__header">
          <h2 className="cover-cropper__title">Position your cover</h2>
          <button
            type="button"
            className="cover-cropper__close"
            onClick={onCancel}
            aria-label="Cancel"
          >
            <IconComponent icon="mdi:close" width={20} height={20} />
          </button>
        </header>

        <div className="cover-cropper__stage" style={{ aspectRatio: ASPECT }}>
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={ASPECT}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid
          />
        </div>

        <div className="cover-cropper__controls">
          <IconComponent icon="mdi:magnify-minus-outline" width={18} height={18} />
          <input
            type="range"
            className="cover-cropper__zoom"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            aria-label="Zoom"
            onChange={(event) => setZoom(Number(event.target.value))}
          />
          <IconComponent icon="mdi:magnify-plus-outline" width={18} height={18} />
        </div>

        <div className="cover-cropper__actions">
          <ButtonComponent
            type="button"
            variant="primary"
            icon="mdi:crop"
            loading={saving}
            onClick={handleApply}
          >
            Apply crop
          </ButtonComponent>
          <ButtonComponent type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </ButtonComponent>
        </div>
      </div>
    </div>
  )
}

export default CoverCropper
