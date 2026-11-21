'use client'

import { useResource } from '@hooks/index'
import { getDeckThird, panelErrorText, type DeckDetail, type DeckVariation } from '@utils/panel'
import { count, Cover, Failure, hex, percent } from '../../shared'

/** What the lists of an approved pair also play: one card per co-occurring archetype, to add as the third name. */
export const ThirdName = ({ lead, pair, season, busy, onAdd }: { lead: DeckDetail; pair: DeckVariation; season: number; busy: boolean; onAdd: (codes: number[], label: string) => void }) => {
  const second = pair.codes.find((c) => c !== lead.code)!
  const third = useResource(`third:${lead.code}:${season}:${second}`, (signal) => getDeckThird(lead.code, season, second, signal))
  const names = pair.names.map((n, i) => n ?? hex(pair.codes[i]!)).join(' / ')
  const top = Math.max(0.0001, ...(third.data?.thirds ?? []).map((t) => t.share))

  return (
    <div className="cut notch c-md f-000 pnl" style={{ gap: 14 }}>
      <div className="fx-b">
        <span className="who">
          {pair.codes.map((c) => (
            <Cover key={c} size={32} card={c === lead.code ? lead.cover.card : pair.covers.find((k) => k.code === c)?.card} />
          ))}
          <span className="col-s">
            <h3 className="t4">{names} · a third name</h3>
            <span className="cap">What else the {count(third.data?.lists ?? pair.lists)} lists of this variation play, staples left out</span>
          </span>
        </span>
        <span className="lbl-sm">Needs the same minimum as any secondary</span>
      </div>
      {third.error ? <Failure title="Couldn't read the third names">{panelErrorText(third.error)}</Failure> : null}
      <div className="g3" style={{ gap: 12 }}>
        {(third.data?.thirds ?? []).map((t) => (
          <div key={t.code} className="well col" style={{ gap: 10 }}>
            <div className="fx-b">
              <span className="who">
                <Cover size={32} card={t.cover?.card} />
                <span className="nm ink" style={{ fontWeight: 700 }}>
                  {t.name ?? hex(t.code)}
                </span>
              </span>
              <span className="mono ink">{percent(t.share)}</span>
            </div>
            <span className="bar g">
              <i style={{ width: `${(t.share / top) * 100}%` }} />
            </span>
            <div className="fx-b">
              <span className="cap">
                {count(t.lists)} lists · {t.cards.toFixed(1)} cards · {percent(t.winRate)} win rate
              </span>
              {t.state === 'on' ? (
                <span className="lbl-sm">On above</span>
              ) : (
                <button type="button" className="act" disabled={busy} onClick={() => onAdd([...pair.codes, t.code], t.name ?? hex(t.code))}>
                  Add as third name
                </button>
              )}
            </div>
          </div>
        ))}
        {third.data && third.data.thirds.length === 0 ? <p className="sm">No third archetype reaches the minimum in these lists.</p> : null}
        {!third.data && !third.error ? <p className="sm">Loading…</p> : null}
      </div>
    </div>
  )
}
