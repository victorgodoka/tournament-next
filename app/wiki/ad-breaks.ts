/**
 * The index's in-list banners: the ordinal of the one that follows the row at `index`, or `null`.
 * Never after the last row: a banner closes nothing there.
 */
export const adAfter = (index: number, total: number, every = 12): number | null =>
  (index + 1) % every === 0 && index < total - 1 ? (index + 1) / every : null
