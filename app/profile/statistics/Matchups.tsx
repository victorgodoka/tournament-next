'use client'

/** 03 Matchups: against each opponent deck, next to an average pilot; every deck you played or one of them. */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { AdBanner } from '@omega/ads/ad-banner'
import { Art, Label, n, NARROW, NUMERIC, pc, SelectBox, signed, Small, tone, WIDE } from '@app/statistics/kit'
import { OTHER_OPPONENT, type PlayerAnswer, type PlayerOpponent } from '@utils/statistics'
import { GapHeads } from './MyDecks'
import { Verdict } from './Overview'
import { GapLine } from './tracks'
import { gap, readOf } from './view'

const PANEL = 'cut notch [--cut:var(--cut-lg)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-100)]'
const COLS = 'minmax(260px,1.5fr) 80px 80px 88px minmax(240px,1.6fr) 72px 152px'
const RANGE = 20
const ALL = ''

export const Matchups = ({ data, name, face }: { data: PlayerAnswer; name: (key: string) => string; face: (key: string) => number | null }) => {
  const t = useTranslations('PlayerStatistics.my.matchups')
  const [deck, setDeck] = useState(ALL)
  const rows = (data.opponents ?? []).filter((o) => o.deck === (deck || null))
  const label = (o: PlayerOpponent) => (o.opponent === OTHER_OPPONENT ? t('other') : name(o.opponent))
  const art = (o: PlayerOpponent) => (o.opponent === OTHER_OPPONENT ? null : face(o.opponent))
  const note = (o: PlayerOpponent) =>
    o.opponent === OTHER_OPPONENT
      ? t('rogue', { n: o.rogue ?? 0 })
      : o.mirrors
        ? t('mirrors', { n: o.mirrors })
        : o.share !== null
          ? t('share', { share: pc(o.share) })
          : ''

  return (
    <>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 max-[719px]:flex-col max-[719px]:items-stretch">
        <div className="flex flex-[1_1_420px] flex-col gap-1.5 max-[719px]:flex-none max-[719px]:gap-1">
          <h2 className="m-0 font-display text-[32px] leading-[1.05] text-ink uppercase max-[719px]:text-[26px]">{t('title')}</h2>
          <p className={`m-0 text-ink-dim ${WIDE}`}>{t('lede')}</p>
          <p className={`m-0 text-sm leading-[22px] text-ink-dim ${NARROW}`}>{t('ledeShort')}</p>
        </div>
        <div className="flex w-70 flex-col gap-2 max-[719px]:w-full">
          <Label htmlFor="p-mydeck">{t('playing')}</Label>
          <SelectBox id="p-mydeck" value={deck} onChange={setDeck} options={[{ value: ALL, label: t('all') }, ...data.decks.map((d) => ({ value: d.key, label: name(d.key) }))]} />
        </div>
      </div>

      <div className={`${PANEL} pt-1 max-[719px]:pt-0.5`}>
        {rows.length ? (
          <>
            <div className={`overflow-x-auto ${WIDE}`}>
              <div role="table" aria-label={t('table')} className="grid min-w-240 gap-px bg-line">
                <GapHeads first={t('opponent')} cols={COLS} />
                {rows.map((o) => {
                  const g = gap(o.performance)
                  return (
                    <div key={o.opponent} role="row" className="grid min-h-14.5 items-center bg-surface-100 transition-colors duration-[120ms] ease-out hover:bg-surface-300" style={{ gridTemplateColumns: COLS }}>
                      <span role="cell" className="flex min-w-0 items-center gap-3 pl-6">
                        <Art id={art(o)} name={label(o)} size={36} />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-bold text-ink">{label(o)}</span>
                          <Small className="truncate">{note(o)}</Small>
                        </span>
                      </span>
                      <span role="cell" className={`text-ink-dim ${NUMERIC}`}>{n(o.games)}</span>
                      <span role="cell" className={`font-bold text-ink ${NUMERIC}`}>{g ? pc(g.you) : '–'}</span>
                      <span role="cell" className={`text-gold ${NUMERIC}`}>{g ? pc(g.exp) : '–'}</span>
                      <span role="cell" className="mx-5 block">
                        {g ? <GapLine gap={g.gap} lo={g.lo} hi={g.hi} read={readOf(o.performance)} range={RANGE} size="opponent" /> : null}
                      </span>
                      <span role="cell" className={twMerge('font-bold', NUMERIC, g ? tone(g.gap) : 'text-draw')}>{g ? signed(g.gap) : '–'}</span>
                      <span role="cell" className="flex justify-end pr-6"><Verdict slice={o.performance} /></span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div role="list" className={`grid gap-px bg-line ${NARROW}`}>
              {rows.map((o) => {
                const g = gap(o.performance)
                return (
                  <div key={o.opponent} role="listitem" className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 bg-surface-100 px-4 py-3.5">
                    <Art id={art(o)} name={label(o)} size={36} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-bold text-ink">{label(o)}</span>
                      <Small>{g ? <>{pc(g.you)} vs <span className="text-gold">{pc(g.exp)}</span> · {t('games', { n: n(o.games) })}</> : t('games', { n: n(o.games) })}</Small>
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <span className={twMerge('font-bold tabular-nums', g ? tone(g.gap) : 'text-draw')}>{g ? signed(g.gap) : '–'}</span>
                      <Verdict slice={o.performance} short />
                    </span>
                    {g ? <GapLine gap={g.gap} lo={g.lo} hi={g.hi} read={readOf(o.performance)} range={RANGE} size="list" className="col-span-2 col-start-2" /> : null}
                    <Small className="col-span-2 col-start-2 truncate">{note(o)}</Small>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <p className="m-0 px-6 py-5 text-ink-dim">{t('empty')}</p>
        )}
        <div className="border-t border-line px-6 py-3.5 max-[719px]:px-4 max-[719px]:py-3">
          <Small className={WIDE}>{t('note')}</Small>
          <Small className={NARROW}>{t('noteShort')}</Small>
        </div>
      </div>

      <AdBanner id="ad-profile-matchups" placement="content" className="mx-auto w-full max-w-[970px]" />
    </>
  )
}
