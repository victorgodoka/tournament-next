'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { deckHref, families, familyWeeks, plainDecks, shareMoves, weekJumps, type DeckStat, type Family, type Meta, type Scope, type ShareWeek } from '@utils/statistics'
import { Art, Box, facesOf, GoldDot, subFace, type Faces, HEAD_ROW, LocalTime, NARROW, NUMERIC, pc, ReadChip, ROW, ROWS, SectionHead, signed, Small, Spark, TH, tone, WIDE } from '../kit'
import { nameOf } from '../shared'

const TOP = 12
const SPAN = 8
const COLS = '56px minmax(220px, 1.2fr) 140px 96px minmax(240px, 1.4fr) 120px'
const M_COLS = '20px 36px minmax(0, 1fr) 64px 56px'

type Line = { key: string; name: string; face?: number | null; href: string; share: number; values: number[]; delta: number | null }

/** The last `SPAN` weeks of one key's share, 0 where it had no games; the move is the last week against the one before. */
const lineOf = (key: string, name: string, face: number | null | undefined, href: string, share: number, weeks: ShareWeek[], window: number[]): Line => {
  const by = new Map(weeks.filter((w) => w.key === key).map((w) => [w.week, w.share]))
  const last = window.at(-1)
  const prev = window.at(-2)
  const delta = last !== undefined && prev !== undefined && by.has(last) && by.has(prev) ? by.get(last)! - by.get(prev)! : null
  return { key, name, face, href, share, values: window.map((w) => by.get(w) ?? 0), delta }
}

