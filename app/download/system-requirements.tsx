'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { TabBar, tabPanelProps } from '@ui/tab-bar'

type Spec = { min: string; minSub?: string; rec: string; recSub?: string }
type Row = 'os' | 'processor' | 'cpu' | 'memory' | 'graphics' | 'directx' | 'network' | 'storage' | 'sound' | 'resolution'
type Platform = 'windows' | 'linux' | 'mac' | 'android' | 'ios'

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: 'windows', label: 'Windows' },
  { id: 'linux', label: 'Linux' },
  { id: 'mac', label: 'Macintosh' },
  { id: 'android', label: 'Android' },
  { id: 'ios', label: 'iOS' },
]

/** The client's published requirements, as the old download page listed them. */
const specs = (t: ReturnType<typeof useTranslations<'Download.specs'>>): Record<Platform, [Row, Spec][]> => {
  const cpu: [Row, Spec] = ['processor', { min: t('values.dualCore'), rec: t('values.quadCore') }]
  const graphics = (star: boolean): [Row, Spec] => [
    'graphics',
    { min: `Intel HD Graphics 3000${star ? '*' : ''}`, minSub: 'VRAM: 1024 MB', rec: 'NVIDIA GeForce GTX 750', recSub: 'VRAM: 2048 MB' },
  ]
  const storage: [Row, Spec] = ['storage', { min: t('values.space', { size: '4GB' }), rec: t('values.space', { size: '6GB' }) }]
  const desktop: [Row, Spec][] = [
    ['network', { min: t('values.broadband'), rec: t('values.broadband') }],
    storage,
    ['sound', { min: t('values.onBoard'), rec: t('values.onBoard') }],
    ['resolution', { min: '1280 x 720', rec: '1920 x 1080' }],
  ]
  return {
    windows: [
      ['os', { min: t('values.latest', { os: 'Windows 10 Home (32bit)' }), rec: t('values.latest', { os: 'Windows 11 Home (64bit)' }) }],
      cpu,
      ['memory', { min: '2GB RAM', rec: '4GB RAM' }],
      graphics(true),
      ['directx', { min: t('values.version', { version: 11 }), rec: t('values.version', { version: 12 }) }],
      ...desktop,
    ],
    linux: [
      ['os', { min: `${t('values.latest', { os: 'Linux' })}*`, rec: `${t('values.latest', { os: 'Linux' })}*` }],
      cpu,
      ['memory', { min: '4GB RAM', rec: '8GB RAM' }],
      graphics(false),
      ...desktop,
    ],
    mac: [
      ['os', { min: 'macOS 10.13+*', rec: 'macOS 12.6+*' }],
      cpu,
      ['memory', { min: '4GB RAM', rec: '8GB RAM' }],
      graphics(false),
      ...desktop,
    ],
    android: [
      ['os', { min: 'Android 5.1', rec: 'Android 9' }],
      ['cpu', { min: '—', rec: 'Snapdragon 845' }],
      ['memory', { min: '3GB RAM', rec: '4GB RAM' }],
      storage,
    ],
    ios: [
      ['os', { min: 'iOS 12+', rec: 'iOS 13+' }],
      ['cpu', { min: 'Apple A10 Fusion', rec: 'Apple A12X Bionic' }],
      ['memory', { min: '3GB RAM', rec: '4GB RAM' }],
      storage,
    ],
  }
}

const HEAD = 'bg-surface-200 px-5 py-3 text-left font-normal signal'
const CELL = 'bg-surface-100 px-5 py-3.5 align-top'

export const SystemRequirements = () => {
  const t = useTranslations('Download.specs')
  const [active, setActive] = useState<Platform>('windows')
  const platform = PLATFORMS.find((p) => p.id === active)!

  return (
    <div className="flex flex-col gap-6">
      <TabBar tabs={PLATFORMS} active={active} onSelect={setActive} label={t('heading')} idPrefix="specs" fit />
      <div {...tabPanelProps('specs', active)} className="overflow-x-auto">
        <table className="w-full min-w-140 border-separate border-spacing-px border border-line bg-line">
          <thead>
            <tr>
              <th scope="col" className={`${HEAD} w-[28%] text-ink-muted`}>{platform.label}</th>
              <th scope="col" className={`${HEAD} text-ink-muted`}>{t('minimum')}</th>
              <th scope="col" className={`${HEAD} text-cyan`}>{t('recommended')}</th>
            </tr>
          </thead>
          <tbody>
            {specs(t)[active].map(([row, { min, minSub, rec, recSub }]) => (
              <tr key={row}>
                <th scope="row" className={`${CELL} text-left font-normal text-ink-muted signal`}>{t(`rows.${row}`)}</th>
                <td className={CELL}>
                  <span className="block text-ink-dim body">{min}</span>
                  {minSub ? <span className="block text-ink-muted data">{minSub}</span> : null}
                </td>
                <td className={CELL}>
                  <span className="block text-ink body">{rec}</span>
                  {recSub ? <span className="block text-ink-muted data">{recSub}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
