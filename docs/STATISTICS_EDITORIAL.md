# Ranked statistics: articles, reports and images

Reviewed November 7, 2026. The implementation in omega-server-v3 is the source for
the calculation; `utils/statistics.ts`, `scripts/tier-list.ts` and
`scripts/wiki-tier-list.ts` define editorial selection.

## Calculation and tier rules

We fit strength to individual ranked games with both deck strengths, first-turn order
and the previous-day rating gap. Expected win rate compares a deck with the other decks
in the selected field, weighted by share, with equal ratings and the turn-order term at
zero. Regularization shrinks strength estimates toward the ladder mean. The strength
interval widens with excess daily variation. Raw win rate remains wins divided by wins,
losses and draws; games without a result stay outside rates, and the strength fit excludes
draws. Mirrors contribute to share and the turn/rating coefficients, not raw deck rates.

Tiers use gaps from the eligible leader's expected win rate. Tier 1 holds at most two
decks; further decks within its gap take Tier 1.5. The build returns its gaps and floors
as `fit.tiers`. Read those values instead of assuming defaults. The script refuses a
build with the former absolute-anchor shape.

The article uses `band=aggregate`. A game's band comes from the mean of both players'
previous-day ratings, each capped; Gold is the default aggregate floor. Gold+ does not
mean both players individually hold Gold. Eligibility filters apply before band selection.

The November 1 statistical review and implementation plans record earlier decisions.
Their original absolute-anchor proposal and uncapped Tier 1 do not describe today's code.

## Deck coverage

- Tier-list articles show Tiers 1–3 and the five strongest Tier 4 builds by expected win
  rate, with key order as the tie-break. The live statistics page retains every eligible deck.
- Tier-board images use the same Tier 4 cap. Other tiers may use a More tile when the
  layout fills. Others counts the Tier 4 builds beyond the five shown. Its visual box uses
  the same square dimensions as that tier's artwork, within a normal tile-width slot.
- Meta-report text and images cover current Tiers 1–3. A family appears only when its
  most played tiered member qualifies. We filter before taking the top five movers.
- Tier changes can include a previous Tier 4 deck promoted to Tier 3 or better. A deck
  that remains Tier 4 or drops to Tier 4 falls outside current report coverage.
- Snapshots keep all tiered builds, including every Tier 4 build. Capping snapshots would
  hide promotions in the next report.

## Comparison periods

**Tier changes** compare with the newest saved snapshot dated before the issue. The
snapshot must come from the rebuilt engine and match the season, band, aggregate floor
and tier rules for that ladder. The script omits an incompatible ladder's comparison;
it does not interpret a missing comparison as no changes. Rerunning an issue excludes
that issue's own snapshot. A snapshot records generation, not verified publication.

**Share changes** compare the last two seven-day blocks counted from the season opening.
The latest block can be short. The script sums family members' weekly shares, so these
changes describe a family while the tier and expected rate describe its representative
build. These changes do not compare report publication dates or season-share snapshots.

**Strength shifts** use consecutive season-week fits and the API's 3.5 combined-standard-
error flag. The threshold reduces false signals across repeated comparisons; it cannot
guarantee that a flagged change reflects a lasting improvement.

## Generation and review

Run `scripts/wiki-tier-list.ts YYYY-MM-DD` with `tsx --tsconfig tsconfig.json`. It writes
two tier-list JSONs, the dated report, the methodology article and a full snapshot under
`docs/wiki-pages`, plus eight JPGs under `public/wiki-images`.

- `WIKI_API` overrides the data API; otherwise it uses `NEXT_PUBLIC_API_URL`.
- `WIKI_IMAGE_BASE=http://localhost:5173` renders the updated image routes on the local app.
  Use the same statistics build for that app and the generator.
- The script validates the wiki document contract and prints the editor's SEO checks.
  Check titles, descriptions, headings, alt text and captions against the output. A score
  from that checker does not verify indexing, traffic or search ranking.
- Keep dated reports as historical records. Mark a report from the old engine with a
  method note; do not replace its old results with today's season totals under its old date.
- Import the JSONs into the editor after their assets deploy. Creating these files does
  not publish an article. When adding methodology links, publish the methodology article
  before the referring copy. Its hub and related tier-list pages must already exist.

The public explanation lives in `ygo-omega-statistics-methodology.json`; the generator
maintains its text in `scripts/statistics-methodology.ts`. It targets the calculation
question. Tier lists target format rankings, while dated reports target changes, avoiding
three copies of the same article with swapped keywords.
