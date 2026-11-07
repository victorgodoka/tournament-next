'use client'

/** The four numbered tabs of My statistics, with one name and one art per deck key across the answer. */

import { useTranslations } from 'next-intl'
import { SectionTabs } from '@app/statistics/SectionTabs'
import { nameOf, subFace, type Faces } from '@app/statistics/format'
import { OTHER_OPPONENT, type PlayerAnswer } from '@utils/statistics'
import type { EloPoint } from '@utils/types'
import { Matchups } from './Matchups'
import { MyDecks } from './MyDecks'
import { Overview } from './Overview'
import { Progress } from './Progress'

/** A deck's card and, for a mixed `A>B` deck, its second archetype's. */
export type DeckArt = (key: string) => { id: number | null; sub: number | null }

export const MySections = ({ data, ladder, history, metaFaces }: { data: PlayerAnswer; ladder: 'TCG' | 'Genesys'; history: EloPoint[]; metaFaces: Faces }) => {
  const t = useTranslations('PlayerStatistics.my.tabs')
  const names = new Map<string, string | null>()
  const faces: Faces = { ...metaFaces }
  const learn = (key: string, name: string | null | undefined, face: number | null | undefined) => {
    if (name && !names.get(key)) names.set(key, name)
    if (face) faces[key] = face
  }
  for (const d of data.decks) learn(d.key, d.name, d.face)
  for (const m of data.matchups) {
    learn(m.key, m.name, m.face)
    learn(m.opponent, m.opponentName, m.opponentFace)
  }
  for (const o of data.opponents ?? []) learn(o.opponent, o.name, o.face)
  const name = (key: string) => nameOf({ key, name: names.get(key) ?? null })
  const art: DeckArt = (key) => (key === OTHER_OPPONENT ? { id: null, sub: null } : { id: faces[key] ?? null, sub: subFace(key, faces) })

  return (
    <SectionTabs
      label={t('label')}
      tabs={[
        { id: 'overview', label: t('overview'), panel: <Overview data={data} name={name} art={art} /> },
        { id: 'decks', label: t('decks'), panel: <MyDecks data={data} name={name} art={art} /> },
        { id: 'matchups', label: t('matchups'), panel: <Matchups data={data} name={name} art={art} /> },
        { id: 'progress', label: t('progress'), panel: <Progress data={data} ladder={ladder} history={history} /> },
      ]}
    />
  )
}
