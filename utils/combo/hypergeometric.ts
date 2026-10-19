/** C(n, k) exactly; `0n` outside `0 ≤ k ≤ n`. */
export const choose = (n: number, k: number): bigint => {
  if (k < 0 || k > n) return 0n
  const m = Math.min(k, n - k)
  let result = 1n
  for (let i = 0; i < m; i++) result = (result * BigInt(n - i)) / BigInt(i + 1)
  return result
}

export type Odds = { favorable: bigint; total: bigint; p: number }

/** The counts stay exact; `p` is a double accurate to 15 digits even past 2^53. */
export const odds = (favorable: bigint, total: bigint): Odds => ({
  favorable,
  total,
  p: total === 0n ? 0 : Number((favorable * 10n ** 15n) / total) / 1e15,
})

/** `P(X = k)` for `k = 0..min(K, n)`: `n` cards drawn from `N`, `K` of them successes. */
export const distribution = (N: number, K: number, n: number): Odds[] => {
  const total = choose(N, n)
  return Array.from({ length: Math.min(K, n) + 1 }, (_, k) => odds(choose(K, k) * choose(N - K, n - k), total))
}

export const atLeast = (dist: Odds[], k: number): Odds => {
  const total = dist[0]?.total ?? 0n
  return odds(dist.slice(Math.max(0, k)).reduce((sum, o) => sum + o.favorable, 0n), total)
}
