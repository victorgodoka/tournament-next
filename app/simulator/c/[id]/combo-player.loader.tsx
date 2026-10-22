'use client'

import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'

const Loading = () => {
  const t = useTranslations('Simulator')
  return (
    <p role="status" className="mx-auto w-[min(var(--container-page),calc(100%-32px))] pt-8 text-ink-muted body">
      {t('player.loading')}
    </p>
  )
}

// Client only, as the simulator: the board measures itself and Operate from here writes the local draft.
const ComboPlayer = dynamic(() => import('@app/simulator/combo-player').then((m) => m.ComboPlayer), { ssr: false, loading: Loading })

export const ComboPlayerLoader = ({ id }: { id: string }) => <ComboPlayer id={id} />
