'use client'

import { useTranslations } from 'next-intl'
import { useLayoutEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from '@ui/button'
import { TextInput } from '@ui/field'
import { LIMITS, START_LP } from '@utils/simulator/types'
import type { Side } from '@utils/simulator/types'
import { TOUCH } from './toolbar'

/** What a tap changes the Life Points by. */
const QUICK = [-1000, -500, 500, 1000]
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
const ROLL_MS = 600

const signed = (n: number) => (n > 0 ? `+${n}` : `−${-n}`)

type LifePlateProps = {
  side: Side
  lp: number
  /** A replay is playing or targets are being picked: the plate only shows. */
  disabled?: boolean
  onChange(delta: number): void
  className?: string
}

/**
 * A duelist's Life Points: the number in Anton over a bar that drains from 8000. The player's plate is the page's one
 * steel surface. A click opens what changes them: nothing here checks a rule, the player says how much.
 */
export const LifePlate = ({ side, lp, disabled = false, onChange, className }: LifePlateProps) => {
  const t = useTranslations('SimulatorNew')
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const plate = useRef<HTMLDivElement>(null)
  const shown = useRef(lp)
  const mine = side === 'me'
  const label = t(mine ? 'life.you' : 'life.rival')
  const typed = Number(amount.replace('−', '-'))
  const valid = Number.isInteger(typed) && typed !== 0 && Math.abs(typed) <= LIMITS.lp

  // The digits roll to the new number and the difference rises off the plate, written to the DOM as the field's effects are.
  useLayoutEffect(() => {
    const from = shown.current
    shown.current = lp
    const el = plate.current
    if (!el || from === lp || !matchMedia('(prefers-reduced-motion: no-preference)').matches) return
    el.querySelector('.sim-lp')?.animate({ '--lp': [from, lp] }, { duration: ROLL_MS, easing: EASE })
    const word = document.createElement('span')
    word.className = `sim-delta stat ${lp < from ? 'text-loss' : 'text-win'}`
    word.textContent = signed(lp - from)
    el.append(word)
    word.animate(
      [
        { offset: 0, transform: 'translateY(0)', opacity: 0 },
        { offset: 0.2, opacity: 1 },
        { offset: 1, transform: `translateY(${mine ? -56 : 56}px)`, opacity: 0 },
      ],
      { duration: ROLL_MS * 1.5, easing: EASE },
    ).onfinish = () => word.remove()
  }, [lp, mine])

  const apply = (delta: number) => {
    onChange(delta)
    setOpen(false)
    setAmount('')
  }
  return (
    <div
      ref={plate}
      className={twMerge('relative', className)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={t('life.edit', { side: label })}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={twMerge(
          'cut notch block w-full cursor-pointer px-3 pt-2 pb-2.5 text-left [--cut:var(--cut-md)] disabled:cursor-default',
          mine ? '[--edge:var(--color-steel-edge)] [--fill:var(--color-steel)]' : '[--edge:var(--color-line-mid)] [--fill:var(--color-surface-100)]',
        )}
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-ink-dim signal">{label}</span>
          <span style={{ '--lp': lp } as React.CSSProperties} className="sim-lp text-ink stat-lg">
            <span className="sr-only">{lp}</span>
          </span>
        </span>
        <span aria-hidden className="mt-1 block h-1 bg-space-000">
          <span style={{ width: `${Math.min(100, (lp / START_LP) * 100)}%` }} className="sim-life-bar block h-full bg-cyan" />
        </span>
      </button>
      {open ? (
        <div
          role="group"
          aria-label={t('life.edit', { side: label })}
          className={twMerge(
            'cut notch absolute z-10 flex w-64 flex-col gap-2 p-3 shadow-lift [--cut:var(--cut-md)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-200)] max-lg:left-0',
            mine ? 'bottom-full left-0 mb-2 max-lg:top-full max-lg:bottom-auto max-lg:mt-2 max-lg:mb-0' : 'top-full right-0 mt-2 max-lg:right-auto',
          )}
        >
          <div className="grid grid-cols-4 gap-1">
            {QUICK.map((delta) => (
              <Button key={delta} variant="secondary" size="mono" onClick={() => apply(delta)} className={twMerge('px-1', TOUCH)}>
                {signed(delta)}
              </Button>
            ))}
          </div>
          <div className="flex gap-1">
            <TextInput
              aria-label={t('life.amount')}
              placeholder={t('life.amount')}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && valid && apply(typed)}
              plateClassName={TOUCH}
            />
            <Button variant="secondary" size="mono" disabled={!valid} onClick={() => apply(typed)} className={TOUCH}>
              {t('life.apply')}
            </Button>
          </div>
          <Button variant="secondary" size="mono" disabled={lp === 0} onClick={() => apply(-Math.ceil(lp / 2))} className={TOUCH}>
            {t('life.half')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

/** The chain on screen, the first link on top. Nothing while there is none. */
export const ChainPlate = ({ names }: { names: string[] }) => {
  const t = useTranslations('SimulatorNew')
  if (!names.length) return null
  return (
    <div className="sim-chain cut notch flex flex-col gap-1.5 px-3 py-2 [--cut:var(--cut-md)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-100)]">
      <p className="text-ink-muted signal-sm">{t('chain.title')}</p>
      <ol aria-label={t('chain.title')} className="flex flex-col gap-1">
        {names.map((name, i) => (
          <li key={i} className="flex min-w-0 items-center gap-2 text-ink body-sm">
            <span aria-hidden className="sim-link">
              {i + 1}
            </span>
            <span className="truncate">{name}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
