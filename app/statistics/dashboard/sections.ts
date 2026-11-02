/** The four questions, in page order: the anchors and the nav read it. Server-safe (no 'use client'). */
export const SECTIONS = ['play', 'face', 'beat', 'me'] as const
export type Section = (typeof SECTIONS)[number]
