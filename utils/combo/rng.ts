/** Uniform doubles and integers from a 32-bit seed: the same seed gives the same stream on every machine. */
export type Rng = { next(): number; int(n: number): number }

export const MAX_SEED = 0xffffffff
const GOLDEN = 0x9e3779b9

/** splitmix32's output function: spreads a counter over all 32 bits, so seed 0 still gives a live state. */
const mix = (x: number): number => {
  let t = x >>> 0
  t ^= t >>> 16
  t = Math.imul(t, 0x21f0aaad)
  t ^= t >>> 15
  t = Math.imul(t, 0x735a2d97)
  t ^= t >>> 15
  return t >>> 0
}

/** The step "Deal again" takes: a bijection on 32-bit seeds, so the walk never repeats before 2^32 deals. */
export const nextSeed = (seed: number): number => (seed + GOLDEN) >>> 0

export const randomSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0]!

/** xorshift128+ with V8's shifts (23, 17, 26); the two 64-bit words live as 32-bit halves because JS has no 64-bit integers. */
export const rng = (seed: number): Rng => {
  let h0 = mix(seed + GOLDEN)
  let l0 = mix(seed + 2 * GOLDEN)
  let h1 = mix(seed + 3 * GOLDEN)
  let l1 = mix(seed + 4 * GOLDEN)
  const next = () => {
    let sh = h0
    let sl = l0
    const th = h1
    const tl = l1
    h0 = th
    l0 = tl
    // s1 ^= s1 << 23
    let xh = (sh << 23) | (sl >>> 9)
    let xl = sl << 23
    sh ^= xh
    sl ^= xl
    // s1 ^= s1 >>> 17
    xh = sh >>> 17
    xl = (sl >>> 17) | (sh << 15)
    sh ^= xh
    sl ^= xl
    // s1 ^= s0; s1 ^= s0 >>> 26
    sh ^= th ^ (th >>> 26)
    sl ^= tl ^ ((tl >>> 26) | (th << 6))
    h1 = sh >>> 0
    l1 = sl >>> 0
    // state0 + state1, with the carry out of the low word
    const lo = l0 + l1
    const hi = (h0 + h1 + (lo > 0xffffffff ? 1 : 0)) >>> 0
    // 27 high bits and 26 low bits: a 53-bit mantissa, so every double in [0, 1) is reachable.
    return ((hi >>> 5) * 67108864 + ((lo >>> 0) >>> 6)) / 9007199254740992
  }
  return { next, int: (n) => Math.floor(next() * n) }
}
