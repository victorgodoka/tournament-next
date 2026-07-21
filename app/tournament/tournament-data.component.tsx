import { useMemo } from 'react'
import { Icon } from '@iconify/react'
import { cardImageUrl } from '@lib/cards.utils'
import { CARD_PLACEHOLDER_SRC } from '../profile/profile.const'
import type { TopcutData, TopcutStatsArchetype, TopcutStatsDeck } from './tournament.types'

type TournamentDataProps = {
  data?: TopcutData
}

// Validated categorical palette (dataviz validator, dark surface): distinct
// hues assigned in fixed order, tail folds into a neutral "Other".
const CATEGORICAL = ['#1794b5', '#b5851c', '#9b7bef', '#22a877', '#d95f92', '#5b8def']
const OTHER_COLOR = 'var(--color-text-subtle)'

const percent = (part: number, whole: number) =>
  whole > 0 ? (part / whole) * 100 : 0

const shareLabel = (value: number) => (value >= 10 ? value.toFixed(0) : value.toFixed(1))

/** First card id available in an archetype, or null. */
const archetypeImageId = (archetype: TopcutStatsArchetype) =>
  archetype.ids?.find((id) => id > 0) ?? null

/** A representative card for the whole deck: first archetype that has art. */
const deckImageId = (deck: TopcutStatsDeck) => {
  for (const archetype of deck.archetypes) {
    const id = archetypeImageId(archetype)
    if (id) return id
  }
  return null
}

const handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
  event.currentTarget.src = CARD_PLACEHOLDER_SRC
}

type StatTileProps = { icon: string; label: string; value: string | number; sub?: string }

const StatTile = ({ icon, label, value, sub }: StatTileProps) => (
  <div className="tournament-data__stat">
    <Icon icon={icon} className="tournament-data__stat-icon" aria-hidden="true" width={20} height={20} />
    <div className="tournament-data__stat-body">
      <span className="tournament-data__stat-label">{label}</span>
      <span className="tournament-data__stat-value">{value}</span>
      {sub ? <span className="tournament-data__stat-sub">{sub}</span> : null}
    </div>
  </div>
)

type Slice = { color: string; label: string; share: number }

const DonutChart = ({ slices, centerValue, centerLabel }: {
  slices: Slice[]
  centerValue: string | number
  centerLabel: string
}) => {
  const size = 148
  const stroke = 20
  const radius = (size - stroke) / 2
  const center = size / 2
  const gap = 1.4 // normalized (pathLength = 100) spacer between slices

  // Precompute each slice's start offset — mutating an accumulator inside the
  // JSX map is a render side effect the React compiler rejects.
  const positionedSlices: Array<Slice & { offset: number }> = []
  let cumulative = 0
  for (const slice of slices) {
    positionedSlices.push({ ...slice, offset: cumulative })
    cumulative += slice.share
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="tournament-data__donut"
      role="img"
      aria-label="Metagame distribution by deck"
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--color-bg-overlay)"
        strokeWidth={stroke}
      />
      <g transform={`rotate(-90 ${center} ${center})`}>
        {positionedSlices.map((slice, index) => {
          const length = Math.max(slice.share - gap, 0.4)
          return (
            <circle
              key={index}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth={stroke}
              pathLength={100}
              strokeDasharray={`${length} ${100 - length}`}
              strokeDashoffset={-slice.offset}
            >
              <title>{`${slice.label}: ${shareLabel(slice.share)}%`}</title>
            </circle>
          )
        })}
      </g>
      <text x={center} y={center - 3} className="tournament-data__donut-value" textAnchor="middle">
        {centerValue}
      </text>
      <text x={center} y={center + 15} className="tournament-data__donut-label" textAnchor="middle">
        {centerLabel}
      </text>
    </svg>
  )
}

