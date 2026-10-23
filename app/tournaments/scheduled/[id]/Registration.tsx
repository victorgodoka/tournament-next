'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { EmptyBox } from '@omega/profile/empty-box'
import { LocalTime } from '@omega/profile/local-time'
import { DAY, TIME_ONLY } from '@omega/tournament/labels'
import { PlayerCell } from '@omega/tournament/player'
import { Button } from '@ui/button/button.component'
import { Panel } from '@ui/panel'
import { SectionHead } from '@ui/section-head'
import { signIn } from '@utils/auth'
import { track } from '@utils/gtm'
import { TournamentApiError, setRegistration } from '@utils/tournaments'
import type { ScheduledTournament } from '@utils/types'

/**
 * Pre-register / withdraw and the list of who signed up. Starts from the server render (which
 * already knows whether the visitor is in) and swaps in the body every POST/DELETE returns.
 */
export const Registration = ({ initial }: { initial: ScheduledTournament }) => {
  const t = useTranslations('Calendar.scheduled')
  const [page, setPage] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { open, registered, players } = page.registration

  const toggle = async () => {
    // `null` = no session: the server can't say, and the POST would be a 401 anyway.
    if (registered === null) return signIn()
    setBusy(true)
    setError(null)
    try {
      setPage(await setRegistration(page.tournament.id!, !registered))
      track(registered ? 'tournament_withdraw' : 'tournament_register', { tournament_id: page.tournament.id })
    } catch (failure) {
      if (failure instanceof TournamentApiError && failure.status === 401) return signIn()
      if (failure instanceof TournamentApiError && failure.code === 'REGISTRATION_CLOSED') {
        setPage((current) => ({ ...current, registration: { ...current.registration, open: false } }))
        setError(t('closedNow'))
      } else setError(t('failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <Panel tone="framed" title={t('heading')} className="self-start">
        <div className="flex flex-col gap-4">
          <p className="text-ink">{!open ? t('closed') : registered ? t('youAreIn') : t('open')}</p>
          <p className="text-ink-muted body">{t('intent')}</p>
          {page.tournament.requiresPass ? <p className="text-ink-muted body">{t('passNote')}</p> : null}
          {open ? (
            <Button variant={registered ? 'secondary' : 'primary'} onClick={toggle} disabled={busy} className="self-start">
              {registered === null ? t('signIn') : registered ? t('withdraw') : t('register')}
            </Button>
          ) : null}
          {error ? (
            <p role="alert" className="text-loss signal-sm">
              {error}
            </p>
          ) : null}
        </div>
      </Panel>

      <section aria-labelledby="registered" className="flex min-w-0 flex-col gap-4">
        <SectionHead as="h2" compact id="registered">
          {t('players', { count: players.length })}
        </SectionHead>
        {players.length ? (
          <ol className="flex flex-col gap-px border border-line bg-line">
            {players.map((player) => (
              <li key={player.id} className="bg-surface-100 px-4 py-3">
                <PlayerCell
                  player={{ ...player, handle: null }}
                  note={
                    <>
                      {t('registeredAt')} <LocalTime iso={player.registeredAt} options={DAY} /> · <LocalTime iso={player.registeredAt} options={TIME_ONLY} />
                    </>
                  }
                />
              </li>
            ))}
          </ol>
        ) : (
          <EmptyBox title={t('noPlayers')} />
        )}
      </section>
    </div>
  )
}
