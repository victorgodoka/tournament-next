# Combo calculator — design

Date: 2026-10-18
Status: approved in brainstorming, awaiting spec review
Repos: `tournament-next` (front only). `omega-server-v3` is not touched.

## Goal

A Yu-Gi-Oh! deck consistency calculator at `/calculator`: the player loads a deck (one of their saved
decks, a pasted Omega / ydke / `.ydk` code, a file, or the deck open in the deck builder), labels cards
with roles (Starter, Extender, Hand Trap, Brick, custom), defines what a playable hand is, and gets exact
probabilities. Every calculation is a shareable link. It is the "odds calculator" and "hand simulator" the
deck editor spec (`2026-10-16-deck-editor-design.md`, Analysis) deferred, built as its own page.

The core requirement is correctness of combined conditions: AND, OR, min/max, negatives and overlapping
roles are computed exactly, never by multiplying probabilities as if cards or roles were independent.

## Decisions

| Topic | Decision |
|---|---|
| Backend | None. Saved decks (`GET /decks/mine`, `GET /decks/:id`, `PATCH /decks/:id`), cards (`GET /cards?id=`) and banlists (`GET /banlists`) already serve everything |
| Roles | Stored in the saved deck's existing `tags` field (`{ [passcode]: string[] }`, ≤ 8 labels per card, ≤ 24 chars each; the server already validates it). The calculator is the first UI to write it |
| Share link | `/calculator?c=<payload>`: the whole calculation (deck, roles, hands, draw settings) compressed in the URL. No table, no expiry, never breaks when the saved deck changes |
| Route and nav | `/calculator`; Tools menu entry "Combo Calculator" |
| Deck builder | New export entry "Combo Calculator": opens `/calculator?d=<ydke>&name=…&deck=<id>` in a new tab |
| Exact engine | Multivariate hypergeometric over *atoms* (groups of cards with the same role signature). Enumerates hand compositions; BigInt counts; exact fractions |
| Condition model | A playable hand is an AND of rules `{ subject, min, max }`; the analysis is an OR of hands. No free-form boolean tree: OR-of-ANDs expresses any boolean condition |
| Monte Carlo | Only for draw effects that select cards (Prosperity, Desires…) and for the hand simulator. Always labelled as an estimate, with the exact figure beside it where one exists |
| Phases | 1 core calculator, 2 comparator and sweeps, 3 simulator and draw effects |

## Constraints found during exploration

- **Deck codecs** exist in `utils/deck/codecs` (`omega`, `ydke`, `ydk`, `text`, `detect`) and
  `app/deck-builder/deck-io.ts#readDeck` resolves a pasted code of any format, looking cards up to split
  main from extra on Omega codes. The calculator reuses `readDeck` as is.
- **Card identity**: alternate artworks and double-script prints are one card. `utils/deck/model.ts`
  `canonicalId(card)` gives the identity; `cardsByIds` (`utils/cards.ts`) resolves any passcode to its
  card. The calculator groups copies by canonical id for probabilities.
- **`tags` keys must be passcodes present in the deck** (`checkTagKeys` on the server). Internally the
  calculator keys roles by canonical id; on write it keys each role set by the first passcode of that card
  found in the deck. On read, passcode keys map to canonical ids and labels merge (union).
- **Copy limits per format**: `utils/deck/rules.ts` `cardStatus(card, banlist)` returns the copies a
  list allows (0–3) or Genesys points. The what-if copy editor caps at that limit (3 without a list, or on
  a Genesys list).
- **`getBanlists`** (`utils/wiki.ts`) lists the formats; the deck builder picks the TCG list when the deck
  has no format. Same default here.
- **`?d=` convention**: the deck builder boots from `?d=<ydke>&name=`; `URLSearchParams` turns `+` into a
  space, so it restores them before decoding. The calculator does the same.
- **Omega code layout**: base64 of raw DEFLATE, written with the native `CompressionStream('deflate-raw')`.
  The share payload uses the same primitives (available in every browser the builder supports).
- **Front verification** is `tsc --noEmit`, eslint and vitest. React lint treats purity and
  set-state-in-effect as errors; the deck builder's client-only `dynamic(..., { ssr: false })` loader
  pattern handles state read from the URL.
- **Nothing runs in a worker today.** Exact calculations are small enough for the main thread (see
  Complexity). Monte Carlo at 100k hands is too, so phase 3 starts without a worker.

## Architecture

### `utils/combo/` — pure TypeScript, unit-tested

