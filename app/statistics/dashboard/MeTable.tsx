'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Button } from '@ui/button'
import { signIn } from '@utils/auth'
import { deckHref, meVerdict, type PlayerDeck, type Scope } from '@utils/statistics'
import { Art, at, Box, ci, subFace, HEAD_ROW, n, NARROW, NUMERIC, pc, ReadChip, ROW, ROWS, SectionHead, span, Small, TH, WIDE, type Read } from '../kit'
import { nameOf } from '../shared'

const COLS = 'minmax(200px, 1.2fr) 88px 140px 96px minmax(320px, 2.2fr) 176px'
const LO = 0.3
const HI = 0.8
const TICKS = [35, 45, 50, 55, 65, 75]

const READ = { above: 'good', below: 'bad', same: 'flat' } as const
const BAND: Record<Read, string> = { good: 'bg-win/35', bad: 'bg-loss/35', flat: 'bg-line-mid' }
const DOT: Record<Read, string> = { good: 'bg-win', bad: 'bg-loss', flat: 'bg-ink' }

const Head = ({ stamp }: { stamp?: React.ReactNode }) => {
  const t = useTranslations('Statistics.me')
  return <SectionHead title={t('title')} lede={<><span className={WIDE}>{t('lede')}</span><span className={NARROW}>{t('ledeShort')}</span></>} stamp={stamp} />
}

export const SignInPrompt = () => {
  const t = useTranslations('Statistics.me')
  return (
    <>
      <Head />
      <Box className="dots items-center gap-4 px-8 py-12 text-center">
        <Image src="/omega-mark.png" alt="" width={60} height={56} className="h-14 w-15 object-contain" />
        <h3 className="m-0 display-2 text-ink">{t('signedOutTitle')}</h3>
        <p className="m-0 max-w-120 text-ink-dim">{t('signIn')}</p>
        <Button size="signal" onClick={signIn} className="px-5">{t('signInCta')}</Button>
      </Box>
    </>
  )
}

export const MeMessage = ({ text }: { text: 'empty' | 'failed' }) => {
  const t = useTranslations('Statistics.me')
  return (
    <>
      <Head />
      <p className="text-[13px] leading-5 text-ink-muted">{t(text)}</p>
    </>
  )
}

/** You on the deck's track: your interval as a band, you as a square, the ladder's rate with it as a gold tick. */
const MeTrack = ({ d, read, h }: { d: PlayerDeck; read: Read; h: number }) => {
  const c = h / 2
  const big = h > 30
  return (
    <span aria-hidden className="relative block" style={{ height: h }}>
      <span className="absolute right-0 left-0 h-px bg-line" style={{ top: c }} />
      {d.wrLo != null && d.wrHi != null ? <span className={twMerge('absolute rounded-xs', BAND[read])} style={{ top: c - (big ? 4 : 4), height: big ? 9 : 8, left: at(d.wrLo, LO, HI), width: span(d.wrLo, d.wrHi, LO, HI) }} /> : null}
      {d.wr != null ? <span className={twMerge('absolute box-border border-2 border-space-000', DOT[read])} style={{ top: c - (big ? 6 : 6), width: big ? 13 : 12, height: big ? 13 : 12, marginLeft: -6, left: at(d.wr, LO, HI) }} /> : null}
      {d.ladder ? <span className="absolute -ml-px w-0.5 bg-gold" style={{ top: big ? c - 16 : 0, height: big ? 32 : h, left: at(d.ladder.wrExpected, LO, HI) }} /> : null}
    </span>
  )
}

