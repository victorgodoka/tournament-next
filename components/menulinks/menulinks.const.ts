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
      { to: '/tournament/live', label: 'Live Tournament', icon: 'mdi:video-wireless' },
      { to: '/history', label: 'Past Tournaments', icon: 'mdi:trophy' },
    ],
  },
  {
    id: 'meta',
    label: 'Meta',
    items: [
      { to: '/statistics', label: 'Statistics', icon: 'mdi:chart' },
      { to: '/leaderboards', label: 'Leaderboard', icon: 'mdi:leaderboard' },
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
      { to: '/calculator', label: 'Calculator', icon: 'mdi:calculator' },
      { to: '/pdf-decklist', label: 'PDF Decklist', icon: 'mdi:file-pdf' },
      { to: '/konami-decklist', label: 'Konami Decklist', icon: 'mdi:code-block-braces' },
    ],
  },
]
