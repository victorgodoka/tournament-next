'use client'

import { Lookup } from '@ui/lookup'
import { useResource } from '@hooks/index'
import { getDeck, panelErrorText } from '@utils/panel'
import { CardThumb, findCards, percent } from '../shared'

/** The cover candidates of one deck, inline in a table row: the most included cards of its pure lists, or any card. */
export const CoverPicker = ({ code, season, busy, onPick }: { code: number; season: number; busy: boolean; onPick: (card: number) => void }) => {
  const deck = useResource(`cover:${code}:${season}`, (signal) => getDeck(code, season, signal))
  if (deck.error) return <span className="cap">{panelErrorText(deck.error)}</span>
  if (!deck.data) return <span className="cap">Loading the candidates…</span>
  return (
    <div className="tiles" style={{ gap: 12 }}>
      {deck.data.cover.candidates.map((c) => (
        <button key={c.card} type="button" className="tile" disabled={busy} onClick={() => onPick(c.card)} style={{ background: 'transparent', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer', width: 92 }}>
          <CardThumb id={c.card} name={c.name} size={64} plain />
          <span className="nm">{c.name ?? c.card}</span>
          <span className="cap">{percent(c.inclusion)} of lists</span>
        </button>
      ))}
      <div className="fld" style={{ flex: '1 1 200px', alignSelf: 'flex-end' }}>
        <span className="lbl-sm">Or any card</span>
        <Lookup label="Any card as the cover" placeholder="Card name or passcode" search={findCards} onPick={(option) => onPick(Number(option.key))} />
      </div>
    </div>
  )
}
