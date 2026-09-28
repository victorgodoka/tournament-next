'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Alert,
  Button,
  Chip,
  Coin,
  DataTable,
  Dialog,
  Field,
  FilterChip,
  Icon,
  PageHeader,
  Panel,
  SectionHead,
  Segmented,
  Select,
  StatGrid,
  Switch,
  TextArea,
  TextInput,
  Thumb,
} from '@ui/index'
import { useResource } from '@hooks/index'
import { count, dayLabel, dayTime, isoDay, timeLabel, toBrt } from '@utils/format'
import {
  deletePassLevel,
  deletePassSeason,
  deleteReward,
  getPassSeason,
  importPassTrack,
  listShopItems,
  panelErrorText,
  passExportUrl,
  savePassLevel,
  savePassRules,
  saveReward,
  syncPassSeason,
  updatePassSeason,
  type BattlepassReward,
  type BattlepassTrack,
  type PassFormat,
  type TrackImportResult,
  type TrackLevel,
  type XpRules,
} from '@utils/panel'
import { glyphOf } from '../../shop/catalog'
import { XP_SOURCES, brtLocal, passState, premiumLabel } from '../season'

const FORMATS: PassFormat[] = ['TCG', 'Genesys']
const PAGE = 10

const load = (code: string) => (signal: AbortSignal) =>
  Promise.all([getPassSeason(code, signal), listShopItems(signal)]).then(([season, items]) => ({ season, items, readAt: Date.now() }))

type LevelDraft = { level: number; xp: string; free: { itemId: string; qty: string }; premium: { itemId: string; qty: string } }

const slotDraft = (reward: BattlepassReward | null) => ({ itemId: reward?.itemId ?? '', qty: String(reward?.qty ?? 1) })

const Slot = ({ reward, onClick }: { reward: BattlepassReward | null; onClick: () => void }) =>
  reward ? (
    <button type="button" onClick={onClick} className="flex cursor-pointer items-center gap-2.5 text-left">
      <Thumb src={`/items/${reward.item.id}.png`} glyph={glyphOf(reward.item.type)} className="size-8" />
      <span className="flex flex-col">
        <span className="font-bold text-ink hover:text-cyan">{reward.item.name}</span>
        <span className="text-ink-muted data">
          {reward.itemId}
          {reward.qty > 1 ? ` · ×${reward.qty}` : ''}
        </span>
      </span>
    </button>
  ) : (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 cursor-pointer items-center border border-dashed border-line-mid px-3 text-[13px] text-ink-muted hover:border-line-strong hover:text-ink"
    >
      Add reward
    </button>
  )

