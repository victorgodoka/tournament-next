'use client'

import { useRef, useState } from 'react'
import {
  Alert,
  Avatar,
  Button,
  Chip,
  Coins,
  DataTable,
  Dialog,
  Field,
  Icon,
  PageHeader,
  Panel,
  SectionHead,
  Select,
  StatGrid,
  TextArea,
  TextInput,
  Thumb,
  type ChipTone,
} from '@ui/index'
import { useResource } from '@hooks/index'
import { count, dayLabel, dayTime, timeLabel } from '@utils/format'
import {
  getUserShop,
  grantReward,
  importRewards,
  listRewardsLog,
  listShopEnums,
  listShopItems,
  listUserLedger,
  panelErrorText,
  refundItem,
  revokeItem,
  type GrantLogEntry,
  type GrantResult,
  type LedgerEntry,
  type UserShop,
} from '@utils/panel'
import { getProfile } from '@utils/profile'
import type { Cosmetics, ShopInventoryItem } from '@utils/types'
import { glyphOf } from '../shop/catalog'

const SNOWFLAKE = /^\d{15,20}$/
const idsOf = (text: string) => [...new Set(text.split(/[\s,;]+/).filter(Boolean))]

const KIND: Record<GrantLogEntry['kind'], { label: string; tone: ChipTone }> = {
  reward: { label: 'Grant', tone: 'cyan' },
  battlepass: { label: 'Battlepass', tone: 'indigo' },
  revoke: { label: 'Revoke', tone: 'negative' },
  refund: { label: 'Refund', tone: 'gold' },
}

const SOURCE = { purchase: 'Purchase', reward: 'Reward', battlepass: 'Battlepass' }

const loadCatalog = (signal: AbortSignal) =>
  Promise.all([listShopItems(signal), listShopEnums(signal)]).then(([items, enums]) => ({
    items,
    currency: new Set(enums.filter((e) => e.kind === 'type' && e.currency).map((e) => e.value)),
  }))

type Account = UserShop & { name: string | null; avatar: string | null; cosmetics?: Cosmetics; readAt: number; older: LedgerEntry[]; cursor: string | null }

const loadAccount = (userId: string) => (signal: AbortSignal) =>
  Promise.all([getUserShop(userId, signal), getProfile(userId, undefined, 1).catch(() => null)]).then(
    ([shop, profile]): Account => ({
      ...shop,
      name: profile?.displayName ?? profile?.handle ?? null,
      avatar: profile?.avatar ?? null,
      cosmetics: profile?.cosmetics,
      readAt: Date.now(),
      older: [],
      cursor: shop.ledger.nextCursor,
    }),
  )

type Pending = { action: 'revoke' | 'refund'; item: ShopInventoryItem; paid: number | null }

/** The result of a grant, dry or real: the counts, then one line per duelist. */
const GrantOutcome = ({ result, title }: { result: GrantResult; title: string }) => (
  <Alert edged tone="info" badge={<Chip tone={result.dryRun ? 'indigo' : 'positive'}>{result.dryRun ? 'Dry run' : 'Granted'}</Chip>} className="flex-col items-stretch">
    <span className="text-sm text-ink-dim">{result.dryRun ? `${title}: nothing was written. This is what granting would do.` : `${title}: done.`}</span>
    <StatGrid
      columns={2}
      className="mt-3.5"
      items={[
        { label: result.dryRun ? 'Would grant' : 'Granted', value: result.granted },
        { label: 'Already own it', value: result.alreadyOwned },
      ]}
    />
    <ul className="mt-3.5 flex flex-col">
      {result.results.map((r) => (
        <li key={`${r.userId}:${r.itemId}`} className="flex h-9 items-center gap-3 border-t border-line">
          <span className="flex-1 text-ink data">{r.userId}</span>
          <span className={`signal-sm ${r.granted ? 'text-win' : 'text-ink-muted'}`}>
            {r.granted ? (result.dryRun ? 'Would grant' : 'Granted') : 'Already owns it'}
          </span>
        </li>
      ))}
    </ul>
  </Alert>
)

