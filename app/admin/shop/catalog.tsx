'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Button, Icon, TabBar } from '@ui/index'
import { importShopCsv, listShopEnums, listShopItems, listShopPrices, panelErrorText, type ShopImportResult, type ShopTab } from '@utils/panel'

/** Every tab reads the whole catalog: a few dozen rows, and each tab's counts need the others. */
export const loadCatalog = (signal: AbortSignal) =>
  Promise.all([listShopItems(signal), listShopEnums(signal), listShopPrices(signal)]).then(([items, enums, prices]) => ({
    items,
    enums,
    prices,
    types: enums.filter((e) => e.kind === 'type'),
    categories: enums.filter((e) => e.kind === 'category'),
    base: new Map(prices.map((p) => [p.type, p.basePrice])),
    readAt: Date.now(),
  }))

export type Catalog = Awaited<ReturnType<typeof loadCatalog>>

const TABS = [
  { id: 'items', href: '/admin/shop' },
  { id: 'prices', href: '/admin/shop/prices' },
  { id: 'types', href: '/admin/shop/types' },
  { id: 'battlepass', href: '/admin/battlepass' },
] as const

type TabId = (typeof TABS)[number]['id']

/** Route tabs: each one is its own page, so a reload or a shared link lands on it. */
export const CatalogTabs = ({ active, catalog }: { active: TabId; catalog?: Catalog }) => {
  const router = useRouter()
  const n = (value?: number) => (value === undefined ? null : <span className="text-ink-muted">{value}</span>)
  return (
    <TabBar
      fit
      label="Catalog"
      active={active}
      onSelect={(id) => router.push(TABS.find((tab) => tab.id === id)!.href)}
      tabs={[
        { id: 'items', label: <span className="inline-flex gap-2">Items {n(catalog?.items.length)}</span> },
        { id: 'prices', label: <span className="inline-flex gap-2">Base prices {n(catalog?.prices.length)}</span> },
        { id: 'types', label: <span className="inline-flex gap-2">Types &amp; categories {n(catalog?.enums.length)}</span> },
        { id: 'battlepass', label: 'Battlepass track' },
      ]}
    />
  )
}

/**
 * The tab's CSV as exported from the spreadsheet. One transaction: a bad row is a 400 naming it and
 * nothing is written. The result stays on screen until dismissed.
 */
export const useCsvImport = (tab: ShopTab, onDone: () => void) => {
  const input = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<{ file: string; ok?: ShopImportResult; error?: string } | null>(null)

  const onFile = (file: File | undefined) => {
    if (!file) return
    file
      .text()
      .then((csv) => importShopCsv(tab, csv))
      .then(
        (ok) => {
          setResult({ file: file.name, ok })
          onDone()
        },
        (e) => setResult({ file: file.name, error: panelErrorText(e) }),
      )
    if (input.current) input.current.value = ''
  }

  const button = (
    <>
      <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <Button variant="secondary" size="mono-md" onClick={() => input.current?.click()}>
        <Icon name="upload" size={16} />
        Import CSV
      </Button>
    </>
  )

  const notice = result ? (
    <Alert
      tone={result.ok ? 'positive' : 'negative'}
      title={result.ok ? `${result.file} imported · ${result.ok.written} rows written` : `${result.file} wasn't imported`}
      action={<Button variant="ghost" size="mono" onClick={() => setResult(null)}>Dismiss</Button>}
    >
      {result.ok ? (
        <>
          Rows missing from the file were kept.
          {result.ok.warnings.length ? ` ${result.ok.warnings.length} warning${result.ok.warnings.length > 1 ? 's' : ''}: ` : null}
          {result.ok.warnings.map((w) => (
            <span key={w} className="block text-gold data">{w}</span>
          ))}
        </>
      ) : (
        `${result.error} Nothing was written.`
      )}
    </Alert>
  ) : null

  return { button, notice }
}

/** Two letters for an item with no image: WEBDECO → WD, CUSTOMBADGE → CB. */
export const glyphOf = (type: string) => {
  const known: Record<string, string> = { WEBDECO: 'WD', BACKGROUND: 'BG', SONG: 'SG', MSGBUBBLE: 'MB', CUSTOMBADGE: 'CB', ANIMATEDFAV: 'AF', CURRENCY: 'DP' }
  return known[type] ?? type.slice(0, 2)
}