| File | Responsibility |
|---|---|
| `types.ts` | `Subject`, `Rule`, `Hand`, `Analysis`, `Draw`, `Roles`, `Build`, `Calculation` (below) |
| `hypergeometric.ts` | `choose(n, k): bigint`; `distribution(N, K, n)`: exact `P(X = k)` for one group as `{ favorable: bigint, total: bigint, p: number }[]`; helpers `atLeast(k)`, `exactly(k)`, `none()` |
| `atoms.ts` | `atomize(build, analysis, roles)`: the main deck as atoms (below), plus the index of which atoms count for each subject |
| `evaluate.ts` | `evaluate(build, analysis, draw)`: enumerates compositions, returns per hand and for the union `{ favorable, total, p }`; `drawCount(draw)` |
| `share.ts` | `encode(calc): Promise<string>` / `decode(text): Promise<Calculation>` for `?c=`; strict validation; throws `ShareError` |
| `roles.ts` | `rolesFromTags(tags, cards, deck)` (passcode keys → canonical), `tagsFromRoles(roles, deck, cards)` (canonical → first passcode in deck), `DEFAULT_ROLES` |
| `sweep.ts` (phase 2) | `sweepCopies(build, cardId, range, …)`, `sweepDeckSize(build, 40..60, …)`, `copiesFor(target)` |
| `simulate.ts` (phase 3) | `rng(seed)` (xorshift128+), `randomSeed`, `nextSeed`; `dealHand(cards, roles, analysis, draw, effects, extraSize, seed, extra)`; `monteCarlo(…, runs, rng)` → counts, `estimate(counts, exact)`, `standardError`; the draw-effect scripts and the excavation policy |

**Types**

```ts
type Subject = { kind: 'role'; role: string } | { kind: 'card'; id: number }   // id: canonical
type Rule = { subject: Subject; min: number; max: number | null }              // null: no upper bound
type Hand = { name: string; rules: Rule[] }                                     // AND of rules
type Analysis = { hands: Hand[] }                                              // OR of hands
type Draw = { going: 'first' | 'second'; handSize: number | null; extraDraws: number; turn: number }
type Roles = Map<number, string[]>                                             // canonical id → roles
type Build = { name: string; deck: Deck; roles: Roles; format: number | null; deckId: string | null }
type Effects = { resolve: number[]; prosperity: 3 | 6; extravagance: 3 | 6 }               // phase 3; resolve: canonical ids
type Calculation = { builds: Build[]; analysis: Analysis; draw: Draw; focus: Subject | null; seed: number; effects: Effects }
```

`seed` (phase 3) is a 32-bit unsigned integer that seeds the hand simulator; `effects` holds which draw-effect
cards resolve when drawn and how many Extra Deck cards Prosperity and Extravagance banish (default none, 6, 6).

`drawCount(draw) = (draw.handSize ?? (draw.going === 'first' ? 5 : 6)) + draw.extraDraws + (draw.turn - 1)`.
Going second is the 6-card opening; `handSize` overrides it when set (1–20). `turn` 1–10; each later turn
adds one normal draw. `extraDraws` 0–20 covers plain draw effects (Upstart Goblin, Extravagance) exactly:
they are just more cards seen. `drawCount` must not exceed the main deck size. `focus` is the subject the
single-card panel shows.

Only `deck.main` is ever drawn from. Extra and side are kept in the build (for the deck builder link and
display) and never enter the probability.

**Atoms.** Each distinct main-deck card (by canonical id, or by passcode when the API does not know
it) has a copy count and a role set. The *referenced subjects* are the roles and cards any rule of the
analysis or the focus mentions. A card's *signature* is the set of referenced subjects it satisfies: its
referenced roles, plus itself when a rule names it. Cards with the same signature merge into one atom;
cards with an empty signature merge into the "other" atom. This is what makes overlap exact: a card
tagged Starter and Engine sits in one atom that counts for both subjects once.

**Evaluation.** With atoms `A_1..A_m` of sizes `K_i`, deck size `N = Σ K_i`, draw `n`: enumerate every
composition `(k_1..k_m)` with `Σ k_i = n` and `0 ≤ k_i ≤ K_i` recursively over the referenced atoms, the
"other" atom taking the remainder (one dimension fewer). Each composition weighs
`Π C(K_i, k_i)` (BigInt). For every hand, `count(subject) = Σ k_i` over atoms whose signature contains
the subject; the hand passes when every rule has `min ≤ count ≤ max`. The analysis passes when any hand
passes. One pass sums the weights of the compositions each hand passes, and of those any hand passes:
`favorable_h`, `favorable_any`; `total = C(N, n)`. `p = Number(favorable) / Number(total)`: the counts
are exact BigInts (what the UI prints as the fraction); the division is a double, accurate to 15 digits
even when a count exceeds 2^53 (`C(60, 30) ≈ 1.2e17`).

