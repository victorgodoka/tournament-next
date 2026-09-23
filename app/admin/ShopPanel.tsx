'use client'

import { useEffect, useId, useState } from 'react'
import { Button, Chip, TabBar, tabPanelProps } from '@ui/index'
import {
  createShopItem,
  deleteReward,
  deleteShopEnum,
  deleteShopItem,
  deleteShopPrice,
  importShopCsv,
  listBattlepass,
  listSeasons,
  listShopEnums,
  listShopItems,
  listShopPrices,
  saveReward,
  saveShopEnum,
  saveShopItem,
  saveShopPrice,
  type BattlepassReward,
  type BattlepassTrack,
  type PanelShopEnum,
  type ShopEnumKind,
  type ShopItemBody,
  type ShopPrice,
  type ShopTab,
} from '@utils/panel'
import type { ShopItem } from '@utils/types'
import { Empty, errorText, Field, INPUT, List, ListRow, MONO_INPUT, Notice, Row, RowButton } from './ui'

const TABS = [
  { id: 'items', label: 'Items' },
  { id: 'prices', label: 'Base prices' },
  { id: 'enums', label: 'Enums' },
  { id: 'battlepass', label: 'Battlepass' },
] as const

/** The spreadsheet's header row for each tab, so an exported tab uploads as-is. */
const CSV_COLUMNS: Record<ShopTab, string> = {
  enums: 'where,value,readable_name,readable_description',
  prices: 'type,base_price',
  items: 'id,item,type,category,limited,start_date,end_date,int_val,price,season,ext',
  battlepass: 'season,item_id,level,premium,qty',
}

const DP = new Intl.NumberFormat('en-US')
const dp = (value: number | null) => (value === null ? 'no price' : `${DP.format(value)} DP`)

/* ---------------------------------------------------------------- *
 * Shared pieces
 * ---------------------------------------------------------------- */

/** Loads once on mount; `reload` re-reads after a write. Errors land in one notice per tab. */
const useRemote = <T,>(load: (signal?: AbortSignal) => Promise<T>) => {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const abort = new AbortController()
    load(abort.signal)
      .then(setData)
      .catch((failure) => !abort.signal.aborted && setError(errorText(failure)))
    return () => abort.abort()
    // `load` is a module-level function per tab; re-running on identity would refetch every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reload = () =>
    load()
      .then((next) => (setData(next), setError(null)))
      .catch((failure) => setError(errorText(failure)))

  return { data, error, setError, reload }
}

