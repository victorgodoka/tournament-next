'use client'

import { CSSProperties, useMemo } from 'react'
import Link from 'next/link'
import { cardImageUrl } from '@lib/cards.utils'
import { discordAvatar } from '@assets/discord.avatar'
import AvatarComponent from '../../components/avatar/avatar.component'
import IconComponent from '../../components/icon/icon.component'
import type { SavedDeck } from './decks.types'
import { DECK_COVER_FALLBACK } from './decks.const'
import { getDeckCreatorName, resolveDeckCoverId } from './decks.utils'
import { ButtonComponent } from '@components'

type DeckCardProps = {
  deck: SavedDeck
  onArchetypeClick: (archetype: string) => void
}

const DeckCardComponent = ({ deck, onArchetypeClick }: DeckCardProps) => {
  const coverId = useMemo(() => resolveDeckCoverId(deck), [deck])
  const coverSrc = coverId ? cardImageUrl(coverId, true) : DECK_COVER_FALLBACK
  const creatorName = getDeckCreatorName(deck)
  const deckHref = `/decks/${deck.id}`

  return (
    <article className="deck-card omega-surface">
      <div className="deck-card__header">
        <Link style={{ "--deck-cover": `url(${coverSrc}) center center no-repeat, url(${DECK_COVER_FALLBACK})` } as CSSProperties} href={deckHref} className="deck-card__cover" aria-label={deck.name}>
          {deck.private ? (
            <span className="deck-card__private">
              <IconComponent icon="mdi:lock-outline" width={12} height={12} />
              Private
            </span>
          ) : null}
        </Link>

        <div className="deck-card__creator">
          <AvatarComponent
            src={discordAvatar(deck.user_id, deck.avatar ?? '')}
            alt={creatorName}
            size="sm"
          />
          <span className="deck-card__creator-meta">
            <span className="deck-card__creator-name">{creatorName}</span>
            {deck.username ? (
              <span className="deck-card__creator-handle">@{deck.username}</span>
            ) : null}
          </span>
        </div>
      </div>
      <div className="deck-card__body">
        <Link href={deckHref} className="deck-card__title">
          {deck.name}
        </Link>

        <div className="deck-card__badges">
          {deck.archetypes?.length ? (
            <>
              {deck.archetypes.slice(0, 3).map((archetype) => (
                <button
                  key={archetype}
                  type="button"
                  className="deck-card__badge"
                  onClick={() => onArchetypeClick(archetype)}
                >
                  {archetype}
                </button>
              ))}
              {deck.archetypes.length > 3 && <button
                title={deck.archetypes.slice(3).join(", ")}
                type="button"
                disabled
                className="deck-card__badge-others"
              >
                <span>...others</span>
              </button>}
            </>
          ) : null}
        </div>
        {deck.tags?.length ? (
          <div className="deck-card__tags">
            {deck.tags.map((tag) => (
              <span
                key={tag}
                className="deck-card__tag"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="deck-card__stats">
          <span className="deck-card__stat">
            <ButtonComponent iconClassname={true ? "deck-card__icon--liked" : ""} variant="link" icon={true ? "mdi:heart" : "mdi:heart-outline"}>
              {deck.likes ?? 0}
            </ButtonComponent>
          </span>
          <span className="deck-card__stat">
            <ButtonComponent iconClassname={true ? "deck-card__icon--commented" : ""} href={`${deckHref}/#comment-section`} variant="link" icon={true ? "mdi:comment" : "mdi:comment-outline"}>
              {deck.comment_count ?? 0}
            </ButtonComponent>
          </span>
        </div>
      </div>
    </article>
  )
}

export default DeckCardComponent