export const SeasonScreen = ({ code }: { code: string }) => {
  const router = useRouter()
  const { data, error: loadError, reload } = useResource(`pass:${code}`, load(code))
  const [shown, setShown] = useState(PAGE)
  const [level, setLevel] = useState<LevelDraft | null>(null)
  const [rules, setRules] = useState<Record<string, string> | null>(null)
  const [editing, setEditing] = useState<null | {
    name: string
    description: string
    startsAt: string
    endsAt: string
    xpPerLevel: string
    premiumPrice: string
    formats: PassFormat[]
    premiumOmegaPass: boolean
  }>(null)
  const [csv, setCsv] = useState<{ file: string; text: string; replace: boolean; result?: TrackImportResult } | null>(null)
  const [notice, setNotice] = useState<{ tone: 'positive' | 'negative'; title: string; body?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const s = data?.season
  const now = data?.readAt ?? 0
  const track = s?.track ?? []
  const stored = new Set(s?.levels.map((l) => l.level))
  const ruleValues = rules ?? Object.fromEntries(XP_SOURCES.map(({ key }) => [key, String(s?.xpRules[key] ?? '')]))

  const act = (request: Promise<unknown>, done: string, after?: () => void) => {
    setBusy(true)
    setNotice(null)
    request
      .then(() => {
        setNotice({ tone: 'positive', title: done })
        after?.()
        reload()
      })
      .catch((e) => setNotice({ tone: 'negative', title: 'That didn’t go through', body: panelErrorText(e) }))
      .finally(() => setBusy(false))
  }

  const dryRun = (file: string, text: string, replace: boolean) => {
    setBusy(true)
    importPassTrack(code, text, { dryRun: true, replace })
      .then((result) => setCsv({ file, text, replace, result }))
      .catch((e) => {
        setCsv(null)
        setNotice({ tone: 'negative', title: `${file} wasn’t imported`, body: panelErrorText(e) })
      })
      .finally(() => setBusy(false))
  }

  const openLevel = (row: TrackLevel) =>
    setLevel({ level: row.level, xp: stored.has(row.level) ? String(row.xp) : '', free: slotDraft(row.free), premium: slotDraft(row.premium) })

  const saveLevel = async () => {
    if (!level || !s) return
    const row = track.find((t) => t.level === level.level)
    const jobs: Promise<unknown>[] = []
    const xp = level.xp.trim()
    if (xp !== '' && Number(xp) !== (stored.has(level.level) ? row?.xp : undefined)) jobs.push(savePassLevel(code, level.level, Number(xp)))
    if (xp === '' && stored.has(level.level)) jobs.push(deletePassLevel(code, level.level))
    for (const t of ['free', 'premium'] as BattlepassTrack[]) {
      const slot = level[t]
      const current = t === 'free' ? row?.free : row?.premium
      if (slot.itemId && (slot.itemId !== current?.itemId || Number(slot.qty) !== current?.qty)) {
        jobs.push(saveReward(code, level.level, t, { itemId: slot.itemId, qty: Number(slot.qty) || 1 }))
      }
      if (!slot.itemId && current) jobs.push(deleteReward(code, level.level, t))
    }
    setLevel(null)
    act(Promise.all(jobs), `Level ${level.level} saved`)
  }

  const itemOptions = [{ value: '', label: 'No reward' }, ...(data?.items ?? []).map((i) => ({ value: i.id, label: `${i.name} · ${i.id} · ${i.type}` }))]

  if (loadError) return <Alert tone="negative" title={`Couldn't read ${code}`}>{panelErrorText(loadError)}</Alert>
  if (!s) return <p className="text-ink-muted body-sm">Loading…</p>

  const state = passState(s, now)
  const linearFrom = s.xpPerLevel

  return (
    <>
      <PageHeader
        flush
        eyebrow={
          <span className="flex items-center gap-2.5">
            {s.code} · {dayLabel(s.startsAt)} → {dayLabel(s.endsAt)} <Chip tone={state.tone}>{state.label.split(' · ')[0]}</Chip>
          </span>
        }
        title={s.name}
        end={
          <>
            <Button variant="secondary" size="mono-md" disabled={busy} onClick={() => act(syncPassSeason(code), 'XP synced')}>
              Sync XP now
            </Button>
            <a href={passExportUrl(code)} className="cut inline-flex min-h-10 items-center gap-2 px-4.5 text-ink signal-strong [--edge:var(--color-line-strong)] hover:[--fill:var(--color-surface-300)]">
              <Icon name="download" size={16} />
              Export CSV
            </a>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) file.text().then((text) => dryRun(file.name, text, false))
                e.target.value = ''
              }}
            />
            <Button variant="secondary" size="mono-md" disabled={busy} onClick={() => fileInput.current?.click()}>
              <Icon name="upload" size={16} />
              Import CSV
            </Button>
          </>
        }
      />

      {notice ? (
        <Alert tone={notice.tone} title={notice.title} action={<Button variant="ghost" size="mono" onClick={() => setNotice(null)}>Dismiss</Button>}>
          {notice.body}
        </Alert>
      ) : null}

      <StatGrid
        items={[
          { label: 'Participants', value: count(s.stats.participants) },
          { label: 'Premium', value: count(s.stats.premium) },
          { label: 'Claims', value: count(s.stats.claims) },
          {
            label: 'Last XP sync',
            value: s.syncedAt ? (isoDay(s.syncedAt) === isoDay(new Date(now)) ? timeLabel(s.syncedAt) : dayLabel(s.syncedAt)) : '—',
            hint: [s.lastDuelId && `Duel #${s.lastDuelId}`, s.lastTournamentId && `Tournament #${s.lastTournamentId}`].filter(Boolean).join(' · ') || undefined,
          },
        ]}
      />

      {csv?.result ? (
        <Alert
          edged
          tone="info"
          badge={<Chip tone="indigo">Dry run · {csv.replace ? 'Replace' : 'Upsert'}</Chip>}
          title={`${csv.file} would write ${csv.result.levels} levels and ${csv.result.rewards} rewards${
            csv.replace ? `, and remove ${csv.result.removed.rewards} rewards and ${csv.result.removed.levels} curve rows` : ''
          }`}
          action={
            <span className="flex flex-wrap items-center gap-3">
              <Segmented
                size="sm"
                label="Import mode"
                value={csv.replace ? 'replace' : 'upsert'}
                onChange={(mode) => dryRun(csv.file, csv.text, mode === 'replace')}
                options={[
                  { value: 'upsert', label: 'Upsert' },
                  { value: 'replace', label: 'Replace' },
                ]}
              />
              <Button variant="ghost" size="mono" onClick={() => setCsv(null)}>Discard</Button>
              <Button
                variant="secondary"
                size="mono"
                disabled={busy}
                onClick={() => act(importPassTrack(code, csv.text, { replace: csv.replace }), `${csv.file} imported`, () => setCsv(null))}
              >
                Apply import
              </Button>
            </span>
          }
        >
          {csv.result.warnings.map((w) => (
            <span key={w} className="block text-gold">{w}</span>
          ))}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex min-w-0 flex-col gap-4">
          <SectionHead compact num="01" end={`${track.length} levels · linear at ${count(linearFrom)} XP where the curve has no row`}>
            Track
          </SectionHead>
          <div className="overflow-x-auto">
            <DataTable
              rows={track.slice(0, shown)}
              rowKey={(t) => t.level}
              empty="No levels yet. Add a reward or import the track."
              columns={[
                {
                  key: 'level',
                  label: 'Level',
                  render: (t) => (
                    <button type="button" onClick={() => openLevel(t)} className="cursor-pointer text-ink display-3 hover:text-cyan" aria-label={`Edit level ${t.level}`}>
                      {t.level}
                    </button>
                  ),
                },
                {
                  key: 'xp',
                  label: 'XP to reach',
                  numeric: true,
                  render: (t) => (
                    <span className="flex flex-col items-end">
                      <span className="text-ink data">{count(t.xp)}</span>
                      <span className={`signal-sm ${stored.has(t.level) ? 'text-cyan' : 'text-ink-muted'}`}>{stored.has(t.level) ? 'Curve' : 'Linear'}</span>
                    </span>
                  ),
                },
                { key: 'free', label: 'Free', render: (t) => <Slot reward={t.free} onClick={() => openLevel(t)} /> },
                { key: 'premium', label: 'Premium', render: (t) => <Slot reward={t.premium} onClick={() => openLevel(t)} /> },
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {track.length > shown ? (
              <Button variant="secondary" size="mono-md" onClick={() => setShown(track.length)}>
                Show levels {shown + 1}–{track.length}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="mono-md"
              onClick={() => setLevel({ level: track.length + 1, xp: '', free: slotDraft(null), premium: slotDraft(null) })}
            >
              Add level {track.length + 1}
            </Button>
            <span className="text-ink-muted caption">A curve row sets the total XP to reach that level. A player never skips a level, even if the curve dips.</span>
          </div>
        </section>

        <div className="flex flex-col gap-6">
          <Panel label="XP rules" className="flex flex-col gap-4.5 [--edge:var(--color-line-mid)]">
            <SectionHead compact num="02">XP rules</SectionHead>
            {XP_SOURCES.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-[minmax(0,1fr)_110px] items-center gap-3">
                <label htmlFor={`rule-${key}`} className="text-sm">{label}</label>
                <TextInput
                  id={`rule-${key}`}
                  inputMode="numeric"
                  suffix="XP"
                  value={ruleValues[key]}
                  onChange={(e) => setRules({ ...ruleValues, [key]: e.target.value })}
                />
              </div>
            ))}
            <span className="text-ink-muted caption">Saving replaces every rule; an empty one gives 0. New values count from now on, nothing already read is recounted.</span>
            <Button
              size="mono-md"
              disabled={busy || rules === null}
              onClick={() => {
                const next: XpRules = {}
                for (const { key } of XP_SOURCES) if (ruleValues[key]?.trim()) next[key] = Number(ruleValues[key])
                act(savePassRules(code, next), 'XP rules saved', () => setRules(null))
              }}
            >
              Save rules
            </Button>
          </Panel>

          <Panel label="Season" className="flex flex-col gap-4.5 [--edge:var(--color-line-mid)]">
            <SectionHead
              compact
              num="03"
              end={
                <Button
                  variant="ghost"
                  size="mono"
                  onClick={() =>
                    setEditing(
                      editing
                        ? null
                        : {
                            name: s.name,
                            description: s.description,
                            startsAt: `${toBrt(s.startsAt).date}T${toBrt(s.startsAt).time}`,
                            endsAt: `${toBrt(s.endsAt).date}T${toBrt(s.endsAt).time}`,
                            xpPerLevel: String(s.xpPerLevel),
                            premiumPrice: s.premiumPrice === null ? '' : String(s.premiumPrice),
                            formats: s.formats,
                            premiumOmegaPass: s.premiumOmegaPass,
                          },
                    )
                  }
                >
                  {editing ? 'Cancel' : 'Edit'}
                </Button>
              }
            >
              Season
            </SectionHead>
            {editing ? (
              <div className="flex flex-col gap-4">
                <Field label="Name" htmlFor="se-name">
                  <TextInput id="se-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </Field>
                <Field label="Description" htmlFor="se-desc">
                  <TextArea id="se-desc" rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                </Field>
                <Field label="Starts (BRT)" htmlFor="se-start">
                  <TextInput id="se-start" type="datetime-local" value={editing.startsAt} onChange={(e) => setEditing({ ...editing, startsAt: e.target.value })} />
                </Field>
                <Field label="Ends (BRT)" htmlFor="se-end">
                  <TextInput id="se-end" type="datetime-local" value={editing.endsAt} onChange={(e) => setEditing({ ...editing, endsAt: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="XP per level" htmlFor="se-xp">
                    <TextInput id="se-xp" inputMode="numeric" value={editing.xpPerLevel} onChange={(e) => setEditing({ ...editing, xpPerLevel: e.target.value })} />
                  </Field>
                  <Field label="Premium price" htmlFor="se-price">
                    <TextInput
                      id="se-price"
                      inputMode="numeric"
                      prefix={<Coin className="h-4 w-3.5" />}
                      placeholder="Not sold"
                      value={editing.premiumPrice}
                      onChange={(e) => setEditing({ ...editing, premiumPrice: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="XP from">
                  <div role="group" aria-label="Formats" className="flex gap-1.5">
                    {FORMATS.map((f) => (
                      <FilterChip
                        key={f}
                        label={f}
                        pressed={editing.formats.includes(f)}
                        onClick={() => setEditing({ ...editing, formats: editing.formats.includes(f) ? editing.formats.filter((x) => x !== f) : [...editing.formats, f] })}
                      />
                    ))}
                  </div>
                </Field>
                <Switch
                  checked={editing.premiumOmegaPass}
                  onChange={(premiumOmegaPass) => setEditing({ ...editing, premiumOmegaPass })}
                  label="Omega pass unlocks premium"
                />
                <div className="flex gap-3">
                  <Button
                    size="mono-md"
                    className="flex-1"
                    disabled={busy}
                    onClick={() =>
                      act(
                        updatePassSeason(code, {
                          name: editing.name,
                          description: editing.description,
                          startsAt: brtLocal(editing.startsAt) ?? undefined,
                          endsAt: brtLocal(editing.endsAt) ?? undefined,
                          xpPerLevel: Number(editing.xpPerLevel),
                          premiumPrice: editing.premiumPrice.trim() ? Number(editing.premiumPrice) : null,
                          formats: editing.formats,
                          premiumOmegaPass: editing.premiumOmegaPass,
                        }),
                        'Season saved',
                        () => setEditing(null),
                      )
                    }
                  >
                    Save season
                  </Button>
                  <Button
                    variant="danger-outline"
                    size="mono-md"
                    disabled={busy || s.stats.claims > 0}
                    onClick={() => deletePassSeason(code).then(() => router.push('/admin/battlepass'), (e) => setNotice({ tone: 'negative', title: 'Not deleted', body: panelErrorText(e) }))}
                  >
                    Delete
                  </Button>
                </div>
                {s.stats.claims > 0 ? <span className="text-ink-muted caption">Someone already claimed a reward: turn it off instead of deleting.</span> : null}
              </div>
            ) : (
              <dl className="flex flex-col">
                {[
                  ['Window', `${dayTime(s.startsAt)} → ${dayTime(s.endsAt)}`],
                  ['XP from', s.formats.join(', ') || 'Nothing'],
                  ['XP per level', count(s.xpPerLevel)],
                  ['Omega pass', s.premiumOmegaPass ? 'Unlocks premium' : 'Doesn’t unlock premium'],
                  ['Premium on the site', s.premiumPrice === null ? 'Not sold' : `${count(s.premiumPrice)} DP`],
                ].map(([label, value]) => (
                  <div key={label} className="flex min-h-9.5 items-center gap-3 border-t border-line">
                    <dt className="flex-1 text-ink-muted signal-sm">{label}</dt>
                    <dd className="text-right text-sm text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <Switch
              checked={s.active}
              disabled={busy}
              onChange={(active) => act(updatePassSeason(code, { active }), active ? 'Season is visible' : 'Season is hidden')}
              label="Visible and claimable"
              hint={premiumLabel(s) === 'Not available' ? 'Premium isn’t available on this season.' : undefined}
            />
          </Panel>
        </div>
      </div>

      <Dialog
        size="sm"
        open={level !== null}
        onClose={() => setLevel(null)}
        title={<>Level <span className="text-ink">{level?.level}</span></>}
        footer={
          <>
            <Button variant="ghost" size="mono-md" onClick={() => setLevel(null)}>Cancel</Button>
            <Button size="mono-md" onClick={saveLevel}>Save level</Button>
          </>
        }
      >
        {level ? (
          <div className="flex flex-col gap-4.5">
            <Field label="XP to reach" htmlFor="lv-xp" hint={`Total XP. Empty: linear, ${count(level.level * linearFrom)}.`}>
              <TextInput id="lv-xp" inputMode="numeric" placeholder={String(level.level * linearFrom)} value={level.xp} onChange={(e) => setLevel({ ...level, xp: e.target.value })} />
            </Field>
            {(['free', 'premium'] as BattlepassTrack[]).map((t) => (
              <div key={t} className="grid grid-cols-[minmax(0,1fr)_90px] items-end gap-3">
                <Field label={t === 'free' ? 'Free reward' : 'Premium reward'}>
                  <Select block aria-label={`${t} reward`} value={level[t].itemId} onChange={(e) => setLevel({ ...level, [t]: { ...level[t], itemId: e.target.value } })} options={itemOptions} />
                </Field>
                <Field label="Qty" htmlFor={`lv-qty-${t}`}>
                  <TextInput id={`lv-qty-${t}`} inputMode="numeric" value={level[t].qty} onChange={(e) => setLevel({ ...level, [t]: { ...level[t], qty: e.target.value } })} />
                </Field>
              </div>
            ))}
            <span className="text-ink-muted caption">Qty above 1 only for a currency item. Removing a reward someone claimed fails: they keep it.</span>
          </div>
        ) : null}
      </Dialog>
    </>
  )
}
