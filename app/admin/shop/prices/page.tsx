'use client'

import { useState } from 'react'
import { Alert, Button, Coin, DataTable, PageHeader, TextInput } from '@ui/index'
import { useResource } from '@hooks/index'
import { deleteShopPrice, panelErrorText, saveShopPrice } from '@utils/panel'
import { CatalogTabs, loadCatalog, useCsvImport } from '../catalog'

/** One row per type: the base price its items multiply. The type editor on the next tab sets it too. */
const ShopPricesPage = () => {
  const { data, error: loadError, reload } = useResource('catalog', loadCatalog)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const csv = useCsvImport('prices', reload)

  const rows = (data?.types ?? []).map((t) => ({ type: t.value, name: t.name, base: data?.base.get(t.value), items: data?.items.filter((i) => i.type === t.value).length ?? 0 }))

  const act = (request: Promise<unknown>, type: string) => {
    setError(null)
    request.then(
      () => {
        setEdits((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== type)))
        reload()
      },
      (e) => setError(panelErrorText(e)),
    )
  }

  return (
    <>
      <PageHeader
        flush
        eyebrow={data ? `Economy · ${data.prices.length} base prices` : 'Economy'}
        title="Shop catalog"
        lead="The base price of each type. Every item of the type costs base × its multiplier, so a change here reprices all of them at once."
        end={csv.button}
      />
      {csv.notice}
      {loadError ? <Alert tone="negative" title="Couldn't read the catalog">{panelErrorText(loadError)}</Alert> : null}
      {error ? <Alert tone="negative" title="Not saved">{error}</Alert> : null}

      <CatalogTabs active="prices" catalog={data} />

      <div className="overflow-x-auto">
        <DataTable
          rows={rows}
          rowKey={(r) => r.type}
          empty={data ? 'No types yet.' : 'Loading…'}
          columns={[
            {
              key: 'type',
              label: 'Type',
              render: (r) => (
                <span className="flex flex-col">
                  <span className="text-ink data">{r.type}</span>
                  <span className="text-[13px]">{r.name}</span>
                </span>
              ),
            },
            { key: 'items', label: 'Items', numeric: true, render: (r) => <span className="data">{r.items}</span> },
            {
              key: 'base',
              label: 'Base price',
              width: 220,
              render: (r) => (
                <TextInput
                  aria-label={`Base price of ${r.type}`}
                  inputMode="numeric"
                  prefix={<Coin className="h-4 w-3.5" />}
                  placeholder="No price"
                  value={edits[r.type] ?? (r.base === undefined ? '' : String(r.base))}
                  onChange={(e) => setEdits({ ...edits, [r.type]: e.target.value })}
                />
              ),
            },
            {
              key: 'actions',
              label: <span className="block text-right">Actions</span>,
              render: (r) => (
                <span className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="mono"
                    disabled={edits[r.type] === undefined || edits[r.type] === ''}
                    onClick={() => act(saveShopPrice(r.type, Number(edits[r.type])), r.type)}
                  >
                    Save
                  </Button>
                  {r.base !== undefined ? (
                    <Button variant="ghost" size="mono" className="text-crimson-lift" onClick={() => act(deleteShopPrice(r.type), r.type)}>
                      Remove
                    </Button>
                  ) : null}
                </span>
              ),
            },
          ]}
        />
      </div>
      <span className="text-ink-muted caption">A base price whose type still has SHOP items can’t be removed. What duelists already paid stays in the ledger.</span>
    </>
  )
}

export default ShopPricesPage
