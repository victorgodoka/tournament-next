'use client'

import { useState } from 'react'
import { Alert, Button, Chip, Coin, Coins, DataTable, Field, FilterChip, PageHeader, Panel, SectionHead, Switch, TextArea, TextInput } from '@ui/index'
import { useResource } from '@hooks/index'
import { deleteShopEnum, deleteShopPrice, panelErrorText, saveShopEnum, saveShopPrice, type PanelShopEnum, type ShopEnumKind } from '@utils/panel'
import { CatalogTabs, loadCatalog, useCsvImport, type Catalog } from '../catalog'

const SURFACES = ['avatar', 'profile', 'messenger', 'welcome'] as const
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)

type Draft = {
  kind: ShopEnumKind
  /** `null` while creating: the value is typed, then fixed. */
  saved: string | null
  value: string
  name: string
  description: string
  equippable: boolean
  surfaces: string[]
  currency: boolean
  basePrice: string
}

const toDraft = (e: PanelShopEnum, catalog: Catalog): Draft => ({
  kind: e.kind,
  saved: e.value,
  value: e.value,
  name: e.name,
  description: e.description,
  equippable: e.equippable,
  surfaces: e.surfaces,
  currency: e.currency,
  basePrice: catalog.base.has(e.value) ? String(catalog.base.get(e.value)) : '',
})

const blank = (kind: ShopEnumKind): Draft => ({
  kind,
  saved: null,
  value: '',
  name: '',
  description: '',
  equippable: false,
  surfaces: [],
  currency: false,
  basePrice: '',
})

