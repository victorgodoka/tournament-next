'use client'

import { useState } from 'react'
import { Alert, Avatar, Button, Chip, PageHeader, Panel, SectionHead, TextInput, type ChipTone } from '@ui/index'
import { useResource } from '@hooks/index'
import { demoteEditor, listEditors, promoteEditor } from '@utils/articles'
import { timeLabel } from '@utils/format'
import { demoteAnalyst, getSettings, listAnalysts, panelErrorText, promoteAnalyst, updateSettings } from '@utils/panel'
import type { WikiEditor } from '@utils/types'

const ROLE: Record<string, { label: string; tone: ChipTone }> = {
  ADMIN: { label: 'Admin', tone: 'gold' },
  ANALYST: { label: 'Analyst', tone: 'cyan' },
  EDITOR: { label: 'Editor', tone: 'indigo' },
}

const SNOWFLAKE = /^\d{15,20}$/

/** One role list: add by ID, remove anyone but admins (who always have it). */
const People = ({
  num,
  id,
  title,
  blurb,
  hint,
  add,
  people,
  onAdd,
  onRemove,
  footnote,
}: {
  num: string
  id: string
  title: string
  blurb: string
  hint?: string
  add: string
  people: WikiEditor[] | undefined
  onAdd: (userId: string) => Promise<unknown>
  onRemove: (userId: string) => Promise<unknown>
  footnote?: string
}) => {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = (request: Promise<unknown>, clear?: boolean) => {
    setBusy(true)
    setError(null)
    request
      .then(() => clear && setInput(''))
      .catch((e) => setError(panelErrorText(e)))
      .finally(() => setBusy(false))
  }

  return (
    <Panel label={title} className="flex scroll-mt-6 flex-col gap-4.5 [--edge:var(--color-line-mid)]">
      <span id={id} />
      <SectionHead compact num={num} end="Needs user.manage">{title}</SectionHead>
      <p className="text-sm leading-5.5 text-ink-dim">{blurb}</p>
      <div className="flex flex-col gap-2">
        <form
          className="flex gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (SNOWFLAKE.test(input.trim())) run(onAdd(input.trim()), true)
          }}
        >
          <TextInput mono aria-label={`Duelist ID to make ${add.toLowerCase()}`} placeholder="Duelist ID" value={input} onChange={(e) => setInput(e.target.value)} plateClassName="flex-1" />
          <Button type="submit" variant="secondary" size="mono-md" disabled={busy || !SNOWFLAKE.test(input.trim())}>
            Make {add.toLowerCase()}
          </Button>
        </form>
        {hint ? <span className="text-ink-muted caption">{hint}</span> : null}
      </div>
      {error ? <Alert tone="negative" title="That didn't go through">{error}</Alert> : null}
      <ul className="flex flex-col">
        {(people ?? []).map((p) => {
          const role = ROLE[p.role] ?? { label: p.role, tone: 'neutral' as ChipTone }
          return (
            <li key={p.id} className="flex min-h-14 items-center gap-3 border-t border-line py-2">
              <Avatar name={p.username ?? p.id} src={p.avatarUrl} className="size-9 text-base" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-bold">{p.username ?? 'Unknown name'}</span>
                <span className="text-ink-muted data">{p.id}</span>
              </span>
              <Chip tone={role.tone}>{role.label}</Chip>
              {p.role === 'ADMIN' ? (
                <span className="w-19 text-right text-ink-muted signal-sm">Always</span>
              ) : (
                <Button variant="ghost" size="mono" disabled={busy} onClick={() => run(onRemove(p.id))}>
                  Remove
                </Button>
              )}
            </li>
          )
        })}
        {people === undefined ? <li className="border-t border-line py-3 text-ink-muted body-sm">Loading…</li> : null}
      </ul>
      {footnote ? <span className="text-ink-muted caption">{footnote}</span> : null}
    </Panel>
  )
}

const StaffPage = () => {
  const analysts = useResource('analysts', () => listAnalysts())
  const editors = useResource('editors', () => listEditors())
  const settings = useResource('settings', getSettings)
  const [minSamples, setMinSamples] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const value = minSamples ?? String(settings.data?.['analytics.global.minSamples'] ?? '')

  const saveSettings = () => {
    setError(null)
    updateSettings({ 'analytics.global.minSamples': Number(value) }).then(
      (next) => {
        settings.setData(() => next)
        setMinSamples(null)
        setSaved(`Saved at ${timeLabel(new Date())}`)
      },
      (e) => setError(panelErrorText(e)),
    )
  }

  return (
    <>
      <PageHeader
        flush
        eyebrow="Staff"
        title="Access and settings"
        lead="Who can write analytics for any profile, who can edit the wiki, and the values staff tune without a deploy. Roles apply on the next request, no sign-in needed."
      />
      {analysts.error || editors.error ? (
        <Alert tone="negative" title="Couldn't read the staff lists">{panelErrorText(analysts.error ?? editors.error)}</Alert>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <People
          num="01"
          id="analysts"
          title="Analysts"
          blurb="An analyst writes explorations on any profile and shows as the author, with the owner as co-author."
          hint="The role is exclusive: an editor made analyst stops being an editor. They must have signed in once."
          add="Analyst"
          people={analysts.data}
          onAdd={(id) => promoteAnalyst(id).then(() => { analysts.reload(); editors.reload() })}
          onRemove={(id) => demoteAnalyst(id).then(analysts.reload)}
          footnote="Removing sets them back to a duelist. Their explorations stay."
        />
        <People
          num="02"
          id="editors"
          title="Wiki editors"
          blurb="Editors can write and change wiki pages."
          add="Editor"
          people={editors.data}
          onAdd={(id) => promoteEditor(id).then(() => { editors.reload(); analysts.reload() })}
          onRemove={(id) => demoteEditor(id).then(editors.reload)}
          footnote="Removing keeps their articles; they can no longer write."
        />
      </div>

      <Panel label="Settings" className="flex scroll-mt-6 flex-col gap-4.5 [--edge:var(--color-line-mid)]">
        <span id="settings" />
        <SectionHead compact num="03" end={saved ?? '1 setting'}>Settings</SectionHead>
        <div className="grid grid-cols-1 items-center gap-6 min-[720px]:grid-cols-[minmax(0,1fr)_220px_auto]">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="min-samples" className="text-ink data">analytics.global.minSamples</label>
            <span className="text-sm leading-5.5 text-ink-dim">Global analytics hide any cut with fewer deck samples than this. 0 shows everything.</span>
          </div>
          <TextInput id="min-samples" inputMode="numeric" suffix="0–1 000 000" value={value} onChange={(e) => setMinSamples(e.target.value)} />
          <Button size="mono-md" disabled={minSamples === null || value.trim() === ''} onClick={saveSettings}>Save settings</Button>
        </div>
        {error ? <Alert tone="negative" title="Not saved">{error}</Alert> : null}
      </Panel>
    </>
  )
}

export default StaffPage
