'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
  type KeyboardEvent,
  CSSProperties,
} from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Icon } from '@iconify/react/offline'
import { cn } from '@sglara/cn'
import AvatarComponent from '@components/avatar/avatar.component'

import ButtonComponent from '@components/button/button.component'
import { discordAvatar } from '@assets/discord.avatar'
import { extractCardsFromResponse, searchCards } from '@lib/cards.api'
import { isAuthenticatedUser } from '@contexts/Auth/auth.const'
import { useAuthContext } from '@contexts/Auth/auth.context'
import { getPlayerDecks, getUserDecks } from '../../decks/decks.api'

import { CARD_PLACEHOLDER_SRC } from '../profile.const'
import ProfileSavedDeckCard from './profile-saved-deck-card.component'
import { PlayerDecksResponse, SavedDeck, MatchHistory } from '../../decks/decks.types'
import { ProfileCustomizationData } from '../profile.types'
import { getTierInfo, calculateWinRate, isPlayerOnline, sanitizeBioHtml, buildTwitchUrl, buildYoutubeUrl, buildXUrl, buildInstagramUrl, tcgHref, formatLastSeen, getWinRateClass, formatMatchDuration } from '../profile.utils'
import type { PlayerData } from '../../../types/player.types'
import IconComponent from '@components/icon/icon.component'
import { cardImageUrl } from '@lib/cards.utils'
import ShimmerImage from '@components/shimmer/shimmer.component'

const MatchHistoryCard = dynamic(() => import('./match-history-card.component'))

type ProfilePageClientProps = {
  profileId: string
  initialProfile: PlayerData | null
  initialCustomization: ProfileCustomizationData | null
  initialError: string | null
}

type ViewMode = 'tcg' | 'genesys' | 'myDecks'

type SocialLink = {
  name: string
  icon: string
  href: string
  modifier: string
}

function ProfileNotFound({ message }: { message: string }) {
  return (
    <div className="profile profile--empty" aria-labelledby="profile-error-title">
      

      <div className="profile__empty omega-container omega-container--narrow">
        <span className="profile__empty-icon-wrap" aria-hidden="true">
          <IconComponent icon="mdi:account-off" className="profile__empty-icon" />
        </span>
        <h1 id="profile-error-title" className="profile__empty-title">
          Profile not found
        </h1>
        <p className="profile__empty-description">{message}</p>
        <div className="profile__empty-actions">
          <ButtonComponent to="/" variant="primary" icon="mdi:home">
            Back to Home
          </ButtonComponent>
        </div>
      </div>
    </div>
  )
}

type RankEntry = {
  key: string
  name: string
  total: number
  winRate: number
  thumbIds: number[]
}

type CardLinkFanProps = {
  cardIds: number[]
  getCardName: (cardId: number) => string
  fanClassName: string
  itemClassName: string
  width: number
  height: number
}

/** A stack of card-art links (TCGplayer search, new tab), later cards behind
 * earlier ones via reverse z-index. Shared by the banner's top-archetype
 * fan and the sidebar rank lists' per-deck thumbnails — same link/image/
 * fallback behavior, only the CSS classes (size, spacing) differ. */
function CardLinkFan({ cardIds, getCardName, fanClassName, itemClassName, width, height }: CardLinkFanProps) {
  if (cardIds.length === 0) return null

  return (
    <div className={fanClassName}>
      {cardIds.map((cardId, index) => (
        <Link
          key={cardId}
          href={tcgHref(getCardName(cardId))}
          target="_blank"
          rel="noopener noreferrer"
          prefetch={false}
          className={itemClassName}
          style={{ zIndex: cardIds.length - index }}
          title={getCardName(cardId)}
        >
          <ShimmerImage
            src={cardImageUrl(cardId)}
            alt={getCardName(cardId)}
            width={width}
            height={height}
            loading="lazy"
          />
        </Link>
      ))}
    </div>
  )
}

type RankListProps = {
  title: string
  icon: string
  entries: RankEntry[]
  emptyText: string
  getCardName: (cardId: number) => string
}

