import type { CardsSearchParams } from '@lib/cards.types'
import type { BanStatus, DeckFormat, DeckZone } from './deck-editor.types'

/** Format tabs, in display order. `region` is what the cards API expects. */
export const FORMATS: {
  value: DeckFormat
  label: string
  region: NonNullable<CardsSearchParams['region']>
  icon: string
}[] = [
  { value: 'tcg', label: 'TCG', region: 'TCG', icon: 'mdi:earth' },
  { value: 'ocg', label: 'OCG', region: 'OCG', icon: 'mdi:ideogram-cjk' },
  { value: 'genesys', label: 'Genesys', region: 'GENESYS', icon: 'mdi:diamond-stone' },
]

/** Standard Advanced-format deck-size rules. */
export const ZONE_LIMITS: Record<DeckZone, { min: number; max: number }> = {
  main: { min: 40, max: 60 },
  extra: { min: 0, max: 15 },
  side: { min: 0, max: 15 },
}

/** Max copies of one card across the whole deck, keyed by banlist status. */
export const COPY_LIMIT: Record<BanStatus, number> = {
  forbidden: 0,
  limited: 1,
  'semi-limited': 2,
  unlimited: 3,
}

export const BAN_LABEL: Record<BanStatus, string> = {
  forbidden: 'Forbidden',
  limited: 'Limited',
  'semi-limited': 'Semi-Limited',
  unlimited: 'Unlimited',
}

/**
 * Genesys is a points format: cards cost points and a legal deck stays within a
 * fixed budget. The official budget is 100.
 * ponytail: hard-coded budget; lift to config if Genesys rules change.
 */
export const GENESYS_POINT_BUDGET = 100

export const CARDS_PER_PAGE = 60

/** localStorage key for the in-progress deck draft. */
export const DRAFT_KEY = 'deck-editor-draft'

/** sessionStorage handoff to the preview page (the `/convert` body). */
export const PREVIEW_KEY = 'deck-editor-preview'

// --- Filter option lists -------------------------------------------------

export const ATTRIBUTES = ['DARK', 'LIGHT', 'EARTH', 'WATER', 'FIRE', 'WIND', 'DIVINE']

/** Common monster types + spell/trap "races" — offered as a datalist so the
 * `race` filter accepts any value the API knows while suggesting the usual. */
export const RACES = [
  'Aqua', 'Beast', 'Beast-Warrior', 'Creator-God', 'Cyberse', 'Dinosaur',
  'Divine-Beast', 'Dragon', 'Fairy', 'Fiend', 'Fish', 'Insect', 'Machine',
  'Plant', 'Psychic', 'Pyro', 'Reptile', 'Rock', 'Sea Serpent', 'Spellcaster',
  'Thunder', 'Warrior', 'Winged Beast', 'Wyrm', 'Zombie',
  'Normal', 'Field', 'Equip', 'Continuous', 'Quick-Play', 'Ritual', 'Counter',
]

/** Client-side refine chips: monster/spell/trap subtypes read from `type_tags`. */
export const SUBTYPES = [
  'Effect', 'Normal', 'Fusion', 'Synchro', 'Xyz', 'Link', 'Ritual', 'Pendulum',
  'Tuner', 'Flip', 'Toon', 'Spirit', 'Union', 'Gemini',
  'Quick-Play', 'Continuous', 'Field', 'Equip', 'Counter',
]

// --- SEO / AEO copy ------------------------------------------------------

export const SEO_KEYWORDS = [
  'yugioh deck builder',
  'yugioh deck editor',
  'yugioh deck creator',
  'yugioh deck maker',
  'tcg deck builder',
  'ocg deck builder',
  'genesys deck builder',
]

/** Answer-engine friendly Q&A rendered both as visible copy and FAQ JSON-LD. */
export const FAQ: { question: string; answer: string }[] = [
  {
    question: 'What is the YGO Omega deck builder?',
    answer:
      'The YGO Omega deck builder is a free online Yu-Gi-Oh! deck editor for building and testing Main, Extra, and Side Decks. Search the full card database, drag or right-click cards into your deck, and it validates your list against the TCG, OCG, and Genesys banlists in real time.',
  },
  {
    question: 'Which formats and banlists are supported?',
    answer:
      'You can build for the TCG, OCG, and Genesys formats. The editor tracks Forbidden, Limited, and Semi-Limited cards for the selected format and, for Genesys, keeps a running total of your point budget so your deck stays legal.',
  },
  {
    question: 'How do I export or share a deck?',
    answer:
      'Save or Export opens a preview with your deck code, YDKE URL, downloadable YDK file, printable PDF, and a shareable image — plus one-click import straight into the YGO Omega client.',
  },
  {
    question: 'Is the Yu-Gi-Oh! deck maker free?',
    answer:
      'Yes. The YGO Omega deck maker is completely free, runs in your browser, and needs no download or account to start building.',
  },
]
