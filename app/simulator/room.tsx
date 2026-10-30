/** Circuits falling either side of the table, in the hero's hand: straight runs, chamfered bends. In a 1600 × 900 box. */
const TRACES = [
  'M64 0V170L104 210V372L68 408V640',
  'M132 0V96L92 136V300L150 358V560L118 592V760',
  'M210 0V58L250 98V238L208 280V430',
  'M1536 0V170L1496 210V372L1532 408V640',
  'M1468 0V96L1508 136V300L1450 358V560L1482 592V760',
  'M1390 0V58L1350 98V238L1392 280V430',
]

/** A pane of glass adrift: `[left %, top %, width px, turn °, drift s, delay s]`. */
const SHARDS: [number, number, number, number, number, number][] = [
  [6, 24, 44, 18, 26, -3],
  [13, 58, 28, -24, 31, -11],
  [3, 70, 52, 40, 22, -17],
  [18, 12, 20, 62, 35, -6],
  [91, 18, 46, -16, 28, -9],
  [84, 52, 26, 30, 33, -2],
  [94, 66, 40, -48, 24, -14],
  [88, 36, 18, -70, 37, -20],
]

/** Behind the table: deep space, the dot field, the hero's rays and the circuits. Nothing here takes a pointer. */
export const Room = () => (
  <div aria-hidden className="sim-room">
    <div className="sim-room-dots dots" />
    <div className="sim-room-art" />
    <svg className="sim-room-traces" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMin slice">
      <defs>
        <linearGradient id="sim-trace-ink" x1="0" y1="0" x2="0" y2="760" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--color-cyan)" stopOpacity="0.75" />
          <stop offset="1" stopColor="var(--color-azure)" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {TRACES.map((d) => (
        <path key={d} className="sim-trace-halo" d={d} />
      ))}
      {TRACES.map((d) => (
        <path key={d} className="sim-trace" d={d} />
      ))}
      {TRACES.map((d, i) => (
        <path key={d} className="sim-trace-pulse" d={d} pathLength={100} style={{ '--d': `${-i * 2.3}s` } as React.CSSProperties} />
      ))}
    </svg>
    {SHARDS.map(([x, y, s, r, t, d]) => (
      <svg
        key={`${x}:${y}`}
        className="sim-shard"
        viewBox="0 0 30 40"
        style={{ '--x': `${x}%`, '--y': `${y}%`, '--s': `${s}px`, '--r': `${r}deg`, '--t': `${t}s`, '--d': `${d}s` } as React.CSSProperties}
      >
        <path d="M6 1 29 7 23 39 1 31Z" />
      </svg>
    ))}
  </div>
)
