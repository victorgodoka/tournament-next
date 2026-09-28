'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '@contexts/auth/auth.context'
import { LocalTime } from '@omega/profile/local-time'
import { WIKI_PAD } from '@omega/wiki'
import { ArticleView } from '@omega/wiki/article-view'
import { buttonClasses } from '@ui/button'
import { TabBar, tabPanelProps } from '@ui/tab-bar'
import { WikiApiError, canDelete, checkSlug, createArticle, updateArticle } from '@utils/articles'
import type { Article, ArticleSummary, DocArticlePatch } from '@utils/types'
import {
  WIKI_DOC_VERSION,
  emptyBlock,
  emptyDoc,
  isAllowedSrc,
  isSlug,
  renderDocHtml,
  toAnchor,
  validateDoc,
  type DocHtml,
  type WikiAsset,
  type WikiBlock,
  type WikiBlockType,
  type WikiDoc,
  type WikiSeo,
} from '@utils/wiki-doc'
import { docWords, isDefaultAlt, seoChecks, seoScore, usedAssets, type SeoTarget } from '@utils/wiki-seo'
import { failure } from '../ArticleForm'
import { AssetLibrary } from './AssetLibrary'
import { BlockList, type Hint } from './BlockList'
import { TextField } from './fields'
import { HeaderPanel, type SlugProps, type SlugStatus } from './HeaderPanel'
import { HistoryRail } from './HistoryRail'
import { Outline, Palette } from './Outline'
import { PublishDialog } from './PublishDialog'
import { SeoRail } from './SeoRail'
import { SeoTab } from './SeoTab'
import { Flag, clock } from './ui'

type Tab = 'write' | 'seo' | 'preview' | 'source'
type Rail = 'seo' | 'library' | 'history'
type Busy = 'save' | 'publish' | 'unpublish' | null

/** What is being dragged: a palette entry (inserts) or a block's handle (moves). */
type Drag = { kind: 'new'; type: WikiBlockType } | { kind: 'move'; id: string }

const newId = () => `b-${crypto.randomUUID().slice(0, 8)}`

/** A pasted doc gets only a shape check here; `validateDoc` (and the server) judge the content. */
const parseDoc = (text: string): WikiDoc | null => {
  try {
    const value = JSON.parse(text)
    const doc = value?.doc ?? value
    if (doc?.v !== WIKI_DOC_VERSION || !Array.isArray(doc.blocks) || typeof doc.assets !== 'object') return null
    return { ...emptyDoc(), ...doc }
  } catch {
    return null
  }
}

/** Unsaved work, kept in this browser only. `base` is the article's `updatedAt` when the work started. */
type LocalDraft = { doc: WikiDoc; slug: string; slugTouched?: boolean; savedAt: number; base?: string }

const subscribeStorage = (onChange: () => void) => {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}

/** Storage can throw (private mode, blocked site data): no draft is the safe answer. */
const readStorage = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const parseDraft = (raw: string | null): LocalDraft | null => {
  try {
    const draft = raw ? (JSON.parse(raw) as LocalDraft) : null
    return draft?.doc?.v === WIKI_DOC_VERSION && Array.isArray(draft.doc.blocks) ? draft : null
  } catch {
    return null
  }
}

/** `""`, `false` and `[]` are absent in `seo` (WIKI_API §5.6); an empty `seo` leaves the doc. */
const withSeo = (doc: WikiDoc, patch: Partial<WikiSeo>): WikiDoc => {
  const seo: WikiSeo = { ...doc.seo, ...patch }
  for (const key of Object.keys(seo) as (keyof WikiSeo)[]) {
    const value = seo[key]
    if (value === undefined || value === '' || value === false || (Array.isArray(value) && !value.length)) delete seo[key]
  }
  const next: WikiDoc = { ...doc, seo }
  if (!Object.keys(seo).length) delete next.seo
  return next
}