/** Upload the tab's CSV. All or nothing on the server: a bad row writes nothing and names itself. */
const CsvImport = ({ tab, season, onDone }: { tab: ShopTab; season?: string; onDone: () => void }) => {
  const id = useId()
  const [result, setResult] = useState<{ tone: 'ok' | 'error'; text: string; warnings?: string[] } | null>(null)
  const [busy, setBusy] = useState(false)

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setResult(null)
    try {
      const { written, warnings } = await importShopCsv(tab, await file.text(), season || undefined)
      setResult({ tone: 'ok', text: `${written} row${written === 1 ? '' : 's'} written from ${file.name}.`, warnings })
      onDone()
    } catch (failure) {
      setResult({ tone: 'error', text: errorText(failure) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border border-dashed border-line px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ink-dim signal">Import CSV</p>
          <p className="mt-1 break-all text-ink-muted mono-note">{CSV_COLUMNS[tab]}</p>
        </div>
        <label
          htmlFor={id}
          className="inline-flex min-h-11 cursor-pointer items-center border border-surface-400 px-3.5 text-ink-dim signal hover:border-ink hover:bg-ink hover:text-ink-on has-disabled:cursor-wait has-disabled:opacity-50"
        >
          {busy ? 'Importing…' : 'Choose file'}
          <input id={id} type="file" accept=".csv,text/csv" onChange={upload} disabled={busy} className="sr-only" />
        </label>
      </div>
      <p className="mt-2 text-ink-muted body-sm">Upserts by key. Rows missing from the file are kept, not deleted.</p>
      {result ? (
        <div className="mt-3 grid gap-2" role={result.tone === 'error' ? 'alert' : 'status'}>
          <Notice tone={result.tone}>{result.text}</Notice>
          {result.warnings?.length ? (
            <ul className="grid gap-1 border border-amber bg-ground-amber px-4 py-3 text-amber mono-note">
              {result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** Edit and a confirm-before-delete, the same two actions on every row of every tab. */
const RowActions = ({ label, onEdit, onDelete }: { label: string; onEdit: () => void; onDelete: () => Promise<void> }) => {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!confirming) {
    return (
      <div className="flex shrink-0 gap-2">
        <RowButton onClick={onEdit}>Edit</RowButton>
        <RowButton tone="danger" onClick={() => setConfirming(true)}>
          Delete
        </RowButton>
      </div>
    )
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <span className="text-ink-dim body-sm">Delete {label}?</span>
      <RowButton
        tone="danger"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          await onDelete().finally(() => setBusy(false))
          setConfirming(false)
        }}
      >
        {busy ? 'Deleting…' : 'Delete it'}
      </RowButton>
      <RowButton onClick={() => setConfirming(false)} disabled={busy}>
        Keep
      </RowButton>
    </div>
  )
}

/** Card chrome around every tab's form, same as the formats form. */
const FormShell = ({
  title,
  error,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
  children,
}: {
  title: string
  error: string | null
  busy: boolean
  submitLabel: string
  onSubmit: () => Promise<void>
  onCancel: () => void
  children: React.ReactNode
}) => (
  <form
    onSubmit={(event) => {
      event.preventDefault()
      onSubmit()
    }}
    className="border border-line-strong bg-surface-100 p-5.5 lg:p-7"
  >
    <p className="text-gold signal-lg">{title}</p>
    <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">{children}</div>
    {error ? (
      <div className="mt-6">
        <Notice tone="error">{error}</Notice>
      </div>
    ) : null}
    <div className="mt-7 flex flex-wrap gap-3">
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? 'Saving…' : submitLabel}
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
        Cancel
      </Button>
    </div>
  </form>
)

/** Runs a save with the busy flag and error text a form needs. */
const useSave = () => {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await work()
    } catch (failure) {
      setError(errorText(failure))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run }
}

/* ---------------------------------------------------------------- *
 * Enums
 * ---------------------------------------------------------------- */

const EnumForm = ({ current, onDone, onCancel }: { current: PanelShopEnum | null; onDone: () => void; onCancel: () => void }) => {
  const [draft, setDraft] = useState({
    kind: current?.kind ?? ('type' as ShopEnumKind),
    value: current?.value ?? '',
    name: current?.name ?? '',
    description: current?.description ?? '',
  })
  const { busy, error, run } = useSave()
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }))

  return (
    <FormShell
      title={current ? `Edit ${current.kind} ${current.value}` : 'New enum'}
      error={error}
      busy={busy}
      submitLabel={current ? 'Save enum' : 'Create enum'}
      onCancel={onCancel}
      onSubmit={() =>
        run(async () => {
          await saveShopEnum(draft.kind, draft.value.trim(), { name: draft.name.trim(), description: draft.description.trim() })
          onDone()
        })
      }
    >
      <Field id="enum-kind" label="Kind">
        <select id="enum-kind" value={draft.kind} disabled={!!current} onChange={(e) => set({ kind: e.target.value as ShopEnumKind })} className={INPUT}>
          <option value="type">type</option>
          <option value="category">category</option>
        </select>
      </Field>
      <Field id="enum-value" label="Value" hint="UPPER_SNAKE_CASE. It is the key: renaming means a new enum.">
        <input
          id="enum-value"
          value={draft.value}
          readOnly={!!current}
          required
          pattern="[A-Z][A-Z0-9_]*"
          onChange={(e) => set({ value: e.target.value.toUpperCase() })}
          placeholder="PROFILE_SONG"
          autoComplete="off"
          className={MONO_INPUT}
        />
      </Field>
      <Field id="enum-name" label="Readable name">
        <input id="enum-name" value={draft.name} required onChange={(e) => set({ name: e.target.value })} placeholder="Profile Song" autoComplete="off" className={INPUT} />
      </Field>
      <Field id="enum-description" label="Description">
        <input id="enum-description" value={draft.description} onChange={(e) => set({ description: e.target.value })} autoComplete="off" className={INPUT} />
      </Field>
    </FormShell>
  )
}

const EnumsTab = () => {
  const { data, error, setError, reload } = useRemote(listShopEnums)
  const [editing, setEditing] = useState<PanelShopEnum | 'new' | null>(null)

  return (
    <div className="grid gap-6">
      {editing === null ? (
        <div>
          <Button size="sm" onClick={() => setEditing('new')}>New enum</Button>
        </div>
      ) : (
        <EnumForm key={editing === 'new' ? 'new' : `${editing.kind}:${editing.value}`} current={editing === 'new' ? null : editing} onCancel={() => setEditing(null)} onDone={() => (setEditing(null), reload())} />
      )}
      <Notice tone="error">{error}</Notice>
      {data === null ? (
        <Empty>Loading enums…</Empty>
      ) : (
        (['type', 'category'] as const).map((kind) => {
          const rows = data.filter((row) => row.kind === kind)
          return (
            <div key={kind}>
              <p className="mb-2.5 text-ink-muted signal">{kind === 'type' ? 'Types' : 'Categories'} · {rows.length}</p>
              {rows.length ? (
                <List>
                  {rows.map((row) => (
                    <ListRow key={row.value} className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-ink body-strong">{row.name}</p>
                        <p className="mt-0.5 text-ink-muted mono-data">{row.value}</p>
                        {row.description ? <p className="mt-1 text-ink-dim body-sm">{row.description}</p> : null}
                      </div>
                      <RowActions
                        label={row.value}
                        onEdit={() => setEditing(row)}
                        onDelete={() => deleteShopEnum(kind, row.value).then(reload, (failure) => setError(errorText(failure)))}
                      />
                    </ListRow>
                  ))}
                </List>
              ) : (
                <Empty>No {kind} yet.</Empty>
              )}
            </div>
          )
        })
      )}
      <CsvImport tab="enums" onDone={reload} />
    </div>
  )
}

/* ---------------------------------------------------------------- *
 * Base prices
 * ---------------------------------------------------------------- */

const PriceForm = ({ current, types, onDone, onCancel }: { current: ShopPrice | null; types: string[]; onDone: () => void; onCancel: () => void }) => {
  const [type, setType] = useState(current?.type ?? '')
  const [basePrice, setBasePrice] = useState(current ? String(current.basePrice) : '')
  const { busy, error, run } = useSave()

  return (
    <FormShell
      title={current ? `Base price of ${current.type}` : 'New base price'}
      error={error}
      busy={busy}
      submitLabel="Save price"
      onCancel={onCancel}
      onSubmit={() =>
        run(async () => {
          await saveShopPrice(type, Number(basePrice))
          onDone()
        })
      }
    >
      <Field id="price-type" label="Type" hint="Must already exist as a type enum.">
        <select id="price-type" value={type} required disabled={!!current} onChange={(e) => setType(e.target.value)} className={INPUT}>
          <option value="">Pick a type</option>
          {types.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
      </Field>
      <Field id="price-base" label="Base price (DP)" hint="Reprices every item of this type at once.">
        <input id="price-base" type="number" inputMode="numeric" min={0} step={1} required value={basePrice} onChange={(e) => setBasePrice(e.target.value)} className={MONO_INPUT} />
      </Field>
    </FormShell>
  )
}

const PricesTab = () => {
  const prices = useRemote(listShopPrices)
  const enums = useRemote(listShopEnums)
  const [editing, setEditing] = useState<ShopPrice | 'new' | null>(null)
  const priced = new Set(prices.data?.map((row) => row.type))
  const types = (enums.data ?? []).filter((row) => row.kind === 'type').map((row) => row.value)

  return (
    <div className="grid gap-6">
      {editing === null ? (
        <div>
          <Button size="sm" onClick={() => setEditing('new')}>New base price</Button>
        </div>
      ) : (
        <PriceForm
          key={editing === 'new' ? 'new' : editing.type}
          current={editing === 'new' ? null : editing}
          types={editing === 'new' ? types.filter((type) => !priced.has(type)) : types}
          onCancel={() => setEditing(null)}
          onDone={() => (setEditing(null), prices.reload())}
        />
      )}
      <Notice tone="error">{prices.error ?? enums.error}</Notice>
      {prices.data === null ? (
        <Empty>Loading prices…</Empty>
      ) : prices.data.length === 0 ? (
        <Empty>No base price yet. An item of a type without one can&apos;t be sold.</Empty>
      ) : (
        <List>
          {prices.data.map((row) => (
            <ListRow key={row.type} className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
                <p className="text-ink mono-data">{row.type}</p>
                <p className="text-amber display-6 tabular-nums">{dp(row.basePrice)}</p>
              </div>
              <RowActions
                label={`the ${row.type} price`}
                onEdit={() => setEditing(row)}
                onDelete={() => deleteShopPrice(row.type).then(prices.reload, (failure) => prices.setError(errorText(failure)))}
              />
            </ListRow>
          ))}
        </List>
      )}
      <CsvImport tab="prices" onDone={prices.reload} />
    </div>
  )
}

/* ---------------------------------------------------------------- *
 * Items
 * ---------------------------------------------------------------- */

type ItemDraft = Record<'id' | 'name' | 'type' | 'category' | 'multiplier' | 'season' | 'ext' | 'startsAt' | 'endsAt', string>

const toItemDraft = (item: ShopItem | null): ItemDraft => ({
  id: item?.id ?? '',
  name: item?.name ?? '',
  type: item?.type ?? '',
  category: item?.category ?? 'SHOP',
  multiplier: item ? String(item.multiplier) : '1',
  season: item?.season ?? '',
  ext: item?.ext ?? '',
  startsAt: item?.startsAt ?? '',
  endsAt: item?.endsAt ?? '',
})

const orNull = (value: string) => value.trim() || null

const toItemBody = (draft: ItemDraft): ShopItemBody => ({
  name: draft.name.trim(),
  type: draft.type,
  category: draft.category,
  multiplier: Number(draft.multiplier) || 1,
  season: orNull(draft.season),
  ext: orNull(draft.ext),
  startsAt: orNull(draft.startsAt),
  endsAt: orNull(draft.endsAt),
})

const ItemForm = ({
  current,
  enums,
  prices,
  onDone,
  onCancel,
}: {
  current: ShopItem | null
  enums: PanelShopEnum[]
  prices: ShopPrice[]
  onDone: () => void
  onCancel: () => void
}) => {
  const [draft, setDraft] = useState(() => toItemDraft(current))
  const { busy, error, run } = useSave()
  const set = (patch: Partial<ItemDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const options = (kind: ShopEnumKind) => enums.filter((row) => row.kind === kind)

  // A preview only: the server computes the real one on every read.
  const base = prices.find((row) => row.type === draft.type)?.basePrice
  const preview = base === undefined ? null : Math.round(base * (Number(draft.multiplier) || 1))

  return (
    <FormShell
      title={current ? `Edit ${current.name}` : 'New item'}
      error={error}
      busy={busy}
      submitLabel={current ? 'Save item' : 'Create item'}
      onCancel={onCancel}
      onSubmit={() =>
        run(async () => {
          const body = toItemBody(draft)
          const id = draft.id.trim()
          await (id ? saveShopItem(id, body) : createShopItem(body))
          onDone()
        })
      }
    >
      <Field id="item-name" label="Name">
        <input id="item-name" value={draft.name} required onChange={(e) => set({ name: e.target.value })} autoComplete="off" className={INPUT} />
      </Field>
      <Field id="item-id" label="Id" hint={current ? 'The key. Fixed once created.' : 'Empty generates one. Fill it to bring an id from the spreadsheet.'}>
        <input
          id="item-id"
          value={draft.id}
          readOnly={!!current}
          pattern="[0-9a-f]{6,16}"
          onChange={(e) => set({ id: e.target.value.toLowerCase() })}
          placeholder="6–16 lowercase hex"
          autoComplete="off"
          className={MONO_INPUT}
        />
      </Field>
      <Field id="item-type" label="Type">
        <select id="item-type" value={draft.type} required onChange={(e) => set({ type: e.target.value })} className={INPUT}>
          <option value="">Pick a type</option>
          {options('type').map((row) => (
            <option key={row.value} value={row.value}>{row.name} · {row.value}</option>
          ))}
        </select>
      </Field>
      <Field id="item-category" label="Category" hint={draft.category === 'SHOP' ? 'On sale: the type needs a base price.' : undefined}>
        <select id="item-category" value={draft.category} required onChange={(e) => set({ category: e.target.value })} className={INPUT}>
          {options('category').map((row) => (
            <option key={row.value} value={row.value}>{row.name} · {row.value}</option>
          ))}
        </select>
      </Field>
      <Field id="item-multiplier" label="Multiplier" hint={preview === null ? 'No base price for this type: the item has no price.' : `Price: ${dp(preview)}`}>
        <input id="item-multiplier" type="number" inputMode="decimal" min={0.0001} step={0.0001} required value={draft.multiplier} onChange={(e) => set({ multiplier: e.target.value })} className={MONO_INPUT} />
      </Field>
      <Field id="item-season" label="Season">
        <input id="item-season" value={draft.season} onChange={(e) => set({ season: e.target.value })} placeholder="09.2026_KEWL_TUNE" autoComplete="off" className={MONO_INPUT} />
      </Field>
      <Field id="item-ext" label="External link" hint="http(s)://, e.g. the track behind a song.">
        <input id="item-ext" type="url" value={draft.ext} onChange={(e) => set({ ext: e.target.value })} autoComplete="off" className={INPUT} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field id="item-starts" label="From">
          <input id="item-starts" type="date" value={draft.startsAt} onChange={(e) => set({ startsAt: e.target.value })} className={INPUT} />
        </Field>
        <Field id="item-ends" label="Until">
          <input id="item-ends" type="date" value={draft.endsAt} onChange={(e) => set({ endsAt: e.target.value })} className={INPUT} />
        </Field>
      </div>
    </FormShell>
  )
}

const ItemsTab = () => {
  const items = useRemote(listShopItems)
  const enums = useRemote(listShopEnums)
  const prices = useRemote(listShopPrices)
  const [editing, setEditing] = useState<ShopItem | 'new' | null>(null)
  const [query, setQuery] = useState('')

  const needle = query.trim().toLowerCase()
  const shown = (items.data ?? []).filter(
    (item) => !needle || [item.id, item.name, item.type, item.category, item.season ?? ''].some((field) => field.toLowerCase().includes(needle)),
  )

  return (
    <div className="grid gap-6">
      {editing === null ? (
        <div className="flex flex-wrap items-end gap-3">
          <Button size="sm" onClick={() => setEditing('new')} disabled={!enums.data || !prices.data}>New item</Button>
          <label className="min-w-0 flex-[1_1_220px]">
            <span className="sr-only">Filter items</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by name, id, type, season…" className={INPUT} />
          </label>
        </div>
      ) : (
        <ItemForm
          key={editing === 'new' ? 'new' : editing.id}
          current={editing === 'new' ? null : editing}
          enums={enums.data ?? []}
          prices={prices.data ?? []}
          onCancel={() => setEditing(null)}
          onDone={() => (setEditing(null), items.reload())}
        />
      )}
      <Notice tone="error">{items.error ?? enums.error ?? prices.error}</Notice>
      {items.data === null ? (
        <Empty>Loading items…</Empty>
      ) : shown.length === 0 ? (
        <Empty>{needle ? 'No item matches that filter.' : 'No item yet.'}</Empty>
      ) : (
        <List>
          {shown.map((item) => (
            <ListRow key={item.id} className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-[1_1_260px]">
                <p className="text-ink body-strong">{item.name}</p>
                <p className="mt-1 text-ink-muted mono-data">
                  {item.id} · {item.type} · ×{item.multiplier}
                  {item.season ? ` · ${item.season}` : ''}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Chip tone={item.category === 'SHOP' ? 'gold' : 'neutral'}>{item.category}</Chip>
                  <Chip tone={item.price === null ? 'neutral' : 'amber'}>{dp(item.price)}</Chip>
                  {item.startsAt || item.endsAt ? <Chip tone="cyan">{item.startsAt ?? '…'} → {item.endsAt ?? '…'}</Chip> : null}
                </div>
              </div>
              <RowActions
                label={item.name}
                onEdit={() => setEditing(item)}
                onDelete={() => deleteShopItem(item.id).then(items.reload, (failure) => items.setError(errorText(failure)))}
              />
            </ListRow>
          ))}
        </List>
      )}
      <CsvImport tab="items" onDone={items.reload} />
    </div>
  )
}

/* ---------------------------------------------------------------- *
 * Battlepass
 * ---------------------------------------------------------------- */

const trackOf = (reward: BattlepassReward): BattlepassTrack => (reward.premium ? 'premium' : 'free')

const RewardForm = ({
  current,
  season,
  items,
  onDone,
  onCancel,
}: {
  current: BattlepassReward | null
  season: string
  items: ShopItem[]
  onDone: () => void
  onCancel: () => void
}) => {
  const [draft, setDraft] = useState({
    season: current?.season ?? season,
    level: current ? String(current.level) : '',
    track: current ? trackOf(current) : ('free' as BattlepassTrack),
    itemId: current?.itemId ?? '',
    qty: current ? String(current.qty) : '1',
  })
  const { busy, error, run } = useSave()
  const set = (patch: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...patch }))
  const listId = useId()

  return (
    <FormShell
      title={current ? `Level ${current.level} · ${trackOf(current)}` : 'New reward'}
      error={error}
      busy={busy}
      submitLabel="Save reward"
      onCancel={onCancel}
      onSubmit={() =>
        run(async () => {
          await saveReward(draft.season.trim(), Number(draft.level), draft.track, { itemId: draft.itemId.trim(), qty: Number(draft.qty) })
          onDone()
        })
      }
    >
      <Field id="reward-season" label="Season" hint="Season code, e.g. tcg-2.">
        <input id="reward-season" value={draft.season} required readOnly={!!current} onChange={(e) => set({ season: e.target.value })} autoComplete="off" className={MONO_INPUT} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field id="reward-level" label="Level">
          <input id="reward-level" type="number" inputMode="numeric" min={1} max={1000} required readOnly={!!current} value={draft.level} onChange={(e) => set({ level: e.target.value })} className={MONO_INPUT} />
        </Field>
        <Field id="reward-track" label="Track">
          <select id="reward-track" value={draft.track} disabled={!!current} onChange={(e) => set({ track: e.target.value as BattlepassTrack })} className={INPUT}>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
          </select>
        </Field>
      </div>
      <Field id="reward-item" label="Item id" hint="Type to search by name or id.">
        <input id="reward-item" list={listId} value={draft.itemId} required onChange={(e) => set({ itemId: e.target.value })} autoComplete="off" className={MONO_INPUT} />
        <datalist id={listId}>
          {items.map((item) => (
            <option key={item.id} value={item.id}>{item.name} · {item.type}</option>
          ))}
        </datalist>
      </Field>
      <Field id="reward-qty" label="Quantity">
        <input id="reward-qty" type="number" inputMode="numeric" min={1} step={1} required value={draft.qty} onChange={(e) => set({ qty: e.target.value })} className={MONO_INPUT} />
      </Field>
    </FormShell>
  )
}

const RewardCell = ({ reward, track, onEdit, onDelete }: { reward?: BattlepassReward; track: BattlepassTrack; onEdit: (r: BattlepassReward) => void; onDelete: (r: BattlepassReward) => Promise<void> }) => (
  <div className="min-w-0 bg-surface-000 px-4 py-3">
    <p className={track === 'premium' ? 'text-gold signal-sm' : 'text-ink-muted signal-sm'}>{track}</p>
    {reward ? (
      <div className="mt-1.5 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-ink body-strong">
            {reward.qty > 1 ? `${DP.format(reward.qty)} × ` : ''}
            {reward.item.name}
          </p>
          <p className="text-ink-muted mono-data">{reward.itemId} · {reward.item.type}</p>
        </div>
        <RowActions label={`level ${reward.level} ${track}`} onEdit={() => onEdit(reward)} onDelete={() => onDelete(reward)} />
      </div>
    ) : (
      <p className="mt-1.5 text-ink-muted body-sm">—</p>
    )}
  </div>
)

const BattlepassTab = () => {
  const [season, setSeason] = useState('')
  const [rewards, setRewards] = useState<BattlepassReward[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const items = useRemote(listShopItems)
  const seasons = useRemote(listSeasons)
  const [editing, setEditing] = useState<BattlepassReward | 'new' | null>(null)
  const listId = useId()

  const load = (code: string, signal?: AbortSignal) =>
    listBattlepass(code.trim() || undefined, signal)
      .then((next) => (setRewards(next), setError(null)))
      .catch((failure) => !signal?.aborted && setError(errorText(failure)))

  useEffect(() => {
    const abort = new AbortController()
    const timer = setTimeout(() => load(season, abort.signal), 250)
    return () => (clearTimeout(timer), abort.abort())
  }, [season])

  const reload = () => void load(season)
  const remove = (reward: BattlepassReward) =>
    deleteReward(reward.season, reward.level, trackOf(reward)).then(reload, (failure) => setError(errorText(failure)))

  // One line per season + level, the free and premium rewards side by side.
  const levels = new Map<string, { season: string; level: number; free?: BattlepassReward; premium?: BattlepassReward }>()
  for (const reward of rewards ?? []) {
    const key = `${reward.season}:${reward.level}`
    const entry = levels.get(key) ?? { season: reward.season, level: reward.level }
    entry[trackOf(reward)] = reward
    levels.set(key, entry)
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <Field id="bp-season" label="Season" className="flex-[1_1_200px]">
          <input id="bp-season" list={listId} value={season} onChange={(e) => setSeason(e.target.value)} placeholder="Every season" autoComplete="off" className={MONO_INPUT} />
          <datalist id={listId}>
            {seasons.data?.map(({ season: open }) => (open ? <option key={open.code} value={open.code}>{open.label}</option> : null))}
          </datalist>
        </Field>
        {editing === null ? (
          <Button size="sm" onClick={() => setEditing('new')} disabled={!items.data}>New reward</Button>
        ) : null}
      </div>
      {editing !== null ? (
        <RewardForm
          key={editing === 'new' ? 'new' : `${editing.season}:${editing.level}:${trackOf(editing)}`}
          current={editing === 'new' ? null : editing}
          season={season}
          items={items.data ?? []}
          onCancel={() => setEditing(null)}
          onDone={() => (setEditing(null), reload())}
        />
      ) : null}
      <Notice tone="error">{error ?? items.error}</Notice>
      {rewards === null ? (
        <Empty>Loading the track…</Empty>
      ) : levels.size === 0 ? (
        <Empty>No reward on {season.trim() ? `season ${season.trim()}` : 'any season'} yet.</Empty>
      ) : (
        <ol className="grid gap-px border border-line bg-line">
          {[...levels.values()].map((entry) => (
            <li key={`${entry.season}:${entry.level}`} className="grid grid-cols-[64px_minmax(0,1fr)] gap-px bg-line md:grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="row-span-2 flex flex-col justify-center bg-surface-100 px-3 md:row-span-1">
                <p className="text-ink display-5 tabular-nums">{entry.level}</p>
                {season.trim() ? null : <p className="truncate text-ink-muted mono-note">{entry.season}</p>}
              </div>
              <RewardCell reward={entry.free} track="free" onEdit={setEditing} onDelete={remove} />
              <RewardCell reward={entry.premium} track="premium" onEdit={setEditing} onDelete={remove} />
            </li>
          ))}
        </ol>
      )}
      <CsvImport tab="battlepass" season={season.trim()} onDone={reload} />
    </div>
  )
}

/* ---------------------------------------------------------------- *
 * The section
 * ---------------------------------------------------------------- */

export const ShopPanel = () => {
  const [tab, setTab] = useState<ShopTab>('items')
  const idPrefix = useId()

  return (
    <Row
      index="01"
      title="Shop catalog"
      blurb="What used to live in the spreadsheet: enums, base prices, items and the battlepass track. A price is always base × multiplier, so changing either reprices the storefront at once; what was already paid stays in the ledger."
    >
      <TabBar label="Catalog tables" idPrefix={idPrefix} tabs={TABS} active={tab} onSelect={setTab} tone="cyan" />
      <div {...tabPanelProps(idPrefix, tab)} className="pt-6">
        {tab === 'items' ? <ItemsTab /> : null}
        {tab === 'prices' ? <PricesTab /> : null}
        {tab === 'enums' ? <EnumsTab /> : null}
        {tab === 'battlepass' ? <BattlepassTab /> : null}
      </div>
    </Row>
  )
}
