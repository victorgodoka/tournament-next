'use client'

import { createContext, useContext } from 'react'
import { SIDE } from './primitives'

/** The side colours in use; `MatchAnalytics` swaps them so the opponent is always gold. */
export const SideTones = createContext(SIDE)

export const useSideTones = () => useContext(SideTones)
