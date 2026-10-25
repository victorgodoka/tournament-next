'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toOmega } from '@utils/deck/codecs/omega'
import { toText } from '@utils/deck/codecs/text'
import { toYdk } from '@utils/deck/codecs/ydk'
import { toYdke } from '@utils/deck/codecs/ydke'
import { deckIn, usesTcgPasscodes } from '@utils/deck/model'
import type { CardMap, Deck } from '@utils/deck/types'
import type { Banlist } from '@utils/wiki'
import { deckImage, type ImageInfo } from './deck-image'
import { download, fileName, konamiPdf, share } from './deck-io'
import { tileStatus } from './pool-query'
import type { ExportKind } from './toolbar'

export type Toast = { tone: 'positive' | 'negative' | 'warn'; text: string }

type Params = {
  deck: Deck
  cards: CardMap
  name: string
  /** The effective list; null while the banlists haven't loaded. */
  banlist: Banlist | null
  /** The saved deck, for the calculator to pull its card roles. */
  deckId: string | null
  /** The name on the image's "Built by" chip; null for none. */
  author: string | null
}

/**
 * The deck's exports, shared by the editor and the deck page: codes to the clipboard, .ydk and PDF
 * downloads, the 16:9 and 9:16 images, the share sheet, the calculator. Owns the toast and the busy
 * state, which the editor also uses for its imports. `omega` holds the deck's Omega code, ready before
 * Ctrl+C: a copy event takes its data synchronously.
 */
export const useDeckExport = ({ deck, cards, name, banlist, deckId, author }: Params) => {
  const t = useTranslations('DeckEditor')
  const locale = useLocale()
  const [toast, setToast] = useState<Toast | null>(null)
  /** An import or export still working: the page is blocked until it settles. */
  const [busy, setBusy] = useState<'importing' | 'building' | null>(null)
  const omega = useRef<string | null>(null)
  const story = useRef<{ key: string; blob: Promise<Blob> } | null>(null)
  /** Double-script cards: the deck and its Omega code hold the TCG print here, the OCG one otherwise. ydk/ydke always OCG. */
  const tcg = !banlist || usesTcgPasscodes(banlist.format)
  const allIds = useMemo(() => [...deck.main, ...deck.extra, ...deck.side], [deck])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    let live = true
    omega.current = null
    toOmega(deckIn(deck, cards, tcg)).then(
      (code) => {
        if (live) omega.current = code
      },
      () => {},
    )
    return () => {
      live = false
    }
  }, [deck, cards, tcg])

  const copy = (text: string | Promise<string>, format: 'omega' | 'ydke' | 'list') =>
    Promise.resolve(text)
      .then((s) => navigator.clipboard.writeText(s))
      .then(
        () => setToast({ tone: 'positive', text: t('io.copied', { format: t(`io.format.${format}`) }) }),
        (error) => {
          console.error(error)
          setToast({ tone: 'negative', text: t('io.copyFailed') })
        },
      )

  const imageInfo = (): ImageInfo => ({
    title: name.trim() || t('newDeck'),
    format: banlist && { name: banlist.name, format: banlist.format },
    author: author ? t('io.image.builtBy', { name: author }) : null,
    date: new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()),
    eyebrow: t('io.image.eyebrow'),
    zones: { main: t('zones.main'), extra: t('zones.extra'), side: t('zones.side') },
    totals: t('io.image.totals', { main: deck.main.length, extra: deck.extra.length, side: deck.side.length }),
    cta: t('io.image.cta'),
    points: Object.fromEntries(
      allIds.flatMap((id) => {
        const card = cards.get(id)
        const status = card && tileStatus(card, banlist)
        return typeof status === 'object' ? [[id, status.points]] : []
      }),
    ),
  })

  /** The 9:16 image, drawn once per deck and wording: the share sheet needs the tap's activation, which a long draw outlives. */
  const storyImage = () => {
    const info = imageInfo()
    const key = JSON.stringify([deck, info])
    if (story.current?.key !== key) story.current = { key, blob: deckImage(deck, cards, info, 'tall') }
    return story.current.blob
  }

  /** The export menu opened on a phone: the image to share starts drawing before the tap. A failure surfaces on the tap. */
  const warmStory = () => {
    if (allIds.length && matchMedia('(pointer: coarse)').matches) storyImage().catch(() => {})
  }

  const exportAs = async (kind: ExportKind) => {
    if (!allIds.length) return setToast({ tone: 'negative', text: t('io.empty') })
    if (kind === 'calculator') {
      // The calculator reads `?d=` like the editor does; `deck` lets it pull the saved deck's roles.
      const params = new URLSearchParams({ d: toYdke(deckIn(deck, cards, false)), name })
      if (deckId) params.set('deck', deckId)
      window.open(`/calculator?${params}`, '_blank', 'noopener')
      return
    }
    if (kind === 'omega') return copy(omega.current ?? toOmega(deckIn(deck, cards, tcg)), kind)
    if (kind === 'ydke') return copy(toYdke(deckIn(deck, cards, false)), kind)
    if (kind === 'list') return copy(toText(deck, cards), kind)
    if (kind === 'ydk') {
      const file = fileName(name, 'ydk')
      download(new Blob([toYdk(deckIn(deck, cards, false))], { type: 'text/plain' }), file)
      return setToast({ tone: 'positive', text: t('io.downloaded', { file }) })
    }
    setBusy('building')
    try {
      if (kind === 'pdf') {
        const file = fileName(name, 'pdf')
        const { blob, overflow } = await konamiPdf(deck, cards)
        download(blob, file)
        return setToast(overflow ? { tone: 'warn', text: t('io.pdfOverflow', { file }) } : { tone: 'positive', text: t('io.downloaded', { file }) })
      }
      const file = fileName(kind === 'wide' ? name : `${name.trim() || 'deck'}-story`, 'jpg')
      const blob = await (kind === 'wide' ? deckImage(deck, cards, imageInfo(), 'wide') : storyImage())
      if (kind !== 'share') {
        download(blob, file)
        return setToast({ tone: 'positive', text: t('io.downloaded', { file }) })
      }
      const how = await share(blob, file, imageInfo().title)
      setToast(how === 'cancelled' ? null : { tone: 'positive', text: how === 'shared' ? t('io.shared') : t('io.downloaded', { file }) })
    } catch (error) {
      console.error(error)
      story.current = null
      setToast({ tone: 'negative', text: t('io.failed') })
    } finally {
      setBusy(null)
    }
  }

  return { exportAs, warmStory, copy, omega, tcg, allIds, toast, setToast, busy, setBusy }
}
