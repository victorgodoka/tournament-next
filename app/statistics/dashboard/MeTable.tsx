'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Button } from '@ui/button'
import { Panel } from '@ui/panel'
import { signIn } from '@utils/auth'
import { deckHref, meVerdict, type PlayerDeck, type Scope } from '@utils/statistics'
import { Interval } from '../Interval'
import { nameOf, NOTE, NUM, num, pct, range, ROW } from '../shared'

const COLS = 'minmax(160px, 1.4fr) 64px minmax(160px, 1.4fr) minmax(160px, 1.4fr) 120px'
const HEAD = 'grid min-h-9 items-center gap-x-4 border-b border-line-mid bg-surface-200 px-4 text-ink-muted signal-sm'

/** One estimate with its range over the bar. */
const Rate = ({ value, lo, hi }: { value: number | null; lo: number | null; hi: number | null }) => (
  <span className="flex flex-col gap-1">
    <span className="font-mono text-xs"><b className="text-ink">{pct(value)}</b> · {range(lo, hi)}</span>
    {value != null && lo != null && hi != null ? <Interval lo={lo} hi={hi} value={value} /> : null}
  </span>
)

export const SignInPrompt = () => {
  const t = useTranslations('Statistics.me')
  return (
    <Panel title={t('title')}>
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-ink-dim body">{t('signIn')}</p>
        <Button size="sm" onClick={signIn}>{t('signInCta')}</Button>
      </div>
    </Panel>
  )
}

export const MeMessage = ({ text }: { text: 'empty' | 'failed' }) => {
  const t = useTranslations('Statistics.me')
  return <Panel title={t('title')}><p className={NOTE}>{t(text)}</p></Panel>
}

/** The viewer's rate per deck beside the ladder's with the same deck, both with intervals. */
export const MeTable = ({ decks, scope }: { decks: PlayerDeck[]; scope: Scope }) => {
  const t = useTranslations('Statistics.me')
  return (
    <Panel title={t('title')} meta={t('meta')}>
      <div className="flex flex-col gap-3">
        <div className="overflow-x-auto">
          <div role="table" aria-label={t('title')} className="min-w-[760px] border border-line">
            <div role="row" className={HEAD} style={{ gridTemplateColumns: COLS }}>
              <span>{t('cols.deck')}</span><span className={NUM}>{t('cols.games')}</span><span>{t('cols.you')}</span><span>{t('cols.ladder')}</span><span>{t('cols.verdict')}</span>
            </div>
            {decks.map((d) => {
              const verdict = meVerdict(d)
              return (
                <div key={d.key} role="row" className={twMerge(ROW, 'py-2')} style={{ gridTemplateColumns: COLS }}>
                  <span role="cell" className="truncate font-bold text-ink"><Link href={deckHref(d.key, scope)} className="hover:text-cyan">{nameOf(d)}</Link></span>
                  <span role="cell" className={NUM}>{num(d.games)}</span>
                  <span role="cell"><Rate value={d.wr} lo={d.wrLo} hi={d.wrHi} /></span>
                  <span role="cell"><Rate value={d.ladder?.wrExpected ?? null} lo={d.ladder?.wrLo ?? null} hi={d.ladder?.wrHi ?? null} /></span>
                  <span role="cell" className={twMerge('text-xs', verdict === 'above' ? 'text-win' : verdict === 'below' ? 'text-loss' : 'text-ink-muted')}>{verdict ? t(`verdicts.${verdict}`) : '—'}</span>
                </div>
              )
            })}
          </div>
        </div>
        <p className={NOTE}>{t('note')}</p>
      </div>
    </Panel>
  )
}
