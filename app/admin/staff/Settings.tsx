'use client'

import { useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Field, TextInput } from '@ui/field'
import { Panel } from '@ui/panel'
import { SectionHead } from '@ui/section-head'
import { useResource } from '@hooks/index'
import { timeLabel } from '@utils/format'
import { DEFAULT_CLASSIFICATION, DEFAULT_TIERS, getSettings, panelErrorText, updateSettings, type Classification, type PanelSettings, type TierAnchors } from '@utils/panel'

const TIERS: { key: keyof TierAnchors; label: string }[] = [
  { key: 't1', label: 'Tier 1' },
  { key: 't15', label: 'Tier 1.5' },
  { key: 't2', label: 'Tier 2' },
  { key: 't3', label: 'Tier 3' },
  { key: 't4', label: 'Tier 4' },
]

const toPercent = (rate: number) => String(Number((rate * 100).toFixed(2)))
const fromPercent = (text: string) => Number(text) / 100
/** Edits in progress, as typed; a field without one shows the stored value. */
type Draft = Partial<Record<keyof TierAnchors | keyof Classification, string>>

/** What the form holds, with the percent fields back in rates. A field left alone isn't sent. */
export const settingsBody = (draft: Draft): PanelSettings => {
  const tiers = Object.fromEntries(TIERS.flatMap(({ key }) => (draft[key] === undefined ? [] : [[key, fromPercent(draft[key])]])))
  const { maxNames, stapleShare, stapleForeign } = draft
  const classification = {
    ...(maxNames === undefined ? {} : { maxNames: Number(maxNames) }),
    ...(stapleShare === undefined ? {} : { stapleShare: fromPercent(stapleShare) }),
    ...(stapleForeign === undefined ? {} : { stapleForeign: fromPercent(stapleForeign) }),
  }
  return {
    ...(Object.keys(tiers).length ? { 'analytics.tiers': tiers } : {}),
    ...(Object.keys(classification).length ? { 'analytics.classification': classification } : {}),
  }
}

export const SettingsPanel = () => {
  const settings = useResource('settings', () => getSettings())
  const [draft, setDraft] = useState<Draft>({})
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const tiers = { ...DEFAULT_TIERS, ...settings.data?.['analytics.tiers'] }
  const classification = { ...DEFAULT_CLASSIFICATION, ...settings.data?.['analytics.classification'] }
  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [key]: e.target.value }))
  const bad = Object.values(draft).some((v) => v.trim() === '' || !Number.isFinite(Number(v)))

  const save = () => {
    setError(null)
    updateSettings(settingsBody(draft)).then(
      (next) => {
        settings.setData(() => next)
        setDraft({})
        setSaved(`Saved at ${timeLabel(new Date())}`)
      },
      (e) => setError(panelErrorText(e)),
    )
  }

  return (
    <Panel label="Settings" className="flex scroll-mt-6 flex-col gap-4.5 [--edge:var(--color-line-mid)]">
      <span id="settings" />
      <SectionHead compact num="03" end={saved ?? 'Read by the next job run'}>Settings</SectionHead>
      {settings.error ? <Alert tone="negative" title="Couldn't read the settings">{panelErrorText(settings.error)}</Alert> : null}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <fieldset className="flex flex-col gap-3">
          <legend className="pb-2 body-strong">Tier anchors</legend>
          <span className="text-sm leading-5.5 text-ink-dim">The expected win rate, in percent, a deck needs for each tier. Each one must be at or below the one before.</span>
          <div className="grid grid-cols-3 gap-3 min-[720px]:grid-cols-5">
            {TIERS.map(({ key, label }) => (
              <Field key={key} label={label} htmlFor={`tier-${key}`}>
                <TextInput id={`tier-${key}`} inputMode="decimal" suffix="%" value={draft[key] ?? toPercent(tiers[key])} onChange={set(key)} />
              </Field>
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-3">
          <legend className="pb-2 body-strong">Deck classification</legend>
          <span className="text-sm leading-5.5 text-ink-dim">How many names a deck can hold, and the cut-offs of the automatic staple detection. Deck names change on the next read, /statistics at the next build.</span>
          <div className="grid grid-cols-1 gap-3 min-[720px]:grid-cols-3">
            <Field label="Names in a deck" htmlFor="set-names">
              <TextInput id="set-names" inputMode="numeric" suffix="1–5" value={draft.maxNames ?? String(classification.maxNames)} onChange={set('maxNames')} />
            </Field>
            <Field label="Staple: in decks" htmlFor="set-share">
              <TextInput id="set-share" inputMode="decimal" suffix="%" value={draft.stapleShare ?? toPercent(classification.stapleShare)} onChange={set('stapleShare')} />
            </Field>
            <Field label="Staple: foreign" htmlFor="set-foreign">
              <TextInput id="set-foreign" inputMode="decimal" suffix="%" value={draft.stapleForeign ?? toPercent(classification.stapleForeign)} onChange={set('stapleForeign')} />
            </Field>
          </div>
        </fieldset>
      </div>
      <div>
        <Button size="mono-md" disabled={bad || !Object.keys(draft).length} onClick={save}>Save settings</Button>
      </div>
      {error ? <Alert tone="negative" title="Not saved">{error}</Alert> : null}
    </Panel>
  )
}
