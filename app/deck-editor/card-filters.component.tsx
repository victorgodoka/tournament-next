'use client'

import ButtonComponent from '@components/button/button.component'
import { ATTRIBUTES, RACES, SUBTYPES } from './deck-editor.const'
import type { CardFilters } from './deck-editor.types'

interface CardFiltersProps {
  filters: CardFilters
  onChange: (patch: Partial<CardFilters>) => void
  onReset: () => void
  open: boolean
}

const num = (value: string): number | undefined => {
  if (value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** A labelled min/max pair for a numeric card stat. */
function Range({
  label,
  min,
  max,
  onMin,
  onMax,
}: {
  label: string
  min?: number
  max?: number
  onMin: (v?: number) => void
  onMax: (v?: number) => void
}) {
  return (
    <div className="filters__field">
      <span className="filters__label">{label}</span>
      <div className="filters__range">
        <input
          type="number"
          inputMode="numeric"
          className="filters__input"
          placeholder="Min"
          aria-label={`${label} minimum`}
          value={min ?? ''}
          onChange={(e) => onMin(num(e.target.value))}
        />
        <span className="filters__range-dash" aria-hidden="true">–</span>
        <input
          type="number"
          inputMode="numeric"
          className="filters__input"
          placeholder="Max"
          aria-label={`${label} maximum`}
          value={max ?? ''}
          onChange={(e) => onMax(num(e.target.value))}
        />
      </div>
    </div>
  )
}

const CardFiltersComponent = ({ filters, onChange, onReset, open }: CardFiltersProps) => {
  const set = <K extends keyof CardFilters>(key: K, value: CardFilters[K]) =>
    onChange({ [key]: value } as Partial<CardFilters>)

  return (
    <div className="filters" hidden={!open}>
      <div className="filters__grid">
        <label className="filters__field">
          <span className="filters__label">Card type</span>
          <select
            className="filters__input"
            value={filters.type ?? ''}
            onChange={(e) => set('type', (e.target.value || undefined) as CardFilters['type'])}
          >
            <option value="">All types</option>
            <option value="Monster">Monster</option>
            <option value="Spell">Spell</option>
            <option value="Trap">Trap</option>
          </select>
        </label>

        <label className="filters__field">
          <span className="filters__label">Attribute</span>
          <select
            className="filters__input"
            value={filters.attribute ?? ''}
            onChange={(e) => set('attribute', e.target.value || undefined)}
          >
            <option value="">Any</option>
            {ATTRIBUTES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>

        <label className="filters__field">
          <span className="filters__label">Type / Race</span>
          <input
            className="filters__input"
            list="deck-editor-races"
            placeholder="e.g. Dragon"
            value={filters.race ?? ''}
            onChange={(e) => set('race', e.target.value || undefined)}
          />
          <datalist id="deck-editor-races">
            {RACES.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </label>

        <label className="filters__field">
          <span className="filters__label">Subtype</span>
          <select
            className="filters__input"
            value={filters.subtype ?? ''}
            onChange={(e) => set('subtype', e.target.value || undefined)}
          >
            <option value="">Any</option>
            {SUBTYPES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <Range
          label="Level / Rank"
          min={filters.levelMin}
          max={filters.levelMax}
          onMin={(v) => set('levelMin', v)}
          onMax={(v) => set('levelMax', v)}
        />
        <Range
          label="ATK"
          min={filters.atkMin}
          max={filters.atkMax}
          onMin={(v) => set('atkMin', v)}
          onMax={(v) => set('atkMax', v)}
        />
        <Range
          label="DEF"
          min={filters.defMin}
          max={filters.defMax}
          onMin={(v) => set('defMin', v)}
          onMax={(v) => set('defMax', v)}
        />

        <label className="filters__field">
          <span className="filters__label">Pendulum scale</span>
          <input
            type="number"
            inputMode="numeric"
            className="filters__input"
            placeholder="Any"
            value={filters.pScale ?? ''}
            onChange={(e) => set('pScale', num(e.target.value))}
          />
        </label>

        <label className="filters__field">
          <span className="filters__label">Set code</span>
          <input
            className="filters__input"
            placeholder="e.g. LOB"
            value={filters.setcode ?? ''}
            onChange={(e) => set('setcode', e.target.value || undefined)}
          />
        </label>

        <label className="filters__field">
          <span className="filters__label">Text contains</span>
          <input
            className="filters__input"
            placeholder="Card text…"
            value={filters.desc ?? ''}
            onChange={(e) => set('desc', e.target.value || undefined)}
          />
        </label>

        <label className="filters__field">
          <span className="filters__label">Tag</span>
          <input
            className="filters__input"
            placeholder="Archetype / keyword"
            value={filters.tag ?? ''}
            onChange={(e) => set('tag', e.target.value || undefined)}
          />
        </label>
      </div>

      <div className="filters__actions">
        <ButtonComponent variant="ghost" size="sm" icon="mdi:filter-remove-outline" onClick={onReset}>
          Clear filters
        </ButtonComponent>
      </div>
    </div>
  )
}

export default CardFiltersComponent
