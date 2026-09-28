'use client'

import { useRef, useState } from 'react'
import { Alert, Button, Chip, Coins, DataTable, Field, Icon, PageHeader, Panel, SearchField, Select, Switch, TextArea, TextInput, Thumb } from '@ui/index'
import { useResource } from '@hooks/index'
import { isoDay, timeLabel } from '@utils/format'
import { createShopItem, deleteShopItem, panelErrorText, saveShopItem, signShopAsset, type ShopItemBody } from '@utils/panel'
import type { ShopItem } from '@utils/types'
import { BubbleDesigner } from './BubbleDesigner'
import { CatalogTabs, glyphOf, loadCatalog, useCsvImport } from './catalog'

type Draft = {
  id: string | null
  name: string
  type: string
  category: string
  multiplier: string
  startsAt: string
  endsAt: string
  description: string
  data: string
  active: boolean
  assetId: string | null
  /** What to preview: the saved URL, or the upload that isn't saved yet. */
  image: string | null
  season: string | null
  ext: string | null
}

const toDraft = (item: ShopItem): Draft => ({
  id: item.id,
  name: item.name,
  type: item.type,
  category: item.category,
  multiplier: String(item.multiplier),
  startsAt: item.startsAt ?? '',
  endsAt: item.endsAt ?? '',
  description: item.description,
  data: Object.keys(item.data).length ? JSON.stringify(item.data, null, 2) : '',
  active: item.active,
  assetId: item.assetId,
  image: item.assetUrl,
  season: item.season,
  ext: item.ext,
})

/** Off: switched off, or outside its window. The admin list shows every item, not the storefront. */
const onSale = (item: ShopItem, today: string) =>
  item.active && (!item.startsAt || item.startsAt <= today) && (!item.endsAt || item.endsAt >= today)

const windowLabel = (item: ShopItem, today: string) =>
  item.endsAt && item.endsAt < today
    ? `Ended ${item.endsAt}`
    : item.startsAt && item.startsAt > today
      ? `From ${item.startsAt}`
      : item.endsAt
        ? `Until ${item.endsAt}`
        : 'Always'

/** Straight to Cloudinary with the server's signature; the API checks moderation when the item is saved. */
const upload = async (file: File) => {
  const { uploadUrl, fields } = await signShopAsset()
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  form.append('file', file)
  const res = await fetch(uploadUrl, { method: 'POST', body: form })
  if (!res.ok) throw new Error('The image upload failed.')
  return (await res.json()) as { public_id: string; secure_url: string }
}

