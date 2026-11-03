import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { bestAgainst, deckHref, getDeck, plainDecks, type BestAgainst as Best, type DeckStat, type Meta, type Scope } from '@utils/statistics'
import { at, facesOf, n, nameOf, NARROW, pc, subFace, WIDE } from '../format'
import { Art, Box, DECK_NAME, GoldDot } from '../kit'

/** The contenders. Each is a request, and the API's limit is per IP, this server's here. */
const CONTENDERS = 8
const LO = 0.4
const HI = 0.7

/** The rate against one of the top 5: the bar from 40% on, the 50% line across it. */
const Line = ({ deck, wr, sub, narrow }: { deck: DeckStat; wr: number; sub: number | null; narrow?: boolean }) => (
  <div className="grid items-center gap-2.5 min-[720px]:gap-3" style={{ gridTemplateColumns: narrow ? '36px minmax(0, 1fr) 80px 48px' : 'minmax(0, 1fr) 120px 52px' }}>
    {narrow ? (
      <>
        <Art id={deck.face} sub={sub} name={nameOf(deck)} size={36} className="border-ink/25" />
        <span className={`${DECK_NAME} text-[13px] leading-4 text-ink`}>{nameOf(deck)}</span>
      </>
    ) : (
      <span className="flex min-w-0 items-center gap-2.5">
        <Art id={deck.face} sub={sub} name={nameOf(deck)} size={36} className="border-ink/25" />
        <span className={`${DECK_NAME} text-[13px] leading-5 text-ink`}>{nameOf(deck)} <span className="text-ink-dim">{pc(deck.share)}</span></span>
      </span>
    )}
    <span aria-hidden className="relative block h-1.5 bg-space-000/45">
      <span className="absolute -top-0.75 -bottom-0.75 left-1/3 w-px bg-ink-dim" />
      <span className="absolute top-0 bottom-0 left-0 rounded-r-xs bg-ink" style={{ width: at(wr, LO, HI) }} />
    </span>
    <span className="text-right text-[13px] leading-5 font-bold text-ink">{pc(wr)}</span>
  </div>
)

export const BestCard = async ({ best, decks, scope }: { best: Best; decks: DeckStat[]; scope: Scope }) => {
  const t = await getTranslations('Statistics.play.best')
  const deck = decks.find((d) => d.key === best.key)
  if (!deck) return null
  const byKey = new Map(decks.map((d) => [d.key, d]))
  const faces = facesOf(decks)
  const lines = best.opponents.flatMap(({ key, wr }) => (byKey.has(key) ? [{ deck: byKey.get(key)!, wr, sub: subFace(key, faces) }] : []))
  const sub = subFace(deck.key, faces)
  const name = <Link href={deckHref(deck.key, scope)} className="text-ink hover:text-cyan">{nameOf(deck)}</Link>
  return (
    <Box className="gap-4 p-6 [--edge:var(--color-steel)] [--fill:var(--color-steel)] max-[719px]:gap-3.5 max-[719px]:p-5">
      <div className="flex items-center gap-2.5 max-[719px]:gap-2">
        <GoldDot />
        <span className="text-ink signal">{t('title')}</span>
      </div>
      <div className={`flex items-end justify-between gap-4 ${WIDE}`}>
        <div className="flex min-w-0 items-center gap-4">
          <Art id={deck.face} sub={sub} name={nameOf(deck)} size={80} className="border-ink/35" />
          <h3 className={`m-0 ${DECK_NAME} font-display text-[32px] leading-[1.05] text-ink uppercase`}>{name}</h3>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-display text-[40px] leading-none text-ink">{pc(best.wr)}</span>
          <span className="text-ink-dim signal-sm">{t('vs', { games: n(best.games) })}</span>
        </div>
      </div>
      <div className={`flex items-center gap-3.5 ${NARROW}`}>
        <Art id={deck.face} sub={sub} name={nameOf(deck)} size={64} className="border-ink/35" />
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className={`m-0 ${DECK_NAME} font-display text-[26px] leading-[1.05] text-ink uppercase`}>{name}</h3>
          <span className="text-[13px] text-ink-dim">{t.rich('vsShort', { rate: pc(best.wr), games: n(best.games), b: (chunks) => <strong className="font-display text-xl font-normal text-ink">{chunks}</strong> })}</span>
        </div>
      </div>
      <div className={`flex flex-col gap-2.5 ${WIDE}`}>{lines.map((l) => <Line key={l.deck.key} {...l} />)}</div>
      <div className={`flex flex-col gap-3.5 ${NARROW}`}>{lines.map((l) => <Line key={l.deck.key} {...l} narrow />)}</div>
      <p className={`m-0 text-[13px] leading-5 text-ink-dim ${WIDE}`}>{t('note')}</p>
    </Box>
  )
}

/**
 * "Best against the top 5". The matchups aren't in `meta`: they come from the best tiered decks' own answers,
 * cached 5 minutes like it. Behind Suspense, so a cold scope doesn't hold the page; a refusal just drops the card.
 */
export const BestAgainst = async ({ meta, scope }: { meta: Meta; scope: Scope }) => {
  const decks = plainDecks(meta.decks)
  const contenders = decks.filter((d) => d.tier !== null).sort((a, b) => b.wrExpected - a.wrExpected).slice(0, CONTENDERS)
  const answers = await Promise.all(contenders.map((d) => getDeck(d.key, scope)))
  const best = bestAgainst(decks, answers.flatMap((a) => (a.ok ? a.data.matchups : [])))
  return best ? <BestCard best={best} decks={decks} scope={scope} /> : null
}
