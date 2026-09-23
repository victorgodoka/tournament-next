'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { twMerge } from 'tailwind-merge'
import { ArticleView } from '@omega/wiki/article-view'
import { buttonClasses } from '@ui/button'
import { TabBar, tabPanelProps } from '@ui/tab-bar'
import { createArticle, updateArticle } from '@utils/articles'
import type { Article } from '@utils/types'
import {
  BLOCK_CATALOG,
  DOC_LIMITS,
  WIKI_DOC_VERSION,
  emptyBlock,
  emptyDoc,
  isAllowedSrc,
  renderDocHtml,
  toAnchor,
  validateDoc,
  type WikiAsset,
  type WikiBlock,
  type WikiBlockType,
  type WikiDoc,
} from '@utils/wiki-doc'
import { FIELD, HELP, LABEL, failure } from '../ArticleForm'
import { AssetLibrary } from './AssetLibrary'
import { AssetPicker, BlockFields, MINI, TextField, blockSummary } from './fields'

type Tab = 'edit' | 'preview' | 'json'

/** What is being dragged: a palette entry (inserts) or a block's handle (moves). */
type Drag = { kind: 'new'; type: WikiBlockType } | { kind: 'move'; id: string }

const newId = () => `b-${crypto.randomUUID().slice(0, 8)}`

const PANEL = 'border border-line bg-surface-000'
const PANEL_HEAD = 'flex items-center justify-between gap-3 border-b border-line bg-ground-soft px-4 py-2.5 text-ink-muted signal-sm'

/** Every asset id the doc points at. The library won't remove these. */
const usedAssets = (doc: WikiDoc) => {
  const ids = new Set<string>()
  if (doc.cover) ids.add(doc.cover.asset)
  if (doc.infobox?.asset) ids.add(doc.infobox.asset)
  for (const block of doc.blocks) {
    if (block.type === 'figure') ids.add(block.asset)
    if (block.type === 'gallery') block.assets.forEach((id) => ids.add(id))
  }
  return ids
}

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
type LocalDraft = { doc: WikiDoc; slug: string; savedAt: number; base?: string }

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

type DocEditorProps = {
  /** Absent on create. On edit, an article that already has a `doc`. */
  article?: Article & { doc: WikiDoc }
  /** The doc was just converted from Markdown: unsaved from the first render. */
  converted?: boolean
}

/**
 * Block editor. The state is one `WikiDoc`; every control edits it, the preview renders it
 * through the published page's own component, and saving sends it as-is (WIKI_API.md §5).
 */
