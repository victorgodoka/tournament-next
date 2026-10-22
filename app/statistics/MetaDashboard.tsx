'use client'

/**
 * MetaDashboard — the new competitive-analysis dashboard for /statistics.
 * Replaces the linear Report layout with a sidebar + sectioned content area.
 * The existing MetaStatistics and DeepDive sections are preserved and embedded
 * under the "archetype-analysis" and "card-search" anchors so nothing is lost.
 */

import { Fragment, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { Notice } from '@ui/notice'
import { Panel } from '@ui/panel'
import { Button } from '@ui/button'
import { Segmented } from '@ui/choice'
import { num, pct, nameOf } from './DeepDive'
import { DeepDiveSearch, PICKS, type DeepDiveRequest } from './DeepDiveSearch'
import { CardSearch } from './CardSearch'
import { DeepDive } from './DeepDive'
import { OmegaActivity } from './OmegaActivity'
import type { PastSeason, RankedLadderId } from '@utils/types'
import {
  archKey as utilsArchKey,
  type Statistics as StatType,
  type MostUsedCard,
  type StatisticsResult,
  type OmegaActivity as OmegaActivityData,
  type DeepDiveMode,
} from '@utils/statistics'

// Dashboard sub-components
import { DashboardSidebar, type NavSection } from './dashboard/DashboardSidebar'
import { DashboardHeader } from './dashboard/DashboardHeader'
import { MetaOverview } from './dashboard/MetaOverview'
import { MatchupMatrix } from './dashboard/MatchupMatrix'
import { DeckRanking } from './dashboard/DeckRanking'
import { SmartCardsSection } from './dashboard/SmartCardsSection'
import { DeckComparator } from './dashboard/DeckComparator'
import { ArchetypeDetailCard } from './dashboard/ArchetypeDetailCard'
import { MetaTrendsCard } from './dashboard/MetaTrendsCard'

const FORMAT: Record<RankedLadderId, string> = { tcg: 'TCG', genesys: 'Genesys' }

/** Scrolls to the section ref if it exists in the DOM. */
const scrollTo = (id: string) => {
  const el = document.getElementById(id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

type MetaDashboardProps = {
  ladder: RankedLadderId
  season?: string
  past: PastSeason[]
  result: StatisticsResult
  omega: OmegaActivityData | null
}

export const MetaDashboard = ({ ladder, season, past, result, omega }: MetaDashboardProps) => {
  const router = useRouter()
  const [pending, start] = useTransition()

  const data: StatType | null = result.ok ? result.data : null
  const format = FORMAT[ladder]

  // Navigation state
  const [activeSection, setActiveSection] = useState<NavSection>('overview')

  // Deep-dive state (preserved from MetaStatistics)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [remoteSeason, setRemoteSeason] = useState<string | null>(null)
  const [searchRound, setSearchRound] = useState(0)
  const [searchBusy, setSearchBusy] = useState(false)
  const [ddMode, setDdMode] = useState<DeepDiveMode>(data?.views ? 'general' : 'pure')
  const [request, setRequest] = useState<DeepDiveRequest | null>(null)
  const [ddSeason, setDdSeason] = useState(data?.season.code ?? '')

  // Card-search state
  const [cardId, setCardId] = useState<number | null>(null)
  const [searched, setSearched] = useState<MostUsedCard | null>(null)

  // Selected archetype for detail card
  const [selectedArchKey, setSelectedArchKey] = useState<string | null>(null)

  const go = (l: RankedLadderId, s?: string) =>
    start(() =>
      router.push(`/statistics?${new URLSearchParams(s ? { ladder: l, season: s } : { ladder: l })}`, { scroll: false })
    )

  // Sync dd season
  if (data && ddSeason !== data.season.code) {
    setDdSeason(data.season.code)
    setDdMode(data.views ? 'general' : 'pure')
  }

  const handleSelectSection = (section: NavSection) => {
    setActiveSection(section)
    scrollTo(`stat-section-${section}`)
  }

  if (!data) {
    return (
      <Panel title={result.ok ? 'Sem dados' : 'Erro ao carregar'} meta={result.ok ? '' : String((result as any).status ?? 0)} className="mt-6">
        <p className="text-ink-dim body">
          {result.ok
            ? 'Nenhum dado disponível para a temporada selecionada.'
            : 'O servidor não respondeu. Tente novamente em instantes.'}
        </p>
        <Button size="sm" variant="secondary" onClick={() => start(() => router.refresh())} className="mt-4">
          Tentar novamente
        </Button>
      </Panel>
    )
  }

  const { season: seasonData, totals, archetypes, matchups, mostUsed, trends, views, minSamples, syncedDays } = data

  const byKey = new Map(archetypes.map((a) => [utilsArchKey(a.archetype), a]))
  const pure = archetypes.filter((a) => a.archetype.length === 1)

  const focus = (focusKey && byKey.get(focusKey)) || pure[0] || archetypes[0]!
  const fKey = focus ? utilsArchKey(focus.archetype) : ''
  const picks = pure.slice(0, PICKS).some((a) => utilsArchKey(a.archetype) === fKey)
    ? pure.slice(0, PICKS)
    : [...pure.slice(0, PICKS), focus].filter(Boolean)
  const rank = focus ? archetypes.indexOf(focus) + 1 : 0

  const selectedArch = selectedArchKey ? byKey.get(selectedArchKey) ?? null : (archetypes[0] ?? null)

  const day = (iso: string, plus = 0) => {
    const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
    d.setUTCDate(d.getUTCDate() + plus)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' })
  }
  const lastSynced = syncedDays.last ? day(syncedDays.last) : undefined

  const closed = seasonData.endsAt ? (
    <div className="cut notch flex items-center gap-3 px-5 py-4 [--cut:var(--cut-md)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-100)]">
      <span className="size-2 flex-none bg-gold" />
      <span className="text-ink-dim body">{seasonData.label} está encerrada. Estes são os números finais.</span>
    </div>
  ) : null

  return (
    <div aria-busy={pending} className={twMerge('transition-opacity', pending && 'opacity-60')}>
      {/* Global header with filters */}
      <DashboardHeader
        ladder={ladder}
        season={season}
        pastSeasons={past}
        syncedDaysCount={syncedDays.count}
        lastSyncedDate={lastSynced}
        activeSection={activeSection}
        onSelectLadder={(l) => go(l)}
        onSelectSeason={(s) => go(ladder, s)}
        onSelectSection={handleSelectSection}
      />

      {closed && <div className="mt-6">{closed}</div>}

      {/* Two-column layout: sidebar + content */}
      <div className="flex gap-8 mt-8 items-start">
        {/* Sticky sidebar */}
        <DashboardSidebar
          activeSection={activeSection}
          onSelectSection={handleSelectSection}
        />

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col gap-16">

          {/* ── Section 01: Visão Geral ─────────────────────────────── */}
          <section id="stat-section-overview" aria-label="Visão geral do meta" className="scroll-mt-24">
            <SectionLabel num="01" label="Visão geral" stamp={`${syncedDays.count} dias sincronizados`} />
            {omega && <OmegaActivity data={omega} ladder={ladder} />}
            <div className={omega ? 'mt-6' : ''}>
              <MetaOverview data={data} />
            </div>
          </section>

          {/* ── Section 02: Ranking de Decks ────────────────────────── */}
          <section id="stat-section-deck-ranking" aria-label="Ranking de decks" className="scroll-mt-24">
            <SectionLabel num="02" label="Ranking de decks" stamp="Mirrors excluídos · ordenado por games" />
            <DeckRanking
              archetypes={archetypes}
              rankings={data.rankings}
              onPickArchetype={(key) => {
                setSelectedArchKey(key)
                handleSelectSection('archetype-analysis')
              }}
            />
          </section>

          {/* ── Section 03: Matchup Matrix ──────────────────────────── */}
          <section id="stat-section-matchup-matrix" aria-label="Matchup matrix" className="scroll-mt-24">
            <SectionLabel num="03" label="Matchup matrix" stamp="Win rate de cada deck contra os demais · top 10" />
            <MatchupMatrix
              archetypes={archetypes}
              matchups={matchups}
              maxDecks={10}
            />
          </section>

          {/* ── Section 04: Deck + Comparator (split) ───────────────── */}
          <section id="stat-section-archetype-analysis" aria-label="Análise de arquétipo" className="scroll-mt-24">
            <SectionLabel num="04" label="Análise de arquétipos" stamp="Selecione um deck no ranking para ver detalhes" />
            <div className="grid grid-cols-1 gap-6 min-[980px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <ArchetypeDetailCard
                archetype={selectedArch}
                onOpenDeepDive={(key) => {
                  setFocusKey(key)
                  handleSelectSection('deep-dive')
                }}
              />
              <DeckComparator
                archetypes={archetypes}
                preselected={archetypes.slice(0, 2)}
              />
            </div>
          </section>

          {/* ── Section 05: Cartas ──────────────────────────────────── */}
          <section id="stat-section-cards" aria-label="Estatísticas de cartas" className="scroll-mt-24">
            <SectionLabel num="05" label="Estatísticas de cartas" stamp="Staples em 2+ arquétipos · deck-games totais" />
            <div className="grid grid-cols-1 gap-6 min-[980px]:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
              <SmartCardsSection
                main={mostUsed?.main ?? []}
                extra={mostUsed?.extra ?? []}
                combinations={data.cardCombinations}
                selectedArchetype={selectedArch ?? undefined}
                onPickCard={(id) => setCardId(id)}
                selectedCardId={cardId}
              />
              {/* Legacy card search panel */}
              <div className="flex flex-col gap-4">
                <CardSearch
                  key={seasonData.code}
                  season={seasonData}
                  onLocal={(id) => {
                    const inMain = mostUsed?.main.some((c) => c.id === id)
                    const inExtra = mostUsed?.extra.some((c) => c.id === id)
                    if (inMain || inExtra) { setCardId(id); return true }
                    return false
                  }}
                  onCard={setSearched}
                />
              </div>
            </div>
          </section>

          {/* ── Section 06: Tendências & Histórico ──────────────────── */}
          <section id="stat-section-trends" aria-label="Tendências e histórico do meta" className="scroll-mt-24">
            <SectionLabel num="06" label="Tendências e histórico do meta" stamp={`Dia 1 = ${day(seasonData.startsAt)}`} />
            <MetaTrendsCard
              trends={trends}
              events={data.metaEvents}
              seasonStartsAt={seasonData.startsAt}
            />
          </section>

          {/* ── Section 07: Deep Dive ───────────────────────────────── */}
          <section id="stat-section-deep-dive" aria-label="Deep dive de arquétipo" className="scroll-mt-24">
            <SectionLabel num="07" label="Deep dive de arquétipo" stamp="Mirrors excluídos · até 15 cartas rastreadas" />
            <DeepDiveSearch
              key={`${seasonData.code}:${searchRound}`}
              season={seasonData}
              mode={ddMode}
              onMode={setDdMode}
              request={request}
              onLocal={(key) => byKey.has(key) && (setFocusKey(key), true)}
              onRemote={(on) => setRemoteSeason(on ? seasonData.code : null)}
              onBusy={setSearchBusy}
            />
            {!searchBusy && ddMode === 'pure' && focus && (
              <Segmented
                label="Arquétipo"
                options={picks.filter(Boolean).map((a) => ({ value: utilsArchKey(a!.archetype), label: nameOf(a!) }))}
                value={fKey}
                onChange={(key) => {
                  setFocusKey(key)
                  setRemoteSeason(null)
                  setSearchRound((n) => n + 1)
                }}
              />
            )}
            {ddMode === 'pure' && remoteSeason !== seasonData.code && focus && (
              <DeepDive archetype={focus} rank={rank} />
            )}
          </section>

          {/* ── Section 08: Busca de Carta ──────────────────────────── */}
          <section id="stat-section-card-search" aria-label="Busca de carta" className="scroll-mt-24">
            <SectionLabel num="08" label="Busca de carta" stamp="Pesquise qualquer carta da temporada" />
            <CardSearch
              key={`search-${seasonData.code}`}
              season={seasonData}
              onLocal={(id) => {
                const inMain = mostUsed?.main.some((c) => c.id === id)
                const inExtra = mostUsed?.extra.some((c) => c.id === id)
                if (inMain || inExtra) { setCardId(id); return true }
                return false
              }}
              onCard={setSearched}
            />
          </section>

          {/* ── Footer: Methodology ─────────────────────────────────── */}
          <section aria-label="Metodologia" className="mt-4">
            <Notice
              title="Como é contado"
              date={syncedDays.last ? day(syncedDays.last) : undefined}
              mark
            >
              Cada jogo conta uma vez por deck, então um Bo3 adiciona até seis deck-games. Win rates excluem mirrors e jogos incompletos; meta share os mantém.
              As listas mostram apenas decks com {minSamples} ou mais deck-games — portanto os shares não somam 100%.
              Intervalos de confiança: Wilson score 95% bilateral.
            </Notice>
          </section>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────── *
 * Section label helper                                         *
 * ─────────────────────────────────────────────────────────── */
const SectionLabel = ({
  num,
  label,
  stamp,
}: {
  num: string
  label: string
  stamp?: string
}) => (
  <div className="mb-5 flex items-baseline gap-3 border-b border-line pb-3">
    <span className="font-mono text-xs text-ink-muted shrink-0">
      {num}
    </span>
    <h2 className="font-bold text-ink text-lg leading-snug">{label}</h2>
    {stamp && (
      <span className="ml-auto hidden text-ink-muted signal-sm min-[720px]:inline">
        {stamp}
      </span>
    )}
  </div>
)