The single-card panel is the same engine with the focus as the only subject, reported through
`distribution`: `P(X = k)` for `k = 0..min(K, n)`, `P(X ≥ 1)`, `P(X ≥ 2)`, `P(X = 0)`.

**Complexity.** Compositions ≤ `C(n + m − 1, m − 1)` with `m` referenced atoms. Typical use (`m ≤ 8`,
`n ≤ 8`) is a few thousand; `m = 15, n = 8` is ~320k, still instant. `evaluate` refuses above 5 000 000
estimated compositions and returns `{ tooComplex: true }`; the UI says so and suggests fewer distinct
roles. `// ponytail: full enumeration; DP over capped per-subject counts if players hit the ceiling`.

**Share payload** (`?c=`). JSON of `Calculation` with `roles` as `[id, string[]][]`, encoded as
UTF-8 → raw DEFLATE → base64url (`-`/`_`, no padding). Versioned: `{ v: 2, ... }` since phase 3 (`v: 1`
had no `seed` or `effects`; the decoder still accepts it, giving a fresh random seed and the default
effects). A 40-card deck with ten roles and three hands is ~600–900 characters. `decode` validates every
field (types, ranges, zone sizes via `assertDeck`, ≤ 8 roles per card, ≤ 24 chars per role, ≤ 12 hands,
≤ 12 rules per hand, ≤ 6 builds, `seed` a 32-bit integer, `effects.resolve` ≤ 5 distinct known effect ids,
banish counts 3 or 6) and throws `ShareError` on anything else: the URL is a trust boundary.

### `app/calculator/`

| Path | Contents |
|---|---|
| `page.tsx` | Server entry, `pageMetadata({ title, path: '/calculator' })`, `Header`, renders the loader |
| `calculator.loader.tsx` | `dynamic(() => import('./calculator.client'), { ssr: false })`: state boots from the URL |
| `calculator.client.tsx` | State (`useReducer`), boot from `?c=` or `?d=&name=&deck=`, URL sync, layout |
| `calculator.reducer.ts` | Actions: `load`, `setRoles`, `setCopies`, `addHand`, `setRule`, `removeHand`, `setDraw`, `setFocus`, `setFormat`, `reset` |
| `deck-picker.tsx` | Dialog: tabs My decks (`listMyDecks`, sign-in prompt when signed out), Paste (`readDeck`), File (`.ydk`) |
| `card-roles.tsx` | Distinct main-deck cards with art, name, copies −/+ (what-if), role chips; extra/side collapsed as "not drawn" |
| `hand-builder.tsx` | Hands and rules editor |
| `results.tsx` | Draw settings, single-card panel, hands panel, fractions, share button |
| `use-calculation.ts` | `useMemo` over `evaluate` for the current state |
| `compare.tsx` (phase 2) | Builds side by side, deltas, sweeps charts |
| `simulator.tsx` (phase 3) | Sample hands, Monte Carlo runs, draw effects |

Strings under a new `Calculator` namespace in `messages/pt.json` and `messages/en.json`.

### Other touch points

- `utils/const.ts`: Tools → `{ item: "Combo Calculator", to: "/calculator" }`.
- `app/deck-builder/toolbar.tsx`: `ExportKind` gains `'calculator'`, listed last in the export menu.
- `app/deck-builder/deck-editor.client.tsx` `exportAs`: `'calculator'` opens
  `/calculator?d=<toYdke(deckIn(deck, cards, false))>&name=<name>&deck=<deckId>` (`deck` only when the
  deck is saved) with `window.open(url, '_blank')`. An empty deck shows the existing `io.empty` toast.

## Boot and URL sync

1. `?c=` present → `decode`. Failure → empty calculator and the notice `damagedLink`.
2. Else `?d=` present → `fromYdke` (after `+` restore) into one build named `?name=` (or "Deck");
   `deck=<id>` → `getDeck(id)`; when it resolves, `rolesFromTags(saved.tags)` fills the roles and the
   build's `format` and `deckId` are set. A failed or 404 lookup keeps the deck and shows no roles.
3. Else empty: the deck picker opens.

