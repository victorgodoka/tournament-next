import { useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { Button } from '@ui/button/button.component'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { Icon } from '@ui/icon'
import { Panel } from '@ui/panel'
import { SectionHead } from '@ui/section-head'
import { pageMetadata } from '@utils/metadata'
import { SystemRequirements } from './system-requirements'

export async function generateMetadata() {
  const t = await getTranslations('Download.meta')
  return pageMetadata({ title: t('title'), path: '/download', description: t('description') })
}

const RELEASES = 'https://github.com/duelists-unite/omega-releases/releases/download/Latest/'

const BUILDS = [
  { name: 'Windows', kind: 'EXE', file: 'Omega_Installer-Windows.exe' },
  { name: 'Linux', kind: 'ZIP', file: 'linux-x64.zip' },
  { name: 'Mac', kind: 'DMG', file: 'Omega_Launcher-Mac.dmg' },
  { name: 'Android', kind: 'APK', file: 'android.apk' },
  { name: 'iOS', kind: 'IPA', file: 'ios.ipa' },
]

const COMMUNITY = [
  { name: 'GitHub', host: 'github.com/duelists-unite', href: 'https://github.com/duelists-unite' },
  { name: 'Discord', host: 'discord.gg/duelistsunite', href: 'https://discord.gg/duelistsunite' },
  { name: 'Forum', host: 'forum.duelistsunite.org', href: 'https://forum.duelistsunite.org' },
  { name: 'Twitch', host: 'twitch.tv/duelists_unite', href: 'https://www.twitch.tv/duelists_unite' },
  { name: 'YouTube', host: 'youtube.com/@DuelistsUnite', href: 'https://www.youtube.com/@DuelistsUnite' },
]

const VIP_PERKS = ['rarities', 'mat', 'sleeves'] as const

const Hero = () => {
  const t = useTranslations('Download.hero')

  return (
    <section aria-labelledby="downloads" className="dots grid items-start gap-12 py-16 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-6 lg:pt-6">
        <span className="flex items-center gap-2.5 text-ink-muted signal">
          <span aria-hidden className="size-2 bg-gold" />
          Duelists Unite
        </span>
        <h1 className="text-[clamp(64px,9vw,112px)] text-ink display-hero">YGO Omega</h1>
        <p className="max-w-110 text-ink-dim lead">{t('lead')}</p>
        <Button href="https://github.com/duelists-unite" size="signal" className="self-start">
          {t('github')} <Icon name="arrow" />
        </Button>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="downloads" className="font-mono text-ink-muted signal">{t('platforms')}</h2>
          <span className="text-ink-muted signal-sm">{t('latest')}</span>
        </div>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-4">
          {BUILDS.map(({ name, kind, file }) => (
            <li key={file}>
              <a
                href={RELEASES + file}
                className="cut notch flex min-h-38 flex-col gap-4 p-5 text-ink [--cut:var(--cut-md)] hover:-translate-y-0.5 hover:[--fill:var(--color-surface-300)] motion-safe:transition-transform motion-safe:duration-120"
              >
                <span className="flex items-center justify-between">
                  <span className="text-cyan"><Icon name="download" size={24} /></span>
                  <span className="text-ink-muted signal-sm">{kind}</span>
                </span>
                <span className="mt-auto flex min-w-0 flex-col gap-1.5">
                  <span className="display-3">{name}</span>
                  <span className="truncate text-ink-muted signal-sm">{file}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const Donations = () => {
  const t = useTranslations('Download.donations')

  return (
    <section aria-labelledby="donations" className="flex flex-col gap-6">
      <SectionHead ruled num="02" id="donations">{t('heading')}</SectionHead>
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
    </section>
  )
}

const About = () => {
  const t = useTranslations('Download.about')

  return (
    <section aria-labelledby="about" className="flex flex-col gap-6">
      <SectionHead ruled num="03" id="about">{t('heading')}</SectionHead>
      <div className="flex flex-wrap items-start gap-6">
        <Panel label={t('heading')} className="min-w-0 flex-[2_1_520px] min-[720px]:p-8">
          <p className="max-w-170 text-ink-dim lead">{t('body')}</p>
        </Panel>
        <nav aria-label={t('community')} className="flex min-w-0 flex-[1_1_300px] flex-col gap-px border border-line bg-line">
          <span className="bg-surface-200 px-5 py-3 text-ink-muted signal">{t('community')}</span>
          {COMMUNITY.map(({ name, host, href }) => (
            <a key={name} href={href} className="flex items-center justify-between gap-4 bg-surface-100 px-5 py-3.5 text-ink hover:bg-surface-300">
              <span className="flex min-w-0 flex-col gap-0.5">
                <b className="body-strong">{name}</b>
                <span className="truncate text-ink-muted signal-sm">{host}</span>
              </span>
              <span className="text-cyan"><Icon name="arrow" /></span>
            </a>
          ))}
        </nav>
      </div>
    </section>
  )
}

const Requirements = () => {
  const t = useTranslations('Download.specs')

  return (
    <section aria-labelledby="sysreq" className="flex flex-col gap-6">
      <SectionHead ruled num="01" id="sysreq" end={t('count', { count: 5 })}>{t('heading')}</SectionHead>
      <SystemRequirements />
    </section>
  )
}

const DownloadPage = () => (
  <>
    <Header />
    <main className="flex min-h-dvh flex-col overflow-x-clip pt-16 pb-24">
      <div className="mx-auto flex w-full max-w-page flex-col gap-section px-gutter">
        <Hero />
        <Requirements />
        <Donations />
        <About />
      </div>
    </main>
    <Footer />
  </>
)

export default DownloadPage