export const DocEditor = ({ article, converted = false }: DocEditorProps) => {
  const router = useRouter()
  const [doc, setDoc] = useState<WikiDoc>(() => article?.doc ?? emptyDoc())
  const [slug, setSlug] = useState(article?.slug ?? '')
  const [tagText, setTagText] = useState(() => (article?.doc.tags ?? []).join(', '))
  const [tab, setTab] = useState<Tab>('edit')
  const [html, setHtml] = useState<Record<string, string>>({})
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [over, setOver] = useState<number | null>(null)
  const [dirty, setDirty] = useState(converted)
  const [status, setStatus] = useState<'idle' | 'saving'>('idle')
  const [problems, setProblems] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pasted, setPasted] = useState('')
  const [draftHandled, setDraftHandled] = useState(false)
  const drag = useRef<Drag | null>(null)
  const blockRefs = useRef(new Map<string, HTMLLIElement>())

  const assets = useMemo(() => Object.values(doc.assets), [doc.assets])
  const used = useMemo(() => usedAssets(doc), [doc])

  // One draft slot per article (and one for "new"). Read through an external-store subscription,
  // so the server render and hydration agree (no draft) and the offer appears right after.
  const draftKey = `wiki-draft:${article?.slug ?? 'new'}`
  const stored = useSyncExternalStore(subscribeStorage, () => readStorage(draftKey), () => null)
  const offer = useMemo(() => {
    const draft = parseDraft(stored)
    const start = JSON.stringify(article?.doc ?? emptyDoc())
    return draft && JSON.stringify(draft.doc) !== start ? draft : null
  }, [stored, article?.doc])
  const showOffer = !!offer && !dirty && !draftHandled

  // Leaving with unsaved work asks first. No state is set here, only a listener.
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
        const draft: LocalDraft = { doc, slug, savedAt: Date.now(), base: article?.updatedAt }
        localStorage.setItem(draftKey, JSON.stringify(draft))
      } catch {
        // Full or blocked storage: the beforeunload guard still stands.
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [doc, slug, dirty, draftKey, article?.updatedAt])

  const forgetDraft = () => {
    try {
      localStorage.removeItem(draftKey)
    } catch {}
  }

  const edit = (next: (doc: WikiDoc) => WikiDoc) => {
    setDoc(next)
    setDirty(true)
    setProblems([])
  }

  const restoreDraft = (draft: LocalDraft) => {
    edit(() => draft.doc)
    setSlug(draft.slug)
    setTagText(draft.doc.tags.join(', '))
    setDraftHandled(true)
  }

  const setBlocks = (next: (blocks: WikiBlock[]) => WikiBlock[]) => edit((d) => ({ ...d, blocks: next(d.blocks) }))

  const insert = (type: WikiBlockType, at: number) => {
    const block = emptyBlock(type, newId())
    setBlocks((blocks) => [...blocks.slice(0, at), block, ...blocks.slice(at)])
    // Scroll to it once it exists, from the event loop rather than an effect.
    requestAnimationFrame(() => blockRefs.current.get(block.id)?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
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

  const replace = (block: WikiBlock) => setBlocks((blocks) => blocks.map((other) => (other.id === block.id ? block : other)))

  const duplicate = (id: string) =>
    setBlocks((blocks) => blocks.flatMap((block) => (block.id === id ? [block, { ...structuredClone(block), id: newId() }] : [block])))

  const remove = (id: string) => setBlocks((blocks) => blocks.filter((block) => block.id !== id))

  const toggle = (id: string) =>
    setCollapsed((set) => {
      const next = new Set(set)
      if (!next.delete(id)) next.add(id)
      return next
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

  const addAsset = (asset: WikiAsset) => edit((d) => ({ ...d, assets: { ...d.assets, [asset.id]: asset } }))
  const removeAsset = (id: string) =>
    edit((d) => {
      const rest = { ...d.assets }
      delete rest[id]
      return { ...d, assets: rest }
    })

  const showTab = (next: Tab) => {
    setTab(next)
    if (next === 'preview') renderDocHtml(doc).then(setHtml, console.error)
  }

  const save = async (published?: boolean) => {
    const found = validateDoc(doc)
    setProblems(found)
    if (found.length) return setError('Fix the problems listed below, then save again.')

    setStatus('saving')
    setError(null)
    try {
      const saved = article
        ? await updateArticle(article.slug, { doc, ...(slug !== article.slug ? { slug: slug.trim() } : {}) })
        : await createArticle({ doc, slug: slug.trim() || undefined, published })
      setDirty(false)
      forgetDraft()
      router.push(`/wiki/${saved.slug}`)
      router.refresh()
    } catch (cause) {
      console.error(cause)
      setError(failure(cause))
      setStatus('idle')
    }
  }

  const infobox = doc.infobox
  const unservable = assets.some((asset) => !isAllowedSrc(asset.src))

  return (
    <div>
      {showOffer && offer ? (
        <div role="status" className="mb-5 flex flex-wrap items-center gap-3 border border-cyan bg-ground-cyan px-4.5 py-3.5">
          <span aria-hidden className="size-2.25 shrink-0 bg-cyan" />
          <p className="min-w-0 flex-1 text-ink-dim body-sm">
            <span className="text-ink body-strong">Unsaved work from {new Date(offer.savedAt).toLocaleString()}</span> is kept
            in this browser.
            {offer.base && article && offer.base !== article.updatedAt
              ? ' The article has been saved since then: restoring replaces those newer changes.'
              : ''}
          </p>
          <button type="button" onClick={() => restoreDraft(offer)} className={buttonClasses({ variant: 'primary', size: 'sm' })}>
            Restore
          </button>
          <button
            type="button"
            onClick={() => {
              forgetDraft()
              setDraftHandled(true)
            }}
            className={buttonClasses({ variant: 'ghost', size: 'sm' })}
          >
            Discard
          </button>
        </div>
      ) : null}

      {converted ? (
        <p className="mb-5 border border-gold bg-ground-gold px-4.5 py-3.5 text-ink-dim body-sm">
          Converted from Markdown: headings became Heading blocks, everything else stayed as Text. Nothing is saved until
          you save, and after that the article opens in this editor.
        </p>
      ) : null}

      <TabBar
        label="Editor view"
        idPrefix="doc-editor"
        active={tab}
        onSelect={showTab}
        tabs={[
          { id: 'edit', label: 'Edit' },
          { id: 'preview', label: 'Preview' },
          { id: 'json', label: 'JSON' },
        ]}
      />

      <div {...tabPanelProps('doc-editor', tab)} className="mt-6">
        {tab === 'edit' ? (
          <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_340px]">
            {/* Palette: drag into the list, or click to append. */}
            <aside className={twMerge(PANEL, 'self-start xl:sticky xl:top-20')}>
              <p className={PANEL_HEAD}>Components</p>
              <ul className="flex flex-col">
                {BLOCK_CATALOG.map((entry) => (
                  <li key={entry.type} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        drag.current = { kind: 'new', type: entry.type }
                        event.dataTransfer.effectAllowed = 'copy'
                        event.dataTransfer.setData('text/plain', entry.type)
                      }}
                      onDragEnd={() => setOver(null)}
                      onClick={() => insert(entry.type, doc.blocks.length)}
                      className="group block w-full cursor-grab px-4 py-3 text-left hover:bg-ground-gold active:cursor-grabbing"
                    >
                      <span className="flex items-center gap-2 text-ink body-strong group-hover:text-gold">
                        <span aria-hidden className="size-1.5 bg-gold" />
                        {entry.label}
                      </span>
                      <span className="mt-0.5 block text-ink-muted micro">{entry.hint}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>

            <div className="flex min-w-0 flex-col gap-6">
              <section className={PANEL} aria-labelledby="doc-page">
                <p id="doc-page" className={PANEL_HEAD}>
                  Page
                </p>
                <div className="flex flex-col gap-4 p-4">
                  <TextField
                    label="Title"
                    value={doc.title}
                    maxLength={DOC_LIMITS.title}
                    onChange={(title) => edit((d) => ({ ...d, title }))}
                    help={`${doc.title.length}/${DOC_LIMITS.title}`}
                  />
                  <TextField
                    label="Address"
                    value={slug}
                    maxLength={80}
                    onChange={(value) => {
                      setSlug(value)
                      setDirty(true)
                    }}
                    placeholder={article ? undefined : 'derived from the title'}
                    help={`/wiki/${slug.trim() || '…'} · lowercase words joined by hyphens.${article ? ' Changing this breaks every existing link.' : ''}`}
                  />
                  <TextField
                    label="Summary"
                    rows={2}
                    value={doc.summary}
                    maxLength={DOC_LIMITS.summary}
                    onChange={(summary) => edit((d) => ({ ...d, summary }))}
                    help="Shown under the title, in search results and in link previews."
                  />
                  <TextField
                    label="Tags"
                    value={tagText}
                    onChange={(text) => {
                      setTagText(text)
                      edit((d) => ({ ...d, tags: [...new Set(text.split(',').map(toAnchor).filter(Boolean))] }))
                    }}
                    // The doc already holds the normalised tags; leaving the field shows the reader what was kept.
                    onBlur={() => setTagText(doc.tags.join(', '))}
                    help={`Comma separated, up to ${DOC_LIMITS.tags}. Lowercased, spaces become hyphens: duel-terminal, hidden-arsenal`}
                  />
                  <AssetPicker
                    optional
                    label="Cover image"
                    assets={assets}
                    selected={doc.cover ? [doc.cover.asset] : []}
                    onChange={([asset]) => edit((d) => ({ ...d, cover: asset ? { asset } : undefined }))}
                  />

                  <div className="border-t border-line pt-4">
                    <label className="flex cursor-pointer items-center gap-2.5 text-ink body-strong">
                      <input
                        type="checkbox"
                        checked={!!infobox}
                        onChange={(event) =>
                          edit((d) => ({ ...d, infobox: event.target.checked ? { facts: [{ label: '', value: '' }] } : undefined }))
                        }
                        className="size-4 accent-gold"
                      />
                      Infobox
                    </label>
                    {infobox ? (
                      <div className="mt-4 flex flex-col gap-4">
                        <AssetPicker
                          optional
                          label="Infobox image"
                          assets={assets}
                          selected={infobox.asset ? [infobox.asset] : []}
                          onChange={([asset]) => edit((d) => ({ ...d, infobox: { ...infobox, asset } }))}
                        />
                        <TextField
                          label="Image caption"
                          value={infobox.caption ?? ''}
                          maxLength={DOC_LIMITS.short}
                          onChange={(caption) => edit((d) => ({ ...d, infobox: { ...infobox, caption: caption || undefined } }))}
                        />
                        <div>
                          <p className={LABEL}>Facts</p>
                          <ul className="mt-2 flex flex-col gap-2">
                            {infobox.facts.map((fact, i) => {
                              const setFact = (patch: Partial<typeof fact>) =>
                                edit((d) => ({
                                  ...d,
                                  infobox: { ...infobox, facts: infobox.facts.map((f, j) => (j === i ? { ...f, ...patch } : f)) },
                                }))
                              // Several values live in the one `value`, a line each: the schema stays a string.
                              const values = fact.value.split('\n')
                              const setValues = (next: string[]) => setFact({ value: next.join('\n') })
                              return (
                                <li key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-start gap-2">
                                  <input aria-label={`Fact ${i + 1} label`} placeholder="Label" value={fact.label} onChange={(event) => setFact({ label: event.target.value })} className={FIELD} />
                                  <div className="flex min-w-0 flex-col gap-1.5">
                                    {values.map((value, k) => (
                                      <div key={k} className="flex gap-1.5">
                                        <input
                                          aria-label={`Fact ${i + 1} value ${k + 1}`}
                                          placeholder="Value"
                                          value={value}
                                          onChange={(event) => setValues(values.map((v, m) => (m === k ? event.target.value.replace(/\n/g, ' ') : v)))}
                                          className={twMerge(FIELD, 'min-w-0 flex-1')}
                                        />
                                        {values.length > 1 ? (
                                          <button
                                            type="button"
                                            aria-label={`Remove value ${k + 1} of fact ${i + 1}`}
                                            onClick={() => setValues(values.filter((_, m) => m !== k))}
                                            className={MINI}
                                          >
                                            −
                                          </button>
                                        ) : null}
                                      </div>
                                    ))}
                                    <button type="button" onClick={() => setValues([...values, ''])} className={twMerge(MINI, 'self-start px-2.5')}>
                                      + Value
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    aria-label={`Remove fact ${i + 1}`}
                                    onClick={() => edit((d) => ({ ...d, infobox: { ...infobox, facts: infobox.facts.filter((_, j) => j !== i) } }))}
                                    className={MINI}
                                  >
                                    ✕
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                          <button
                            type="button"
                            disabled={infobox.facts.length >= DOC_LIMITS.facts}
                            onClick={() => edit((d) => ({ ...d, infobox: { ...infobox, facts: [...infobox.facts, { label: '', value: '' }] } }))}
                            className={twMerge(MINI, 'mt-2 px-3')}
                          >
                            + Fact
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className={PANEL} aria-labelledby="doc-blocks">
                <p id="doc-blocks" className={PANEL_HEAD}>
                  <span>Content</span>
                  <span className="mono-note">
                    {doc.blocks.length}/{DOC_LIMITS.blocks} blocks
                  </span>
                </p>

                <ol
                  onDragOver={(event) => {
                    if (!drag.current) return
                    event.preventDefault()
                    if (!doc.blocks.length) setOver(0)
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    drop()
                  }}
                  className="flex min-h-40 flex-col gap-3 p-4"
                >
                  {doc.blocks.map((block, i) => {
                    const entry = BLOCK_CATALOG.find((item) => item.type === block.type)
                    const closed = collapsed.has(block.id)
                    return (
                      <li
                        key={block.id}
                        ref={(node) => {
                          if (node) blockRefs.current.set(block.id, node)
                          else blockRefs.current.delete(block.id)
                        }}
                        onDragOver={(event) => {
                          if (!drag.current) return
                          const box = event.currentTarget.getBoundingClientRect()
                          setOver(event.clientY < box.top + box.height / 2 ? i : i + 1)
                        }}
                        className={twMerge(
                          'relative border border-line bg-surface-100',
                          over === i && 'before:absolute before:inset-x-0 before:-top-2 before:h-0.5 before:bg-cyan',
                          over === i + 1 && i === doc.blocks.length - 1 && 'after:absolute after:inset-x-0 after:-bottom-2 after:h-0.5 after:bg-cyan',
                        )}
                      >
                        <div className="flex items-center gap-2 border-b border-line px-2 py-1.5">
                          <span
                            draggable
                            role="img"
                            aria-label="Drag to reorder"
                            title="Drag to reorder"
                            onDragStart={(event) => {
                              drag.current = { kind: 'move', id: block.id }
                              event.dataTransfer.effectAllowed = 'move'
                              event.dataTransfer.setData('text/plain', block.id)
                              const card = blockRefs.current.get(block.id)
                              if (card) event.dataTransfer.setDragImage(card, 24, 16)
                            }}
                            onDragEnd={() => {
                              drag.current = null
                              setOver(null)
                            }}
                            className="flex h-8 w-6 cursor-grab items-center justify-center text-ink-muted hover:text-gold active:cursor-grabbing"
                          >
                            ⠿
                          </span>
                          <span className="text-gold mono-note">{String(i + 1).padStart(2, '0')}</span>
                          <span className="text-ink signal-sm">{entry?.label}</span>
                          {closed ? <span className="min-w-0 flex-1 truncate text-ink-muted body-sm">{blockSummary(block)}</span> : <span className="flex-1" />}
                          <button type="button" onClick={() => move(block.id, i - 1)} disabled={i === 0} aria-label={`Move block ${i + 1} up`} className={MINI}>
                            ↑
                          </button>
                          <button type="button" onClick={() => move(block.id, i + 2)} disabled={i === doc.blocks.length - 1} aria-label={`Move block ${i + 1} down`} className={MINI}>
                            ↓
                          </button>
                          <button type="button" onClick={() => duplicate(block.id)} aria-label={`Duplicate block ${i + 1}`} className={MINI}>
                            ⧉
                          </button>
                          <button type="button" onClick={() => toggle(block.id)} aria-expanded={!closed} aria-label={`${closed ? 'Expand' : 'Collapse'} block ${i + 1}`} className={MINI}>
                            {closed ? '+' : '−'}
                          </button>
                          <button type="button" onClick={() => remove(block.id)} aria-label={`Delete block ${i + 1}`} className={twMerge(MINI, 'hover:border-negative hover:text-negative')}>
                            ✕
                          </button>
                        </div>
                        {closed ? null : (
                          <div className="p-4">
                            <BlockFields block={block} assets={assets} onChange={replace} />
                          </div>
                        )}
                      </li>
                    )
                  })}

                  {doc.blocks.length ? null : (
                    <li
                      className={twMerge(
                        'flex min-h-32 items-center justify-center border border-dashed border-line px-6 text-center text-ink-muted body-sm',
                        over === 0 && 'border-cyan bg-ground-cyan text-cyan',
                      )}
                    >
                      Drag a component here, or click one in the list.
                    </li>
                  )}
                </ol>
              </section>
            </div>

            <aside className={twMerge(PANEL, 'self-start xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto')}>
              <p className={PANEL_HEAD}>
                <span>Library</span>
                <span className="mono-note">
                  {assets.length}/{DOC_LIMITS.assets}
                </span>
              </p>
              <div className="p-4">
                <AssetLibrary
                  assets={assets}
                  used={used}
                  onAdd={addAsset}
                  onChange={addAsset}
                  onRemove={removeAsset}
                />
              </div>
            </aside>
          </div>
        ) : null}

        {tab === 'preview' ? (
          unservable ? (
            <p className="text-gold body-sm">
              Some images come from a host the site can&apos;t serve yet, so the preview can&apos;t render. Check the Library.
            </p>
          ) : (
            <div className="border border-line">
              <ArticleView doc={doc} slug={slug.trim() || article?.slug || ''} html={html} />
            </div>
          )
        ) : null}

        {tab === 'json' ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0">
              <p className={LABEL}>What the editor sends</p>
              <pre className="mt-2 max-h-[70dvh] overflow-auto border border-line bg-surface-200 p-4 text-ink-dim mono-note">
                {JSON.stringify(article ? { doc, slug } : { doc, slug: slug.trim() || undefined, published: false }, null, 2)}
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
                  setTagText(next.tags.join(', '))
                  setPasted('')
                  setError(null)
                  setTab('edit')
                }}
                className={twMerge(buttonClasses({ variant: 'secondary', size: 'sm' }), 'mt-3')}
              >
                Load
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <button type="button" onClick={() => void save(false)} disabled={status === 'saving'} className={buttonClasses({ variant: 'primary', size: 'sm' })}>
          {status === 'saving' ? 'Saving…' : article ? 'Save changes' : 'Save draft'}
        </button>
        {article ? null : (
          <button type="button" onClick={() => void save(true)} disabled={status === 'saving'} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
            Save and publish
          </button>
        )}
        <Link href={article ? `/wiki/${article.slug}` : '/wiki'} className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
          Cancel
        </Link>
        {dirty ? <span className="text-ink-muted signal-sm">Unsaved · kept in this browser</span> : null}
      </div>

      <div aria-live="polite" role={error ? 'alert' : undefined} className="mt-3.5">
        {error ? <p className="text-gold body-sm">{error}</p> : null}
        {problems.length ? (
          <ul className="mt-2 flex flex-col gap-1">
            {problems.map((problem) => (
              <li key={problem} className={twMerge(HELP, 'mt-0 text-gold')}>
                {problem}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