const Caret = ({ open, size }: { open: boolean; size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="currentColor" className={open ? 'rotate-90' : undefined}><path d="M9 6l6 6-6 6z" /></svg>
)

const Triangle = ({ up }: { up: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden fill="currentColor"><path d={up ? 'M12 4l8 10H4z' : 'M12 20L4 10h16z'} /></svg>
)

/** Who is on the ladder and which way it is moving. */
export const WhatYouFace = ({ meta, scope }: { meta: Meta; scope: Scope }) => {
  const t = useTranslations('Statistics.face')
  const locale = useLocale()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const fams = families(meta.decks)
  const faces = facesOf(meta.decks)
  const top = fams.slice(0, TOP)
  const famWeeks = familyWeeks(meta.weeks, fams)
  const lastWeek = Math.max(0, ...meta.weeks.map((w) => w.week))
  const window = Array.from({ length: Math.min(SPAN, lastWeek) }, (_, i) => lastWeek - Math.min(SPAN, lastWeek) + 1 + i)
  const plain = new Map(plainDecks(meta.decks).map((d) => [d.key, d]))
  const familyLine = ({ family, members }: Family) =>
    lineOf(family.key, nameOf(family), family.face ?? members[0]?.face, deckHref((members[0] ?? family).key, scope), family.share, famWeeks, window)
  const memberLine = (d: DeckStat) => lineOf(d.key, nameOf(d), d.face, deckHref(d.key, scope), d.share, meta.weeks, window)
  const sparkLabel = (l: Line) => t('sparkLabel', { name: l.name, weeks: window.length, from: pc(l.values[0] ?? 0), to: pc(l.values.at(-1) ?? 0) })
  const delta = (d: number | null) => (d === null ? '–' : t('pts', { value: signed(d * 100) }))
  const color = (d: number | null) => (d === null ? 'text-ink-muted' : tone(d * 100))

  // a versao abaixo do share minimo do formato (o mesmo piso do tier) nao entra no grupo; sem as regras do build, todas
  const minShare = meta.fit.tiers?.minShare ?? 0
  const lines = top.map((f) => ({ line: familyLine(f), kids: f.members.length > 1 ? f.members.filter((m) => m.share >= minShare).map(memberLine) : [] }))
  const lastShare = new Map(famWeeks.filter((w) => w.week === lastWeek).map((w) => [w.key, w.share]))
  const { risers, fallers } = shareMoves(famWeeks, 3)
  const byFamily = new Map(fams.map((f) => [f.family.key, f]))
  const moved = risers.concat(fallers).reduce((m, x) => m.set(x.key, x.delta), new Map<string, number>())
  const jumps = weekJumps(meta.weeks.filter((w) => plain.has(w.key)))
  const prevRate = new Map(meta.weeks.filter((w) => w.week === lastWeek - 1).map((w) => [w.key, w.wrExpected]))
  const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' })
  const toggle = (key: string) => setOpen((o) => ({ ...o, [key]: !o[key] }))
  // the last week still filling: its share moves are against a few days, not a week
  const lastDay = meta.weeks.find((w) => w.week === lastWeek)?.firstDay
  const swept = meta.season?.sweptThrough
  const sofar = lastDay && swept ? Math.round((Date.parse(swept.slice(0, 10)) - Date.parse(lastDay)) / 86_400_000) + 1 : 7
  const partial = sofar < 7 ? t('partial', { days: sofar }) : null
  const link = (l: Line, className: string) => <Link href={l.href} className={twMerge('truncate hover:text-cyan', className)}>{l.name}</Link>

  if (!top.length) {
    return (
      <>
        <SectionHead title={t('title')} lede={t('lede', { count: TOP })} />
        <p className="text-[13px] leading-5 text-ink-muted">{t('empty')}</p>
      </>
    )
  }

  const versions = (key: string, count: number, size: 'md' | 'sm') => (
    <button
      type="button"
      aria-expanded={!!open[key]}
      onClick={() => toggle(key)}
      className={twMerge(
        'cut inline-flex cursor-pointer items-center gap-1.5 text-ink-dim signal-sm [--cut:var(--cut-xs)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-200)] hover:text-ink hover:[--fill:var(--color-surface-300)]',
        size === 'md' ? 'h-7 px-2.5' : 'h-6.5 px-2',
      )}
    >
      <Caret open={!!open[key]} size={size === 'md' ? 12 : 10} />
      {t('versions', { count })}
    </button>
  )

  const moveList = (list: { key: string; delta: number }[]) =>
    list.map(({ key }) => {
      const fam = byFamily.get(key)!
      const l = familyLine(fam)
      const d = moved.get(key)!
      return { l, d, now: lastShare.get(key) ?? fam.family.share }
    })

  return (
    <>
      <SectionHead
        title={t('title')}
        lede={<><span className={WIDE}>{t('lede', { count: top.length })}</span><span className={NARROW}>{t('ledeShort', { count: top.length, weeks: window.length })}</span></>}
        stamp={<span className={WIDE}>{t.rich('stamp', { weeks: window.length, time: () => <LocalTime iso={meta.fit.builtAt} locale={locale} /> })}</span>}
      />

      <Box className="pt-1 max-[719px]:pt-0.5">
        <div className={twMerge('overflow-x-auto', WIDE)}>
          <div role="table" aria-label={t('aria')} className={twMerge(ROWS, 'min-w-[720px]')}>
            <div role="row" className={HEAD_ROW} style={{ gridTemplateColumns: COLS }}>
              <span role="columnheader" className={twMerge(TH, 'pl-6')}>#</span>
              <span role="columnheader" className={TH}>{t('cols.deck')}</span>
              <span role="columnheader" className={TH}>{t('cols.versions')}</span>
              <span role="columnheader" className={twMerge(TH, 'text-right')}>{t('cols.meta')}</span>
              <span role="columnheader" className={twMerge(TH, 'pl-8')}>{t('cols.weeks', { count: window.length })}</span>
              <span role="columnheader" className={twMerge(TH, 'pr-6 text-right')}>{t('cols.delta')}</span>
            </div>
            {lines.map(({ line, kids }, i) => (
              <div key={line.key} className="contents">
                <div role="row" className={twMerge(ROW, 'min-h-13')} style={{ gridTemplateColumns: COLS }}>
                  <span role="cell" className="pl-6 font-display text-lg text-ink-muted">{i + 1}</span>
                  <span role="cell" className="flex min-w-0 items-center gap-3">
                    <Art id={line.face} name={line.name} size={36} />
                    {link(line, 'font-bold text-ink')}
                  </span>
                  <span role="cell">{kids.length ? versions(line.key, kids.length, 'md') : null}</span>
                  <span role="cell" className={twMerge(NUMERIC, 'font-bold text-ink')}>{pc(line.share)}</span>
                  <span role="cell" className="flex items-center pl-8"><Spark values={line.values} width={200} height={28} label={sparkLabel(line)} /></span>
                  <span role="cell" className={twMerge(NUMERIC, 'pr-6 text-[13px] font-bold', color(line.delta))}>{delta(line.delta)}</span>
                </div>
                {open[line.key]
                  ? kids.map((k) => (
                      <div key={k.key} role="row" className="grid min-h-11 items-center bg-surface-200" style={{ gridTemplateColumns: COLS }}>
                        <span role="cell" />
                        <span role="cell" className="flex min-w-0 items-center gap-2.5 text-sm text-ink-dim">
                          <span aria-hidden className="-mt-2 size-3 flex-none border-b border-l border-line-mid" />
                          <Art id={k.face} sub={subFace(k.key, faces)} name={k.name} size={28} />
                          {link(k, '')}
                        </span>
                        <span role="cell" />
                        <span role="cell" className={twMerge(NUMERIC, 'text-ink-dim')}>{pc(k.share)}</span>
                        <span role="cell" className="flex items-center pl-8"><Spark values={k.values} width={200} height={28} label={sparkLabel(k)} minor /></span>
                        <span role="cell" className={twMerge(NUMERIC, 'pr-6 text-[13px]', color(k.delta))}>{delta(k.delta)}</span>
                      </div>
                    ))
                  : null}
              </div>
            ))}
          </div>
        </div>

        <div role="list" aria-label={t('aria')} className={twMerge(ROWS, NARROW)}>
          {lines.map(({ line, kids }, i) => (
            <div key={line.key} className="contents">
              <div role="listitem" className="grid items-center gap-x-2.5 gap-y-1 bg-surface-100 px-4 py-3" style={{ gridTemplateColumns: M_COLS }}>
                <span className="font-display text-[15px] text-ink-muted">{i + 1}</span>
                <Art id={line.face} name={line.name} size={36} />
                <span className="flex min-w-0 flex-col items-start gap-0.5">
                  {link(line, 'max-w-full font-bold text-ink')}
                  {kids.length ? versions(line.key, kids.length, 'sm') : null}
                </span>
                <Spark values={line.values} width={64} height={24} label={sparkLabel(line)} />
                <span className="flex flex-col items-end">
                  <span className="font-bold text-ink tabular-nums">{pc(line.share)}</span>
                  <span className={twMerge('text-xs leading-4 font-bold tabular-nums', color(line.delta))}>{delta(line.delta)}</span>
                </span>
              </div>
              {open[line.key]
                ? kids.map((k) => (
                    <div key={k.key} role="listitem" className="grid items-center gap-x-2.5 gap-y-1 bg-surface-200 px-4 py-2.5" style={{ gridTemplateColumns: M_COLS }}>
                      <span />
                      <Art id={k.face} sub={subFace(k.key, faces)} name={k.name} size={28} className="justify-self-end" />
                      {link(k, 'text-sm text-ink-dim')}
                      <Spark values={k.values} width={64} height={20} label={sparkLabel(k)} minor />
                      <span className="flex flex-col items-end">
                        <span className="text-sm text-ink-dim tabular-nums">{pc(k.share)}</span>
                        <span className={twMerge('text-xs leading-4 tabular-nums', color(k.delta))}>{delta(k.delta)}</span>
                      </span>
                    </div>
                  ))
                : null}
            </div>
          ))}
        </div>

        <div className={twMerge('border-t border-line px-6 py-3.5', WIDE)}>
          <span className="text-[13px] leading-5 text-ink-muted">{t('note')}{partial ? ` ${partial}` : null}</span>
        </div>
      </Box>

      {/* Wide: three cards. Narrow: rising and falling share one. */}
      <div className={twMerge('grid items-stretch gap-6 grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]', WIDE)}>
        {([['risers', risers, true], ['fallers', fallers, false]] as const).map(([id, list, up]) => (
          <Box key={id} className="gap-3.5 p-6">
            <span className="flex items-center gap-1.5 text-ink signal-strong"><Triangle up={up} />{t(id)}</span>
            {list.length ? moveList(list).map(({ l, d, now }) => (
              <div key={l.key} className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
                <span className="flex min-w-0 items-center gap-3"><Art id={l.face} name={l.name} size={28} />{link(l, 'font-bold text-ink')}</span>
                <span className="text-[13px] leading-5 whitespace-nowrap text-ink-dim"><strong className={tone(d * 100)}>{delta(d)}</strong> · {t('now', { share: pc(now) })}</span>
              </div>
            )) : <span className="border-t border-line pt-3 text-[13px] leading-5 text-ink-muted">{t('noMoves')}</span>}
          </Box>
        ))}
        <ChangedCard jumps={jumps} plain={plain} prevRate={prevRate} day={day} scope={scope} faces={faces} />
      </div>
      <div className={twMerge('flex flex-col gap-4', NARROW)}>
        <Box className="gap-3 p-5">
          {([['risers', risers, true], ['fallers', fallers, false]] as const).map(([id, list, up]) => (
            <div key={id} className="contents">
              <span className={twMerge('flex items-center gap-1.5 text-ink signal-strong', !up && 'mt-2')}><Triangle up={up} />{t(id)}</span>
              {list.length ? moveList(list).map(({ l, d, now }) => (
                <div key={l.key} className="flex items-center gap-2.5 border-t border-line pt-2.5">
                  <Art id={l.face} name={l.name} size={28} />
                  {link(l, 'flex-auto font-bold text-ink')}
                  <span className="text-[13px] whitespace-nowrap"><strong className={tone(d * 100)}>{delta(d)}</strong> · {pc(now)}</span>
                </div>
              )) : <Small className="border-t border-line pt-2.5">{t('noMoves')}</Small>}
            </div>
          ))}
          {partial ? <Small className="border-t border-line pt-2.5">{partial}</Small> : null}
        </Box>
        <ChangedCard jumps={jumps} plain={plain} prevRate={prevRate} day={day} scope={scope} faces={faces} narrow />
      </div>
    </>
  )
}

type ChangedProps = {
  jumps: ReturnType<typeof weekJumps>
  plain: Map<string, DeckStat>
  prevRate: Map<string, number>
  day: (iso: string) => string
  scope: Scope
  faces: Faces
  narrow?: boolean
}

/** Decks whose strength moved past noise this week, with the expected rate before and after. */
const ChangedCard = ({ jumps, plain, prevRate, day, scope, faces, narrow }: ChangedProps) => {
  const t = useTranslations('Statistics.face')
  return (
    <Box className={narrow ? 'gap-3 p-5' : 'gap-3.5 p-6'}>
      <div className="flex items-center gap-2.5">
        <GoldDot />
        <span className="text-ink signal-strong">{t('jumps')}</span>
      </div>
      {jumps.length ? jumps.map((w) => {
        const deck = plain.get(w.key)!
        const before = prevRate.get(w.key)
        const up = w.jump > 0
        return (
          <div key={w.key} className={twMerge('flex flex-col gap-1.5 border-t border-line', narrow ? 'pt-2.5' : 'pt-3')}>
            <div className={twMerge('flex items-center gap-3', !narrow && 'justify-between', narrow && 'gap-2.5')}>
              <span className={twMerge('flex min-w-0 items-center gap-3', narrow && 'flex-auto gap-2.5')}>
                <Art id={deck.face} sub={subFace(deck.key, faces)} name={nameOf(deck)} size={28} />
                <Link href={deckHref(deck.key, scope)} className="truncate font-bold text-ink hover:text-cyan">{nameOf(deck)}</Link>
              </span>
              <ReadChip read={up ? 'good' : 'bad'}>{t(up ? 'stronger' : 'weaker')}{before !== undefined ? ` ${signed((w.wrExpected - before) * 100)}` : ''}</ReadChip>
            </div>
            <span className={narrow ? 'text-xs leading-4 font-medium text-ink-muted' : 'text-[13px] leading-5 text-ink-dim'}>
              {before !== undefined ? t('jumpDetail', { from: pc(before), to: pc(w.wrExpected), date: day(w.firstDay) }) : t('jumpDetailNew', { to: pc(w.wrExpected), date: day(w.firstDay) })}
            </span>
          </div>
        )
      }) : <span className={twMerge('border-t border-line text-[13px] leading-5 text-ink-muted', narrow ? 'pt-2.5' : 'pt-3')}>{t('noJumps')}</span>}
      <p className="m-0 text-xs leading-4 font-medium text-ink-muted">{narrow ? t('jumpsNoteShort') : t('jumpsNote')}</p>
    </Box>
  )
}
