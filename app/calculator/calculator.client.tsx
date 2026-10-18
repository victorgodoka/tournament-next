'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Select, TextInput } from '@ui/field'
import { PageHeader } from '@ui/page-header'
import { useCardCache } from '@app/deck-builder/use-card-cache'
import { subjectCopies } from '@utils/combo/atoms'
import { distinctCards } from '@utils/combo/deck-cards'
import { rolesFromTags } from '@utils/combo/roles'
import { encodeShare } from '@utils/combo/share'
import { getDeck } from '@utils/decks'
import { getBanlists, type Banlist } from '@utils/wiki'
import { bootState, type Boot } from './boot'
import { calculatorReducer, initialState } from './calculator.reducer'
import { CardRoles } from './card-roles'
import { HandBuilder } from './hand-builder'
import { DrawSettings, FocusPanel } from './results'
import { useCalculation } from './use-calculation'

const TOUCH = 'max-lg:min-h-11'

type Toast = { tone: 'positive' | 'negative' | 'warn'; text: string }

/** Boots from the URL once, client only, then hands over to the loaded calculator. */
const Calculator = () => {
  const t = useTranslations('Calculator')
  const [boot, setBoot] = useState<Boot | null>(null)
  useEffect(() => {
    let live = true
    bootState(window.location.search).then((b) => {
      if (live) setBoot(b)
    })
    return () => {
      live = false
    }
  }, [])
  if (!boot) {
    return (
      <p role="status" className="mx-auto w-[min(1280px,calc(100%-32px))] pt-8 text-ink-muted body">
        {t('loading')}
      </p>
    )
  }
  return <Loaded boot={boot} />
}