const ShopTypesPage = () => {
  const { data, error: loadError, reload } = useResource('catalog', loadCatalog)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const csv = useCsvImport('enums', reload)

  const itemsOf = (field: 'type' | 'category', value: string) => data?.items.filter((i) => i[field] === value).length ?? 0
  const d = draft ?? (data?.types[0] ? toDraft(data.types[0], data) : null)
  const set = (patch: Partial<Draft>) => d && setDraft({ ...d, ...patch })
  const hadPrice = d?.saved ? data?.base.has(d.saved) : false

  const save = async () => {
    if (!d || !data) return
    const value = d.value.trim().toUpperCase()
    setBusy(true)
    setError(null)
    try {
      await saveShopEnum(
        d.kind,
        value,
        d.kind === 'type'
          ? { name: d.name, description: d.description, equippable: d.equippable, surfaces: d.equippable ? d.surfaces : [], currency: d.currency }
          : { name: d.name, description: d.description },
      )
      if (d.kind === 'type') {
        const price = d.basePrice.trim()
        if (price !== '' && Number(price) !== data.base.get(value)) await saveShopPrice(value, Number(price))
        if (price === '' && hadPrice) await deleteShopPrice(value)
      }
      setDraft({ ...d, value, saved: value })
      reload()
    } catch (e) {
      setError(panelErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!d?.saved) return
    setBusy(true)
    setError(null)
    try {
      await deleteShopEnum(d.kind, d.saved)
      setDraft(null)
      reload()
    } catch (e) {
      setError(panelErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const behaviour = (e: PanelShopEnum) =>
    e.currency ? <Chip tone="gold">Currency</Chip> : e.equippable ? <Chip className="text-cyan [--edge:var(--color-cyan)]">Equippable</Chip> : <Chip>Plain</Chip>

  return (
    <>
      <PageHeader
        flush
        eyebrow={data ? `Economy · ${data.types.length} types · ${data.categories.length} categories` : 'Economy'}
        title="Shop catalog"
        lead="What each type does, where it shows up and what it costs before the item’s multiplier."
        end={
          <>
            {csv.button}
            <Button size="mono-md" onClick={() => setDraft(blank('type'))}>New type</Button>
          </>
        }
      />
      {csv.notice}
      {loadError ? <Alert tone="negative" title="Couldn't read the catalog">{panelErrorText(loadError)}</Alert> : null}

      <CatalogTabs active="types" catalog={data} />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-7">
          <section className="flex flex-col gap-3.5">
            <SectionHead compact num="01" end="The slot is the type">Types</SectionHead>
            <div className="overflow-x-auto">
              <DataTable
                rows={data?.types ?? []}
                rowKey={(t) => t.value}
                isSelected={(t) => d?.kind === 'type' && t.value === d.saved}
                empty={data ? 'No types yet.' : 'Loading…'}
                columns={[
                  {
                    key: 'type',
                    label: 'Type',
                    render: (t) => (
                      <button type="button" onClick={() => data && setDraft(toDraft(t, data))} className="flex cursor-pointer flex-col text-left">
                        <span className="text-ink data hover:text-cyan">{t.value}</span>
                        <span className="text-[13px]">{t.name}</span>
                      </button>
                    ),
                  },
                  { key: 'kind', label: 'Behaviour', render: behaviour },
                  {
                    key: 'surfaces',
                    label: 'Shows on',
                    render: (t) => (
                      <span className="inline-flex gap-1.5">
                        {t.surfaces.map((s) => (
                          <Chip key={s}>{cap(s)}</Chip>
                        ))}
                      </span>
                    ),
                  },
                  {
                    key: 'price',
                    label: 'Base price',
                    numeric: true,
                    render: (t) =>
                      data?.base.has(t.value) ? (
                        <Coins amount={data.base.get(t.value)!} className="text-gold" />
                      ) : (
                        <span className="text-ink-muted signal-sm">No base price</span>
                      ),
                  },
                  { key: 'items', label: 'Items', numeric: true, render: (t) => <span className="data">{itemsOf('type', t.value)}</span> },
                ]}
              />
            </div>
          </section>

          <section className="flex flex-col gap-3.5">
            <SectionHead compact num="02" end={<Button variant="ghost" size="mono" onClick={() => setDraft(blank('category'))}>New category</Button>}>
              Categories
            </SectionHead>
            <ul className="grid grid-cols-1 gap-px bg-line min-[720px]:grid-cols-3">
              {(data?.categories ?? []).map((c) => (
                <li key={c.value}>
                  <button
                    type="button"
                    aria-pressed={d?.kind === 'category' && d.saved === c.value}
                    onClick={() => data && setDraft(toDraft(c, data))}
                    className="flex size-full cursor-pointer flex-col gap-2 bg-surface-100 px-5 py-4.5 text-left hover:bg-surface-300 aria-pressed:bg-ground-cyan aria-pressed:shadow-selected"
                  >
                    <span className="flex w-full items-center gap-2.5">
                      <span className="flex-1 text-ink data">{c.value}</span>
                      <span className="text-ink-muted signal-sm">{itemsOf('category', c.value)} items</span>
                    </span>
                    <span className="text-sm font-bold">{c.name}</span>
                    <span className="text-[13px] leading-5 text-ink-dim">{c.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {d ? (
          <Panel label={d.kind === 'type' ? 'Type editor' : 'Category editor'} className="flex flex-col gap-4.5 [--edge:var(--color-line-mid)]">
            <div className="flex flex-col gap-1.5">
              <span className="text-ink-muted signal-sm">{d.kind === 'type' ? 'Type' : 'Category'}</span>
              <h2 className="display-3">{d.saved ?? `New ${d.kind}`}</h2>
            </div>
            {d.saved === null ? (
              <Field label="Value" htmlFor="enum-value" hint="UPPER_SNAKE_CASE. Can’t change after it’s saved.">
                <TextInput id="enum-value" mono value={d.value} onChange={(e) => set({ value: e.target.value.toUpperCase() })} />
              </Field>
            ) : null}
            <Field label="Readable name" htmlFor="enum-name">
              <TextInput id="enum-name" value={d.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Description" htmlFor="enum-desc">
              <TextArea id="enum-desc" rows={2} value={d.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            {d.kind === 'type' ? (
              <>
                <Switch
                  checked={d.equippable}
                  onChange={(equippable) => set({ equippable, currency: equippable ? false : d.currency })}
                  label="Equippable"
                  hint="One item per slot. The slot is this type."
                />
                <Field label="Shows on" hint="Avatar means everywhere the avatar appears: profile, messenger, ranked, tournaments, wiki.">
                  <div role="group" aria-label="Surfaces" className="flex flex-wrap gap-1.5">
                    {SURFACES.map((s) => (
                      <FilterChip
                        key={s}
                        label={cap(s)}
                        pressed={d.surfaces.includes(s)}
                        disabled={!d.equippable}
                        onClick={() => set({ surfaces: d.surfaces.includes(s) ? d.surfaces.filter((x) => x !== s) : [...d.surfaces, s] })}
                      />
                    ))}
                  </div>
                </Field>
                <Switch
                  checked={d.currency}
                  disabled={d.equippable}
                  onChange={(currency) => set({ currency })}
                  label="Currency"
                  hint="Granting credits Duel Points instead. An equippable type can’t be currency."
                />
                <Field
                  label="Base price"
                  htmlFor="enum-price"
                  warn={d.saved !== null && d.basePrice !== '' && Number(d.basePrice) !== data?.base.get(d.saved)}
                  hint={
                    d.saved
                      ? `Reprices ${itemsOf('type', d.saved)} items at once. What duelists already paid stays in the ledger. Empty: no price.`
                      : 'Empty: items of this type can’t be on sale.'
                  }
                >
                  <TextInput id="enum-price" inputMode="numeric" prefix={<Coin className="h-4 w-3.5" />} value={d.basePrice} onChange={(e) => set({ basePrice: e.target.value })} />
                </Field>
              </>
            ) : null}
            {error ? <Alert tone="negative" title="Not saved">{error}</Alert> : null}
            <div className="flex gap-3">
              <Button size="mono-md" className="flex-1" disabled={busy || !d.value.trim() || !d.name.trim()} onClick={save}>
                Save {d.kind}
              </Button>
              {d.saved ? (
                <Button variant="danger-outline" size="mono-md" disabled={busy} onClick={remove}>
                  Delete
                </Button>
              ) : null}
            </div>
            <span className="text-ink-muted caption">
              {d.kind === 'type' ? 'A type still used by an item, or with a base price, can’t be deleted.' : 'A category still used by an item can’t be deleted.'}
            </span>
          </Panel>
        ) : null}
      </div>
    </>
  )
}

export default ShopTypesPage