const ShopItemsPage = () => {
  const { data, error: loadError, reload, setData } = useResource('catalog', loadCatalog)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [category, setCategory] = useState('')
  const [showOff, setShowOff] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const csv = useCsvImport('items', reload)

  const today = data ? isoDay(new Date(data.readAt)) : ''
  const items = (data?.items ?? []).filter(
    (item) =>
      (!query || `${item.name} ${item.id}`.toLowerCase().includes(query.toLowerCase())) &&
      (!type || item.type === type) &&
      (!category || item.category === category) &&
      (showOff || onSale(item, today)),
  )
  const d = draft
  const set = (patch: Partial<Draft>) => d && setDraft({ ...d, ...patch })
  const typeOf = data?.types.find((t) => t.value === d?.type)
  const base = d ? data?.base.get(d.type) : undefined
  const multiplier = Number(d?.multiplier.replace(',', '.'))

  const blank = (): Draft => ({
    id: null,
    name: '',
    type: data?.types[0]?.value ?? '',
    category: data?.categories.find((c) => c.value === 'SHOP')?.value ?? data?.categories[0]?.value ?? '',
    multiplier: '1',
    startsAt: '',
    endsAt: '',
    description: '',
    data: '',
    active: true,
    assetId: null,
    image: null,
    season: null,
    ext: null,
  })

  const onImage = (file: File | undefined) => {
    if (!file || !d) return
    setBusy(true)
    setError(null)
    upload(file)
      .then((asset) => set({ assetId: asset.public_id, image: asset.secure_url }))
      .catch((e) => setError(panelErrorText(e)))
      .finally(() => setBusy(false))
    if (imageInput.current) imageInput.current.value = ''
  }

  const save = () => {
    if (!d) return
    let parsed: Record<string, unknown> = {}
    try {
      parsed = d.data.trim() ? JSON.parse(d.data) : {}
    } catch {
      return setError('Data isn’t valid JSON.')
    }
    const body: ShopItemBody = {
      name: d.name.trim(),
      type: d.type,
      category: d.category,
      multiplier,
      season: d.season,
      ext: d.ext,
      startsAt: d.startsAt || null,
      endsAt: d.endsAt || null,
      description: d.description,
      assetId: d.assetId,
      data: parsed,
      active: d.active,
    }
    setBusy(true)
    setError(null)
    ;(d.id === null ? createShopItem(body) : saveShopItem(d.id, body))
      .then((saved) => {
        setDraft(toDraft(saved))
        setData((c) => c && { ...c, items: d.id === null ? [...c.items, saved] : c.items.map((i) => (i.id === saved.id ? saved : i)) })
      })
      .catch((e) => setError(panelErrorText(e)))
      .finally(() => setBusy(false))
  }

  const remove = () => {
    if (!d?.id) return
    const id = d.id
    setBusy(true)
    setError(null)
    deleteShopItem(id)
      .then(() => {
        setDraft(null)
        setData((c) => c && { ...c, items: c.items.filter((i) => i.id !== id) })
      })
      .catch((e) => setError(panelErrorText(e)))
      .finally(() => setBusy(false))
  }

  return (
    <>
      <PageHeader
        flush
        eyebrow={data ? `Economy · ${data.items.length} items · Read ${timeLabel(new Date(data.readAt))}` : 'Economy'}
        title="Shop catalog"
        lead="Types, base prices, items and the battlepass track. A price is always base × multiplier, worked out when it’s read."
        end={
          <>
            {csv.button}
            <Button size="mono-md" onClick={() => setDraft(blank())}>New item</Button>
          </>
        }
      />
      {csv.notice}
      {loadError ? <Alert tone="negative" title="Couldn't read the catalog">{panelErrorText(loadError)}</Alert> : null}

      <CatalogTabs active="items" catalog={data} />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <SearchField placeholder="Name or id" label="Search items" value={query} onChange={(e) => setQuery(e.target.value)} className="w-65 min-w-0" />
            <Select
              prefix="Type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              options={[{ value: '', label: 'Any' }, ...(data?.types ?? []).map((t) => t.value)]}
              className="w-45 min-w-0"
            />
            <Select
              prefix="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={[{ value: '', label: 'Any' }, ...(data?.categories ?? []).map((c) => c.value)]}
              className="w-50 min-w-0"
            />
            <span className="flex-1" />
            <Switch quiet checked={showOff} onChange={setShowOff} label="Show off-sale" />
          </div>
          <div className="overflow-x-auto">
            <DataTable
              rows={items}
              rowKey={(item) => item.id}
              isSelected={(item) => item.id === d?.id}
              empty={data ? 'No item matches.' : 'Loading…'}
              columns={[
                { key: 'thumb', label: <span className="sr-only">Image</span>, width: 64, render: (item) => <Thumb src={`/items/${item.id}.png`} glyph={glyphOf(item.type)} /> },
                {
                  key: 'item',
                  label: 'Item',
                  render: (item) => (
                    <button type="button" onClick={() => setDraft(toDraft(item))} className="flex cursor-pointer flex-col text-left">
                      <span className="font-bold text-ink hover:text-cyan">{item.name}</span>
                      <span className="text-ink-muted data">{item.id}</span>
                    </button>
                  ),
                },
                { key: 'type', label: 'Type', render: (item) => <span className="text-ink-dim signal-sm">{item.type}</span> },
                { key: 'cat', label: 'Category', render: (item) => <span className="text-ink-dim signal-sm">{item.category}</span> },
                {
                  key: 'calc',
                  label: 'Base × mult.',
                  numeric: true,
                  render: (item) => {
                    const b = data?.base.get(item.type)
                    return <span className="text-ink-dim data">{b === undefined ? '—' : `${b} × ${item.multiplier}`}</span>
                  },
                },
                {
                  key: 'price',
                  label: 'Price',
                  numeric: true,
                  render: (item) =>
                    item.price === null ? <span className="text-ink-muted signal-sm">No price</span> : <Coins amount={item.price} className="text-gold" />,
                },
                { key: 'window', label: 'Window', render: (item) => windowLabel(item, today) },
                {
                  key: 'status',
                  label: 'Status',
                  render: (item) => (onSale(item, today) ? <Chip tone="positive">On sale</Chip> : <Chip>Off</Chip>),
                },
              ]}
            />
          </div>
          <span className="text-ink-muted caption">Items outside their window and non-shop categories are listed too. This is the admin view, not the storefront.</span>
        </div>

        {d ? (
          <Panel label="Item editor" className="flex flex-col gap-4.5 [--edge:var(--color-line-mid)]">
            <div className="flex items-center gap-2.5">
              <div className="flex flex-1 flex-col gap-1.5">
                <span className="text-ink-muted data">{d.id ?? 'New item · id generated on save'}</span>
                <h2 className="display-3">{d.name || 'Untitled'}</h2>
              </div>
              <Button variant="ghost" size="icon" aria-label="Close" onClick={() => setDraft(null)}>
                <Icon name="close" size={16} />
              </Button>
            </div>
            <Thumb wide src={d.image} className="h-37.5 w-full border border-line-mid">
              <span className="flex flex-col items-center gap-2">
                <span className="text-ink-muted signal-sm">No image</span>
                {d.assetId ? <span className="text-ink-muted data">{d.assetId}</span> : null}
              </span>
            </Thumb>
            <div className="flex items-center gap-3">
              <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => onImage(e.target.files?.[0])} />
              <Button variant="secondary" size="mono" disabled={busy} onClick={() => imageInput.current?.click()}>
                {d.image ? 'Replace image' : 'Add image'}
              </Button>
              <span className="text-ink-muted caption">JPG, PNG, WebP or GIF. Checked for moderation before it saves.</span>
            </div>
            <Field label="Name" htmlFor="item-name">
              <TextInput id="item-name" value={d.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Type"
                hint={typeOf ? (typeOf.currency ? 'Currency · credits Duel Points' : typeOf.equippable ? `Equippable · shows on ${typeOf.surfaces.join(', ') || 'nothing yet'}` : 'Not equippable') : undefined}
              >
                <Select block aria-label="Type" value={d.type} onChange={(e) => set({ type: e.target.value })} options={(data?.types ?? []).map((t) => t.value)} />
              </Field>
              <Field label="Category">
                <Select block aria-label="Category" value={d.category} onChange={(e) => set({ category: e.target.value })} options={(data?.categories ?? []).map((c) => c.value)} />
              </Field>
            </div>
            <Field label="Multiplier" htmlFor="item-mult">
              <TextInput
                id="item-mult"
                prefix="×"
                inputMode="decimal"
                value={d.multiplier}
                onChange={(e) => set({ multiplier: e.target.value })}
                suffix={base === undefined ? 'No base' : `${base} base`}
              />
              <span className="flex items-center gap-2">
                {base !== undefined && Number.isFinite(multiplier) ? (
                  <span className="text-[13px] text-gold">
                    <Coins amount={Math.round(base * multiplier)} className="text-gold" /> on the storefront
                  </span>
                ) : (
                  <span className="text-[13px] text-ink-dim">No price: the type has no base price</span>
                )}
                <span className="text-ink-muted caption">· up to 4 decimals</span>
              </span>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts" htmlFor="item-start">
                <TextInput id="item-start" type="date" value={d.startsAt} onChange={(e) => set({ startsAt: e.target.value })} />
              </Field>
              <Field label="Ends" htmlFor="item-end">
                <TextInput id="item-end" type="date" value={d.endsAt} onChange={(e) => set({ endsAt: e.target.value })} />
              </Field>
            </div>
            <Field label="Description" htmlFor="item-desc">
              <TextArea id="item-desc" rows={2} maxLength={1000} value={d.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            {d.type === 'MSGBUBBLE' ? <BubbleDesigner value={d.data} sticker={d.image} onChange={(data) => set({ data })} /> : null}
            <Field label="Data" htmlFor="item-data" hint="JSON the front reads for this type · up to 4000 characters">
              <TextArea id="item-data" mono rows={3} maxLength={4000} placeholder="{}" value={d.data} onChange={(e) => set({ data: e.target.value })} />
            </Field>
            <Switch checked={d.active} onChange={(active) => set({ active })} label="On the storefront" />
            {error ? <Alert tone="negative" title="Not saved">{error}</Alert> : null}
            <div className="flex gap-3 pt-1.5">
              <Button size="mono-md" className="flex-1" disabled={busy || !d.name.trim()} onClick={save}>
                Save item
              </Button>
              {d.id ? (
                <Button variant="danger-outline" size="mono-md" disabled={busy} onClick={remove}>
                  Delete
                </Button>
              ) : null}
            </div>
            <span className="text-ink-muted caption">An item someone owns can&apos;t be deleted. Take it off the storefront instead.</span>
          </Panel>
        ) : null}
      </div>
    </>
  )
}

export default ShopItemsPage
