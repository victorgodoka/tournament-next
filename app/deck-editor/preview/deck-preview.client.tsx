'use client'

import { useEffect, useMemo, useState } from 'react'
import BadgesComponent from '@components/badges/badges.component'
import ButtonComponent from '@components/button/button.component'
import DeckListComponent from '@components/deck-list/deck-list.component'
import IconComponent from '@components/icon/icon.component'
import { buildCardLookup, isExtra } from '@lib/cards.utils'
import { PREVIEW_KEY } from '../deck-editor.const'
import { loadPreview, type PreviewPayload, type PreviewResult } from './deck-preview.api'
import './deck-preview.styles.css'

type Status = 'loading' | 'empty' | 'ready'

/** Split the merged main list back into true main/extra counts for the stats. */
function useSizes(result: PreviewResult | null) {
  return useMemo(() => {
    if (!result) return { main: 0, extra: 0, side: 0 }
    const lookup = buildCardLookup(result.deck.uniqueCardsData ?? [])
    let main = 0
    let extra = 0
    for (const id of result.deck.fullDeck.main) {
      const card = lookup.get(id)
      if (card && isExtra(card)) extra += 1
      else main += 1
    }
    return { main, extra, side: result.deck.fullDeck.side.length }
  }, [result])
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked */
    }
  }
  return (
    <div className="preview-code">
      <label className="preview-code__label">{label}</label>
      <div className="preview-code__row">
        <input className="preview-code__input" value={value} readOnly onFocus={(e) => e.target.select()} />
        <ButtonComponent
          variant="secondary"
          size="sm"
          icon={copied ? 'mdi:check' : 'mdi:content-copy'}
          onClick={copy}
        >
          {copied ? 'Copied' : 'Copy'}
        </ButtonComponent>
      </div>
    </div>
  )
}

const DeckPreviewClient = () => {
  const [status, setStatus] = useState<Status>('loading')
  const [payload, setPayload] = useState<PreviewPayload | null>(null)
  const [result, setResult] = useState<PreviewResult | null>(null)
  const sizes = useSizes(result)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      let raw: string | null = null
      try {
        raw = sessionStorage.getItem(PREVIEW_KEY)
      } catch (error) {
        console.log(error)
      }
      if (!raw) {
        if (!cancelled) setStatus('empty')
        return
      }
      try {
        const parsed = JSON.parse(raw) as PreviewPayload
        if (!cancelled) setPayload(parsed)
        const res = await loadPreview(parsed)
        if (cancelled) return
        setResult(res)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('empty')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const share = async () => {
    if (!result) return
    const data = { title: payload?.name ?? 'My Yu-Gi-Oh! deck', text: result.ydke }
    try {
      if (navigator.share) await navigator.share(data)
      else await navigator.clipboard.writeText(result.ydke)
    } catch {
      /* user cancelled or clipboard blocked */
    }
  }

  if (status === 'loading') {
    return (
      <div className="preview-state">
        <IconComponent icon="mdi:loading" className="preview-state__spin" width={34} height={34} />
        <p>Converting your deck…</p>
      </div>
    )
  }

  if (status === 'empty' || !result) {
    return (
      <div className="preview-state">
        <IconComponent icon="mdi:cards-outline" width={40} height={40} />
        <p>No deck to preview yet.</p>
        <ButtonComponent variant="primary" icon="mdi:pencil-outline" to="/deck-editor">
          Open the deck builder
        </ButtonComponent>
      </div>
    )
  }

  const name = payload?.name ?? 'Untitled Deck'
  const stats = [
    { key: 'main', label: 'Main', value: sizes.main },
    { key: 'extra', label: 'Extra', value: sizes.extra },
    { key: 'side', label: 'Side', value: sizes.side },
  ].filter((s) => s.value > 0)

  return (
    <article className="preview omega-container">
      <header className="preview__header">
        <div className="preview__heading">
          <ButtonComponent variant="ghost" size="sm" icon="mdi:arrow-left" to="/deck-editor">
            Back to editor
          </ButtonComponent>
          <h1 className="preview__name">{name}</h1>
          {result.deck.archetypes.length > 0 && <BadgesComponent archetypes={result.deck.archetypes} />}
        </div>

        <dl className="preview__stats">
          {stats.map((s) => (
            <div key={s.key} className="preview__stat">
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      {result.degraded && (
        <p className="preview__notice" role="status">
          <IconComponent icon="mdi:information-outline" width={16} height={16} />
          {result.note
            ? `${result.note}. Archetype detection and the Omega code are hidden, but your decklist and YDKE export still work.`
            : 'The Omega converter is unavailable, so archetype detection and the Omega code are hidden. Your decklist and YDKE export still work.'}
        </p>
      )}

      <section className="preview__share" aria-label="Share and export">
        <CopyField label="YDKE URL" value={result.ydke} />
        <ButtonComponent variant="outline" icon="mdi:share-variant" onClick={share}>
          Share deck
        </ButtonComponent>
      </section>

      <DeckListComponent convertedDeck={result.deck} name={name} headingTag="h2" />
    </article>
  )
}

export default DeckPreviewClient
