'use client'

import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Field, Select, TextInput } from '@ui/field'
import { Panel } from '@ui/panel'
import { SectionHead } from '@ui/section-head'
import { useResource } from '@hooks/index'
import { count, timeLabel } from '@utils/format'
import { BAND_NAMES, DEFAULT_CLASSIFICATION, DEFAULT_FILTERS, DEFAULT_TIERS, FORMATS, getSettings, panelErrorText, updateSettings, type Classification, type Filters, type Format, type PanelSettings, type TierAnchors } from '@utils/panel'
import { getMeta } from '@utils/statistics'

const FILTER_COUNTS: { key: 'minPlayerGames' | 'minListGames' | 'minKeyGames' | 'eloCap'; label: string; hint: string }[] = [
  { key: 'minPlayerGames', label: 'Player games', hint: 'Ranked games a player needs in the season; a game is out unless both players reach it. 0 turns it off.' },
  { key: 'minListGames', label: 'List games', hint: 'Games a decklist needs to count. 0 turns it off.' },
  { key: 'minKeyGames', label: 'Deck games', hint: 'Games a deck key needs to get a row. 0 turns it off.' },
  { key: 'eloCap', label: 'Rating cap', hint: 'Each rating is capped here before the pair’s mean sets the game’s band.' },
]