/** Shared "Top Decks" / "Top Opponents" sidebar panel. */
function RankList({ title, icon, entries, emptyText, getCardName }: RankListProps) {
  return (
    <section className="profile__sidebar-panel omega-surface">
      <header className="profile__sidebar-header">
        <h3 className="profile__sidebar-title">{title}</h3>
        <IconComponent icon={icon} className="profile__sidebar-icon" />
      </header>

      <div className="profile__rank-list">
        {entries.length > 0 ? (
          entries.map((entry, index) => (
            <div key={entry.key} className="profile__rank-item">
              <span className="profile__rank-index">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="profile__rank-body">
                <p className="profile__rank-name">{entry.name}</p>
                <div className="profile__rank-meta">
                  <CardLinkFan
                    cardIds={entry.thumbIds}
                    getCardName={getCardName}
                    fanClassName="profile__thumb-fan"
                    itemClassName="profile__thumb"
                    width={22}
                    height={30}
                  />
                  <span>{entry.total} games</span>
                </div>
              </div>
              <span className={cn('profile__rank-rate', getWinRateClass(entry.winRate))}>
                {entry.winRate.toFixed(0)}%
              </span>
            </div>
          ))
        ) : (
          <p className="profile__sidebar-empty">{emptyText}</p>
        )}
      </div>
    </section>
  )
}

const toRankEntries = (
  decks: Array<{ deck?: string; wins: number; loss: number; total: number; ids?: number[] }> | undefined,
): RankEntry[] =>
  (decks ?? []).slice(0, 5).map((deck, index) => ({
    key: `${deck.deck}-${index}`,
    name: deck.deck || 'Unknown deck',
    total: deck.total,
    winRate: calculateWinRate(deck.wins, deck.loss),
    thumbIds: deck.ids?.slice(0, 4) ?? [],
  }))

