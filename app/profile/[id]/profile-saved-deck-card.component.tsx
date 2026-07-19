import Link from 'next/link'
import IconComponent from '../../../components/icon/icon.component'
import type { SavedDeck } from '../../decks/decks.types'
import { CARD_ART_BASE, DECK_COVER_FALLBACK } from '../profile.const'

type ProfileSavedDeckCardProps = {
  deck: SavedDeck
}

const ProfileSavedDeckCard = ({ deck }: ProfileSavedDeckCardProps) => {
  const coverSrc = deck.cover_id
    ? `${CARD_ART_BASE}/${deck.cover_id}.jpg`
    : DECK_COVER_FALLBACK

  return (
    <article className="profile-deck-card omega-surface">
      <Link
        href={`/decks/${deck.id}`}
        className="profile-deck-card__cover"
        aria-label={deck.name}
      >
        <img
          src={coverSrc}
          alt=""
          loading="lazy"
          onError={(event) => {
            event.currentTarget.src = DECK_COVER_FALLBACK
          }}
        />
        {deck.private ? (
          <span className="profile-deck-card__private">
            <IconComponent icon="mdi:lock-outline" width={12} height={12} />
            Private
          </span>
        ) : null}
      </Link>

      <div className="profile-deck-card__body">
        <Link href={`/decks/${deck.id}`} className="profile-deck-card__title">
          {deck.name}
        </Link>

        {(deck.archetypes?.length ?? 0) > 0 ? (
          <p className="profile-deck-card__tags">{deck.archetypes?.join(' · ')}</p>
        ) : null}
      </div>
    </article>
  )
}

export default ProfileSavedDeckCard
