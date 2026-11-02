import { useTranslations } from 'next-intl'
import { Button } from '@ui/button'
import { Eyebrow } from '@ui/eyebrow'
import { Panel } from '@ui/panel'

/** Stands in for a page that's switched off for a while: what's going on, and the way back. */
export const Maintenance = () => {
  const t = useTranslations('Maintenance')
  return (
    <Panel tone="steel" label={t('title')} className="flex flex-col items-start gap-5">
      <Eyebrow tone="amber" className="self-stretch">{t('eyebrow')}</Eyebrow>
      <h1 className="text-ink display-2">{t('title')}</h1>
      <p className="max-w-[62ch] text-ink-dim lead">{t('body')}</p>
      <Button href="/">{t('home')}</Button>
    </Panel>
  )
}
