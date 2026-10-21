'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Alert } from '@ui/alert'
import { Button, buttonClasses } from '@ui/button'
import { Select, TextInput } from '@ui/field'
import { PageHeader } from '@ui/page-header'
import { tabPanelProps } from '@ui/tab-bar/tab-bar.component'
import { useCardCache } from '@app/deck-builder/use-card-cache'
import { useAuth } from '@hooks/index'
import { subjectCopies } from '@utils/combo/atoms'
import { distinctCards } from '@utils/combo/deck-cards'
import { rolesFromTags, sameRole, tagsFromRoles } from '@utils/combo/roles'
import { encodeShare } from '@utils/combo/share'
import { EFFECT_IDS } from '@utils/combo/types'
import { toYdke } from '@utils/deck/codecs/ydke'
import { DeckApiError, DeckConflictError, getDeck, updateDeck } from '@utils/decks'
import { setReturnTo } from '@utils/return-to'
import { getBanlists, type Banlist } from '@utils/wiki'
import { bootState, type Boot } from './boot'
import { BuildTabs } from './build-tabs'
import { calculatorReducer, initialState, type CalcAction } from './calculator.reducer'
import { Compare } from './compare'
import { DeckPicker } from './deck-picker'
import { HandBuilder } from './hand-builder'
import { OddsHeadline } from './odds-headline'
import { DrawSettings, FocusPanel } from './results'
import { Simulator } from './simulator'
import { Sweeps } from './sweeps'
import { TagBoard } from './tag-board'
import { suggestedRule } from './tags'
import { markTourSeen, Tour, tourAfter, tourSeen, type TourState } from './tour'
import { useCalculations } from './use-calculation'

const TOUCH = 'max-lg:min-h-11'