const ProfilePageClient = ({
  profileId,
  initialProfile,
  initialCustomization,
  initialError,
}: ProfilePageClientProps) => {
  const { user } = useAuthContext()

  // Profile + customization are server-fetched and never refetched here; the
  // page remounts per profile via key={id}, so no prop-change resets needed.
  const profileData = initialProfile
  const customizationData = initialCustomization

  const [viewMode, setViewMode] = useState<ViewMode>('tcg')
  const [statsData, setStatsData] = useState<PlayerDecksResponse | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [pagination, setPagination] = useState({ tcg: 1, genesys: 1 })
  const [userDecks, setUserDecks] = useState<SavedDeck[]>([])
  const [loadingDecks, setLoadingDecks] = useState(false)
  const [deckError, setDeckError] = useState<string | null>(null)
  const [cardNamesMap, setCardNamesMap] = useState<Map<number, string>>(
    () => new Map(),
  )
  const [sanitizedBio, setSanitizedBio] = useState('')

  const fetchedCardIdsRef = useRef<Set<number>>(new Set())
  const decksLoadedForIdRef = useRef<string | null>(null)

  const gameMode: 'tcg' | 'genesys' =
    viewMode === 'myDecks' ? 'tcg' : viewMode

  const isOwnProfile =
    isAuthenticatedUser(user) && user.id === profileId

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // The bio is untrusted HTML — sanitized with DOMPurify in the browser and
  // rendered only after mount (the SSR pass leaves it empty on purpose).
  useEffect(() => {
    let active = true

    sanitizeBioHtml(customizationData?.duelist_bio ?? '').then((clean) => {
      if (active) setSanitizedBio(clean)
    })

    return () => {
      active = false
    }
  }, [customizationData])

  useEffect(() => {
    if (!profileData) return

    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the fetch this effect owns
    setLoadingStats(true)

    const load = async () => {
      try {
        const decks = await getPlayerDecks(profileId, {
          tcgPage: pagination.tcg,
          genesysPage: pagination.genesys,
        })

        if (!active) return

        if (decks.ok && decks.data) {
          setStatsData(decks.data)
        } else if (!decks.ok) {
          console.warn('[Profile] Failed to fetch match stats:', decks.message)
        }
      } catch {
        if (!active) return
        console.warn('[Profile] Failed to fetch paginated stats')
      } finally {
        if (active) setLoadingStats(false)
      }
    }

    load()

    return () => {
      active = false
    }
  }, [profileId, profileData, pagination.tcg, pagination.genesys])

  useEffect(() => {
    if (viewMode !== 'myDecks') return
    if (decksLoadedForIdRef.current === profileId) return

    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the fetch this effect owns
    setLoadingDecks(true)
    setDeckError(null)

    const load = async () => {
      try {
        const response = await getUserDecks(profileId, isOwnProfile)

        if (!active) return

        if (response.ok) {
          decksLoadedForIdRef.current = profileId
          setUserDecks(response.data)
        } else {
          setDeckError(response.message)
        }
      } catch {
        if (!active) return
        setDeckError('Network error while loading decks.')
      } finally {
        if (active) setLoadingDecks(false)
      }
    }

    load()

    return () => {
      active = false
    }
  }, [profileId, viewMode, isOwnProfile])

  const requiredCardIdsKey = useMemo(() => {
    const ids = new Set<number>()

    if (customizationData?.duelist_favorite) {
      const favoriteId = Number(customizationData.duelist_favorite)
      if (Number.isFinite(favoriteId)) ids.add(favoriteId)
    }

    if (statsData) {
      ; (['tcg', 'genesys'] as const).forEach((mode) => {
        const queue = statsData[mode]
        queue?.matchHistory?.forEach((match) => {
          match.duelist?.deck?.forEach((deck) => {
            const deckIds = deck.ids ?? []
            const quantity = deck.qtd ?? deckIds.length
            deckIds.slice(0, quantity).forEach((cardId) => ids.add(cardId))
          })
          match.opponent?.deck?.forEach((deck) => {
            const deckIds = deck.ids ?? []
            const quantity = deck.qtd ?? deckIds.length
            deckIds.slice(0, quantity).forEach((cardId) => ids.add(cardId))
          })
        })
        queue?.mostUsedArchetypes?.forEach((deck) => {
          deck.ids?.forEach((cardId) => ids.add(cardId))
        })
        queue?.opponentDecks?.forEach((deck) => {
          deck.ids?.forEach((cardId) => ids.add(cardId))
        })
      })
    }

    return Array.from(ids)
      .sort((a, b) => a - b)
      .join(',')
  }, [customizationData, statsData])

  useEffect(() => {
    if (!requiredCardIdsKey) return

    const allIds = requiredCardIdsKey
      .split(',')
      .map(Number)
      .filter(Number.isFinite)
    const missing = allIds.filter(
      (cardId) => !fetchedCardIdsRef.current.has(cardId),
    )

    if (missing.length === 0) return

    missing.forEach((cardId) => fetchedCardIdsRef.current.add(cardId))

    let cancelled = false

    const load = async () => {
      try {
        const response = await searchCards({
          id: missing,
          region: 'ALL',
          method: 'POST',
        })

        if (cancelled) return

        const cards = extractCardsFromResponse(response)
        if (cards.length) {
          setCardNamesMap((previous) => {
            const next = new Map(previous)
            cards.forEach((card) => {
              next.set(
                card.id,
                card.name_en || card.name_pt || `Card ${card.id}`,
              )
            })
            return next
          })
        }
      } catch {
        missing.forEach((cardId) => fetchedCardIdsRef.current.delete(cardId))
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [requiredCardIdsKey])

  const getCardName = useCallback(
    (cardId: number) => cardNamesMap.get(cardId) || `Card ${cardId}`,
    [cardNamesMap],
  )

  const favoriteCardName = useMemo(() => {
    if (!customizationData?.duelist_favorite) return null
    const favoriteId = Number(customizationData.duelist_favorite)
    if (!Number.isFinite(favoriteId)) return null
    return cardNamesMap.get(favoriteId) ?? null
  }, [cardNamesMap, customizationData])

  const currentStats = useMemo(() => {
    if (!profileData) {
      return { wins: 0, losses: 0, draws: 0, rating: 0 }
    }

    return gameMode === 'tcg'
      ? {
        wins: profileData.tcgwins,
        losses: profileData.tcgloses,
        draws: profileData.tcgdraws,
        rating: profileData.tcgrating,
      }
      : {
        wins: profileData.ocgwins,
        losses: profileData.ocgloses,
        draws: profileData.ocgdraws,
        rating: profileData.ocgrating,
      }
  }, [profileData, gameMode])

  const tierInfo = useMemo(
    () => getTierInfo(currentStats.rating),
    [currentStats.rating],
  )

  const winRate = calculateWinRate(
    currentStats.wins,
    currentStats.losses,
    currentStats.draws,
  )
  const totalGames =
    currentStats.wins + currentStats.losses + currentStats.draws
  const currentGameData = statsData?.[gameMode]

  const recentForm = useMemo(() => {
    return (
      currentGameData?.matchHistory?.slice(0, 5).map((match) =>
        match.isDraw ? 'D' : match.isWinner ? 'W' : 'L',
      ) ?? []
    )
  }, [currentGameData])

  const topArchetype = useMemo(() => {
    const top = currentGameData?.mostUsedArchetypes?.[0]
    if (!top?.ids?.length) return null
    return { name: top.deck, ids: top.ids.slice(0, 5) }
  }, [currentGameData])

  const isOnline = profileData?.lastlogin
    ? isPlayerOnline(profileData.lastlogin)
    : false

  const isPrivate = customizationData?.hide_history === 1
  const canViewPrivateData = isOwnProfile || !isPrivate

  const socials = useMemo<SocialLink[]>(() => {
    if (!customizationData) return []

    return [
      customizationData.socialTwitch && {
        name: 'Twitch',
        icon: 'mdi:twitch',
        href: buildTwitchUrl(customizationData.socialTwitch),
        modifier: 'profile__social-link--twitch',
      },
      customizationData.socialYoutube && {
        name: 'YouTube',
        icon: 'mdi:youtube',
        href: buildYoutubeUrl(customizationData.socialYoutube),
        modifier: 'profile__social-link--youtube',
      },
      customizationData.socialX && {
        name: 'X',
        icon: 'mdi:twitter',
        href: buildXUrl(customizationData.socialX),
        modifier: 'profile__social-link--x',
      },
      customizationData.socialInstagram && {
        name: 'Instagram',
        icon: 'mdi:instagram',
        href: buildInstagramUrl(customizationData.socialInstagram),
        modifier: 'profile__social-link--instagram',
      },
    ].filter(Boolean) as SocialLink[]
  }, [customizationData])

  if (initialError || !profileData) {
    return (
      <ProfileNotFound
        message={initialError || 'No player data exists for this account yet.'}
      />
    )
  }

  const avatarSrc = profileData.avatar
    ? discordAvatar(profileData.id, profileData.avatar)
    : ''

  const tabs: Array<{ id: ViewMode; label: string }> = [
    { id: 'tcg', label: 'TCG' },
    { id: 'genesys', label: 'Genesys' },
    {
      id: 'myDecks',
      label: isOwnProfile ? 'My Decks' : 'Saved Decks',
    },
  ]

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return

    event.preventDefault()
    const nextIndex =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : (index - 1 + tabs.length) % tabs.length
    const nextTab = tabs[nextIndex]
    if (!nextTab) return
    setViewMode(nextTab.id)
    if (nextTab.id !== 'myDecks') {
      setPagination({ tcg: 1, genesys: 1 })
    }
  }

  return (
    <div className="profile profile--detail">
      

      <section
        className="profile__banner"
        aria-label="Profile banner"
        style={
          customizationData?.duelist_banner_url
            ? {
              backgroundImage: `url(${customizationData.duelist_banner_url})`,
            }
            : undefined
        }
      >
        <div className="profile__banner-vignette" aria-hidden="true" />
        <div className="profile__banner-glow" aria-hidden="true" />
        <div className="profile__banner-grid" aria-hidden="true" />
        <div
          className={cn('profile__banner-accent', tierInfo.accentClass)}
          aria-hidden="true"
        />

        {topArchetype ? (
          <div className="profile__banner-cards">
            <CardLinkFan
              cardIds={topArchetype.ids}
              getCardName={getCardName}
              fanClassName="profile__banner-card-fan"
              itemClassName="profile__banner-card"
              width={60}
              height={92}
            />
            <p className="profile__banner-card-label">
              <span>Most Used · </span>
              {topArchetype.name}
            </p>
          </div>
        ) : null}
      </section>

      <div className="profile__page omega-container">
        <section
          className={cn('profile__command omega-surface', tierInfo.accentClass)}
          aria-label="Player overview"
        >
          <div className="profile__command-identity">
            <div className={cn('profile__avatar-wrap', tierInfo.accentClass)}>
              <AvatarComponent
                src={avatarSrc}
                alt={profileData.displayname}
                size="lg"
                shape="circle"
              />
              {isOnline ? (
                <span className="profile__online-badge" aria-label="Online now" />
              ) : null}
            </div>

            <div className="profile__identity">
              <div className="profile__meta-row">
                <span className="profile__meta-label">Duelist</span>
                <span className="profile__meta-divider" aria-hidden="true" />
                <span
                  className={cn('profile__meta-status', {
                    'profile__meta-status--online': isOnline,
                  })}
                >
                  {isOnline
                    ? 'Online'
                    : formatLastSeen(profileData.lastlogin)}
                </span>
              </div>

              <h1 className="profile__title">{profileData.displayname}</h1>

              <div className="profile__subtitle-row">
                <p className="profile__username">@{profileData.username}</p>
                <span className="profile__subtitle-dot" aria-hidden="true" />
                <span className={cn('profile__tier-label', tierInfo.accentClass)}>
                  {tierInfo.name.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="profile__actions">
              {isOwnProfile ? (
                <Link href="/profile/edit" className="profile__edit-link">
                  <IconComponent icon="mdi:pencil-outline" className="profile__edit-icon" />
                  Edit Profile
                </Link>
              ) : null}

              {socials.length > 0 ? (
                <div
                  className={cn('profile__socials', {
                    'profile__socials--bordered': isOwnProfile,
                  })}
                >
                  {socials.map((social) => (
                    <a
                      key={social.name}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn('profile__social-link', social.modifier)}
                      title={social.name}
                    >
                      <IconComponent icon={social.icon} className="profile__social-icon" />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="profile__command-divider" />

          <div className="profile__telemetry">
            <div className="profile__telemetry-panel">
              <h2 className="profile__telemetry-label">Rating</h2>
              <div className="profile__telemetry-main">
                <div className="profile__telemetry-value-row">
                  <span className="profile__telemetry-value">
                    {Math.floor(currentStats.rating)}
                  </span>
                  <span className={cn('profile__tier-chip', tierInfo.accentClass)}>
                    {tierInfo.name.toUpperCase()}
                  </span>
                </div>
                <img
                  src={tierInfo.image}
                  alt={`${tierInfo.name} tier badge`}
                  className="profile__tier-badge"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none'
                  }}
                />
              </div>
              <span className={cn('profile__tier-line', tierInfo.accentClass)} />
            </div>

            <div className="profile__telemetry-panel">
              <h2 className="profile__telemetry-label">Win Rate</h2>
              <div className={cn('profile__telemetry-value', getWinRateClass(winRate))}>
                {winRate.toFixed(1)}
                <span className="profile__telemetry-suffix">%</span>
              </div>
              <div className="profile__win-rate-track">
                <span
                  className="profile__win-rate-fill"
                  style={{ width: `${Math.min(100, Math.max(0, winRate))}%` }}
                />
              </div>
            </div>

            <div className="profile__telemetry-panel">
              <h2 className="profile__telemetry-label">Matches</h2>
              <span className="profile__telemetry-value">{totalGames}</span>
              <div className="profile__record-row">
                <span className="profile__record profile__record--win">
                  {currentStats.wins} Wins
                </span>
                <span className="profile__record profile__record--loss">
                  {currentStats.losses} Losses
                </span>
              </div>
            </div>

            <div className="profile__telemetry-panel">
              <h2 className="profile__telemetry-label">Recent Form</h2>
              {recentForm.length > 0 ? (
                <>
                  <div className="profile__form-chart" aria-hidden="true">
                    {recentForm.map((result, index) => (
                      <span
                        key={index}
                        title={
                          result === 'W'
                            ? 'Win'
                            : result === 'D'
                              ? 'Draw'
                              : 'Loss'
                        }
                        className={cn('profile__form-bar', `profile__form-bar--${result.toLowerCase()}`)}
                      />
                    ))}
                  </div>
                  <p className="profile__form-caption">Last {recentForm.length}</p>
                </>
              ) : (
                <>
                  <div className="profile__form-chart profile__form-chart--empty" aria-hidden="true">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <span key={index} className="profile__form-bar profile__form-bar--empty" />
                    ))}
                  </div>
                  <p className="profile__form-caption">No data</p>
                </>
              )}
            </div>
          </div>
        </section>

        <div className="profile__toolbar">
          <div className="profile__tabs" role="tablist" aria-label="Profile sections">
            {tabs.map((tab, index) => {
              const active = viewMode === tab.id
              const tabId = `profile-tab-${tab.id}`
              const panelId =
                tab.id === 'myDecks' ? 'profile-panel-decks' : 'profile-panel-matches'

              return (
                <button
                  key={tab.id}
                  type="button"
                  id={tabId}
                  role="tab"
                  aria-selected={active}
                  aria-controls={panelId}
                  tabIndex={active ? 0 : -1}
                  className={cn('profile__tab', {
                    'profile__tab--active': active,
                  })}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  onClick={() => {
                    setViewMode(tab.id)
                    if (tab.id !== 'myDecks') {
                      setPagination({ tcg: 1, genesys: 1 })
                    }
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {viewMode !== 'myDecks' && currentGameData?.totalGaming ? (
            <div className="profile__playtime">
              <IconComponent icon="mdi:clock-outline" className="profile__playtime-icon" />
              <span>{currentGameData.totalGaming}</span>
            </div>
          ) : null}
        </div>

        <div className="profile__body">
          {viewMode === 'myDecks' ? (
            <section
              className="profile__decks-section"
              role="tabpanel"
              id="profile-panel-decks"
              aria-labelledby="profile-tab-myDecks"
            >
              <header className="profile__section-header">
                <div>
                  <p className="profile__section-eyebrow">Collection</p>
                  <h2 className="profile__section-title">
                    {isOwnProfile
                      ? 'My Decks'
                      : `${profileData.username}'s Decks`}
                  </h2>
                </div>
                {!loadingDecks && userDecks.length > 0 ? (
                  <span className="profile__deck-count">{userDecks.length} decks</span>
                ) : null}
              </header>

              {loadingDecks ? (
                <div className="profile__deck-grid">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <span key={index} className="profile__deck-skeleton" />
                  ))}
                </div>
              ) : deckError ? (
                <div className="profile__panel-empty profile__panel-empty--error">
                  <IconComponent icon="mdi:alert-circle-outline" className="profile__panel-empty-icon" />
                  <p>{deckError}</p>
                </div>
              ) : userDecks.length === 0 ? (
                <div className="profile__panel-empty">
                  <IconComponent icon="mdi:cards-outline" className="profile__panel-empty-icon" />
                  <h3 className="profile__panel-empty-title">No decks yet</h3>
                  <p className="profile__panel-empty-text">
                    Saved deck lists will appear here once published.
                  </p>
                </div>
              ) : (
                <div className="profile__deck-grid">
                  {userDecks.map((deck) => (
                    <ProfileSavedDeckCard key={deck.id} deck={deck} />
                  ))}
                </div>
              )}
            </section>
          ) : canViewPrivateData ? (
            <div
              className="profile__layout"
              role="tabpanel"
              id="profile-panel-matches"
              aria-labelledby={`profile-tab-${gameMode}`}
            >
              <section className="profile__feed omega-surface">
                <header className="profile__feed-header">
                  <div>
                    <p className="profile__section-eyebrow">
                      {gameMode.toUpperCase()} · Feed
                    </p>
                    <h2 className="profile__section-title">Match History</h2>
                  </div>
                  <div className="profile__feed-meta">
                    {currentGameData?.pagination?.totalMatches != null ? (
                      <span>{currentGameData.pagination.totalMatches} total</span>
                    ) : null}
                    {currentGameData?.pagination?.totalPages ? (
                      <span className="profile__page-chip">
                        {currentGameData.pagination.currentPage}/
                        {currentGameData.pagination.totalPages}
                      </span>
                    ) : null}
                  </div>
                </header>

                <div className="profile__match-scroll">
                  {loadingStats ? (
                    <div className="profile__match-grid">
                      {Array.from({ length: 8 }).map((_, index) => (
                        <span key={index} className="profile__match-skeleton" />
                      ))}
                    </div>
                  ) : currentGameData?.matchHistory?.length ? (
                    <div className="profile__match-grid">
                      <Suspense
                        fallback={
                          <>
                            {Array.from({ length: 8 }).map((_, index) => (
                              <span key={index} className="profile__match-skeleton" />
                            ))}
                          </>
                        }
                      >
                        {currentGameData.matchHistory.map(
                          (match: MatchHistory, index: number) => (
                            <MatchHistoryCard
                              key={`${match.start}-${index}`}
                              match={match}
                              formatMatchDuration={formatMatchDuration}
                              getCardName={getCardName}
                            />
                          ),
                        )}
                      </Suspense>
                    </div>
                  ) : (
                    <div className="profile__panel-empty">
                      <IconComponent icon="mdi:history" className="profile__panel-empty-icon" />
                      <p className="profile__panel-empty-text">
                        No {gameMode.toUpperCase()} matches recorded yet.
                      </p>
                    </div>
                  )}
                </div>

                {currentGameData?.pagination &&
                  currentGameData.pagination.totalPages > 1 ? (
                  <div className="profile__pagination">
                    <button
                      type="button"
                      className="profile__pagination-btn"
                      disabled={pagination[gameMode] <= 1}
                      onClick={() =>
                        setPagination((previous) => ({
                          ...previous,
                          [gameMode]: Math.max(1, previous[gameMode] - 1),
                        }))
                      }
                      aria-label="Previous page"
                    >
                      <IconComponent icon="mdi:chevron-left" />
                    </button>
                    <span className="profile__pagination-label">
                      {pagination[gameMode]} / {currentGameData.pagination.totalPages}
                    </span>
                    <button
                      type="button"
                      className="profile__pagination-btn"
                      disabled={
                        pagination[gameMode] >=
                        currentGameData.pagination.totalPages
                      }
                      onClick={() =>
                        setPagination((previous) => ({
                          ...previous,
                          [gameMode]: Math.min(
                            currentGameData.pagination.totalPages,
                            previous[gameMode] + 1,
                          ),
                        }))
                      }
                      aria-label="Next page"
                    >
                      <IconComponent icon="mdi:chevron-right" />
                    </button>
                  </div>
                ) : null}
              </section>

              <aside className="profile__sidebar">
                {(customizationData?.duelist_bio ||
                  customizationData?.duelist_favorite) && (
                    <section
                      style={
                        customizationData.duelist_favorite
                          ? ({
                            '--favorite-bg': `url(${cardImageUrl(
                              Number(customizationData.duelist_favorite), true
                            )})`,
                          } as CSSProperties)
                          : undefined
                      }
                      data-custom={customizationData.duelist_favorite ? 'true' : 'false'}
                      className="profile__sidebar-panel profile__sidebar-panel--dossier"
                    >
                      {customizationData.duelist_favorite && <Link
                        href={tcgHref(
                          favoriteCardName ||
                          `Card ${customizationData.duelist_favorite}`,
                        )}
                        prefetch={false}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="profile__favorite-card-link"
                        title={favoriteCardName || 'Favorite card'}
                      ></Link>}
                      {(sanitizedBio ||
                        (customizationData.duelist_favorite && favoriteCardName)) ? (
                        <div className="profile__dossier-content">
                          {sanitizedBio ? (
                            <div
                              className="profile__bio"
                              dangerouslySetInnerHTML={{
                                __html: sanitizedBio,
                              }}
                            />
                          ) : null}
                          {customizationData.duelist_favorite && favoriteCardName ? (
                            <p className="profile__favorite-card-caption">
                              <span className="profile__favorite-card-caption-label">
                                Favorite
                              </span>
                              {favoriteCardName}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </section>
                  )}

                <RankList
                  title="Top Decks"
                  icon="mdi:cards-outline"
                  entries={toRankEntries(currentGameData?.mostUsedArchetypes)}
                  emptyText={`No ${gameMode.toUpperCase()} deck data yet.`}
                  getCardName={getCardName}
                />

                <RankList
                  title="Top Opponents"
                  icon="mdi:sword-cross"
                  entries={toRankEntries(currentGameData?.opponentDecks)}
                  emptyText={`No ${gameMode.toUpperCase()} opponent data yet.`}
                  getCardName={getCardName}
                />
              </aside>
            </div>
          ) : (
            <div className="profile__private omega-surface">
              <span className="profile__private-icon-wrap" aria-hidden="true">
                <IconComponent icon="mdi:lock-outline" className="profile__private-icon" />
              </span>
              <h2 className="profile__private-title">Match history is private</h2>
              <p className="profile__private-text">
                This duelist has hidden their competitive record from public view.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProfilePageClient
