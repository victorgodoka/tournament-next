import { useTranslations } from 'next-intl'
import { Button } from '@ui/button'
import { Panel } from '@ui/panel'

const VIP_PERKS = ['rarities', 'mat', 'sleeves', 'ads'] as const

/** The VIP pitch and its perks: the download page's donations section, and the home's VIP band. */
export const VipPanel = () => {
  const t = useTranslations('Download.donations')

  return (
    <Panel tone="steel" label={t('title')} className="flex flex-wrap items-center gap-x-12 gap-y-8 min-[720px]:p-10">
      <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-4">
        <h3 className="text-ink display-1">{t('title')}</h3>
        <p className="max-w-140 text-ink-dim lead">
          {t.rich('body', { gold: (chunks) => <b className="text-gold">{chunks}</b> })}
        </p>
      </div>
      <div className="flex min-w-0 flex-[0_1_340px] flex-col gap-5">
        <dl className="flex flex-col gap-px bg-line-strong/25">
          {VIP_PERKS.map((perk) => (
            <div key={perk} className="flex justify-between gap-3 bg-steel py-3">
              <dt className="text-ink-dim signal">{t(`perks.${perk}.label`)}</dt>
              <dd className="text-ink body-strong">{t(`perks.${perk}.value`)}</dd>
            </div>
          ))}
        </dl>
        <Button href="https://paypal.me/DUnite" size="signal" className="self-start">{t('donate')}</Button>
      </div>
    </Panel>
  )
}
