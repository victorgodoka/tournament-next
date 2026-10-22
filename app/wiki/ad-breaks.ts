/**
 * The index's in-grid banners: the ordinal of the one that follows the card at `index`, or `null`.
 * 12 is whole rows at both 2 and 3 columns. Never after the last card: the bottom banner is there.
 */
export const adAfter = (index: number, total: number, every = 12): number | null =>
  (index + 1) % every === 0 && index < total - 1 ? (index + 1) / every : null
