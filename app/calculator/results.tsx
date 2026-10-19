'use client'

import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { Alert } from '@ui/alert'
import { Chip } from '@ui/chip'
import { Segmented } from '@ui/choice'
import { Field, Select, TextInput } from '@ui/field'
import { Panel } from '@ui/panel'
import { StatGrid, type Stat } from '@ui/stat-grid'
import type { DeckCard } from '@utils/combo/deck-cards'
import { drawCount, type EvaluateError } from '@utils/combo/evaluate'
import { atLeast, type Odds } from '@utils/combo/hypergeometric'
import { LIMITS, subjectKey, type Draw, type Subject } from '@utils/combo/types'

const TOUCH = 'max-lg:min-h-11'

export const percent = (p: number, format: ReturnType<typeof useFormatter>): string => format.number(p, { style: 'percent', maximumFractionDigits: 2 })

/** `favorable / total`, every digit exact. */
export const Fraction = ({ odds }: { odds: Odds }) => {
  const locale = useLocale()
  const digits = new Intl.NumberFormat(locale)
  return (
    <span className="text-ink-muted data">
      {digits.format(odds.favorable)} / {digits.format(odds.total)}
    </span>
  )
}

/** What the subject selects name: every role, then every distinct card. */
export type Subjects = { roles: string[]; cards: DeckCard[]; nameOf(id: number): string }

export const subjectOptions = (subjects: Subjects): { value: string; label: string }[] => [
  ...subjects.roles.map((role) => ({ value: subjectKey({ kind: 'role', role }), label: role })),
  ...subjects.cards.map((card) => ({ value: subjectKey({ kind: 'card', id: card.id }), label: subjects.nameOf(card.id) })),
]

export const parseSubject = (key: string): Subject | null =>
  key.startsWith('role:') ? { kind: 'role', role: key.slice(5) } : key.startsWith('card:') ? { kind: 'card', id: Number(key.slice(5)) } : null

const number = (value: string): number | null => (value.trim() === '' ? null : Number(value))

type DrawSettingsProps = { draw: Draw; deckSize: number; onChange(d: Partial<Draw>): void }

export const DrawSettings = ({ draw, deckSize, onChange }: DrawSettingsProps) => {
  const t = useTranslations('Calculator')
  return (
    <Panel title={t('draw.title')} meta={<Chip tone="cyan">{t('draw.total', { n: drawCount(draw), deck: deckSize })}</Chip>}>
      <div className="flex flex-col gap-4">
        <Field label={t('draw.going')}>
          <Segmented
            label={t('draw.going')}
            value={draw.going}
            onChange={(going) => onChange({ going })}
            options={[
              { value: 'first', label: t('draw.first') },
              { value: 'second', label: t('draw.second') },
            ]}
            className="max-lg:[&>button]:min-h-11"
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t('draw.handSize')} htmlFor="calc-hand-size" hint={t('draw.handSizeHint')}>
            <TextInput
              id="calc-hand-size"
              type="number"
              inputMode="numeric"
              min={LIMITS.handSize[0]}
              max={LIMITS.handSize[1]}
              value={draw.handSize ?? ''}
              onChange={(e) => onChange({ handSize: number(e.target.value) })}
              aria-label={t('draw.handSize')}
              plateClassName={TOUCH}
            />
          </Field>
          <Field label={t('draw.extraDraws')} htmlFor="calc-extra-draws">
            <TextInput
              id="calc-extra-draws"
              type="number"
              inputMode="numeric"
              min={LIMITS.extraDraws[0]}
              max={LIMITS.extraDraws[1]}
              value={draw.extraDraws}
              onChange={(e) => onChange({ extraDraws: number(e.target.value) ?? 0 })}
              aria-label={t('draw.extraDraws')}
              plateClassName={TOUCH}
            />
          </Field>
          <Field label={t('draw.turn')} htmlFor="calc-turn">
            <TextInput
              id="calc-turn"
              type="number"
              inputMode="numeric"
              min={LIMITS.turn[0]}
              max={LIMITS.turn[1]}
              value={draw.turn}
              onChange={(e) => onChange({ turn: number(e.target.value) ?? 1 })}
              aria-label={t('draw.turn')}
              plateClassName={TOUCH}
            />
          </Field>
        </div>
      </div>
    </Panel>
  )
}

type FocusPanelProps = {
  subjects: Subjects
  focus: Subject | null
  onFocus(s: Subject | null): void
  dist: Odds[] | null
  copies: number
  error: EvaluateError['error'] | null
}

/** One card or role: at least 1, at least 2, none, and every exact count. */
export const FocusPanel = ({ subjects, focus, onFocus, dist, copies, error }: FocusPanelProps) => {
  const t = useTranslations('Calculator')
  const format = useFormatter()
  const stat = (label: string, odds: Odds): Stat => ({ label, value: percent(odds.p, format), hint: <Fraction odds={odds} /> })
  return (
    <Panel title={t('results.focus')} meta={focus ? t('results.copiesInDeck', { count: copies }) : undefined}>
      <div className="flex flex-col gap-4">
        <Select
          block
          aria-label={t('results.focus')}
          options={[{ value: '', label: t('results.pickSubject') }, ...subjectOptions(subjects)]}
          value={focus ? subjectKey(focus) : ''}
          onChange={(e) => onFocus(parseSubject(e.target.value))}
          className={TOUCH}
        />
        {error ? (
          <Alert tone="warn" edged title={t(`results.${error}`)} />
        ) : dist === null ? (
          <p className="text-ink-muted body">{t('results.pickSubject')}</p>
        ) : (
          <>
            <StatGrid columns={3} items={[stat(t('results.atLeast1'), atLeast(dist, 1)), stat(t('results.atLeast2'), atLeast(dist, 2)), stat(t('results.none'), dist[0]!)]} />
            <ul className="flex flex-col divide-y divide-line">
              {dist.map((odds, k) => (
                <li key={k} className="flex flex-wrap items-baseline gap-x-3 py-1.5">
                  <span className="min-w-28 text-ink-muted signal-sm">{t('results.exactly', { k })}</span>
                  <span className="text-ink data">{percent(odds.p, format)}</span>
                  <span className="ml-auto">
                    <Fraction odds={odds} />
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Panel>
  )
}
