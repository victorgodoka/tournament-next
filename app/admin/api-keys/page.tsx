'use client'

import { useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Chip } from '@ui/chip'
import { DataTable } from '@ui/data-table'
import { TextInput } from '@ui/field'
import { PageHeader } from '@ui/page-header'
import { useResource } from '@hooks/index'
import { count, dayLabel } from '@utils/format'
import { listApiAccounts, panelErrorText, updateApiAccount, type ApiAccount } from '@utils/panel'

const RateLimit = ({ account, onSave }: { account: ApiAccount; onSave: (rateLimit: number) => void }) => {
  const [value, setValue] = useState(String(account.rateLimit))
  const next = Number(value)
  const valid = Number.isInteger(next) && next >= 1 && next <= 10000
  return (
    <span className="flex items-center gap-2">
      <TextInput aria-label={`Requests a minute for ${account.discordUsername}`} inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} plateClassName="w-24" />
      <Button variant="ghost" size="mono" disabled={!valid || next === account.rateLimit} onClick={() => onSave(next)}>Save</Button>
    </span>
  )
}

const ApiKeysPage = () => {
  const accounts = useResource('api-accounts', listApiAccounts)
  const [error, setError] = useState<string | null>(null)
  const update = (account: ApiAccount, body: Parameters<typeof updateApiAccount>[1]) => {
    setError(null)
    updateApiAccount(account.discordId, body).then(accounts.reload, (e) => setError(panelErrorText(e)))
  }

  return (
    <>
      <PageHeader
        flush
        eyebrow={`Staff · ${count(accounts.data?.length ?? 0)} accounts`}
        title="API keys"
        lead="Accounts of the public API portal, most recently used first. A key is born in its owner's login, so here you only set the limit or block the account."
      />
      {accounts.error ? <Alert tone="negative" title="Couldn't read the accounts">{panelErrorText(accounts.error)}</Alert> : null}
      {error ? <Alert tone="negative" title="That didn't go through">{error}</Alert> : null}
      <div className="overflow-x-auto">
        <DataTable
          rows={accounts.data ?? []}
          rowKey={(a) => a.discordId}
          empty={accounts.data ? 'No account yet.' : 'Loading…'}
          columns={[
            {
              key: 'name',
              label: 'Account',
              strong: true,
              render: (a) => (
                <span className="flex flex-col">
                  <span>{a.discordUsername}</span>
                  <span className="font-normal text-ink-muted data">{a.discordId}</span>
                </span>
              ),
            },
            { key: 'key', label: 'Key', render: (a) => <span className="data">{a.keyPrefix ? `${a.keyPrefix}…` : 'None yet'}</span> },
            { key: 'used', label: 'Last used', render: (a) => (a.lastUsedAt ? dayLabel(a.lastUsedAt) : 'Never') },
            { key: 'state', label: 'State', render: (a) => (a.blockedAt ? <Chip tone="negative">Blocked</Chip> : <Chip tone="positive">Active</Chip>) },
            { key: 'limit', label: 'Requests a minute', render: (a) => <RateLimit key={a.rateLimit} account={a} onSave={(rateLimit) => update(a, { rateLimit })} /> },
            {
              key: 'actions',
              label: <span className="block text-right">Actions</span>,
              render: (a) => (
                <span className="flex justify-end">
                  {a.blockedAt ? (
                    <Button variant="ghost" size="mono" onClick={() => update(a, { blocked: false })}>Unblock</Button>
                  ) : (
                    <Button variant="danger-outline" size="mono" onClick={() => update(a, { blocked: true })}>Block</Button>
                  )}
                </span>
              ),
            },
          ]}
        />
      </div>
      <span className="text-ink-muted caption">Blocking drops the key at once and stops the owner from making another.</span>
    </>
  )
}

export default ApiKeysPage