On every state change the URL is rewritten with `history.replaceState` to `?c=<encode(state)>`, debounced
300 ms, so the address bar is always the share link. "Copy link" copies `location.href` and toasts. The
`?d=` form is replaced by `?c=` on first sync.

Roles default to `['Starter', 'Extender', 'Hand Trap', 'Brick']` as the palette, plus whatever the deck's
tags or the link bring; the user adds custom ones (≤ 24 chars, trimmed, case preserved, matched
case-insensitively on write to avoid `starter`/`Starter` duplicates).

## UX

Desktop: two columns. Left, the deck: name, format `Select` (same options as the builder), deck size and
draw count, the card list with roles and copies. Right, sticky: draw settings (`Segmented` first/second,
hand size, extra draws, turn), the single-card panel, the hands panel, Copy link, Open in deck builder.
Below 1024 px the columns stack, results first, 44 px targets like the builder.

**Deck picker** (`Dialog`): My decks lists name, label, counts, updated; Open loads `getDeck`
(cards, format, tags, deckId). Paste: textarea + `readDeck`, `DeckCodeError` → inline error. File:
`.ydk` only, ≤ 64 KB like the builder. A deck replaces the current build; roles are kept for cards that
stay (by canonical id) and dropped for cards that leave.

**Card roles**: one row per distinct main-deck card, in deck order: art thumb (`CARD_ART_URL`), name
(passcode when unknown), copies with −/+ bounded by `[0, limit]` where limit is `cardStatus` for the
format (3 without a list or on Genesys). A changed count marks the row and shows "Restore" (back to the
loaded deck). Roles are `FilterChip`s from the palette; a `+` adds a custom role. Extra and side decks
are a collapsed list labelled "not drawn". Cards the API does not know are counted and shown by passcode
with a muted note; they can still get roles.

**Hands**: a list of hands, each with a name (default "Hand 1", "Hand 2"…) and rules. A rule is a subject
`Select` (every role in the palette, then every distinct card), `min` (0–20) and `max` (blank = none; a
`max` below `min` is rejected inline). Presets on an empty analysis, each creating one hand: "≥1 Starter",
"≥1 Starter + ≥1 Hand Trap", "≥1 Starter + ≥1 Hand Trap, no Brick" (Brick `max 0`). Each hand shows its
own probability inline; the panel header shows "Any hand". A rule on a role no card has is flagged "no
card has this role".

**Results**: percentages with two decimals and the exact fraction `favorable / total` underneath, both
formatted with `useFormatter`. Single-card panel: subject `Select` (defaults to the first Starter card,
else the first card), `P(≥1)`, `P(≥2)`, `P(0)`, and `P(= k)` for each possible `k` as a small table.
Deck smaller than the draw count → results replaced by the notice `tooFewCards`. `tooComplex` → notice.

**Save roles to deck**: shown when the build has a `deckId` and `getDeck` returned `ownerId === user.id`.
Sends `updateDeck(deckId, { tags: tagsFromRoles(...) }, revision)`. Success toasts; `409` toasts
`deckChanged` and offers Reload (which re-reads the deck and its tags). Signed out: the button is hidden.

**Open in deck builder**: link to `/deck-builder?d=<ydke>&name=<name>` (the builder's own convention);
with a `deckId` and the user as owner, `/deck-builder/<id>` instead.

## Phase 2 — comparator and sweeps

- `builds` grows to several (≤ 6). Add build: from My decks, paste, file, or "Duplicate" (copy of the
  current build, to tweak copies). Each has its own name, format, roles and copies; the analysis and draw
  settings are shared. Tabs switch which build the roles editor edits.
- `compare.tsx`: a `DataTable` with one column per build: deck size, each hand's `p`, "Any hand", and
  per-row delta against build A in percentage points. Builds come and go through the same reducer; the
  share link carries them all.
- **Sweeps** (`LineChart`): pick a card → copies from 0 to its limit, one series per hand plus "Any";
  pick deck size → 40..60 by adding or removing cards of the "other" atom (filler); pick turn → 1..6.
  A target field (default 80 %) prints the first copies count / deck size / turn that reaches it, or
  "not reached".
- **OPT badge**: a card whose `description` matches `/once per turn/i` shows "OPT"; one matching
  `/you can only (use|activate) (this|1) .* (once|per turn)/i` shows "HOPT". Informational only, so a
  player remembers to set `max: 1` where extra copies are dead.

## Phase 3 — simulator and draw effects

Decided with Victor on 2026-10-19 (the three open items of the first draft): the excavation policy below
stands as the default; Prosperity **and** Extravagance each get a 3 / 6 banish control saved in the link;
short links are not part of this phase.

- **Random numbers**: `rng(seed)` is xorshift128+ in 32-bit halves, its 128-bit state expanded from a
  32-bit `seed` with splitmix32; `randomSeed()` draws one from `crypto.getRandomValues`; `nextSeed(seed)`
  is one splitmix32 step, what "Deal again" dispatches. `emptyCalculation()` and a `v: 1` link get a
  random seed; otherwise the seed travels in the link, so a shared link reproduces the hand and the
  simulation.
- **Pile**: the main deck's canonical ids; `draw()` is one Fisher–Yates step (swap a random undrawn card
  into the next position), so a hand of `n` cards costs `n` swaps; `bottom(ids)` takes cards out of the
  pool (Prosperity's leftovers), `shuffleBack(ids)` returns them to it (Duality's).
