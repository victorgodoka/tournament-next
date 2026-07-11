import { DISCORD_SERVER_LINK } from "@lib/site-config"
import type { HomeCommunityLink, HomeFeature, HomeToolLink } from "./home.types"

export const HOME_FEATURES: HomeFeature[] = [
  {
    id: 'tournaments',
    title: 'Live Tournaments',
    description: 'Compete in organized events with real-time brackets and standings.',
    to: '/tournament/live',
    icon: 'fluent:live-20-filled',
  },
  {
    id: 'rankings',
    title: 'Rankings & Stats',
    description: 'Track your rating, match history, and climb the leaderboards.',
    to: '/leaderboards',
    icon: 'material-symbols:leaderboard',
  },
  {
    id: 'decks',
    title: 'Deck Builder',
    description: 'Create, edit, and manage your decks with the built-in editor.',
    to: '/deck-editor',
    icon: 'mdi:cards',
  },
  {
    id: 'meta',
    title: 'Meta & Wiki',
    description: 'Explore statistics, deck profiles, and the community deck wiki.',
    to: '/deck-wiki',
    icon: 'mdi:book-open-page-variant',
  },
]

export const HOME_TOOLS: HomeToolLink[] = [
  { label: 'Calculator', to: '/calculator', icon: 'tabler:math' },
  { label: 'PDF Decklist', to: '/pdf-decklist', icon: 'teenyicons:pdf-outline' },
  { label: 'Konami Decklist', to: '/konami-decklist', icon: 'si:json-alt-1-line' },
  { label: 'Statistics', to: '/statistics', icon: 'picon:chart' },
  { label: 'Past Tournaments', to: '/history', icon: 'material-symbols:trophy' },
  { label: 'My Decks', to: '/decks', icon: 'mdi:cards-outline' },
]

export const HOME_COMMUNITY: HomeCommunityLink[] = [
  {
    label: 'Forum',
    href: 'https://forum.duelistsunite.org/',
    icon: 'mdi:forum-outline',
    description: 'Discuss strategy, tournaments, and YGO Omega development.',
  },
  {
    label: 'Discord Server',
    href: DISCORD_SERVER_LINK,
    icon: 'mdi:discord',
    description: 'Join the main Duelists Unite community on Discord.',
  },
  {
    label: 'Dueling Nexus',
    href: 'https://discord.gg/duelingnexus',
    icon: 'mdi:sword-cross',
    description: 'Connect with the Dueling Nexus community server.',
  },
]
