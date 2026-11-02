'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Lookup, type LookupOption } from '@ui/lookup'
import { Panel } from '@ui/panel'
import { getDeck, plainDecks, type DeckAnswer, type Meta, type Scope } from '@utils/statistics'
import { AgainstList, MatchupList, SamplePanel, TurnOrder } from '../DeckBlocks'
import { nameOf, NOTE, num } from '../shared'

const TILES = 10
const OPTIONS = 20

/** Pick a deck, read its answer from the browser: only the viewer's picks spend the viewer's rate limit. */
export const HowToBeat = ({ meta, scope }: { meta: Meta; scope: Scope }) => {
  const t = useTranslations('Statistics.beat')
  const decks = useMemo(() => plainDecks(meta.decks).sort((a, b) => b.share - a.share), [meta.decks])
  const [key, setKey] = useState<string | null>(null)
  const [state, setState] = useState<{ key: string; deck: DeckAnswer } | 'failed' | null>(null)
  const latest = useRef<string | null>(null)

  const pick = (next: string) => {
    latest.current = next
    setKey(next)
    setState(null)
    getDeck(next, scope).then((r) => {
      if (latest.current === next) setState(r.ok ? { key: next, deck: r.data } : 'failed')
    })
  }

  const search = useCallback(
    async (text: string): Promise<LookupOption[]> => {
      const q = text.trim().toLowerCase()
      return decks.filter((d) => nameOf(d).toLowerCase().includes(q)).slice(0, OPTIONS).map((d) => ({ key: d.key, label: nameOf(d), meta: num(d.games) }))
    },
    [decks],
  )

  const answer = state && state !== 'failed' && state.key === key ? state.deck : null

  return (
    <div className="flex flex-col gap-4">
      <Panel title={t('title')}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 min-[720px]:grid-cols-5">
            {decks.slice(0, TILES).map((d) => (
              <button
                key={d.key}
                type="button"
                aria-pressed={key === d.key}
                onClick={() => pick(d.key)}
                className="cursor-pointer truncate border border-line bg-surface-200 px-3 py-2 text-left text-sm font-bold text-ink transition-colors hover:bg-surface-300 aria-pressed:border-cyan aria-pressed:bg-ground-cyan"
              >
                {nameOf(d)}
              </button>
            ))}
          </div>
          <Lookup label={t('search')} placeholder={t('search')} search={search} onPick={({ key: picked }) => pick(String(picked))} className="w-full max-w-64" />
          {!key ? <p className={NOTE}>{t('pick')}</p> : state === 'failed' ? <p role="status" className={NOTE}>{t('failed')}</p> : !answer ? <p role="status" className={NOTE}>{t('loading')}</p> : null}
        </div>
      </Panel>
      {answer ? (
        <>
          <MatchupList deck={answer.deck} matchups={answer.matchups} scope={scope} />
          <TurnOrder deck={answer.deck} />
          <AgainstList cards={answer.against} />
          {answer.sampleDeck ? <SamplePanel deck={answer.sampleDeck} /> : null}
        </>
      ) : null}
    </div>
  )
}