- **Deal a hand**: `dealHand(cards, roles, analysis, draw, effects, extraSize, seed, extra)` is pure:
  the opening `drawCount` cards, then the toggled effects, then `extra` more cards. It returns the hand
  (ids), which hands pass and whether any does, and a log of what each effect did. Cards render with
  their role chips, the referenced roles highlighted, and a pass/fail line per hand and for "Any". "Deal
  again" advances the seed; "Draw next" is `extra + 1` on the same seed (the same hand plus one card);
  `extra` is UI state, not part of the link.
- **Simulate**: `runs` (10 000 default, 1 000 to 200 000) hands; `monteCarlo(…, runs, rng)` returns raw
  counts (`runs`, hits per hand, any) so the page sums chunks of 5 000 run between animation frames;
  `estimate(counts, exact)` gives per hand and for "Any" the observed rate, the exact `p` without effects
  beside it ("—" when `evaluate` is `tooComplex`, the case the simulator exists for), the difference in
  percentage points, and the 95 % half-width `1.96 · √(p̂(1−p̂)/runs)`. Results carry the inputs they were
  computed for and render as stale once the deck, roles, hands, draw or effects change.
  `// ponytail: main thread; a worker if runs above 200k are wanted`.
- **Draw effects**, each a scripted step applied after the opening hand when the card is in hand and the
  player toggled "resolve when drawn" (`effects.resolve`, by canonical id; off by default). Passcodes
  confirmed against `GET /cards?id=` on 2026-10-19; Extravagance's alternate art 49238329 canonicalizes to it.
  - Pot of Desires (35261759): banish the top 10 face-down, draw 2. Once per turn.
  - Pot of Prosperity (84211599): banish `effects.prosperity` (3 or 6) from the Extra Deck, excavate as
    many, add one by the policy, the rest to the bottom. Once per turn; cannot be activated after an
    effect draw this turn; locks effect draws for the rest of the turn. (Its text has no "skip the normal
    draw" clause; the first draft was wrong.)
  - Pot of Duality (98645731): excavate 3, add one by the policy, shuffle the rest back. Once per turn.
  - Pot of Extravagance (49238328): banish `effects.extravagance` (3 or 6) from the Extra Deck, draw 1 per
    3. Locks effect draws for the rest of the turn (so a second copy is dead).
  - Upstart Goblin (70368879): draw 1. No once-per-turn clause: every copy resolves until a lock.
  - A banish is capped by the build's Extra Deck size (6 → 3 when it holds 3 to 5 cards; fewer than 3: the
    card cannot resolve, and the log says so). Resolution order is fixed: Extravagance, Prosperity, Duality,
    Desires, Upstart; the loop repeats while a toggled, resolvable effect sits in hand, so an effect drawn
    by an effect resolves too. A resolved card leaves the hand before the rules are checked. (Exact users
    of Upstart and Extravagance should prefer `extraDraws`; the toggles exist so one simulation can mix
    effects.)
  - Policy for "add one of the excavated": for each hand in its listed order, the first excavated card
    that completes it given the current hand; else the first excavated card that advances any rule (it
    satisfies a referenced subject whose count is still below that rule's `max`); else the first excavated
    card. Deterministic and documented in the UI tooltip.
  - Results are labelled "Estimate (Monte Carlo, N hands)" and never shown next to an exact figure
    for the same question, only below it: the simulator panel closes the left column, under the exact
    panels, the compare table and the sweeps.
- **UI** (`simulator.tsx`, one `Panel`): a Draw effects block with one row per effect card in the active
  build's main deck (art, name, a `Switch` "Resolve when drawn", a 3 / 6 `Segmented` on Prosperity and
  Extravagance; a muted line naming the supported cards when the deck has none); the Deal a hand block;
  the Simulate block (runs field, Simulate / Stop, progress, the estimates table). Reducer actions
  `setSeed`, `toggleEffect` (known ids only), `setBanish`. Strings under `Calculator.simulator`.

