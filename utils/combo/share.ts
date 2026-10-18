import { pipe } from '@utils/deck/codecs/omega'
import { assertDeck } from '@utils/deck/codecs/ydk'
import type { Deck } from '@utils/deck/types'
import { addRole, normalizeRole } from './roles'
import { LIMITS, type Analysis, type Build, type Calculation, type Draw, type Hand, type Roles, type Rule, type Subject } from './types'

export class ShareError extends Error {
  constructor(message?: string) {
    super(message)
    this.name = 'ShareError'
  }
}

const MAX_ID = 2147483647
const DECK_ID = /^[0-9a-f]{16}$/

const toBase64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
const fromBase64url = (text: string) => Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0))

/** The calculation as `?c=`: JSON → UTF-8 → raw DEFLATE → base64url. Roles travel as `[id, labels]` pairs. */
export const encodeShare = async (calc: Calculation): Promise<string> => {
  const json = JSON.stringify({ v: 1, ...calc, builds: calc.builds.map((b) => ({ ...b, roles: [...b.roles] })) })
  return toBase64url(await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw')))
}

const fail = (what: string): never => {
  throw new ShareError(`Invalid share link: ${what}`)
}
const isInt = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi
const int = (v: unknown, lo: number, hi: number, what: string): number => (isInt(v, lo, hi) ? v : fail(what))
const str = (v: unknown, max: number, what: string): string => (typeof v === 'string' && v.length <= max ? v : fail(what))
const obj = (v: unknown, what: string): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : fail(what))
const arr = (v: unknown, max: number, what: string): unknown[] => (Array.isArray(v) && v.length <= max ? v : fail(what))
const role = (v: unknown): string => {
  const clean = typeof v === 'string' ? normalizeRole(v) : null
  return clean ?? fail('role')
}

const subject = (v: unknown): Subject => {
  const s = obj(v, 'subject')
  if (s.kind === 'role') return { kind: 'role', role: role(s.role) }
  if (s.kind === 'card') return { kind: 'card', id: int(s.id, 1, MAX_ID, 'subject.id') }
  return fail('subject.kind')
}

const rule = (v: unknown): Rule => {
  const r = obj(v, 'rule')
  const min = int(r.min, LIMITS.rule[0], LIMITS.rule[1], 'rule.min')
  const max = r.max === null ? null : int(r.max, min, LIMITS.rule[1], 'rule.max')
  return { subject: subject(r.subject), min, max }
}

const hand = (v: unknown): Hand => {
  const h = obj(v, 'hand')
  return { name: str(h.name, LIMITS.handName, 'hand.name'), rules: arr(h.rules, LIMITS.rules, 'hand.rules').map(rule) }
}

const analysis = (v: unknown): Analysis => ({ hands: arr(obj(v, 'analysis').hands, LIMITS.hands, 'analysis.hands').map(hand) })

const draw = (v: unknown): Draw => {
  const d = obj(v, 'draw')
  return {
    going: d.going === 'first' || d.going === 'second' ? d.going : fail('draw.going'),
    handSize: d.handSize === null ? null : int(d.handSize, LIMITS.handSize[0], LIMITS.handSize[1], 'draw.handSize'),
    extraDraws: int(d.extraDraws, LIMITS.extraDraws[0], LIMITS.extraDraws[1], 'draw.extraDraws'),
    turn: int(d.turn, LIMITS.turn[0], LIMITS.turn[1], 'draw.turn'),
  }
}

const deck = (v: unknown): Deck => {
  const d = obj(v, 'deck')
  const zone = (z: unknown, what: string) => arr(z, 60, what).map((id) => int(id, 1, MAX_ID, what))
  const out = { main: zone(d.main, 'deck.main'), extra: zone(d.extra, 'deck.extra'), side: zone(d.side, 'deck.side') }
  try {
    assertDeck(out)
  } catch {
    fail('deck')
  }
  return out
}

const roles = (v: unknown): Roles => {
  let out: Roles = new Map()
  for (const pair of arr(v, 90, 'roles')) {
    const [id, labels] = arr(pair, 2, 'roles pair')
    const card = int(id, 1, MAX_ID, 'roles id')
    out = arr(labels, LIMITS.rolesPerCard, 'roles labels').map(role).reduce((acc, label) => addRole(acc, card, label), out)
  }
  return out
}

const build = (v: unknown): Build => {
  const b = obj(v, 'build')
  return {
    name: str(b.name, LIMITS.name, 'build.name'),
    deck: deck(b.deck),
    roles: roles(b.roles),
    format: b.format === null ? null : int(b.format, -MAX_ID, MAX_ID, 'build.format'),
    deckId: b.deckId === null ? null : typeof b.deckId === 'string' && DECK_ID.test(b.deckId) ? b.deckId : fail('build.deckId'),
  }
}

/** `?c=` back to a calculation. The URL is untrusted: anything off throws `ShareError`. */
export const decodeShare = async (text: string): Promise<Calculation> => {
  if (text.length > LIMITS.share) fail('too long')
  let raw: unknown
  try {
    const bytes = await pipe(fromBase64url(text), new DecompressionStream('deflate-raw'))
    raw = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    fail('unreadable')
  }
  const r = obj(raw, 'payload')
  if (r.v !== 1) fail('version')
  const builds = arr(r.builds, LIMITS.builds, 'builds')
  if (!builds.length) fail('builds')
  return {
    builds: builds.map(build),
    analysis: analysis(r.analysis),
    draw: draw(r.draw),
    focus: r.focus === null ? null : subject(r.focus),
  }
}