const TIERS: { key: 't1' | 't15' | 't2' | 't3' | 't4'; label: string }[] = [
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

/**
 * What the form holds, with the percent fields back in rates, laid over what is stored: the PATCH replaces a key's
 * whole value, so a key sent with only the edited field would drop every other stored field (and the other format's
 * filters). A key with no edit isn't sent; a field never stored stays absent, on its default.
 */
export const settingsBody = (draft: Draft, stored: PanelSettings = {}): PanelSettings => {
  const { maxNames, stapleShare, stapleForeign } = draft
  const tiers = Object.fromEntries(TIERS.flatMap(({ key }) => (draft[key] === undefined ? [] : [[key, fromPercent(draft[key])]])))
  const classification = {
    ...(maxNames === undefined ? {} : { maxNames: Number(maxNames) }),
    ...(stapleShare === undefined ? {} : { stapleShare: fromPercent(stapleShare) }),
    ...(stapleForeign === undefined ? {} : { stapleForeign: fromPercent(stapleForeign) }),
  }
  const filters = Object.fromEntries(
    FORMATS.flatMap((format) => {
      const floor = draft[`${format}.aggregateFloor`]
      const share = draft[`${format}.tierShare`]
      const players = draft[`${format}.tierPlayers`]
      const one = {
        ...Object.fromEntries(FILTER_COUNTS.flatMap(({ key }) => (draft[`${format}.${key}`] === undefined ? [] : [[key, Number(draft[`${format}.${key}`])]]))),
        ...(floor === undefined ? {} : { aggregateFloor: floor as Filters['aggregateFloor'] }),
        ...(share === undefined ? {} : { tierShare: fromPercent(share) }),
        ...(players === undefined ? {} : { tierPlayers: Number(players) }),
      }
      return Object.keys(one).length ? [[format, one]] : []
    }),
  )
  const storedFilters = stored['analytics.filters'] ?? {}
  return {
    ...(Object.keys(tiers).length ? { 'analytics.tiers': { ...stored['analytics.tiers'], ...tiers } } : {}),
    ...(Object.keys(classification).length ? { 'analytics.classification': { ...stored['analytics.classification'], ...classification } } : {}),
    ...(Object.keys(filters).length
      ? { 'analytics.filters': { ...storedFilters, ...Object.fromEntries(Object.entries(filters).map(([f, one]) => [f, { ...storedFilters[f as Format], ...one }])) } }
      : {}),
  }
}

/** One group of settings: a title, what it changes and when, then its fields. */
const Group = ({ title, lede, when, className, children }: { title: string; lede: string; when: string; className?: string; children: React.ReactNode }) => (
  <fieldset className={twMerge('flex min-w-0 flex-col gap-4 border border-line bg-surface-100 p-5', className)}>
    <legend className="sr-only">{title}</legend>
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h3 className="m-0 display-3 text-ink">{title}</h3>
      <span className="text-ink-muted signal-sm">{when}</span>
    </div>
    <p className="m-0 max-w-3xl text-sm leading-5.5 text-ink-dim">{lede}</p>
    {children}
  </fieldset>
)

const Hint = ({ children }: { children: React.ReactNode }) => <span className="text-xs leading-5 text-ink-muted">{children}</span>

/** Games each filter dropped on the latest build of a format's season; none until a build has them. */
const useDropped = () => {
  const ladders = useResource('settings-dropped', () => Promise.all(FORMATS.map((f) => getMeta({ ladder: f === 'TCG' ? 'tcg' : 'genesys', window: 'season', band: 'all' }))))
  return (i: number) => {
    const r = ladders.data?.[i]
    const d = r?.ok ? r.data.fit.dropped : null
    if (!ladders.data) return '…'
    return d ? `${count(d.players)} by player floor, ${count(d.lists)} by list floor, ${count(d.iron)} Iron, of ${count(d.total)} games` : 'No build yet'
  }
}

const FILTER_COLS = 'minmax(220px, 1.3fr) minmax(140px, 1fr) minmax(140px, 1fr)'
const FLOOR_COLS = 'minmax(160px, 1.4fr) minmax(100px, 1fr) minmax(100px, 1fr)'

export const SettingsPanel = () => {
  const settings = useResource('settings', () => getSettings())
  const [draft, setDraft] = useState<Draft>({})
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const dropped = useDropped()
  const tiers = { ...DEFAULT_TIERS, ...settings.data?.['analytics.tiers'] }
  const classification = { ...DEFAULT_CLASSIFICATION, ...settings.data?.['analytics.classification'] }
  const filtersOf = (format: Format): Filters => ({ ...DEFAULT_FILTERS, ...settings.data?.['analytics.filters']?.[format] })
  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft((d) => ({ ...d, [key]: e.target.value }))
  const bad = Object.entries(draft).some(([k, v]) => !k.endsWith('aggregateFloor') && (v.trim() === '' || !Number.isFinite(Number(v))))
  const edits = Object.keys(draft).length
  /** An edited field gets a cyan edge until it is saved. */
  const edited = (key: keyof Draft) => (draft[key] === undefined ? undefined : '[--edge:var(--color-cyan)]')

  const save = () => {
    setError(null)
    updateSettings(settingsBody(draft, settings.data ?? {})).then(
      (next) => {
        settings.setData(() => next)
        setDraft({})
        setSaved(`Saved at ${timeLabel(new Date())}`)
      },
      (e) => setError(panelErrorText(e)),
    )
  }

  return (
    <Panel label="Settings" className="flex scroll-mt-6 flex-col gap-5 [--edge:var(--color-line-mid)]">
      <span id="settings" />
      <SectionHead compact num="03" end="Read by the next job run">Settings</SectionHead>
      {settings.error ? <Alert tone="negative" title="Couldn't read the settings">{panelErrorText(settings.error)}</Alert> : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Group title="Tiers" when="/statistics · next build" lede="The expected win rate a deck needs for each tier, highest first: each mark at or below the one before. A deck under the floors gets no tier and is listed apart as untiered.">
          <div className="grid grid-cols-2 gap-3 min-[720px]:grid-cols-5">
            {TIERS.map(({ key, label }) => (
              <Field key={key} label={label} htmlFor={`tier-${key}`}>
                <TextInput id={`tier-${key}`} inputMode="decimal" suffix="%" value={draft[key] ?? toPercent(tiers[key])} onChange={set(key)} plateClassName={edited(key)} />
              </Field>
            ))}
          </div>
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <span className="text-ink signal-strong">Who gets a tier · per format</span>
            <div role="table" aria-label="Tier floors by format" className="grid gap-px border border-line bg-line">
              <div role="row" className="grid min-h-9 items-center bg-surface-200" style={{ gridTemplateColumns: FLOOR_COLS }}>
                <span role="columnheader" className="px-3 text-ink-muted signal">Floor</span>
                {FORMATS.map((f) => <span key={f} role="columnheader" className="px-3 text-ink signal-strong">{f}</span>)}
              </div>
              {([
                ['tierShare', 'Minimum meta share', 'Share of the window’s deck-games.'],
                ['tierPlayers', 'Minimum duelists', 'Different duelists who played it.'],
              ] as const).map(([key, label, hint]) => (
                <div key={key} role="row" className="grid items-center bg-surface-100" style={{ gridTemplateColumns: FLOOR_COLS }}>
                  <span role="rowheader" className="flex flex-col gap-0.5 px-3 py-2.5">
                    <label htmlFor={`floor-TCG-${key}`} className="font-bold text-ink">{label}</label>
                    <Hint>{hint} Under it, no tier.</Hint>
                  </span>
                  {FORMATS.map((format) => {
                    const stored = filtersOf(format)[key]
                    return (
                      <span key={format} role="cell" className="px-3 py-2.5">
                        <TextInput
                          id={`floor-${format}-${key}`}
                          aria-label={`${label} (${format})`}
                          inputMode={key === 'tierShare' ? 'decimal' : 'numeric'}
                          suffix={key === 'tierShare' ? '%' : undefined}
                          value={draft[`${format}.${key}`] ?? (key === 'tierShare' ? toPercent(stored) : String(stored))}
                          onChange={set(`${format}.${key}`)}
                          plateClassName={edited(`${format}.${key}`)}
                        />
                      </span>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </Group>

        <Group title="Deck classification" when="Names now · /statistics next build" lede="How many names a deck can hold, and the cut-offs of the automatic staple detection.">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Field label="Names in a deck" htmlFor="set-names">
                <TextInput id="set-names" inputMode="numeric" suffix="1–5" value={draft.maxNames ?? String(classification.maxNames)} onChange={set('maxNames')} plateClassName={edited('maxNames')} />
              </Field>
              <Hint>Archetypes a deck name joins, lead first.</Hint>
            </div>
            <div className="grid grid-cols-1 gap-3 min-[720px]:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Field label="Staple: in decks" htmlFor="set-share">
                  <TextInput id="set-share" inputMode="decimal" suffix="%" value={draft.stapleShare ?? toPercent(classification.stapleShare)} onChange={set('stapleShare')} plateClassName={edited('stapleShare')} />
                </Field>
                <Hint>Share of all decks a card must be in.</Hint>
              </div>
              <div className="flex flex-col gap-1">
                <Field label="Staple: foreign" htmlFor="set-foreign">
                  <TextInput id="set-foreign" inputMode="decimal" suffix="%" value={draft.stapleForeign ?? toPercent(classification.stapleForeign)} onChange={set('stapleForeign')} plateClassName={edited('stapleForeign')} />
                </Field>
                <Hint>Of those decks, the share where nothing else shares its setcode.</Hint>
              </div>
            </div>
          </div>
        </Group>
      </div>

      <Group title="Sample filters" when="/statistics · next build" lede="Which ranked games and decks the statistics count, per format: a season is filtered by its own.">
        <div className="overflow-x-auto">
          <div role="table" aria-label="Sample filters by format" className="grid min-w-[600px] gap-px border border-line bg-line">
            <div role="row" className="grid min-h-10 items-center bg-surface-200" style={{ gridTemplateColumns: FILTER_COLS }}>
              <span role="columnheader" className="px-4 text-ink-muted signal">Filter</span>
              {FORMATS.map((f) => <span key={f} role="columnheader" className="px-4 text-ink signal-strong">{f}</span>)}
            </div>
            {FILTER_COUNTS.map(({ key, label, hint }) => (
              <div key={key} role="row" className="grid items-center bg-surface-100" style={{ gridTemplateColumns: FILTER_COLS }}>
                <span role="rowheader" className="flex flex-col gap-0.5 px-4 py-3">
                  <label htmlFor={`filter-TCG-${key}`} className="font-bold text-ink">{label}</label>
                  <Hint>{hint}</Hint>
                </span>
                {FORMATS.map((format) => (
                  <span key={format} role="cell" className="px-4 py-3">
                    <TextInput id={`filter-${format}-${key}`} aria-label={`${label} (${format})`} inputMode="numeric" value={draft[`${format}.${key}`] ?? String(filtersOf(format)[key])} onChange={set(`${format}.${key}`)} plateClassName={edited(`${format}.${key}`)} />
                  </span>
                ))}
              </div>
            ))}
            <div role="row" className="grid items-center bg-surface-100" style={{ gridTemplateColumns: FILTER_COLS }}>
              <span role="rowheader" className="flex flex-col gap-0.5 px-4 py-3">
                <span className="font-bold text-ink">Aggregate floor</span>
                <Hint>The lowest tier in the “and up” band.</Hint>
              </span>
              {FORMATS.map((format) => (
                <span key={format} role="cell" className="px-4 py-3">
                  <Select block label={`Aggregate floor (${format})`} value={draft[`${format}.aggregateFloor`] ?? filtersOf(format).aggregateFloor} onChange={set(`${format}.aggregateFloor`)} options={[...BAND_NAMES]} />
                </span>
              ))}
            </div>
            <div role="row" className="grid items-start bg-surface-200" style={{ gridTemplateColumns: FILTER_COLS }}>
              <span role="rowheader" className="flex flex-col gap-0.5 px-4 py-3">
                <span className="font-bold text-ink">Dropped last build</span>
                <Hint>Games each filter left out of the season, of all its games.</Hint>
              </span>
              {FORMATS.map((format, i) => <span key={format} role="cell" className="px-4 py-3 text-sm leading-5.5 text-ink-dim">{dropped(i)}</span>)}
            </div>
          </div>
        </div>
      </Group>

      {error ? <Alert tone="negative" title="Not saved">{error}</Alert> : null}
      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 border-t border-line bg-surface-100/95 px-1 py-3">
        <span className={twMerge('text-sm', edits ? 'text-ink' : 'text-ink-muted')}>
          {edits ? `${edits} unsaved ${edits === 1 ? 'change' : 'changes'}${bad ? ' · fix the empty or non-numeric fields' : ''}` : (saved ?? 'No changes')}
        </span>
        <span className="ml-auto flex gap-2">
          {edits ? <Button variant="ghost" size="mono-md" onClick={() => setDraft({})}>Discard</Button> : null}
          <Button size="mono-md" disabled={bad || !edits} onClick={save}>Save settings</Button>
        </span>
      </div>
    </Panel>
  )
}
