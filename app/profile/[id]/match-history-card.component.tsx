import Link from 'next/link'
import { Icon } from '@iconify/react'
import type { MatchHistory } from '../../decks/decks.types'
import { CARD_PLACEHOLDER_SRC } from '../profile.const'
import { cardArtUrl, tcgHref } from '../profile.utils'
import IconComponent from '../../../components/icon/icon.component'
import Image from 'next/image'

type MatchHistoryCardProps = {
  match: MatchHistory
  formatMatchDuration: (start: string, end: string) => string
  getCardName: (id: number) => string
}

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

  const dateStr = new Date(match.start).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  const timeStr = new Date(match.start).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <article className={`match-card ${resultModifier}`}>
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
          <div className="match-card__cards">
            {myDeckCards.map((card, index) => (
              <Link
                key={`${card.id}-${index}`}
                prefetch={false}
                href={tcgHref(card.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="match-card__card-thumb"
                style={{ zIndex: myDeckCards.length - index }}
                title={card.name}
              >
                <Image
                  src={cardArtUrl(card.id)}
                  alt={card.name}
                  loading="lazy"
                  width={38}
                  height={54}
                  onError={(event) => {
                    event.currentTarget.src = CARD_PLACEHOLDER_SRC
                  }}
                />
              </Link>
            ))}
          </div>

          <div className="match-card__duelist-info">
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
          <div className="match-card__cards">
            {opponentDeckCards.map((card, index) => (
              <Link
                key={`${card.id}-${index}`}
                prefetch={false} 
                href={tcgHref(card.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="match-card__card-thumb"
                style={{ zIndex: opponentDeckCards.length - index }}
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
          </div>

          <div className="match-card__duelist-info">
            <span className="match-card__opponent-label">Opponent</span>
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
