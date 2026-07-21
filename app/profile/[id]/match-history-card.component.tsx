import Link from 'next/link'
import type { MatchHistory } from '../../decks/decks.types'
import { CARD_PLACEHOLDER_SRC } from '../profile.const'
import { cardArtUrl, tcgHref } from '../profile.utils'
import IconComponent from '../../../components/icon/icon.component'
import { cn } from '@sglara/cn'

type MatchHistoryCardProps = {
  match: MatchHistory
  formatMatchDuration: (start: string, end: string) => string
  getCardName: (id: number) => string
}

/** Cap the fan so a big deck can't overflow the card; the rest collapse to "+N". */
const MAX_FAN = 4

function getDeckCards(
  deck: MatchHistory['duelist']['deck'] | undefined,
  getCardName: (id: number) => string,
) {
  const cards: Array<{ id: number; name: string }> = []

  deck?.forEach((entry) => {
    const ids = entry.ids ?? []
    const quantity = entry.qtd ?? ids.length
    ids.slice(0, quantity).forEach((id) => {
      cards.push({ id, name: getCardName(id) })
    })
  })

  return cards
}

function DeckFan({ cards }: { cards: Array<{ id: number; name: string }> }) {
  if (cards.length === 0) return null

  const shown = cards.slice(0, MAX_FAN)
  const extra = cards.length - shown.length

  return (
    <div className="match-card__cards">
      {shown.map((card, index) => (
        <Link
          key={`${card.id}-${index}`}
          prefetch={false}
          href={tcgHref(card.name)}
          target="_blank"
          rel="noopener noreferrer"
          className="match-card__card-thumb"
          style={{ zIndex: shown.length - index }}
          title={card.name}
        >
          <img
            src={cardArtUrl(card.id)}
            alt={card.name}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.src = CARD_PLACEHOLDER_SRC
            }}
          />
        </Link>
      ))}
      {extra > 0 ? (
        <span className="match-card__card-more" title={`${extra} more cards`}>
          +{extra}
        </span>
      ) : null}
    </div>
  )
}

const MatchHistoryCard = ({
  match,
  formatMatchDuration,
  getCardName,
}: MatchHistoryCardProps) => {
  const resultModifier = match.isDraw
    ? 'match-card--draw'
    : match.isWinner
      ? 'match-card--win'
      : 'match-card--loss'

  const resultLabel = match.isDraw ? 'Draw' : match.isWinner ? 'Victory' : 'Defeat'
  const resultCode = match.isDraw ? 'D' : match.isWinner ? 'W' : 'L'

  const myDeckCards = getDeckCards(match.duelist?.deck, getCardName)
  const opponentDeckCards = getDeckCards(match.opponent?.deck, getCardName)
  const myDeckNames =
    match.duelist?.deck?.map((deck) => deck.archetype).join(' / ') ?? 'Unknown deck'
  const opponentDeckNames =
    match.opponent?.deck?.map((deck) => deck.archetype).join(' / ') ?? 'Unknown deck'

  const dateStr = new Date(match.start).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
  const timeStr = new Date(match.start).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })

  return (
    <article className={cn("match-card", resultModifier)}>
      <div className="match-card__accent" aria-hidden="true" />

      <div className="match-card__body">
        <header className="match-card__header">
          <div className="match-card__result">
            <span className="match-card__result-chip">{resultCode}</span>
            <div className="match-card__result-meta">
              <span className="match-card__result-label">{resultLabel}</span>
              <span className="match-card__timestamp">
                {dateStr} · {timeStr}
              </span>
            </div>
          </div>

          <div className="match-card__duration">
            <IconComponent icon="mdi:clock-outline" className="match-card__duration-icon" />
            <span>{formatMatchDuration(match.start, match.end)}</span>
          </div>
        </header>

        <div className="match-card__duelist">
          <DeckFan cards={myDeckCards} />

          <div className="match-card__duelist-info">
            <span className="match-card__role-label match-card__role-label--self">
              Duelist
            </span>
            <p className="match-card__player-name">
              {match.duelist?.discord?.displayname ?? 'Unknown player'}
            </p>
            <p className="match-card__deck-name">{myDeckNames}</p>
          </div>
        </div>

        <div className="match-card__versus" aria-hidden="true">
          <span className="match-card__versus-line" />
          <span className="match-card__versus-label">VS</span>
          <span className="match-card__versus-line" />
        </div>

        <div className="match-card__duelist">
          <DeckFan cards={opponentDeckCards} />

          <div className="match-card__duelist-info">
            <span className="match-card__role-label">Opponent</span>
            <Link href={`/profile/${match.opponent?.id ?? ''}`} className="match-card__player-link">
              {match.opponent?.discord?.displayname ?? 'Unknown opponent'}
            </Link>
            <p className="match-card__deck-name">{opponentDeckNames}</p>
          </div>
        </div>
      </div>
    </article>
  )
}

export default MatchHistoryCard
