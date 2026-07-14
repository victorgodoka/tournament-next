import type { KeyboardEvent } from 'react'

export type TournamentTabId = 'brackets' | 'table' | 'topcut' | 'data'

type TournamentTab = {
  id: TournamentTabId
  label: string
  requiresFinished: boolean
}

export const TOURNAMENT_TABS: TournamentTab[] = [
  { id: 'brackets', label: 'Brackets', requiresFinished: false },
  { id: 'table', label: 'Table', requiresFinished: false },
  { id: 'topcut', label: 'Topcut & Decklists', requiresFinished: true },
  { id: 'data', label: 'Data & Graphics', requiresFinished: true },
]

type TournamentTabsProps = {
  finished: boolean
  activeTab: TournamentTabId
  onTabChange: (tab: TournamentTabId) => void
}

const TournamentTabs = ({
  finished,
  activeTab,
  onTabChange,
}: TournamentTabsProps) => {
  const isTabDisabled = (tab: TournamentTab) =>
    tab.requiresFinished && !finished

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    tabId: TournamentTabId,
  ) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return

    event.preventDefault()
    const enabledTabs = TOURNAMENT_TABS.filter((tab) => !isTabDisabled(tab))
    const currentIndex = enabledTabs.findIndex((tab) => tab.id === tabId)
    if (currentIndex === -1) return

    const nextIndex =
      event.key === 'ArrowRight'
        ? (currentIndex + 1) % enabledTabs.length
        : (currentIndex - 1 + enabledTabs.length) % enabledTabs.length
    const nextTab = enabledTabs[nextIndex]
    onTabChange(nextTab.id)
    document.getElementById(`tournament-tab-${nextTab.id}`)?.focus()
  }

  return (
    <div
      className="tournament__tabs"
      role="tablist"
      aria-label="Tournament sections"
    >
      {TOURNAMENT_TABS.map((tab) => {
        const active = activeTab === tab.id
        const disabled = isTabDisabled(tab)

        return (
          <button
            key={tab.id}
            type="button"
            id={`tournament-tab-${tab.id}`}
            role="tab"
            aria-selected={active}
            aria-controls={`tournament-panel-${tab.id}`}
            disabled={disabled}
            title={disabled ? 'Available once the tournament ends' : undefined}
            tabIndex={active ? 0 : -1}
            className={
              active ? 'tournament__tab tournament__tab--active' : 'tournament__tab'
            }
            onKeyDown={(event) => handleKeyDown(event, tab.id)}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export default TournamentTabs
