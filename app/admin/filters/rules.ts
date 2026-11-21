import type { FilterRange, FilterRules } from '@utils/panel'

/** The values each rule of a filter offers, as the API names them (PANEL_API.md §9.2.3), and how they read. */
const title = (value: string) => value.split('_').map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ')

export const ATTRIBUTES = ['dark', 'light', 'earth', 'water', 'fire', 'wind', 'divine']
export const RACES = [
  'warrior', 'spellcaster', 'fairy', 'fiend', 'zombie', 'machine', 'aqua', 'pyro', 'rock', 'winged_beast', 'plant', 'insect', 'thunder',
  'dragon', 'beast', 'beast_warrior', 'dinosaur', 'fish', 'sea_serpent', 'reptile', 'psychic', 'divine_beast', 'creator_god', 'wyrm', 'cyberse', 'illusion',
]
/** Shown before "All 26 types" is opened. */
export const COMMON_RACES = 8
export const FRAMES = ['normal', 'effect', 'ritual', 'fusion', 'synchro', 'xyz', 'pendulum', 'link']
export const ABILITIES = ['tuner', 'flip', 'gemini', 'spirit', 'union', 'toon']
export const SPELL_TRAP = ['normal', 'continuous', 'quickplay', 'field', 'equip', 'ritual', 'counter']

const LABEL: Record<string, string> = { quickplay: 'Quick-Play', xyz: 'Xyz', beast_warrior: 'Beast-Warrior', winged_beast: 'Winged Beast', divine_beast: 'Divine-Beast' }
export const label = (value: string, upper = false) => LABEL[value] ?? (upper ? value.toUpperCase() : title(value))

const range = (name: string, r: FilterRange) =>
  r.min === null && r.max === null ? null : r.min === r.max ? `${name} ${r.min}` : r.min === null ? `${name} up to ${r.max}` : r.max === null ? `${name} ${r.min} or more` : `${name} ${r.min}–${r.max}`

/** A filter read as pills, in the order of the builder. `mentions`: the quoted cards' names, by id. */
export const rulePills = (rules: FilterRules, mentions: ReadonlyMap<number, string> = new Map()): string[] =>
  [
    rules.kind ? label(rules.kind) : null,
    rules.extraDeck === null ? null : rules.extraDeck ? 'Extra deck' : 'Main deck',
    ...rules.attributes.map((v) => label(v, true)),
    ...rules.races.map((v) => label(v)),
    ...rules.frames.map((v) => label(v)),
    ...rules.abilities.map((v) => label(v)),
    range('Level', rules.level),
    range('ATK', rules.atk),
    range('DEF', rules.def),
    ...rules.spellTrapTypes.map((v) => label(v)),
    ...rules.terms.map((t) => `"${t}"`),
    ...rules.mentions.map((id) => `Quotes "${mentions.get(id) ?? id}"`),
  ].filter((pill): pill is string => pill !== null)

/** Whether anything is picked: a filter with nothing picked matches no card. */
export const hasRules = (rules: FilterRules) => rulePills(rules).length > 0