/** The viewer's rate per deck beside the ladder's with the same deck. */
export const MeTable = ({ decks, scope, faces = {}, who = null, games = 0 }: { decks: PlayerDeck[]; scope: Scope; faces?: Record<string, number | null>; who?: string | null; games?: number }) => {
  const t = useTranslations('Statistics.me')
  const rows = decks.map((d) => {
    const verdict = meVerdict(d)
    return { d, read: verdict ? READ[verdict] : ('flat' as Read), verdict }
  })
  const verdictText = (v: ReturnType<typeof meVerdict>) => t(`verdicts.${v ?? 'same'}`)
  const tally = (['good', 'bad', 'flat'] as const).map((r) => ({ read: r, count: rows.filter((x) => x.read === r).length }))
  const link = (d: PlayerDeck, className: string) => <Link href={deckHref(d.key, scope)} className={twMerge('truncate font-bold text-ink hover:text-cyan', className)}>{nameOf(d)}</Link>
  const legendText = t.rich('legendText', {
    up: (c) => <span className="text-win">{c}</span>,
    down: (c) => <span className="text-loss">{c}</span>,
    flat: (c) => <span className="text-draw">{c}</span>,
  })
  const swatches = (
    <>
      <span className="flex items-center gap-2 text-ink-muted signal-sm max-[719px]:gap-1.5"><span aria-hidden className="size-2.75 bg-ink max-[719px]:size-2.5" />{t('legend.you')}</span>
      <span className="flex items-center gap-2 text-ink-muted signal-sm max-[719px]:gap-1.5"><span aria-hidden className="h-1.75 w-4.5 rounded-xs bg-line-mid max-[719px]:h-1.5 max-[719px]:w-4" />{t('legend.interval')}</span>
      <span className="flex items-center gap-2 text-ink-muted signal-sm max-[719px]:gap-1.5"><span aria-hidden className="h-3.5 w-0.5 bg-gold max-[719px]:h-3" /><span className={WIDE}>{t('legend.ladder')}</span><span className={NARROW}>{t('legend.ladderShort')}</span></span>
    </>
  )

  return (
    <>
      <Head stamp={who ? <><span className={WIDE}>{t('stamp', { name: who, games: n(games) })}</span><span className={NARROW}>{t('stampShort', { name: who, games: n(games) })}</span></> : undefined} />
      <div className="flex flex-wrap items-center gap-2.5">
        {tally.map(({ read, count }) => <ReadChip key={read} read={read}>{t(`summary.${read}`, { count })}</ReadChip>)}
        <Small>{t('summaryNote', { count: rows.length })}</Small>
      </div>
      <Box className="pt-1 max-[719px]:pt-0.5">
        <div className={twMerge('overflow-x-auto', WIDE)}>
          <div role="table" aria-label={t('aria')} className={twMerge(ROWS, 'min-w-[860px]')}>
            <div role="row" className={HEAD_ROW} style={{ gridTemplateColumns: COLS }}>
              <span role="columnheader" className={twMerge(TH, 'pl-6')}>{t('cols.deck')}</span>
              <span role="columnheader" className={twMerge(TH, 'text-right')}>{t('cols.games')}</span>
              <span role="columnheader" className={twMerge(TH, 'pl-6')}>{t('cols.you')}</span>
              <span role="columnheader" className={TH}>{t('cols.ladder')}</span>
              <span role="columnheader" aria-label={t('axis', { lo: 30, hi: 80 })} className="relative mx-3 block h-11">
                {TICKS.map((v) => <span key={v} className="absolute top-4 -translate-x-1/2 text-ink-muted signal-sm" style={{ left: at(v / 100, LO, HI) }}>{v}%</span>)}
              </span>
              <span role="columnheader" className={twMerge(TH, 'pr-6 text-right')}>{t('cols.verdict')}</span>
            </div>
            {rows.map(({ d, read, verdict }) => (
              <div key={d.key} role="row" className={twMerge(ROW, 'min-h-15')} style={{ gridTemplateColumns: COLS }}>
                <span role="cell" className="flex min-w-0 items-center gap-3 pl-6"><Art id={faces[d.key]} sub={subFace(d.key, faces)} name={nameOf(d)} size={36} />{link(d, '')}</span>
                <span role="cell" className={twMerge(NUMERIC, 'text-ink-dim')}>{n(d.games)}</span>
                <span role="cell" className="flex flex-col pl-6">
                  <span className="font-bold text-ink tabular-nums">{pc(d.wr)}</span>
                  <span className="tracking-[0.06em] text-ink-muted signal-sm">{d.wrLo != null && d.wrHi != null ? ci(d.wrLo, d.wrHi) : '–'}</span>
                </span>
                <span role="cell" className="text-ink-dim tabular-nums">{pc(d.ladder?.wrExpected)}</span>
                <span role="cell" className="mx-3"><MeTrack d={d} read={read} h={60} /></span>
                <span role="cell" className="flex justify-end pr-6"><ReadChip read={read}>{verdictText(verdict)}</ReadChip></span>
              </div>
            ))}
            <div role="row" className="flex flex-wrap items-center gap-x-7 gap-y-2.5 bg-surface-100 px-6 py-3.5">
              {swatches}
              <span className="flex-[1_1_360px] text-right text-xs leading-4 font-medium text-ink-muted">{legendText}</span>
            </div>
          </div>
        </div>

        <div role="list" aria-label={t('aria')} className={twMerge(ROWS, NARROW)}>
          {rows.map(({ d, read, verdict }) => (
            <div key={d.key} role="listitem" className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 bg-surface-100 px-4 py-3.5">
              <Art id={faces[d.key]} sub={subFace(d.key, faces)} name={nameOf(d)} size={36} />
              <span className="flex min-w-0 flex-col">
                {link(d, '')}
                <Small>{t('rowMeta', { you: pc(d.wr), ladder: pc(d.ladder?.wrExpected), games: n(d.games) })}</Small>
              </span>
              <ReadChip read={read}>{verdictText(verdict)}</ReadChip>
              <span className="col-[2/4]"><MeTrack d={d} read={read} h={18} /></span>
            </div>
          ))}
          <div className="flex flex-col gap-2 bg-surface-100 px-4 py-3.5">
            <span className="flex flex-wrap gap-x-4 gap-y-2">{swatches}</span>
            <Small>{legendText}</Small>
          </div>
        </div>
      </Box>
    </>
  )
}
