'use client'

import { useState } from 'react'
import { Chip, FilterChip } from '@ui/chip'
import { Lookup } from '@ui/lookup'
import { useResource } from '@hooks/index'
import { listStaples, panelErrorText, resetStaple, setStaple, type Staple } from '@utils/panel'
import { CardThumb, count, Failure, findCards, Head, NextBuildNote, percent, RowAction, SeasonSelect, ShareBar, TWO_STEPS, useAction, useSeason } from '../shared'

type Only = 'all' | 'auto' | 'manual' | 'off'

const FILTERS: Record<Only, (s: Staple) => boolean> = {
  all: () => true,
  auto: (s) => s.source === 'auto',
  manual: (s) => s.source === 'manual',
  off: (s) => !s.enabled,
}

const StaplesPage = () => {
  const [picked, setPicked] = useState<number | null>(null)
  const { swept, season } = useSeason(picked)
  const staples = useResource(season === null ? null : `staples:${season}`, (signal) => listStaples(season!, signal))
  const [only, setOnly] = useState<Only>('all')
  const { run, pending, flash } = useAction(staples.reload)
  /** Each write says what it did and can be taken back. */
  const set = (s: Pick<Staple, 'card' | 'name' | 'enabled' | 'source'>, enabled: boolean) => {
    const label = s.name ?? `Card ${s.card}`
    run(`${s.card}:set`, setStaple(s.card, enabled), {
      title: enabled ? `${label} is a staple` : `${label} is not a staple any more`,
      body: `Set by hand: the build leaves it alone. ${TWO_STEPS}`,
      flash: String(s.card),
      undo: () => run(`${s.card}:set`, s.source === 'manual' ? setStaple(s.card, s.enabled) : resetStaple(s.card), { title: `${label} put back`, flash: String(s.card) }),
    })
  }
  const all = staples.data ?? []
  const rows = all.filter(FILTERS[only])

  return (
    <>
      <Head
        eyebrow={`Decks · ${count(all.filter((s) => s.enabled).length)} staples`}
        title="Staples"
        lead="Cards that don't name a deck. The build finds them every night; a decision here overrides it for that card until it goes back to the build."
        end={<SeasonSelect seasons={swept} value={season} onChange={setPicked} />}
      />
      {staples.error ? <Failure title="Couldn't read the staples">{panelErrorText(staples.error)}</Failure> : null}

      <section className="col" style={{ gap: 16 }}>
        <div className="fx-b">
          <div className="fld" style={{ flex: '1 1 280px', maxWidth: 420 }}>
            <span className="lbl-sm">Make a card a staple</span>
            <Lookup label="Make a card a staple" placeholder="Card name or passcode" search={findCards} exclude={all.filter((s) => s.enabled).map((s) => s.card)} onPick={(o) => set({ card: Number(o.key), name: String(o.label), enabled: false, source: 'auto' }, true)} />
          </div>
          <div className="fx">
            {(
              [
                ['all', 'All'],
                ['auto', 'Found by the build'],
                ['manual', 'Set by hand'],
                ['off', 'Disabled'],
              ] as [Only, string][]
            ).map(([key, label]) => (
              <FilterChip key={key} pressed={only === key} label={label} count={all.filter(FILTERS[key]).length} onClick={() => setOnly(key)} />
            ))}
          </div>
        </div>
        <div className="tblbox">
          <table className="tbl">
            <thead>
              <tr>
                <th>Card</th>
                <th>Decided by</th>
                <th>Staple</th>
                <th style={{ minWidth: 150 }}>In decks</th>
                <th className="r">Main</th>
                <th className="r">Side</th>
                <th className="r">Foreign</th>
                <th className="r">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.card} className={`${s.enabled ? '' : 'off'} ${flash === String(s.card) ? 'flash' : ''}`}>
                  <td>
                    <span className="who">
                      <CardThumb id={s.card} name={s.name} size={28} />
                      <span className="col-s">
                        <span className="nm">{s.name ?? 'Left the card database'}</span>
                        <span className="cap mono">{s.card}</span>
                      </span>
                    </span>
                  </td>
                  <td>
                    <Chip tone={s.source === 'manual' ? 'cyan' : 'neutral'}>{s.source === 'manual' ? 'Manual' : 'Build'}</Chip>
                  </td>
                  <td className={s.enabled ? 'ink' : 'dim'}>{s.enabled ? 'Yes' : 'No'}</td>
                  <td>{s.share === null ? <span className="mono mut">—</span> : <ShareBar rate={s.share} />}</td>
                  <td className="r">{percent(s.mainShare)}</td>
                  <td className="r">{percent(s.sideShare)}</td>
                  <td className="r">{percent(s.foreignShare)}</td>
                  <td className="r">
                    <span className="fx" style={{ justifyContent: 'flex-end', gap: 14, flexWrap: 'nowrap' }}>
                      <RowAction id={`${s.card}:set`} pending={pending} label={s.enabled ? 'Disable' : 'Enable'} doing={s.enabled ? 'Disabling…' : 'Enabling…'} danger={s.enabled} onClick={() => set(s, !s.enabled)} />
                      {s.source === 'manual' ? (
                        <RowAction
                          id={`${s.card}:reset`}
                          pending={pending}
                          label="Back to build"
                          doing="Handing back…"
                          onClick={() =>
                            run(`${s.card}:reset`, resetStaple(s.card), {
                              title: `${s.name ?? `Card ${s.card}`} is back with the build`,
                              body: 'The detection decides it again at the next build.',
                              flash: String(s.card),
                              undo: () => run(`${s.card}:reset`, setStaple(s.card, s.enabled), { title: 'Decision put back', flash: String(s.card) }),
                            })
                          }
                        />
                      ) : null}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="dim">
                    {staples.data ? (all.length ? 'No staple matches.' : 'No staple yet: the build finds them.') : 'Loading…'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="cap">
          In decks counts the side deck too: a card counts once per deck in any zone. Main is the main or extra deck, Side the side deck; a deck with it in both counts in both. Foreign: of the decks holding the card, those where no other card shares a setcode with it. The detection cut-offs are in Settings.
        </p>
      </section>
      <NextBuildNote />
    </>
  )
}

export default StaplesPage