const TournamentData = ({ data }: TournamentDataProps) => {
  const model = useMemo(() => {
    if (!data || data.decks.length === 0) return null

    const totalPlayers = data.totalPlayers
    const decks = [...data.decks].sort((a, b) => b.qty - a.qty)
    const topDeck = decks[0]
    if (!topDeck) return null
    const maxQty = topDeck.qty

    const rows = decks.map((deck, index) => ({
      deck,
      color: CATEGORICAL[index] ?? OTHER_COLOR,
      share: percent(deck.qty, totalPlayers),
      barWidth: percent(deck.qty, maxQty),
      imageId: deckImageId(deck),
    }))

    // Donut: top N colored slices, remainder folded into "Other".
    const shown = rows.slice(0, CATEGORICAL.length)
    const rest = rows.slice(CATEGORICAL.length)
    const slices: Slice[] = shown.map((row) => ({
      color: row.color,
      label: row.deck.primaryArchetype,
      share: row.share,
    }))
    if (rest.length > 0) {
      const restQty = rest.reduce((sum, row) => sum + row.deck.qty, 0)
      slices.push({
        color: OTHER_COLOR,
        label: `Other (${rest.length})`,
        share: percent(restQty, totalPlayers),
      })
    }

    return {
      rows,
      slices,
      totalPlayers,
      uniqueDecks: data.uniqueDecks,
      diversity: Math.round(percent(data.uniqueDecks, totalPlayers)),
      top: topDeck,
      topShare: Math.round(percent(topDeck.qty, totalPlayers)),
    }
  }, [data])

  if (!model) {
    return (
      <div className="tournament__panel-empty" role="status">
        <Icon icon="mdi:chart-box-outline" className="tournament__panel-empty-icon" aria-hidden="true" />
        <p>No metagame data available for this tournament.</p>
      </div>
    )
  }

  const { rows, slices, totalPlayers, uniqueDecks, diversity, top, topShare } = model

  return (
    <section className="tournament-data" aria-label="Metagame data">
      <div className="tournament-data__stats">
        <StatTile icon="mdi:account-group-outline" label="Players" value={totalPlayers} />
        <StatTile icon="mdi:cards-outline" label="Unique decks" value={uniqueDecks} />
        <StatTile
          icon="mdi:chart-scatter-plot"
          label="Field diversity"
          value={`${diversity}%`}
          sub="unique decks per player"
        />
        <StatTile
          icon="mdi:trophy-outline"
          label="Most played"
          value={top.primaryArchetype}
          sub={`${top.qty} ${top.qty === 1 ? 'entry' : 'entries'} · ${topShare}% of field`}
        />
      </div>

      <div className="tournament-data__section tournament-data__distribution">
        <header className="tournament-data__section-head">
          <h3 className="tournament-data__section-title">Metagame distribution</h3>
          <p className="tournament-data__section-sub">
            Share of the {totalPlayers}-player field by deck
          </p>
        </header>

        <div className="tournament-data__chart">
          <DonutChart slices={slices} centerValue={totalPlayers} centerLabel="players" />
          <ul className="tournament-data__legend">
            {slices.map((slice, index) => (
              <li className="tournament-data__legend-item" key={`${slice.label}-${index}`}>
                <span
                  className="tournament-data__legend-dot"
                  style={{ backgroundColor: slice.color }}
                  aria-hidden="true"
                />
                <span className="tournament-data__legend-name">{slice.label}</span>
                <span className="tournament-data__legend-pct">{shareLabel(slice.share)}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="tournament-data__section">
        <header className="tournament-data__section-head">
          <h3 className="tournament-data__section-title">Top cut breakdown</h3>
          <p className="tournament-data__section-sub">
            Every deck in the cut with its archetype engines
          </p>
        </header>

        <div className="tournament-table__scroll">
          <table className="tournament-table tournament-data__table">
            <caption className="visually-hidden">
              Top cut decks ranked by representation
            </caption>
            <thead>
              <tr>
                <th scope="col" className="tournament-table__position-header">#</th>
                <th scope="col">Deck</th>
                <th scope="col">Archetypes</th>
                <th scope="col" className="tournament-data__col-num">Players</th>
                <th scope="col" className="tournament-data__col-share">Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.deck.primaryArchetype}-${index}`}>
                  <td className="tournament-data__rank-cell">
                    <span
                      className="tournament-data__color-dot"
                      style={{ backgroundColor: row.color }}
                      aria-hidden="true"
                    />
                    <span className="tournament-data__rank-num">{index + 1}</span>
                  </td>
                  <td>
                    <div className="tournament-data__deck-cell">
                      {row.imageId ? (
                        <img
                          className="tournament-data__deck-art"
                          src={cardImageUrl(row.imageId)}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          onError={handleImageError}
                        />
                      ) : (
                        <span className="tournament-data__deck-art tournament-data__deck-art--empty" aria-hidden="true">
                          <Icon icon="mdi:cards-outline" width={18} height={18} />
                        </span>
                      )}
                      <span className="tournament-data__deck-title">
                        {row.deck.primaryArchetype}
                      </span>
                    </div>
                  </td>
                  <td>
                    <ul className="tournament-data__tags">
                      {row.deck.archetypes.map((archetype, tagIndex) => {
                        const imageId = archetypeImageId(archetype)
                        return (
                          <li
                            className="tournament-data__tag"
                            key={`${archetype.name}-${tagIndex}`}
                            title={`${archetype.name}: ${archetype.count} cards (${archetype.percentage}% of the deck)`}
                          >
                            {imageId ? (
                              <img
                                className="tournament-data__tag-art"
                                src={cardImageUrl(imageId)}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                onError={handleImageError}
                              />
                            ) : null}
                            <span className="tournament-data__tag-name">{archetype.name}</span>
                            <span className="tournament-data__tag-pct">{archetype.percentage}%</span>
                          </li>
                        )
                      })}
                    </ul>
                  </td>
                  <td className="tournament-data__col-num tournament-data__players">
                    {row.deck.qty}
                  </td>
                  <td className="tournament-data__col-share">
                    <div className="tournament-data__share-cell">
                      <span className="tournament-data__share-num">{shareLabel(row.share)}%</span>
                      <span className="tournament-data__share-bar" aria-hidden="true">
                        <span
                          style={{ width: `${row.barWidth}%`, backgroundColor: row.color }}
                        />
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export default TournamentData
