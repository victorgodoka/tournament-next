/** Every section of the statistics page, in order: the tabs and `?section=` both read it. Server-safe (no 'use client'). */
export const SECTIONS = ['season', 'meta-shape', 'deck-ranking', 'matchups', 'compare', 'trends', 'sample-decks', 'cards', 'activity'] as const
export type Section = (typeof SECTIONS)[number]
export const sectionNum = (s: Section) => String(SECTIONS.indexOf(s) + 1).padStart(2, '0')
