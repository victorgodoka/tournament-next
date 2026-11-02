'use client'

import { useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Field, Select, TextInput } from '@ui/field'
import { Panel } from '@ui/panel'
import { SectionHead } from '@ui/section-head'
import { useResource } from '@hooks/index'
import { count, timeLabel } from '@utils/format'
import { BAND_NAMES, DEFAULT_CLASSIFICATION, DEFAULT_FILTERS, DEFAULT_TIERS, FORMATS, getSettings, panelErrorText, updateSettings, type Classification, type Filters, type Format, type PanelSettings, type TierAnchors } from '@utils/panel'
import { getMeta } from '@utils/statistics'
import type { RankedLadderId } from '@utils/types'

const LADDERS: RankedLadderId[] = ['tcg', 'genesys']
const FILTER_COUNTS: { key: 'minPlayerGames' | 'minListGames' | 'minKeyGames' | 'eloCap'; label: string; hint: string }[] = [
  { key: 'minPlayerGames', label: 'Player games', hint: 'Ranked games a player needs in the season; a game is out unless both players reach it. 0 turns it off.' },
  { key: 'minListGames', label: 'List games', hint: 'Games a decklist needs to count. 0 turns it off.' },
  { key: 'minKeyGames', label: 'Deck games', hint: 'Games a deck key needs to get a row. 0 turns it off.' },
  { key: 'eloCap', label: 'Rating cap', hint: 'Each rating is capped here before the pair’s mean sets the game’s band.' },
]

const TIERS: { key: keyof TierAnchors; label: string }[] = [
  { key: 't1', label: 'Tier 1' },
  { key: 't15', label: 'Tier 1.5' },
  { key: 't2', label: 'Tier 2' },
  { key: 't3', label: 'Tier 3' },
  { key: 't4', label: 'Tier 4' },
]

const toPercent = (rate: number) => String(Number((rate * 100).toFixed(2)))
const fromPercent = (text: string) => Number(text) / 100
/** A filter field of one format, as the draft keys it: `TCG.minListGames`. */
type FilterDraftKey = `${Format}.${keyof Filters}`
/** Edits in progress, as typed; a field without one shows the stored value. */
type Draft = Partial<Record<keyof TierAnchors | keyof Classification | FilterDraftKey, string>>

/** What the form holds, with the percent fields back in rates. A field left alone isn't sent; a format with no edit isn't either. */
export const settingsBody = (draft: Draft): PanelSettings => {
  const tiers = Object.fromEntries(TIERS.flatMap(({ key }) => (draft[key] === undefined ? [] : [[key, fromPercent(draft[key])]])))
  const { maxNames, stapleShare, stapleForeign } = draft
  const classification = {
    ...(maxNames === undefined ? {} : { maxNames: Number(maxNames) }),
    ...(stapleShare === undefined ? {} : { stapleShare: fromPercent(stapleShare) }),
    ...(stapleForeign === undefined ? {} : { stapleForeign: fromPercent(stapleForeign) }),
  }
  const filters = Object.fromEntries(
    FORMATS.flatMap((format) => {
      const floor = draft[`${format}.aggregateFloor`]
      const one = {
        ...Object.fromEntries(FILTER_COUNTS.flatMap(({ key }) => (draft[`${format}.${key}`] === undefined ? [] : [[key, Number(draft[`${format}.${key}`])]]))),
        ...(floor === undefined ? {} : { aggregateFloor: floor as Filters['aggregateFloor'] }),
      }
      return Object.keys(one).length ? [[format, one]] : []
    }),
  )
  return {
    ...(Object.keys(tiers).length ? { 'analytics.tiers': tiers } : {}),
    ...(Object.keys(classification).length ? { 'analytics.classification': classification } : {}),
    ...(Object.keys(filters).length ? { 'analytics.filters': filters } : {}),
  }
}

/** Games each filter dropped on the latest build of each ladder's season; none until a build has them. */
const Dropped = () => {
  const ladders = useResource('settings-dropped', () => Promise.all(LADDERS.map((ladder) => getMeta({ ladder, window: 'season', band: 'all' }))))
  return (
    <div className="flex flex-col gap-1">
      <span className="body-strong">What the filters drop</span>
      {LADDERS.map((ladder, i) => {
        const r = ladders.data?.[i]
        const d = r?.ok ? r.data.fit.dropped : null
        return (
          <span key={ladder} className="text-sm leading-5.5 text-ink-dim">
            {ladder}: {!ladders.data ? '…' : d ? `${count(d.players)} by player floor, ${count(d.lists)} by list floor, ${count(d.iron)} Iron, of ${count(d.total)} games` : 'no build yet'}
          </span>
        )
      })}
    </div>
  )
}

export const SettingsPanel = () => {
  const settings = useResource('settings', () => getSettings())
  const [draft, setDraft] = useState<Draft>({})
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const tiers = { ...DEFAULT_TIERS, ...settings.data?.['analytics.tiers'] }
  const classification = { ...DEFAULT_CLASSIFICATION, ...settings.data?.['analytics.classification'] }
  const filtersOf = (format: Format): Filters => ({ ...DEFAULT_FILTERS, ...settings.data?.['analytics.filters']?.[format] })
  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft((d) => ({ ...d, [key]: e.target.value }))
  const bad = Object.entries(draft).some(([k, v]) => !k.endsWith('aggregateFloor') && (v.trim() === '' || !Number.isFinite(Number(v))))

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
      <fieldset className="flex flex-col gap-3">
        <legend className="pb-2 body-strong">Sample filters</legend>
        <span className="text-sm leading-5.5 text-ink-dim">Which ranked games and decks the statistics count, per format: a season is filtered by its own. Read at the next build.</span>
        {FORMATS.map((format) => {
          const filters = filtersOf(format)
          return (
            <div key={format} className="flex flex-col gap-2">
              <span className="body-strong">{format}</span>
              <div className="grid grid-cols-1 gap-3 min-[720px]:grid-cols-3 xl:grid-cols-5">
                {FILTER_COUNTS.map(({ key, label, hint }) => (
                  <div key={key} className="flex flex-col gap-1">
                    <Field label={label} htmlFor={`filter-${format}-${key}`}>
                      <TextInput id={`filter-${format}-${key}`} inputMode="numeric" value={draft[`${format}.${key}`] ?? String(filters[key])} onChange={set(`${format}.${key}`)} />
                    </Field>
                    <span className="text-xs leading-5 text-ink-dim">{hint}</span>
                  </div>
                ))}
                <div className="flex flex-col gap-1">
                  <Select block label={`Aggregate floor (${format})`} value={draft[`${format}.aggregateFloor`] ?? filters.aggregateFloor} onChange={set(`${format}.aggregateFloor`)} options={[...BAND_NAMES]} />
                  <span className="text-xs leading-5 text-ink-dim">The lowest tier in the “and up” band.</span>
                </div>
              </div>
            </div>
          )
        })}
        <Dropped />
      </fieldset>
      <div>
        <Button size="mono-md" disabled={bad || !Object.keys(draft).length} onClick={save}>Save settings</Button>
      </div>
      {error ? <Alert tone="negative" title="Not saved">{error}</Alert> : null}
    </Panel>
  )
}