const head = (doc: WikiDoc) => JSON.stringify([doc.title, doc.summary, doc.tags, doc.cover, doc.infobox])
const meta = (doc: WikiDoc) => JSON.stringify([doc.seo, doc.hub, doc.related, doc.assets])

type DocEditorProps = {
  /** Absent on create. On edit, an article that already has a `doc`. */
  article?: Article & { doc: WikiDoc }
  /** The doc was just converted from Markdown: unsaved from the first render. */
  converted?: boolean
}

/**
 * Block editor. The state is one `WikiDoc`; every control edits it, the preview renders it through the
 * published page's own component, and saving sends it whole (WIKI_API.md §5). SEO advice is computed
 * here from the doc; what the server refuses is `validateDoc`, and only that blocks a save.
 */
export const DocEditor = ({ article, converted = false }: DocEditorProps) => {
  const router = useRouter()
  const { user } = useAuth()
  const [doc, setDoc] = useState<WikiDoc>(() => article?.doc ?? emptyDoc())
  const [slugText, setSlugText] = useState(article?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(!!article)
  const [slugAnswer, setSlugAnswer] = useState<{ slug: string; status: SlugStatus } | null>(null)
  const [redirect, setRedirect] = useState(true)
  const [takeover, setTakeover] = useState(false)
  const [liveDays, setLiveDays] = useState(0)
  const [tab, setTab] = useState<Tab>('write')
  const [rail, setRail] = useState<Rail>('seo')
  const [selected, setSelected] = useState<string | null>('header')
  // A new article opens every block; an existing one opens collapsed, one line per block.
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [over, setOver] = useState<number | null>(null)
  const [dirty, setDirty] = useState(converted)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [html, setHtml] = useState<DocHtml>({})
  const [pasted, setPasted] = useState('')
  const [draftHandled, setDraftHandled] = useState(false)
  const [titles, setTitles] = useState<Record<string, string>>(() =>
    Object.fromEntries([article?.links?.hub, ...(article?.links?.related ?? [])].flatMap((link) => (link ? [[link.slug, link.title]] : []))),
  )
  const drag = useRef<Drag | null>(null)
  const blockRefs = useRef(new Map<string, HTMLLIElement>())
  const dialog = useRef<HTMLDialogElement>(null)

  const slug = slugTouched ? slugText.trim() : toAnchor(doc.title)
  const live = !!article?.publishedAt
  const assets = useMemo(() => Object.values(doc.assets), [doc.assets])

  // ---- address check: GET /wiki/{slug}, debounced, answers tagged with the slug they answer ----
  const needsCheck = isSlug(slug) && slug !== article?.slug
  useEffect(() => {
    if (!needsCheck) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      checkSlug(slug, controller.signal)
        .then((status) => setSlugAnswer({ slug, status }))
        .catch((cause: Error) => {
          if (cause.name !== 'AbortError') setSlugAnswer({ slug, status: 'error' })
        })
    }, 400)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [slug, needsCheck])
  const slugStatus: SlugStatus = !slug
    ? 'empty'
    : slug === article?.slug
      ? 'current'
      : !isSlug(slug)
        ? 'invalid'
        : slugAnswer?.slug === slug
          ? slugAnswer.status
          : 'checking'

  // ---- local draft: one slot per article (and one for "new"), read without a hydration mismatch ----
  const draftKey = `wiki-draft:${article?.slug ?? 'new'}`
  const stored = useSyncExternalStore(subscribeStorage, () => readStorage(draftKey), () => null)
  const offer = useMemo(() => {
    const draft = parseDraft(stored)
    return draft && JSON.stringify(draft.doc) !== JSON.stringify(article?.doc ?? emptyDoc()) ? draft : null
  }, [stored, article?.doc])
  const showOffer = !!offer && !dirty && !draftHandled

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // Every change lands in this browser half a second later, so a crash or a closed tab loses little.
  useEffect(() => {
    if (!dirty) return
    const timer = setTimeout(() => {
      try {
        const now = Date.now()
        const draft: LocalDraft = { doc, slug: slugText, slugTouched, savedAt: now, base: article?.updatedAt }
        localStorage.setItem(draftKey, JSON.stringify(draft))
        setSavedAt(now)
      } catch {
        // Full or blocked storage: the beforeunload guard still stands.
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [doc, slugText, slugTouched, dirty, draftKey, article?.updatedAt])

  const forgetDraft = () => {
    try {
      localStorage.removeItem(draftKey)
    } catch {}
  }

  // ---- edits ----
  const edit = (next: (doc: WikiDoc) => WikiDoc) => {
    setDoc(next)
    setDirty(true)
    setError(null)
  }
  const setSeo = (patch: Partial<WikiSeo>) => edit((d) => withSeo(d, patch))
  const setLinks = ({ hub, related }: { hub?: string | null; related?: string[] }) => {
    setLinkError(null)
    edit((d) => {
      const next = { ...d }
      if (hub === null) delete next.hub
      else if (hub !== undefined) next.hub = hub
      if (related) {
        if (related.length) next.related = related
        else delete next.related
      }
      return next
    })
  }
  const onSlug = (value: string) => {
    setSlugText(value)
    setSlugTouched(true)
    setTakeover(false)
    setDirty(true)
    if (article?.publishedAt) setLiveDays(Math.floor((Date.now() - Date.parse(article.publishedAt)) / 86_400_000))
  }
  const addAsset = (asset: WikiAsset) => edit((d) => ({ ...d, assets: { ...d.assets, [asset.id]: asset } }))
  const removeAsset = (id: string) =>
    edit((d) => {
      const rest = { ...d.assets }
      delete rest[id]
      return { ...d, assets: rest }
    })
  const setBlocks = (next: (blocks: WikiBlock[]) => WikiBlock[]) => edit((d) => ({ ...d, blocks: next(d.blocks) }))

  const reveal = (id: string) =>
    requestAnimationFrame(() => document.getElementById(`block-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }))

  const select = (id: string) => {
    setSelected(id)
    if (id !== 'header') setOpen((set) => (set.has(id) ? set : new Set(set).add(id)))
    reveal(id)
  }

  const insert = (type: WikiBlockType, at?: number) => {
    const block = emptyBlock(type, newId())
    const after = selected === 'header' ? 0 : doc.blocks.findIndex((b) => b.id === selected) + 1 || doc.blocks.length
    const index = at ?? after
    setBlocks((blocks) => [...blocks.slice(0, index), block, ...blocks.slice(index)])
    setOpen((set) => new Set(set).add(block.id))
    setSelected(block.id)
    reveal(block.id)
  }

  const move = (id: string, to: number) =>
    setBlocks((blocks) => {
      const from = blocks.findIndex((block) => block.id === id)
      const moved = blocks[from]
      if (!moved) return blocks
      const rest = blocks.filter((block) => block.id !== id)
      const at = from < to ? to - 1 : to
      return [...rest.slice(0, at), moved, ...rest.slice(at)]
    })

  const drop = () => {
    const payload = drag.current
    if (payload && over !== null) {
      if (payload.kind === 'new') insert(payload.type, over)
      else move(payload.id, over)
    }
    drag.current = null
    setOver(null)
  }

  const restoreDraft = (draft: LocalDraft) => {
    edit(() => draft.doc)
    setSlugText(draft.slug)
    setSlugTouched(draft.slugTouched ?? !!draft.slug)
    setDraftHandled(true)
  }

  const showTab = (next: Tab) => {
    setTab(next)
    if (next === 'preview') renderDocHtml(doc).then(setHtml, console.error)
  }

  const go = (to: SeoTarget) => {
    if (to === 'seo') return showTab('seo')
    setTab('write')
    if (to === 'library') return setRail('library')
    select(to === 'header' ? 'header' : to.block)
  }

  // ---- derived: blockers, SEO checks, changes ----
  const blockers = useMemo(() => {
    const problems = validateDoc(doc)
    if (slugStatus === 'invalid') problems.unshift('The address must be lowercase words joined by hyphens, at most 80 characters.')
    if (slugStatus === 'taken') problems.unshift(`/wiki/${slug} is taken. Choose a different address.`)
    if (slugStatus === 'moved' && !takeover) problems.unshift(`/wiki/${slug} is another article's former address. Confirm the takeover or pick another.`)
    if (!slug && doc.title.trim()) problems.unshift('The title has no letters or digits to build an address from. Type one.')
    return problems
  }, [doc, slug, slugStatus, takeover])

  const deferred = useDeferredValue(doc)
  const checks = useMemo(() => seoChecks(deferred, { slug, children: article?.links?.children.length }), [deferred, slug, article?.links?.children.length])
  const score = seoScore(checks)
  const openChecks = checks.filter((check) => check.level !== 'pass').length
  // Headings that are live on the published page: their anchors stop following the text. Fixed per mount (keyed by `updatedAt`).
  const [keepAnchors] = useState(
    () => new Set(article?.publishedAt ? article.doc.blocks.flatMap((block) => (block.type === 'heading' ? [block.id] : [])) : []),
  )

  const hints = useMemo(() => {
    const map = new Map<string, Hint[]>()
    const push = (id: string, hint: Hint) => map.set(id, [...(map.get(id) ?? []), hint])
    for (const check of checks) if (check.block && check.hint) push(check.block, { text: check.hint, tone: check.level === 'pass' ? 'pass' : 'warn' })
    for (const block of deferred.blocks) {
      const asset = block.type === 'figure' ? deferred.assets[block.asset] : undefined
      if (asset && isDefaultAlt(asset)) push(block.id, { text: '! Alt text is the default', tone: 'warn' })
      if (block.type === 'video' && block.uploadDate) push(block.id, { text: '✓ VideoObject', tone: 'pass' })
      // Google shows FAQ results only for government and health sites now: the schema stays, the promise doesn't.
      if (block.type === 'faq') push(block.id, { text: '✓ FAQPage schema', tone: 'pass' })
      if (block.type === 'heading' && keepAnchors.has(block.id) && block.anchor !== toAnchor(block.text)) push(block.id, { text: 'Anchor kept', tone: 'warn' })
    }
    return map
  }, [checks, deferred, keepAnchors])

  const changed = useMemo(() => {
    if (!article) return undefined
    const set = new Set<string>()
    const before = new Map(article.doc.blocks.map((block) => [block.id, JSON.stringify(block)]))
    for (const block of deferred.blocks) if (before.get(block.id) !== JSON.stringify(block)) set.add(block.id)
    for (const id of before.keys()) if (!deferred.blocks.some((block) => block.id === id)) set.add(`removed:${id}`)
    if (head(deferred) !== head(article.doc) || slug !== article.slug) set.add('header')
    if (meta(deferred) !== meta(article.doc)) set.add('seo')
    return set
  }, [article, deferred, slug])

  const hubTitle = doc.hub ? (titles[doc.hub] ?? doc.hub) : undefined
  const crumbs = [...(doc.hub ? [doc.hub] : []), slug || '…']
  const words = useMemo(() => docWords(deferred), [deferred])

  // ---- saving ----
  const save = async (mode: Exclude<Busy, null>) => {
    if (mode !== 'unpublish' && blockers.length) {
      setError(`${blockers.length} blocker${blockers.length === 1 ? '' : 's'} left. They are listed under Content.`)
      return
    }
    setBusy(mode)
    setError(null)
    setLinkError(null)
    try {
      let saved: Article
      if (!article) {
        saved = await createArticle({ doc, slug: slug || undefined, published: mode === 'publish' })
      } else {
        const patch: DocArticlePatch =
          mode === 'unpublish' ? { published: false, ...(dirty && !blockers.length ? { doc } : {}) } : { doc }
        if (mode !== 'unpublish' && slug !== article.slug) {
          patch.slug = slug
          if (!redirect) patch.redirect = false
        }
        if (mode === 'publish') patch.published = true
        saved = await updateArticle(article.slug, patch)
      }
      setDirty(false)
      forgetDraft()
      dialog.current?.close()
      if (mode === 'publish') router.push(`/wiki/${saved.slug}`)
      else if (!article || saved.slug !== article.slug) router.replace(`/wiki/${saved.slug}/edit`)
      router.refresh()
    } catch (cause) {
      console.error(cause)
      // `doc.hub …` / `doc.related[i] …`: an article that doesn't exist, or this one. Point at the field.
      if (cause instanceof WikiApiError && cause.status === 400 && /doc\.(hub|related)/.test(cause.message)) {
        setLinkError(`The server refused a link: ${cause.message}. Remove it in Site structure.`)
      }
      setError(failure(cause))
      setBusy(null)
    }
  }

  const openPublish = () => {
    setError(null)
    dialog.current?.showModal()
  }

  // ---- render ----
  const unsaved = changed ? changed.size : 0
  const status = article
    ? unsaved
      ? { dot: 'bg-gold', text: `${unsaved} unsaved change${unsaved === 1 ? '' : 's'}`, tone: 'text-gold' }
      : { dot: 'bg-win', text: savedAt ? `Kept in this browser · ${clock(savedAt)}` : 'All changes saved', tone: 'text-ink-muted' }
    : dirty && savedAt
      ? { dot: 'bg-ink-muted', text: `Kept in this browser · ${clock(savedAt)}`, tone: 'text-ink-muted' }
      : { dot: 'bg-ink-muted', text: 'Nothing saved yet', tone: 'text-ink-muted' }
  const scoreTone = score >= 85 ? 'text-win' : score >= 60 ? 'text-gold' : 'text-loss'
  const unservable = assets.some((asset) => !isAllowedSrc(asset.src))
  const mayDelete = !!article && canDelete(user, article.author.id)
  const secondary = twMerge(buttonClasses({ variant: 'secondary', size: 'mono' }), 'min-h-9.5 px-4.5')
  const primary = twMerge(buttonClasses({ variant: 'primary', size: 'mono' }), 'min-h-10 px-5.5')

  const slugProps: SlugProps = {
    slug: slugTouched ? slugText : slug,
    onSlug,
    status: slugStatus,
    original: article?.slug,
    live,
    liveDays,
    redirect,
    onRedirect: setRedirect,
    takeover,
    onTakeover: setTakeover,
  }

  const railTabs = [
    { id: 'seo' as const, label: article ? `SEO · ${score}` : 'SEO' },
    { id: 'library' as const, label: `Library · ${assets.length}` },
    ...(article ? [{ id: 'history' as const, label: 'History' }] : []),
  ]

  return (
    <>
      {/* Editor bar: the actions, the status and the autosave are always in view. */}
      <div className="sticky top-16 z-(--z-sticky) border-b border-line bg-surface-100">
        <div className={twMerge('flex flex-wrap items-center gap-x-6 gap-y-3 py-3.5', WIKI_PAD)}>
          <div className="flex min-w-0 flex-col gap-1.5 xl:min-w-75">
            <nav aria-label="Breadcrumb" className="text-ink-muted signal-sm">
              <Link href="/wiki" className="text-ink-muted hover:text-cyan">
                Omega Wiki
              </Link>{' '}
              /{' '}
              {article ? (
                <>
                  {article.links?.hub ? (
                    <>
                      <Link href={`/wiki/${article.links.hub.slug}`} className="text-ink-muted hover:text-cyan">
                        {article.links.hub.title}
                      </Link>{' '}
                      /{' '}
                    </>
                  ) : null}
                  {article.title}
                </>
              ) : (
                <>
                  <Link href={user ? `/wiki?author=${user.id}` : '/wiki'} className="text-ink-muted hover:text-cyan">
                    My articles
                  </Link>{' '}
                  / New
                </>
              )}
            </nav>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-ink display-3">{article ? `Editing: ${article.title}` : 'New article'}</h1>
              {live ? (
                <span className="cut flex items-center gap-1.5 px-2 py-1 text-ink signal-sm [--cut:var(--cut-xs)] [--edge:var(--color-ground-cyan)] [--fill:var(--color-ground-cyan)]">
                  <span aria-hidden className="size-1.5 rounded-round bg-cyan" />
                  Published
                </span>
              ) : (
                <span className="cut px-2 py-1 text-ink-dim signal-sm [--cut:var(--cut-xs)]">
                  {article ? 'Draft' : savedAt ? `Draft · kept ${clock(savedAt)}` : 'Draft · not saved'}
                </span>
              )}
            </div>
            {article ? (
              <span className="text-ink-muted caption">
                {article.publishedAt ? (
                  <>
                    Live since <LocalTime iso={article.publishedAt} options={{ weekday: 'short', day: 'numeric', month: 'short' }} /> ·{' '}
                  </>
                ) : null}
                last saved{article.updatedBy?.username ? ` by ${article.updatedBy.username}` : ''},{' '}
                <LocalTime iso={article.updatedAt} options={{ hour: '2-digit', minute: '2-digit' }} /> · by {article.author.username ?? 'unknown'}
              </span>
            ) : null}
          </div>

          <TabBar
            label="Editor view"
            idPrefix="doc-editor"
            active={tab}
            onSelect={showTab}
            className="w-auto min-w-80 self-stretch border-b-0 xl:-my-3.5"
            tabs={[
              { id: 'write', label: 'Write' },
              {
                id: 'seo',
                label: (
                  <span className="inline-flex items-center gap-2">
                    SEO {openChecks ? <Flag>{openChecks}</Flag> : null}
                  </span>
                ),
              },
              { id: 'preview', label: 'Preview' },
              { id: 'source', label: 'Source' },
            ]}
          />

          <div className="flex flex-1 flex-wrap items-center justify-end gap-2.5">
            <p className="flex items-center gap-2" aria-live="polite">
              <span aria-hidden className={twMerge('size-2 rounded-round', status.dot)} />
              <span className={twMerge('signal-sm', status.tone)}>{status.text}</span>
            </p>
            <button type="button" onClick={() => showTab('seo')} className="cut flex min-h-10 cursor-pointer items-center gap-2.5 px-3.5 signal-strong [--edge:var(--color-surface-200)]">
              <span className="text-ink-muted">SEO</span>
              <span className={twMerge('text-[20px] stat', scoreTone)}>{score}</span>
              <span className="text-ink-muted">/100</span>
            </button>
            {article ? (
              <>
                {live ? (
                  <Link href={`/wiki/${article.slug}`} className="px-1.5 text-ink-dim signal-strong hover:text-ink">
                    View live ↗
                  </Link>
                ) : null}
                {live ? (
                  <button type="button" disabled={!!busy} onClick={() => void save('unpublish')} className={secondary}>
                    {busy === 'unpublish' ? 'Unpublishing…' : 'Unpublish'}
                  </button>
                ) : (
                  <button type="button" disabled={!!busy} onClick={() => void save('save')} className={secondary}>
                    {busy === 'save' ? 'Saving…' : 'Save draft'}
                  </button>
                )}
                {live ? (
                  <button type="button" disabled={!!busy} onClick={() => void save('save')} className={primary}>
                    {busy === 'save' ? 'Saving…' : 'Save changes'}
                  </button>
                ) : (
                  <button type="button" disabled={!!busy} onClick={openPublish} className={primary}>
                    Publish…
                  </button>
                )}
                <button
                  type="button"
                  aria-label="More: history and delete article"
                  onClick={() => {
                    setTab('write')
                    setRail('history')
                  }}
                  className="cut size-10 cursor-pointer text-ink-dim signal-strong [--edge:var(--color-surface-200)] [--fill:var(--color-surface-200)] hover:text-ink"
                >
                  ⋯
                </button>
              </>
            ) : (
              <>
                <button type="button" disabled={!!busy} onClick={() => void save('save')} className={secondary}>
                  {busy === 'save' ? 'Saving…' : 'Save draft'}
                </button>
                <button type="button" disabled={!!busy} onClick={openPublish} className={primary}>
                  Publish…
                </button>
              </>
            )}
          </div>
        </div>
        {error ? (
          <p role="alert" className={twMerge('border-t border-line bg-ground-loss py-2.5 text-loss body-sm', WIKI_PAD)}>
            {error}
          </p>
        ) : null}
      </div>

      <div {...tabPanelProps('doc-editor', tab)} className={twMerge('py-6 pb-10', WIKI_PAD)}>
        {tab === 'write' ? (
          <div className="grid items-start gap-6 xl:grid-cols-[248px_minmax(0,1fr)_380px]">
            <aside className="flex flex-col gap-5 xl:sticky xl:top-48">
              <Outline blocks={doc.blocks} selected={selected} onSelect={select} changed={changed} />
              <Palette
                onAdd={(type) => insert(type)}
                onDragStart={(type, event) => {
                  drag.current = { kind: 'new', type }
                  event.dataTransfer.effectAllowed = 'copy'
                  event.dataTransfer.setData('text/plain', type)
                }}
                onDragEnd={() => {
                  drag.current = null
                  setOver(null)
                }}
              />
            </aside>

            <main className="flex min-w-0 flex-col gap-6">
              {showOffer && offer ? (
                <div role="status" className="flex flex-wrap items-center gap-3.5 border border-cyan bg-ground-cyan px-4.5 py-3.5">
                  <span aria-hidden className="size-2.25 shrink-0 bg-cyan" />
                  <p className="min-w-0 flex-1 text-ink-dim body-sm">
                    <span className="text-[13px] text-ink body-strong">Unsaved work from {clock(offer.savedAt)} is kept in this browser.</span>
                    {offer.base && article && offer.base !== article.updatedAt
                      ? ` ${article.updatedBy?.username ?? 'Someone'} saved the article at ${clock(article.updatedAt)}, after it — restoring replaces those newer changes.`
                      : ''}
                  </p>
                  <button type="button" onClick={() => restoreDraft(offer)} className={buttonClasses({ variant: 'primary', size: 'mono' })}>
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      forgetDraft()
                      setDraftHandled(true)
                    }}
                    className={buttonClasses({ variant: 'ghost', size: 'mono' })}
                  >
                    Discard
                  </button>
                </div>
              ) : null}

              {converted ? (
                <p className="border border-cyan bg-ground-cyan px-4.5 py-3.5 text-ink-dim body-sm">
                  Converted from Markdown: headings became Heading blocks, everything else stayed as Text. Nothing is saved until you save, and after that
                  the article opens in this editor.
                </p>
              ) : null}

              <HeaderPanel
                doc={doc}
                edit={edit}
                assets={assets}
                autoSlug={!slugTouched}
                selected={selected === 'header'}
                onSelect={() => setSelected('header')}
                slugProps={slugProps}
              />

              <BlockList
                blocks={doc.blocks}
                assets={assets}
                open={open}
                selected={selected}
                over={over}
                hints={hints}
                changed={changed}
                keepAnchors={keepAnchors}
                words={words}
                blockers={blockers}
                onSelect={setSelected}
                onToggle={(id) =>
                  setOpen((set) => {
                    const next = new Set(set)
                    if (!next.delete(id)) next.add(id)
                    return next
                  })
                }
                onChange={(block) => setBlocks((blocks) => blocks.map((other) => (other.id === block.id ? block : other)))}
                onMove={move}
                onDuplicate={(id) =>
                  setBlocks((blocks) => blocks.flatMap((block) => (block.id === id ? [block, { ...structuredClone(block), id: newId() }] : [block])))
                }
                onRemove={(id) => {
                  setBlocks((blocks) => blocks.filter((block) => block.id !== id))
                  setSelected(null)
                }}
                onOver={setOver}
                onDrop={drop}
                onDragBlock={(id, event) => {
                  drag.current = id ? { kind: 'move', id } : null
                  if (!id || !event) return setOver(null)
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', id)
                  const card = blockRefs.current.get(id)
                  if (card) event.dataTransfer.setDragImage(card, 24, 16)
                }}
                dragging={() => !!drag.current}
                register={(id, node) => {
                  if (node) blockRefs.current.set(id, node)
                  else blockRefs.current.delete(id)
                }}
              />
            </main>

            <aside className="min-w-0 xl:sticky xl:top-48 xl:max-h-[calc(100dvh-13rem)] xl:overflow-y-auto">
              <TabBar
                label="Side panel"
                idPrefix="doc-rail"
                active={rail}
                onSelect={setRail}
                tabs={railTabs}
                className="border border-b-0 border-line bg-surface-100"
              />
              <div {...tabPanelProps('doc-rail', rail)} className="border border-t-0 border-line bg-surface-100">
                {rail === 'seo' ? (
                  <SeoRail doc={deferred} slug={slug} crumbs={crumbs} checks={checks} score={score} onKeyword={(keyword) => setSeo({ keyword })} onGo={go} />
                ) : rail === 'library' ? (
                  <div className="p-4">
                    <AssetLibrary assets={assets} used={usedAssets(doc)} onAdd={addAsset} onChange={addAsset} onRemove={removeAsset} />
                  </div>
                ) : article ? (
                  <HistoryRail
                    slug={article.slug}
                    author={article.author.username ?? 'the author'}
                    canDelete={mayDelete}
                    dirty={dirty}
                    onRestored={() => {
                      setDirty(false)
                      forgetDraft()
                      router.refresh()
                    }}
                    onDeleted={() => {
                      setDirty(false)
                      forgetDraft()
                      router.push('/wiki')
                      router.refresh()
                    }}
                  />
                ) : null}
              </div>
            </aside>
          </div>
        ) : null}

        {tab === 'seo' ? (
          <SeoTab
            doc={doc}
            setSeo={setSeo}
            setLinks={setLinks}
            addAsset={addAsset}
            slugProps={slugProps}
            self={article?.slug}
            crumbs={crumbs}
            checks={checks}
            titles={titles}
            onTitle={(picked: ArticleSummary) => setTitles((all) => ({ ...all, [picked.slug]: picked.title }))}
            onGo={go}
            saved={article?.seo}
            linkError={linkError}
          />
        ) : null}

        {tab === 'preview' ? (
          unservable ? (
            <p className="text-cyan body-sm">Some images come from a host the site can&apos;t serve yet, so the preview can&apos;t render. Check the Library.</p>
          ) : (
            <div className="border border-line">
              <ArticleView doc={doc} slug={slug || article?.slug || ''} html={html} />
            </div>
          )
        ) : null}

        {tab === 'source' ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0">
              <p className="text-ink-muted signal">What the editor sends</p>
              <pre className="mt-2 max-h-[70dvh] overflow-auto border border-line bg-surface-200 p-4 text-ink-dim mono-note">
                {JSON.stringify(article ? { doc, slug } : { doc, slug: slug || undefined, published: false }, null, 2)}
              </pre>
            </div>
            <div>
              <TextField label="Load a document" rows={10} mono value={pasted} onChange={setPasted} help="Paste a doc (or a whole request body) to rebuild the article from it." />
              <button
                type="button"
                onClick={() => {
                  const next = parseDoc(pasted)
                  if (!next) return setError(`That isn't a v${WIKI_DOC_VERSION} wiki document.`)
                  edit(() => next)
                  setPasted('')
                  setTab('write')
                }}
                className={twMerge(buttonClasses({ variant: 'secondary', size: 'mono' }), 'mt-3')}
              >
                Load
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <PublishDialog
        dialogRef={dialog}
        doc={doc}
        slug={slug}
        hubTitle={hubTitle}
        crumbs={crumbs}
        blockers={blockers}
        checks={checks}
        busy={busy === 'publish'}
        error={error}
        onGo={go}
        onPublish={() => void save('publish')}
      />
    </>
  )
}
