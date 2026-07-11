import type { MenuEntry } from './menulinks.types'

export const MENU_LINKS_GROUPS: MenuEntry[] = [
  {
    id: 'home',
    label: 'Home',
    to: '/',
  },
  {
    id: 'play',
    label: 'Play',
    items: [
      { to: '/tournament/live', label: 'Live Tournament', icon: 'fluent:live-20-filled' },
      { to: '/history', label: 'Past Tournaments', icon: 'material-symbols:trophy' },
    ],
  },
  {
    id: 'meta',
    label: 'Meta',
    items: [
      { to: '/statistics', label: 'Statistics', icon: 'picon:chart' },
      { to: '/leaderboards', label: 'Leaderboard', icon: 'material-symbols:leaderboard' },
      { to: '/deck-wiki', label: 'Deck Wiki', icon: 'mdi:book-open-page-variant' },
    ],
  },
  {
    id: 'decks',
    label: 'Decks',
    items: [
      { to: '/decks', label: 'Decks', icon: 'mdi:cards' },
      { to: '/deck-editor', label: 'Deck Editor', icon: 'mdi:pencil' },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    items: [
      { to: '/calculator', label: 'Calculator', icon: 'tabler:math' },
      { to: '/pdf-decklist', label: 'PDF Decklist', icon: 'teenyicons:pdf-outline' },
      { to: '/konami-decklist', label: 'Konami Decklist', icon: 'si:json-alt-1-line' },
    ],
  },
]