const RewardsPage = () => {
  const catalog = useResource('reward-catalog', loadCatalog)
  const [ids, setIds] = useState('')
  const [itemId, setItemId] = useState('')
  const [qty, setQty] = useState('1')
  const [note, setNote] = useState('')
  const [grant, setGrant] = useState<{ result: GrantResult; title: string; csv?: string } | null>(null)
  const [grantError, setGrantError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const csvInput = useRef<HTMLInputElement>(null)

  const [lookup, setLookup] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const account = useResource(userId, loadAccount(userId ?? ''))
  const [pending, setPending] = useState<Pending | null>(null)
  const [pendingNote, setPendingNote] = useState('')
  const [accountError, setAccountError] = useState<string | null>(null)

  const [logFilter, setLogFilter] = useState('')
  const logKey = SNOWFLAKE.test(logFilter.trim()) ? logFilter.trim() : ''
  const log = useResource(`log:${logKey}`, (signal) => listRewardsLog({ userId: logKey || undefined }, signal))
  const [olderLog, setOlderLog] = useState<{ key: string; entries: GrantLogEntry[]; cursor: string | null } | null>(null)
  const older = olderLog?.key === logKey ? olderLog : null
  const logEntries = [...(log.data?.entries ?? []), ...(older?.entries ?? [])]
  const logCursor = older ? older.cursor : (log.data?.nextCursor ?? null)

  const items = catalog.data?.items ?? []
  const item = items.find((i) => i.id === itemId) ?? items[0]
  const currency = item ? catalog.data?.currency.has(item.type) : false
  const userIds = idsOf(ids)
  const badIds = userIds.filter((id) => !SNOWFLAKE.test(id))

  const runGrant = (dryRun: boolean) => {
    if (!item) return
    setBusy(true)
    setGrantError(null)
    grantReward({ userIds, itemId: item.id, qty: currency ? Number(qty) : 1, note: note.trim() || undefined }, dryRun)
      .then((result) => {
        setGrant({ result, title: `${item.name} to ${userIds.length} duelists` })
        if (!dryRun) log.reload()
      })
      .catch((e) => setGrantError(panelErrorText(e)))
      .finally(() => setBusy(false))
  }

  const importCsv = (file: File | undefined, apply?: string) => {
    const read = apply !== undefined ? Promise.resolve(apply) : (file?.text() ?? Promise.reject(new Error('No file')))
    setBusy(true)
    setGrantError(null)
    read
      .then((csv) =>
        importRewards(csv, apply === undefined).then((result) => {
          setGrant({ result, title: file?.name ?? 'The CSV', csv })
          if (apply !== undefined) log.reload()
        }),
      )
      .catch((e) => setGrantError(panelErrorText(e)))
      .finally(() => setBusy(false))
  }

  const paidFor = (a: Account, id: string) => {
    const line = [...a.ledger.entries, ...a.older].find((l) => l.reason === 'purchase' && l.itemId === id)
    return line ? Math.abs(line.amount) : null
  }

  const confirm = () => {
    if (!pending || !userId) return
    const { action, item: target } = pending
    setPending(null)
    setAccountError(null)
    const request = action === 'revoke' ? revokeItem(userId, target.id, pendingNote.trim() || undefined) : refundItem(userId, target.id, pendingNote.trim() || undefined)
    request.then(
      () => {
        account.reload()
        log.reload()
      },
      (e) => setAccountError(panelErrorText(e)),
    )
  }

  const moreLedger = () => {
    const a = account.data
    if (!a?.cursor || !userId) return
    listUserLedger(userId, a.cursor).then(
      (page) => account.setData((cur) => (cur ? { ...cur, older: [...cur.older, ...page.entries], cursor: page.entries.length ? page.nextCursor : null } : cur)),
      (e) => setAccountError(panelErrorText(e)),
    )
  }

  const moreLog = () => {
    if (!logCursor) return
    listRewardsLog({ userId: logKey || undefined, cursor: logCursor }).then(
      (page) =>
        setOlderLog({
          key: logKey,
          entries: [...(older?.entries ?? []), ...page.entries],
          cursor: page.entries.length ? page.nextCursor : null,
        }),
      () => undefined,
    )
  }

  const a = account.data
  const equipped = a ? Object.keys(a.equipped).length : 0

  return (
    <>
      <PageHeader
        flush
        eyebrow="Economy · Rewards"
        title="Rewards"
        lead="Give an item to up to 500 duelists at once, or look one duelist up to revoke or refund what they own."
        end={
          <>
            <input
              ref={csvInput}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                importCsv(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <Button variant="secondary" size="mono-md" disabled={busy} onClick={() => csvInput.current?.click()}>
              <Icon name="upload" size={16} />
              Import CSV
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <Panel label="Grant an item" className="flex flex-col gap-5 [--edge:var(--color-line-mid)]">
          <SectionHead compact num="01" end="All or nothing">Grant an item</SectionHead>
          <Field
            label="Duelists"
            htmlFor="grant-ids"
            warn={badIds.length > 0 || userIds.length > 500}
            hint={
              badIds.length
                ? `Not a duelist ID: ${badIds.slice(0, 3).join(', ')}`
                : `One ID per line · ${userIds.length} of up to 500 · each must have signed in to the site once`
            }
          >
            <TextArea id="grant-ids" mono rows={4} value={ids} onChange={(e) => setIds(e.target.value)} className="leading-5.5" />
          </Field>
          <Field label="Item">
            <span className="flex items-center gap-3">
              <Thumb src={item && `/items/${item.id}.png`} glyph={item ? glyphOf(item.type) : ''} className="size-9" />
              <Select
                block
                aria-label="Item"
                value={item?.id ?? ''}
                onChange={(e) => setItemId(e.target.value)}
                options={items.map((i) => ({ value: i.id, label: `${i.name} · ${i.id} · ${i.type}` }))}
                className="flex-1"
              />
            </span>
          </Field>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3">
              <Field label="Qty" htmlFor="grant-qty">
                <TextInput id="grant-qty" inputMode="numeric" disabled={!currency} value={currency ? qty : '1'} onChange={(e) => setQty(e.target.value)} />
              </Field>
              <Field label="Note" htmlFor="grant-note">
                <TextInput id="grant-note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </div>
            <span className="text-ink-muted caption">Only a currency item takes a quantity: it credits that many Duel Points.</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="secondary" size="mono-md" disabled={busy || !item || !userIds.length || badIds.length > 0} onClick={() => runGrant(true)}>
              Dry run
            </Button>
            <Button size="mono-md" disabled={busy || !item || !userIds.length || badIds.length > 0} onClick={() => runGrant(false)}>
              Grant to {userIds.length} duelist{userIds.length === 1 ? '' : 's'}
            </Button>
          </div>
          {grantError ? <Alert tone="negative" title="Nothing was granted">{grantError}</Alert> : null}
          {grant ? (
            <>
              <GrantOutcome result={grant.result} title={grant.title} />
              {grant.csv !== undefined && grant.result.dryRun ? (
                <div className="flex gap-3">
                  <Button size="mono" disabled={busy} onClick={() => importCsv(undefined, grant.csv)}>Apply import</Button>
                  <Button variant="ghost" size="mono" onClick={() => setGrant(null)}>Discard</Button>
                </div>
              ) : null}
            </>
          ) : null}
        </Panel>

        <Panel label="Duelist" className="flex flex-col gap-5 [--edge:var(--color-line-mid)]">
          <SectionHead compact num="02" end={a ? `Read ${timeLabel(new Date(a.readAt))}` : undefined}>Duelist</SectionHead>
          <form
            className="flex gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (SNOWFLAKE.test(lookup.trim())) setUserId(lookup.trim())
            }}
          >
            <TextInput mono aria-label="Duelist ID" placeholder="Duelist ID" value={lookup} onChange={(e) => setLookup(e.target.value)} prefix={<Icon name="search" size={16} />} plateClassName="flex-1" />
            <Button type="submit" variant="secondary" size="mono-md">Look up</Button>
          </form>
          {account.error ? <Alert tone="negative" title="No account">{panelErrorText(account.error)}</Alert> : null}
          {accountError ? <Alert tone="negative" title="That didn't go through">{accountError}</Alert> : null}
          {a ? (
            <>
              <div className="flex items-center gap-4">
                <Avatar name={a.name ?? a.userId} src={a.avatar} cosmetics={a.cosmetics} className="size-14 text-2xl" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-[17px] font-bold">{a.name ?? 'Unknown name'}</span>
                  <span className="text-ink-muted data">{a.userId}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-ink-muted signal-sm">Balance</span>
                  <Coins amount={a.balance} size="lg" className="text-gold" />
                </div>
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-2.5 pb-2.5">
                  <span className="flex-1 text-ink-muted signal">Inventory</span>
                  <span className="text-ink-muted signal-sm">{a.items.length} items · {equipped} equipped</span>
                </div>
                {a.items.map((owned) => {
                  const paid = owned.source === 'purchase' ? paidFor(a, owned.id) : null
                  return (
                    <div key={owned.id} className="flex items-center gap-3 border-t border-line py-3">
                      <Thumb src={`/items/${owned.id}.png`} glyph={glyphOf(owned.type)} className="size-9" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-bold">{owned.name}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-ink-muted signal-sm">{owned.type}</span>
                          {a.equipped[owned.type]?.id === owned.id ? <span className="text-cyan signal-sm">Equipped</span> : null}
                        </span>
                      </div>
                      <Chip>{SOURCE[owned.source]}</Chip>
                      {owned.source === 'purchase' ? (
                        <Button variant="secondary" size="mono" onClick={() => setPending({ action: 'refund', item: owned, paid })}>
                          Refund{paid !== null ? ` ${count(paid)}` : ''}
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="mono" className="text-crimson-lift" onClick={() => setPending({ action: 'revoke', item: owned, paid: null })}>
                        Revoke
                      </Button>
                    </div>
                  )
                })}
                {a.items.length === 0 ? <p className="border-t border-line py-4 text-ink-muted body-sm">Owns nothing yet.</p> : null}
                <span className="pt-2.5 text-ink-muted caption">
                  Refund gives back what this purchase cost, not today&apos;s price. Revoking empties the slot it was equipped in.
                </span>
              </div>

              <div className="flex flex-col">
                <div className="flex items-center gap-2.5 pb-2.5">
                  <span className="flex-1 text-ink-muted signal">Ledger</span>
                  {a.cursor ? (
                    <button type="button" className="cursor-pointer text-cyan signal-strong" onClick={moreLedger}>Older lines</button>
                  ) : null}
                </div>
                {[...a.ledger.entries, ...a.older].map((line) => (
                  <div key={line.id} className="grid min-h-9.5 grid-cols-[90px_100px_minmax(0,1fr)_120px] items-center gap-3 border-t border-line">
                    <span className={`display-3 text-lg ${line.amount < 0 ? 'text-loss' : 'text-win'}`}>
                      {line.amount < 0 ? '−' : '+'}
                      {count(Math.abs(line.amount))}
                    </span>
                    <span className="text-ink-dim signal-sm">{line.reason}</span>
                    <span className="truncate text-[13px] text-ink-dim">{[line.itemName, line.note].filter(Boolean).join(' · ') || '—'}</span>
                    <span className="text-right text-xs text-ink-muted">{dayTime(line.createdAt)}</span>
                  </div>
                ))}
                {a.ledger.entries.length === 0 ? <p className="border-t border-line py-4 text-ink-muted body-sm">No ledger lines.</p> : null}
              </div>
            </>
          ) : userId && account.loading ? (
            <p className="text-ink-muted body-sm">Loading…</p>
          ) : (
            <p className="text-ink-muted body-sm">Type a duelist ID to see their balance, inventory and ledger.</p>
          )}
        </Panel>
      </div>

      <section className="flex flex-col gap-5">
        <SectionHead
          compact
          num="03"
          end={
            <TextInput
              mono
              aria-label="Filter the log by duelist ID"
              prefix="Duelist"
              placeholder="Everyone"
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              plateClassName="h-9 w-65"
            />
          }
        >
          Rewards log
        </SectionHead>
        <div className="overflow-x-auto">
          <DataTable
            rows={logEntries}
            rowKey={(r) => r.id}
            empty={log.data ? 'Nothing in the log.' : 'Loading…'}
            columns={[
              {
                key: 'when',
                label: 'When',
                render: (r) => (
                  <span className="whitespace-nowrap">
                    <span className="font-bold text-ink">{dayLabel(r.createdAt)}</span> · {timeLabel(r.createdAt)}
                  </span>
                ),
              },
              { key: 'what', label: 'What', render: (r) => <Chip tone={KIND[r.kind].tone}>{KIND[r.kind].label}</Chip> },
              {
                key: 'user',
                label: 'Duelist',
                render: (r) => (
                  <button type="button" className="cursor-pointer data hover:text-cyan" onClick={() => { setLookup(r.userId); setUserId(r.userId) }}>
                    {r.userId}
                  </button>
                ),
              },
              { key: 'item', label: 'Item', render: (r) => r.itemName },
              { key: 'qty', label: 'Qty', numeric: true, render: (r) => <span className="data">{r.qty}</span> },
              { key: 'note', label: 'Note', render: (r) => r.note ?? '—' },
              { key: 'by', label: 'By', render: (r) => (r.actorId ? <span className="data">{r.actorId}</span> : '—') },
            ]}
          />
        </div>
        {logCursor ? (
          <div>
            <Button variant="secondary" size="mono-md" onClick={moreLog}>Load more</Button>
          </div>
        ) : null}
      </section>

      <Dialog
        size="sm"
        open={pending !== null}
        onClose={() => setPending(null)}
        title={
          <>
            {pending?.action === 'refund' ? 'Refund' : 'Revoke'} <span className="text-ink">{pending?.item.name}</span>
          </>
        }
        footer={
          <>
            <Button variant="ghost" size="mono-md" onClick={() => setPending(null)}>Cancel</Button>
            <Button variant="danger" size="mono-md" onClick={confirm}>
              {pending?.action === 'refund' ? `Refund${pending.paid !== null ? ` ${count(pending.paid)}` : ''}` : 'Revoke item'}
            </Button>
          </>
        }
      >
        <p className="text-ink-dim body">
          {pending?.action === 'refund'
            ? 'Takes the item back and returns what this purchase cost to the balance.'
            : 'Takes the item back. Nothing is returned. If it was equipped, the slot empties.'}
        </p>
        <Field label="Note" htmlFor="pending-note" hint="Optional. Goes to the log.">
          <TextInput id="pending-note" maxLength={200} value={pendingNote} onChange={(e) => setPendingNote(e.target.value)} />
        </Field>
      </Dialog>
    </>
  )
}

export default RewardsPage