## Error handling

- Damaged `?c=` or `?d=`: empty calculator, `Alert` `damagedLink`, picker opens.
- `getDeck` fails (network, 404, 401): the deck from `?d=` stays, roles are empty, `Alert`
  `deckRolesUnavailable` with Retry. From My decks: inline error in the dialog with Retry.
- Card lookup fails (`cardsByIds`): rows show passcodes and a `lookupFailed` notice with Retry; the
  probabilities still compute (unknown cards are their own atoms).
- Banlists fail (`getBanlists` → `[]`): format `Select` disabled, copy limit 3.
- `PATCH` 409 → `deckChanged` + Reload; 400 → `saveRejected`; 401 → sign-in link via `setReturnTo`.
- Deck smaller than draw, `tooComplex`, hand with zero rules, rule on an unused role: inline notices,
  no results for the affected part.
- Clipboard API missing or denied on Copy link: the URL appears in a read-only `TextInput` to copy by hand.

## Testing

`utils/combo/*.test.ts` (vitest):

- `choose(40, 5) = 658008n`; `distribution(40, 3, 5)`: `P(≥1) = 1 − 435897/658008`.
- Overlap: a card `{Starter, Engine}` ×3 and a card `{Starter}` ×3 in 40 → `P(≥1 Starter)` equals the
  single-group figure with `K = 6`.
- Brute force oracle: for small decks (`N ≤ 14`, `n ≤ 5`) enumerate every subset of the actual card
  multiset and compare `evaluate` for AND, OR, min/max, `max 0`, a rule naming a card, and the union of
  two overlapping hands (inclusion–exclusion must hold, the sum must not).
- `drawCount`: first/second, override, extra draws, turn.
- `tooComplex` at the ceiling; `n > N` rejected.
- `share`: round trip of a full `Calculation`; rejects garbage, wrong version, out-of-range fields,
  oversized zones, > 8 roles per card.
- `roles`: tags → roles with alt-art keys merging into one canonical id; roles → tags keyed by a passcode
  present in the deck.
- Phase 2: sweep endpoints match `evaluate` called directly; `copiesFor` returns `null` when the target
  is unreachable. Phase 3: `rng` is reproducible from a seed and uniform enough; seeded `dealHand` is
  reproducible and "Draw next" keeps the first cards; `monteCarlo` on a deck with no effects lands within
  3 standard errors of `evaluate` at 50k runs; each effect script on a fixed deck, the once-per-turn and
  lock rules, chaining, the Extra Deck cap, the excavation policy, a resolved card leaving the hand;
  `share` round-trips `seed` and `effects`, decodes a `v: 1` payload, refuses bad `effects`.

Component tests (happy-dom): the toolbar export menu lists "Combo Calculator" and `exportAs` opens the
URL with `d`, `name` and `deck`; the deck picker's Paste tab turns a ydke into a build; the loader with a
damaged `?c=` shows the notice.

Verification per phase: `tsc --noEmit`, `eslint`, `vitest run`, then the page in the browser on desktop
and phone widths.

## Phases

Each phase gets its own implementation plan and ships on its own.

1. **Core**: `utils/combo` (types, hypergeometric, atoms, evaluate, share, roles) with tests; the page,
   picker, roles editor with what-if copies and format limits, hand builder, results, draw settings
   (first/second, hand size, extra draws, turn), URL sync and Copy link, Save roles to deck, Open in deck
   builder, deck builder export entry, nav entry, pt/en strings.
2. **Comparator and sweeps**: multiple builds, compare table with deltas, copies / deck size / turn
   sweeps with target, OPT/HOPT badges.
3. **Simulator**: seeded hand dealing, Monte Carlo runs with error bars, draw-effect scripts.

## Open items

- Short links (`/c/<id>`) if `?c=` URLs prove too long for Discord embeds; would need one table and two
  routes on `omega-server-v3`. Not part of phase 3 (decided 2026-10-19).

## Out of scope

Result export as image or PDF; calculation history or versions; opponent interaction modelling
(hand traps against the combo); side-deck planning; nested boolean trees beyond OR-of-ANDs; any change
to the game client or the deck editor beyond the export entry.