const Loaded = ({ boot }: { boot: Boot }) => {
  const t = useTranslations('Calculator')
  const [state, dispatch] = useReducer(calculatorReducer, boot.calc, (calc) => initialState(calc))
  const [notice, setNotice] = useState(boot.notice)
  /** `null` while loading; `[]` when the API failed (getBanlists swallows the error). */
  const [banlists, setBanlists] = useState<Banlist[] | null>(null)
  /** The saved deck named by the link: its roles, format and revision. */
  const [meta, setMeta] = useState<'idle' | 'loading' | 'failed'>(boot.deckId ? 'loading' : 'idle')
  const [metaAttempt, setMetaAttempt] = useState(0)
  const [toast, setToast] = useState<Toast | null>(null)
  /** The clipboard refused: the link shows in a field to copy by hand. */
  const [copyFallback, setCopyFallback] = useState<string | null>(null)
  const { cards, failed, ensure } = useCardCache()
  const build = state.calc.builds[0]!
  const banlist = banlists?.find((b) => (build.format === null ? b.format === 'tcg' : b.id === build.format)) ?? null
  const allIds = useMemo(
    () => [...build.deck.main, ...build.deck.extra, ...build.deck.side, ...state.original.main],
    [build.deck.main, build.deck.extra, build.deck.side, state.original.main],
  )
  const view = useCalculation(build, state.original, cards, state.calc.analysis, state.calc.draw, state.calc.focus)
  /** Copies in the loaded deck by canonical id: what a what-if row is compared against. */
  const originalCopies = useMemo(() => new Map(distinctCards(state.original.main, cards).map((r) => [r.id, r.copies])), [state.original.main, cards])
  const nameOf = (id: number) => {
    const row = view.rows.find((r) => r.id === id)
    return row?.card?.name ?? cards.get(id)?.name ?? String(row?.passcode ?? id)
  }
  const [lookupAttempt, setLookupAttempt] = useState(0)

  useEffect(() => {
    ensure(allIds).catch(() => {})
  }, [allIds, ensure, lookupAttempt])

  useEffect(() => {
    getBanlists().then(setBanlists)
  }, [])

  useEffect(() => {
    const id = boot.deckId
    if (!id) return
    let live = true
    getDeck(id).then(
      async (saved) => {
        if (!live) return
        if (!saved) return setMeta('failed')
        const known = await ensure([...saved.main, ...saved.extra, ...saved.side]).catch(() => new Map())
        if (!live) return
        dispatch({ type: 'deckMeta', deckId: saved.id, format: saved.format, roles: rolesFromTags(saved.tags, known), saved: { revision: saved.revision, ownerId: saved.ownerId } })
        setMeta('idle')
      },
      () => live && setMeta('failed'),
    )
    return () => {
      live = false
    }
  }, [boot.deckId, metaAttempt, ensure])

  // The address bar is always the share link.
  useEffect(() => {
    const timer = setTimeout(() => {
      encodeShare(state.calc).then(
        (code) => window.history.replaceState(null, '', `/calculator?c=${code}`),
        () => {},
      )
    }, 300)
    return () => clearTimeout(timer)
  }, [state.calc])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const copyLink = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setCopyFallback(null)
      setToast({ tone: 'positive', text: t('copied') })
    } catch {
      setCopyFallback(url)
    }
  }

  const subjects = { roles: view.palette, cards: view.rows, nameOf }
  const error = 'error' in view.result ? view.result.error : null
  /** Roles a rule names that no card in the deck carries: the rule can never pass. */
  const unusedRoles = useMemo(() => {
    const unused = new Set<string>()
    for (const hand of state.calc.analysis.hands)
      for (const rule of hand.rules) if (rule.subject.kind === 'role' && subjectCopies(view.rows, build.roles, rule.subject) === 0) unused.add(rule.subject.role)
    return unused
  }, [state.calc.analysis.hands, view.rows, build.roles])

  return (
    <div className="mx-auto flex w-[min(1280px,calc(100%-32px))] flex-col gap-8 pt-8 pb-24">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        end={
          <>
            <Button variant="secondary" className={TOUCH}>
              {t('pickDeck')}
            </Button>
            <Button onClick={() => void copyLink()} className={TOUCH}>
              {t('copyLink')}
            </Button>
          </>
        }
      />

      {notice ? (
        <Alert
          tone="warn"
          edged
          title={t(notice)}
          action={
            <Button variant="ghost" size="sm" onClick={() => setNotice(null)} className={TOUCH}>
              {t('dismiss')}
            </Button>
          }
        />
      ) : null}
      {meta === 'failed' ? (
        <Alert
          tone="negative"
          edged
          title={t('deckRolesUnavailable')}
          action={
            <Button variant="secondary" size="sm" onClick={() => (setMeta('loading'), setMetaAttempt((n) => n + 1))} className={TOUCH}>
              {t('retry')}
            </Button>
          }
        />
      ) : null}
      {failed.size ? (
        <Alert
          tone="warn"
          edged
          title={t('lookupFailed')}
          action={
            <Button variant="secondary" size="sm" onClick={() => setLookupAttempt((n) => n + 1)} className={TOUCH}>
              {t('retry')}
            </Button>
          }
        />
      ) : null}
      {copyFallback ? (
        <Alert tone="info" edged title={t('copyFailed')}>
          <TextInput readOnly value={copyFallback} mono onFocus={(e) => e.target.select()} plateClassName="mt-2" />
        </Alert>
      ) : null}

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <div className="order-2 flex flex-col gap-6 lg:order-1">
          <div className="flex flex-wrap items-center gap-2">
            <TextInput
              value={build.name}
              onChange={(e) => dispatch({ type: 'rename', name: e.target.value })}
              placeholder={t('untitled')}
              aria-label={t('deckName')}
              maxLength={80}
              plateClassName={twMerge('min-w-0 flex-1 basis-48', TOUCH)}
            />
            <Select
              banlist
              aria-label={t('deck.format')}
              options={(banlists ?? []).map((b) => ({ value: String(b.id), label: b.name }))}
              value={banlist ? String(banlist.id) : ''}
              onChange={(e) => dispatch({ type: 'setFormat', format: Number(e.target.value) })}
              disabled={!banlists?.length}
              className={twMerge('min-w-44', TOUCH)}
            />
          </div>
          <CardRoles
            rows={view.rows}
            roles={build.roles}
            palette={view.palette}
            originalCopies={originalCopies}
            banlist={banlist}
            notDrawn={build.deck.extra.length + build.deck.side.length}
            onToggle={(id, role) => dispatch({ type: 'toggleRole', id, role })}
            onCopies={(id, copies, passcode) => dispatch({ type: 'setCopies', id, copies, passcode, cards })}
            onRestore={() => dispatch({ type: 'restoreDeck' })}
          />
          <HandBuilder
            analysis={state.calc.analysis}
            subjects={subjects}
            result={view.result}
            unusedRoles={unusedRoles}
            onAdd={(hand) => dispatch({ type: 'addHand', hand })}
            onRemove={(index) => dispatch({ type: 'removeHand', index })}
            onRename={(index, name) => dispatch({ type: 'renameHand', index, name })}
            onRule={(hand, index, rule) => dispatch({ type: 'setRule', hand, index, rule })}
            onAddRule={(hand) => dispatch({ type: 'addRule', hand, rule: { subject: { kind: 'role', role: view.palette[0] ?? 'Starter' }, min: 1, max: null } })}
            onRemoveRule={(hand, index) => dispatch({ type: 'removeRule', hand, index })}
          />
        </div>
        <div className="order-1 flex flex-col gap-6 lg:sticky lg:top-24 lg:order-2">
          <DrawSettings draw={state.calc.draw} deckSize={build.deck.main.length} onChange={(draw) => dispatch({ type: 'setDraw', draw })} />
          <FocusPanel
            subjects={subjects}
            focus={state.calc.focus}
            onFocus={(focus) => dispatch({ type: 'setFocus', focus })}
            dist={view.focusDist}
            copies={view.focusCopies}
            error={error}
          />
        </div>
      </div>

      {toast ? (
        <div className="fixed inset-x-4 top-[calc(var(--header-h,64px)+12px)] z-(--z-toast) mx-auto max-w-120 drop-shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
          <Alert
            tone={toast.tone}
            edged
            title={toast.text}
            action={
              <Button variant="ghost" size="sm" onClick={() => setToast(null)} className={TOUCH}>
                {t('dismiss')}
              </Button>
            }
          />
        </div>
      ) : null}
    </div>
  )
}

export default Calculator
