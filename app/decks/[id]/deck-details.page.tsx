import type { CSSProperties } from 'react'
import { getDeck, getDeckComments } from './deck-details.api'
import { AvatarComponent, BackdropComponent, BadgesComponent, CommentsComponent, DeckListComponent, ErrorPageComponent, TagsComponent } from '@components'
import IconComponent from '../../../components/icon/icon.component'
import { DeckDetailsPageProps } from './deck-details.types'
import { discordAvatar } from '@assets/discord.avatar'
import { getDeckCreatorName, resolveDeckCoverId } from '../decks.utils'
import { buildCardLookup, cardImageUrl, isExtra } from '@lib/cards.utils'
import type { SavedDeckDetails } from '../decks.types'
import './deck-details.styles.css'
import Link from 'next/link'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** Split the raw main list (main + extra mixed) into true main/extra counts. */
function getDeckSizes({ decodedDeck }: SavedDeckDetails) {
  const lookup = buildCardLookup(decodedDeck.uniqueCardsData ?? [])
  let main = 0
  let extra = 0
  for (const id of decodedDeck.fullDeck?.main ?? []) {
    const card = lookup.get(id)
    if (card && isExtra(card)) extra += 1
    else main += 1
  }
  return { main, extra, side: decodedDeck.fullDeck?.side?.length ?? 0 }
}

export default async function DeckDetailsPage({ params }: DeckDetailsPageProps) {
  const { id } = await params
  const [{ deck }, commentsResult] = await Promise.all([
    getDeckDetails(id),
    getDeckComments(id),
  ])
  if (!deck) return <ErrorPageComponent />
  const creatorName = getDeckCreatorName(deck.user)
  const archetypes = deck.decodedDeck.archetypes
  const sizes = getDeckSizes(deck)
  const coverId = resolveDeckCoverId(deck)
  const coverSrc = coverId ? cardImageUrl(coverId, true) : null
  const createdLabel = dateFormatter.format(new Date(deck.created_at))

  const stats = [
    { key: 'main', label: 'Main', value: sizes.main },
    { key: 'extra', label: 'Extra', value: sizes.extra },
    { key: 'side', label: 'Side', value: sizes.side },
  ].filter((stat) => stat.value > 0)

  return (
    <div className="decks-detail">
      <article className="decks-detail__content omega-container">
        <BackdropComponent />

        <header className="decks-detail__header">
          {coverSrc ? (
            <span
              className="decks-detail__cover"
              style={{ '--deck-cover': `url(${coverSrc})` } as CSSProperties}
              aria-hidden="true"
            />
          ) : null}

          <div className="decks-detail__header-body">
            <div className="decks-detail__eyebrow">
              <span className="decks-detail__kicker">
                <span className="decks-detail__kicker-mark" aria-hidden="true" />
                Saved Deck
              </span>
              {deck.private ? (
                <span className="decks-detail__flag">
                  <IconComponent icon="mdi:lock-outline" width={13} height={13} />
                  Private
                </span>
              ) : null}
            </div>

            <h1 className="decks-detail__name">{deck.name}</h1>

            {archetypes.length > 0 ? (
              <BadgesComponent archetypes={archetypes} />
            ) : null}

            <div className="decks-detail__meta">
              <Link href={`/profile/${deck.user.discord_id}`} target="_blank" className="decks-detail__creator">
                <AvatarComponent
                  className="decks-detail__creator-avatar"
                  src={discordAvatar(deck.user.discord_id, deck.user.avatar ?? '')}
                  alt={creatorName}
                  size="xl"
                />
                <span className="decks-detail__creator-meta">
                  <span className="decks-detail__creator-label">Curated by</span>
                  <span className="decks-detail__creator-name">{creatorName}</span>
                  {deck.user.username ? (
                    <span className="decks-detail__creator-handle">@{deck.user.username}</span>
                  ) : null}
                </span>
              </Link>

              <dl className="decks-detail__stats">
                {stats.map((stat) => (
                  <div key={stat.key} className="decks-detail__stat">
                    <dd className="decks-detail__stat-value">{stat.value}</dd>
                    <dt className="decks-detail__stat-label">{stat.label}</dt>
                  </div>
                ))}
                <div className="decks-detail__stat decks-detail__stat--date">
                  <dd className="decks-detail__stat-value decks-detail__stat-value--icon">
                    <IconComponent icon="mdi:calendar-blank-outline" width={16} height={16} />
                  </dd>
                  <dt className="decks-detail__stat-label">{createdLabel}</dt>
                </div>
              </dl>
            </div>

            {deck.tags?.length ? (
              <TagsComponent tags={deck.tags} />
            ) : null}
          </div>
        </header>

        <DeckListComponent convertedDeck={deck.decodedDeck} name={deck?.name} />
        <CommentsComponent commentsResult={commentsResult} />
      </article>
    </div>
  )
}

const getDeckDetails = (async (id: string) => {
  const deck = (await getDeck(id))
  if (!deck.ok || !deck.data) return { data: null }
  return { deck: deck.data }
})
