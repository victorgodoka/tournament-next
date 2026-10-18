'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Chip } from '@ui/chip'
import { Select, TextInput } from '@ui/field'
import { Panel } from '@ui/panel'
import type { Evaluation, EvaluateError } from '@utils/combo/evaluate'
import { LIMITS, subjectKey, type Analysis, type Hand, type Rule } from '@utils/combo/types'
import { Fraction, parseSubject, percent, subjectOptions, type Subjects } from './results'

const TOUCH = 'max-lg:min-h-11'

const role = (name: string, min: number, max: number | null = null): Rule => ({ subject: { kind: 'role', role: name }, min, max })

/** One-click starts for an empty analysis, each one hand. */
const PRESETS: { key: 'starter' | 'starterTrap' | 'starterTrapNoBrick'; hand: Hand }[] = [
  { key: 'starter', hand: { name: '', rules: [role('Starter', 1)] } },
  { key: 'starterTrap', hand: { name: '', rules: [role('Starter', 1), role('Hand Trap', 1)] } },
  { key: 'starterTrapNoBrick', hand: { name: '', rules: [role('Starter', 1), role('Hand Trap', 1), role('Brick', 0, 0)] } },
]

type HandBuilderProps = {
  analysis: Analysis
  subjects: Subjects
  result: Evaluation | EvaluateError
  /** Roles a rule names that no card carries. */
  unusedRoles: ReadonlySet<string>
  onAdd(hand?: Hand): void
  onRemove(index: number): void
  onRename(index: number, name: string): void
  onRule(hand: number, index: number, rule: Rule): void
  onAddRule(hand: number): void
  onRemoveRule(hand: number, index: number): void
}

/** The playable hands (OR) and their rules (AND), each hand's odds beside it, the union in the header. */
export const HandBuilder = (p: HandBuilderProps) => {
  const t = useTranslations('Calculator')
  const format = useFormatter()
  const evaluation = 'error' in p.result ? null : p.result
  const options = subjectOptions(p.subjects)

  return (
    <Panel
      title={t('hands.title')}
      meta={
        evaluation ? (
          <span className="flex flex-wrap items-baseline gap-2">
            <span>{t('hands.any')}</span>
            <span className="text-ink data">{percent(evaluation.any.p, format)}</span>
            <Fraction odds={evaluation.any} />
          </span>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {'error' in p.result ? <Alert tone="warn" edged title={t(`results.${p.result.error}`)} /> : null}

        {p.analysis.hands.length === 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-ink-muted signal-sm">{t('hands.presets')}</span>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <Button key={preset.key} variant="secondary" size="sm" onClick={() => p.onAdd(preset.hand)} className={TOUCH}>
                  {t(`hands.preset.${preset.key}`)}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {p.analysis.hands.map((hand, h) => {
              const odds = evaluation?.hands[h]?.odds
              return (
                <li key={h} className="flex flex-col gap-3 border-b border-line pb-4 last:border-b-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <TextInput
                      value={hand.name}
                      onChange={(e) => p.onRename(h, e.target.value)}
                      placeholder={t('hands.name', { n: h + 1 })}
                      aria-label={t('hands.rename')}
                      maxLength={LIMITS.handName}
                      plateClassName={`min-w-0 flex-1 basis-40 ${TOUCH}`}
                    />
                    {odds ? (
                      <span className="flex items-baseline gap-2">
                        <span className="text-ink stat-sm">{percent(odds.p, format)}</span>
                        <Fraction odds={odds} />
                      </span>
                    ) : null}
                    <Button variant="ghost" size="sm" aria-label={t('hands.remove')} onClick={() => p.onRemove(h)} className={TOUCH}>
                      {t('hands.remove')}
                    </Button>
                  </div>

                  {hand.rules.length === 0 ? <p className="text-ink-muted body-sm">{t('hands.noRules')}</p> : null}
                  <ul className="flex flex-col gap-2">
                    {hand.rules.map((rule, i) => (
                      <li key={i} className="flex flex-wrap items-center gap-2">
                        <Select
                          aria-label={t('hands.subject')}
                          options={options}
                          value={subjectKey(rule.subject)}
                          onChange={(e) => {
                            const subject = parseSubject(e.target.value)
                            if (subject) p.onRule(h, i, { ...rule, subject })
                          }}
                          className={`min-w-0 flex-1 basis-48 ${TOUCH}`}
                        />
                        <TextInput
                          type="number"
                          inputMode="numeric"
                          aria-label={t('hands.min')}
                          prefix={t('hands.min')}
                          min={LIMITS.rule[0]}
                          max={LIMITS.rule[1]}
                          value={rule.min}
                          onChange={(e) => p.onRule(h, i, { ...rule, min: Number(e.target.value) || 0 })}
                          plateClassName={`w-28 min-w-0 ${TOUCH}`}
                        />
                        <TextInput
                          type="number"
                          inputMode="numeric"
                          aria-label={t('hands.max')}
                          prefix={t('hands.max')}
                          placeholder="∞"
                          min={rule.min}
                          max={LIMITS.rule[1]}
                          value={rule.max ?? ''}
                          onChange={(e) => {
                            const raw = e.target.value.trim()
                            p.onRule(h, i, { ...rule, max: raw === '' ? null : Math.max(rule.min, Number(raw) || 0) })
                          }}
                          plateClassName={`w-28 min-w-0 ${TOUCH}`}
                        />
                        {rule.subject.kind === 'role' && p.unusedRoles.has(rule.subject.role) ? <Chip tone="gold">{t('hands.unusedRole')}</Chip> : null}
                        <Button variant="ghost" size="icon-sm" aria-label={t('hands.removeRule')} onClick={() => p.onRemoveRule(h, i)} className={TOUCH}>
                          ×
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <Button variant="secondary" size="sm" onClick={() => p.onAddRule(h)} className={`self-start ${TOUCH}`}>
                    {t('hands.addRule')}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}

        <Button variant="secondary" size="sm" onClick={() => p.onAdd()} className={`self-start ${TOUCH}`}>
          {t('hands.add')}
        </Button>
      </div>
    </Panel>
  )
}