type Toast = { tone: 'positive' | 'negative' | 'warn'; text: string }
type SaveState = 'idle' | 'saving' | 'conflict' | 'rejected' | 'signIn' | 'failed'
/** What the picked deck becomes: the active build, or a new one. */
type Picker = 'replace' | 'add' | null

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
  const { user } = useAuth()
  const [state, dispatch] = useReducer(calculatorReducer, boot.calc, (calc) => initialState(calc))
  const [notice, setNotice] = useState(boot.notice)
  /** Nothing to compute yet: the picker opens by itself. */
  const [picker, setPicker] = useState<Picker>(boot.from === 'empty' && boot.calc.builds[0]!.deck.main.length === 0 ? 'replace' : null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  /** `null` while loading; `[]` when the API failed (getBanlists swallows the error). */
  const [banlists, setBanlists] = useState<Banlist[] | null>(null)
  /** The saved deck behind a builder link: its roles, format and revision are adopted. A share link only learns the revision. */
  const [meta, setMeta] = useState<'idle' | 'loading' | 'failed'>(boot.deckId && boot.from === 'builder' ? 'loading' : 'idle')
  const [metaAttempt, setMetaAttempt] = useState(0)
  const [toast, setToast] = useState<Toast | null>(null)
  /** The clipboard refused: the link shows in a field to copy by hand. */
  const [copyFallback, setCopyFallback] = useState<string | null>(null)
  /** The hands-on tour opens by itself on a first visit with a deck; the board's `?` brings it back. */
  const [tour, setTour] = useState<TourState>(() => (boot.calc.builds[0]!.deck.main.length > 0 && !tourSeen() ? { step: 1, paints: 0 } : null))
  const { cards, failed, ensure } = useCardCache()
  const build = state.calc.builds[state.active]!
  const original = state.originals[state.active]!
  const saved = state.saved[state.active] ?? null
  const banlist = banlists?.find((b) => (build.format === null ? b.format === 'tcg' : b.id === build.format)) ?? null
  // The five draw-effect cards ride along, so the simulator can name the ones a deck lacks.
  const allIds = useMemo(
    () => [...state.calc.builds.flatMap((b) => [...b.deck.main, ...b.deck.extra, ...b.deck.side]), ...state.originals.flatMap((o) => o.main), ...EFFECT_IDS],
    [state.calc.builds, state.originals],
  )
  const views = useCalculations(state.calc.builds, state.originals, cards, state.calc.analysis, state.calc.draw, state.calc.focus)
  const view = views[state.active]!
  /** Copies in the loaded deck by canonical id: what a what-if row is compared against. */
  const originalCopies = useMemo(() => new Map(distinctCards(original.main, cards).map((r) => [r.id, r.copies])), [original.main, cards])
  const nameOf = (id: number) => {
    const row = view.rows.find((r) => r.id === id)
    return row?.card?.name ?? cards.get(id)?.name ?? String(row?.passcode ?? id)
  }
  const [lookupAttempt, setLookupAttempt] = useState(0)
  /** `any.p` as the last paint stroke began, for 4 s: what the headline's arrow measures from. */
  const [baseline, setBaseline] = useState<number | null>(null)
  const baselineTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(baselineTimer.current), [])
  const onPainted = () => {
    if ('error' in view.result) return
    setBaseline(view.result.any.p)
    clearTimeout(baselineTimer.current)
    baselineTimer.current = setTimeout(() => setBaseline(null), 4000)
  }
  /** An action that changes which build or deck is shown: the baseline was measured on the old one. */
  const showBuild = (action: CalcAction) => {
    clearTimeout(baselineTimer.current)
    setBaseline(null)
    dispatch(action)
  }

  useEffect(() => {
    ensure(allIds).catch(() => {})
  }, [allIds, ensure, lookupAttempt])

  useEffect(() => {
    getBanlists().then(setBanlists)
  }, [])

  /**
   * Reads the saved deck behind `id`. `adopt`: take its format and roles too (a builder link, or Reload after a
   * conflict) and report a failure; otherwise only its revision and owner, silently (a share link is complete
   * on its own, and the viewer may not be allowed to read the deck). The reducer drops a reply no build points at.
   */
  const readSaved = useCallback(
    (id: string, adopt: boolean) =>
      getDeck(id).then(
        async (result) => {
          if (!result) {
            if (adopt) setMeta('failed')
            return
          }
          const info = { revision: result.revision, ownerId: result.ownerId }
          if (!adopt) return dispatch({ type: 'setSaved', deckId: result.id, saved: info })
          const known = await ensure([...result.main, ...result.extra, ...result.side]).catch(() => new Map())
          dispatch({ type: 'deckMeta', deckId: result.id, format: result.format, roles: rolesFromTags(result.tags, known), saved: info })
          setMeta('idle')
        },
        (error: unknown) => {
          if (!adopt) return
          console.error(error)
          setMeta('failed')
        },
      ),
    [ensure],
  )

  /** Every saved deck a share link's builds point at. */
  const bootDeckIds = useMemo(() => [...new Set(boot.calc.builds.flatMap((b) => (b.deckId ? [b.deckId] : [])))], [boot.calc.builds])

  useEffect(() => {
    if (boot.from === 'builder') {
      if (boot.deckId) void readSaved(boot.deckId, true)
      return
    }
    // A share link's decks are read only for a signed-in viewer (the owner is the one who can save roles).
    if (!user) return
    for (const id of bootDeckIds) void readSaved(id, false)
  }, [boot.deckId, boot.from, bootDeckIds, metaAttempt, readSaved, user])

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

  /** The signed-in user owns the saved deck behind the active build: roles can be written back to it. */
  const owner = saved !== null && user?.id === saved.ownerId
  const canSave = build.deckId !== null && owner

  const saveRoles = async () => {
    if (!build.deckId || !saved || saveState === 'saving') return
    setSaveState('saving')
    try {
      // Tags are keyed by the saved deck's own prints: the what-if copies never decide what is written.
      const result = await updateDeck(build.deckId, { tags: tagsFromRoles(build.roles, original, cards) }, saved.revision)
      dispatch({ type: 'setSaved', deckId: result.id, saved: { revision: result.revision, ownerId: result.ownerId } })
      setSaveState('idle')
      setToast({ tone: 'positive', text: t('save.saved') })
    } catch (e) {
      if (e instanceof DeckConflictError) setSaveState('conflict')
      else if (e instanceof DeckApiError && e.status === 400) setSaveState('rejected')
      else if (e instanceof DeckApiError && e.status === 401) setSaveState('signIn')
      else {
        console.error(e)
        setSaveState('failed')
      }
    }
  }

  /** After a conflict: the deck the build came from, as it is now, roles merged, revision fresh. */
  const reloadDeck = () => {
    if (!build.deckId) return
    setSaveState('idle')
    setMeta('loading')
    void readSaved(build.deckId, true)
  }

  const builderHref = (() => {
    if (build.deckId && owner) return `/deck-builder/${build.deckId}`
    try {
      return `/deck-builder?d=${encodeURIComponent(toYdke(build.deck))}&name=${encodeURIComponent(build.name)}`
    } catch {
      return '/deck-builder'
    }
  })()

  const subjects = { roles: view.palette, cards: view.rows, nameOf }
  const error = 'error' in view.result ? view.result.error : null
  /** Roles a rule names that no card in the active build carries: the rule can never pass there. */
  const unusedRoles = useMemo(() => {
    const unused = new Set<string>()
    for (const hand of state.calc.analysis.hands)
      for (const rule of hand.rules) if (rule.subject.kind === 'role' && subjectCopies(view.rows, build.roles, rule.subject) === 0) unused.add(rule.subject.role)
    return unused
  }, [state.calc.analysis.hands, view.rows, build.roles])

  /** A tag's suggested rule joins every hand that has no rule on it yet; with no hands, it starts one. */
  const suggest = (role: string) => {
    const rule = suggestedRule(role)
    if (!rule) return
    const hands = state.calc.analysis.hands
    if (!hands.length) return dispatch({ type: 'addHand', hand: { name: '', rules: [rule] } })
    hands.forEach((hand, i) => {
      if (!hand.rules.some((r) => r.subject.kind === 'role' && sameRole(r.subject.role, role))) dispatch({ type: 'addRule', hand: i, rule })
    })
  }

  return (
    <div className="mx-auto flex w-[min(1280px,calc(100%-32px))] flex-col gap-8 pt-8 pb-24">
      <PageHeader
        eyebrow={t('eyebrow')}
        title={t('title')}
        end={
          <>
            <Link href={builderHref} className={twMerge(buttonClasses({ variant: 'secondary' }), TOUCH)}>
              {t('openBuilder')}
            </Link>
            <Button variant="secondary" onClick={() => setPicker('replace')} className={TOUCH}>
              {t('pickDeck')}
            </Button>
            <Button onClick={() => void copyLink()} className={TOUCH}>
              {t('copyLink')}
            </Button>
          </>
        }
      />
      {/* Fixed on screen, so its place here only sets the tab order: Skip and Next come before the board, not after the Simulator. */}
      {tour ? (
        <Tour
          state={tour}
          onBack={() => setTour({ step: tour.step - 1, paints: 0 })}
          onNext={() => setTour({ step: tour.step + 1, paints: 0 })}
          onClose={() => (markTourSeen(), setTour(null))}
        />
      ) : null}
      <DeckPicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        lookup={ensure}
        onPick={(b, s) => {
          showBuild(picker === 'add' ? { type: 'addBuild', build: b, saved: s } : { type: 'load', build: b, saved: s, cards })
          if (tour === null && !tourSeen() && b.deck.main.length > 0) setTour({ step: 1, paints: 0 })
        }}
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

      <BuildTabs
        builds={state.calc.builds}
        active={state.active}
        onSelect={(index) => showBuild({ type: 'setActive', index })}
        onAdd={() => setPicker('add')}
        onDuplicate={() => showBuild({ type: 'duplicateBuild', name: t('builds.copyOf', { name: build.name || t('builds.untitled', { n: state.active + 1 }) }) })}
        onRemove={() => showBuild({ type: 'removeBuild', index: state.active })}
      />

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <div {...tabPanelProps('calc-build', String(state.active))} className="order-2 flex flex-col gap-6 lg:order-1">
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
            {canSave ? (
              <Button variant="secondary" aria-disabled={saveState === 'saving' || undefined} onClick={() => void saveRoles()} className={TOUCH}>
                {saveState === 'saving' ? t('save.saving') : t('save.roles')}
              </Button>
            ) : null}
          </div>
          {saveState === 'conflict' ? (
            <Alert
              tone="warn"
              edged
              title={t('save.changed')}
              action={
                <Button variant="secondary" size="sm" onClick={reloadDeck} className={TOUCH}>
                  {t('save.reload')}
                </Button>
              }
            />
          ) : saveState === 'rejected' || saveState === 'failed' ? (
            <Alert tone="negative" edged title={t(`save.${saveState}`)} action={<Button variant="ghost" size="sm" onClick={() => setSaveState('idle')} className={TOUCH}>{t('dismiss')}</Button>} />
          ) : saveState === 'signIn' ? (
            <Alert
              tone="info"
              edged
              title={t('save.signIn')}
              action={
                <Link href="/login" onClick={() => setReturnTo(location.pathname + location.search)} className={twMerge(buttonClasses({ size: 'sm' }), TOUCH)}>
                  {t('picker.signIn')}
                </Link>
              }
            />
          ) : null}
          <TagBoard
            rows={view.rows}
            roles={build.roles}
            palette={view.palette}
            hands={state.calc.analysis.hands}
            originalCopies={originalCopies}
            banlist={banlist}
            notDrawn={build.deck.extra.length + build.deck.side.length}
            onSetRole={(id, role, on) => dispatch({ type: 'setRole', id, role, on })}
            onToggle={(id, role) => dispatch({ type: 'toggleRole', id, role })}
            onCopies={(id, copies, passcode) => dispatch({ type: 'setCopies', id, copies, passcode, cards })}
            onRestore={() => dispatch({ type: 'restoreDeck' })}
            onSuggest={suggest}
            onPainted={onPainted}
            onTour={(event) => setTour((s) => tourAfter(s, event))}
            onHelp={() => setTour({ step: 1, paints: 0 })}
          />
          <div data-tour="hands">
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
          {state.calc.builds.length > 1 ? <Compare builds={state.calc.builds} hands={state.calc.analysis.hands} results={views.map((v) => v.result)} /> : null}
          <Sweeps rows={view.rows} roles={build.roles} analysis={state.calc.analysis} draw={state.calc.draw} banlist={banlist} focus={state.calc.focus} nameOf={nameOf} />
          <Simulator
            rows={view.rows}
            roles={build.roles}
            analysis={state.calc.analysis}
            draw={state.calc.draw}
            effects={state.calc.effects}
            extraSize={build.deck.extra.length}
            seed={state.calc.seed}
            result={view.result}
            nameOf={nameOf}
            onSeed={(seed) => dispatch({ type: 'setSeed', seed })}
            onToggleEffect={(id) => dispatch({ type: 'toggleEffect', id })}
            onBanish={(card, count) => dispatch({ type: 'setBanish', card, count })}
          />
        </div>
        <div className="order-1 flex flex-col gap-6 lg:sticky lg:top-24 lg:order-2">
          <OddsHeadline result={view.result} hasHands={state.calc.analysis.hands.length > 0} baseline={baseline} />
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
