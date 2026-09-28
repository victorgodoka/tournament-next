'use client'

import { useId, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { uploadWikiAsset } from '@utils/articles'
import type { ArticleSeo, ArticleSummary } from '@utils/types'
import {
  DOC_LIMITS,
  imageSource,
  isShareSize,
  shareAsset,
  shareCrop,
  toAnchor,
  type WikiAsset,
  type WikiDoc,
  type WikiSchema,
  type WikiSeo,
} from '@utils/wiki-doc'
import {
  SITE_NAME,
  SNIPPET_CHARS,
  TITLE_PX,
  clip,
  countWords,
  docWords,
  hasKeyword,
  internalLinks,
  plainText,
  searchDescription,
  searchTitle,
  titlePixels,
  usedAssets,
  type SeoCheck,
  type SeoTarget,
} from '@utils/wiki-seo'
import { failure } from '../ArticleForm'
import { ArticlePicker, useArticleSearch } from './ArticlePicker'
import { hasStopWords, SlugField, slugWords, TagInput, type SlugProps } from './HeaderPanel'
import { CheckRow, SerpPreview } from './SeoRail'
import { Check, FieldHead, Frame, Help, INPUT, Meter, Panel, Pill } from './ui'

const PAGE_TYPES: { schema: WikiSchema; label: string; hint: string }[] = [
  { schema: 'Article', label: 'Guide', hint: 'Article · decks, how-tos' },
  { schema: 'DefinedTerm', label: 'Glossary', hint: 'DefinedTerm · “what is”' },
  { schema: 'HowTo', label: 'Steps', hint: 'HowTo · combo lines' },
  { schema: 'CollectionPage', label: 'Hub', hint: 'CollectionPage' },
]

const Section = ({ n, title, meta, children }: { n: string; title: string; meta: string; children: React.ReactNode }) => {
  const id = useId()
  return (
    <section aria-labelledby={id}>
      <div className="mb-4 flex items-center gap-3.5">
        <span className="text-gold stat">{n}</span>
        <h2 id={id} className="text-ink display-3">
          {title}
        </h2>
        <span aria-hidden className="h-px flex-1 bg-line" />
        <span className="text-ink-muted signal-sm">{meta}</span>
      </div>
      {children}
    </section>
  )
}

const BOX = 'cut notch [--cut:var(--cut-lg)] [--edge:var(--color-line)]'

/** The 1200×630 cut the server makes, drawn from the asset's own pixels. Click to move the focal point. */
export const ShareCrop = ({ asset, onFocal, className }: { asset: WikiAsset; onFocal?: (focal: { x: number; y: number }) => void; className?: string }) => {
  const crop = shareCrop(asset)
  const Tag = onFocal ? 'button' : 'div'
  return (
    <Tag
      type={onFocal ? 'button' : undefined}
      aria-label={onFocal ? `Move the focal point of ${asset.id}` : undefined}
      onClick={
        onFocal
          ? (event: React.MouseEvent<HTMLElement>) => {
              const box = event.currentTarget.getBoundingClientRect()
              const x = crop.x + ((event.clientX - box.left) / box.width) * crop.w
              const y = crop.y + ((event.clientY - box.top) / box.height) * crop.h
              onFocal({ x: Math.round((x / asset.width) * 100), y: Math.round((y / asset.height) * 100) })
            }
          : undefined
      }
      className={twMerge('relative block aspect-[1200/630] w-full overflow-hidden border border-line-mid bg-steel', onFocal && 'cursor-crosshair', className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a crop window: sized in percent of the original, which next/image can't express */}
      <img
        src={imageSource(asset, 1200).src}
        alt=""
        style={{
          width: `${(asset.width / crop.w) * 100}%`,
          height: `${(asset.height / crop.h) * 100}%`,
          left: `${(-crop.x / crop.w) * 100}%`,
          top: `${(-crop.y / crop.h) * 100}%`,
        }}
        className="absolute max-w-none"
      />
      {asset.focal ? (
        <span
          aria-hidden
          style={{
            left: `${(((asset.focal.x / 100) * asset.width - crop.x) / crop.w) * 100}%`,
            top: `${(((asset.focal.y / 100) * asset.height - crop.y) / crop.h) * 100}%`,
          }}
          className="absolute size-3.5 -translate-1/2 border-2 border-cyan bg-scrim"
        />
      ) : null}
      <span className="absolute bottom-2 left-2 bg-scrim px-1 text-ink signal-sm">{asset.id}</span>
    </Tag>
  )
}

type SeoTabProps = {
  doc: WikiDoc
  setSeo: (patch: Partial<WikiSeo>) => void
  setLinks: (patch: { hub?: string | null; related?: string[] }) => void
  addAsset: (asset: WikiAsset) => void
  slugProps: SlugProps
  /** The article's own address, left out of every search. */
  self?: string
  crumbs: string[]
  checks: SeoCheck[]
  titles: Record<string, string>
  onTitle: (article: ArticleSummary) => void
  onGo: (to: SeoTarget) => void
  /** The server's last derived head, when the article has been saved. */
  saved?: ArticleSeo
  /** `doc.hub …` / `doc.related …` from a 400, pointed at the Site structure fields. */
  linkError?: string | null
}

/** The SEO tab: everything that decides how the page appears in search and when it is shared. */
export const SeoTab = ({ doc, setSeo, setLinks, addAsset, slugProps, self, crumbs, checks, titles, onTitle, onGo, saved, linkError }: SeoTabProps) => {
  const ids = { title: useId(), desc: useId(), same: useId(), kw: useId(), kw2: useId(), index: useId(), canon: useId() }
  const [mobile, setMobile] = useState(false)
  const [upload, setUpload] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null })
  const seo = doc.seo ?? {}
  const keyword = seo.keyword?.trim() ?? ''
  const title = seo.title ?? ''
  const titlePx = titlePixels(searchTitle(doc))
  const description = seo.description ?? ''
  const assets = Object.values(doc.assets)
  const share = shareAsset(doc)
  const related = doc.related ?? []
  const words = docWords(doc)
  const exclude = [...(self ? [self] : []), ...(doc.hub ? [doc.hub] : []), ...related]
  const rivals = useArticleSearch(keyword)
  const rivalRows = rivals && rivals !== 'loading' ? rivals.articles.filter((article) => article.slug !== self) : []
  const used = usedAssets(doc)
  const inUse = assets.filter((asset) => used.has(asset.id))
  const withKeywordAlt = inUse.filter((asset) => hasKeyword(asset.alt, keyword)).length
  const first = doc.blocks.find((block) => block.type === 'text')
  const firstH2 = doc.blocks.findIndex((block) => block.type === 'heading' && block.level === 2 && hasKeyword(block.text, keyword))
  const allText = doc.blocks.map((block) => (block.type === 'text' || block.type === 'callout' ? plainText(block.md) : block.type === 'heading' ? block.text : '')).join(' ')
  const uses = keyword ? (allText.toLowerCase().match(new RegExp(keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))?.length ?? 0) : 0
  const faqBlocks = doc.blocks.flatMap((block, i) => (block.type === 'faq' ? [i + 1] : []))
  const videoBlocks = doc.blocks.flatMap((block, i) => (block.type === 'video' ? [i + 1] : []))
  const open = checks.filter((check) => check.level !== 'pass')
  const passed = checks.filter((check) => check.level === 'pass')

  const uploadShare = async (file: File | undefined) => {
    if (!file) return
    setUpload({ busy: true, error: null })
    try {
      const asset = await uploadWikiAsset(file, file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '))
      addAsset(asset)
      if (isShareSize(asset)) setSeo({ image: asset.id })
      setUpload({
        busy: false,
        error: isShareSize(asset) ? null : `That image is ${asset.width}×${asset.height}. It is in the Library, but a share image needs ${DOC_LIMITS.shareWidth}×${DOC_LIMITS.shareHeight} or more.`,
      })
    } catch (cause) {
      console.error(cause)
      setUpload({ busy: false, error: failure(cause) })
    }
  }

  return (
    <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_460px]">
      <div className="flex min-w-0 flex-col gap-10">
        <Section n="01" title="Search appearance" meta="What a search result shows">
          <div className={twMerge(BOX, 'flex flex-col gap-5.5 p-6')}>
            <div>
              <FieldHead
                htmlFor={ids.title}
                label={
                  <>
                    SEO title <span className="text-ink-dim">· optional</span>
                  </>
                }
                meta={`${title.length || doc.title.length} chars · ${titlePx} / ${TITLE_PX} px`}
                metaTone={titlePx > TITLE_PX ? 'warn' : 'pass'}
              />
              <Frame>
                <input
                  id={ids.title}
                  value={title}
                  maxLength={DOC_LIMITS.seoTitle}
                  placeholder={doc.title || 'Uses the article title'}
                  onChange={(event) => setSeo({ title: event.target.value })}
                  className={twMerge(INPUT, 'body')}
                />
                <span className="pr-3 whitespace-nowrap text-ink-muted body-sm">| {SITE_NAME}</span>
              </Frame>
              <Meter value={titlePx} limit={TITLE_PX} max={Math.max(TITLE_PX * 1.2, titlePx)} />
              <Help>Empty uses the article title. The site name is added after it and counts toward the width.</Help>
            </div>

            <div>
              <FieldHead
                htmlFor={ids.desc}
                label={
                  <>
                    Meta description <span className="text-ink-dim">· optional</span>
                  </>
                }
                meta={`${description.length} / ${DOC_LIMITS.seoDescription}`}
                metaTone={description.length > SNIPPET_CHARS ? 'warn' : description ? 'pass' : 'muted'}
              />
              <Frame>
                <textarea
                  id={ids.desc}
                  rows={3}
                  value={description}
                  maxLength={DOC_LIMITS.seoDescription}
                  placeholder={doc.summary || 'Uses the summary'}
                  onChange={(event) => setSeo({ description: event.target.value.replace(/\n/g, ' ') })}
                  className={twMerge(INPUT, 'resize-y body')}
                />
              </Frame>
              <Meter value={description.length} limit={SNIPPET_CHARS} max={DOC_LIMITS.seoDescription} />
              <Check id={ids.same} checked={!description} onChange={(checked) => checked && setSeo({ description: '' })} className="mt-2">
                Use the summary instead ({doc.summary.length} characters{doc.summary.length > SNIPPET_CHARS ? ', gets cut' : ''})
              </Check>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <SlugField {...slugProps} />
                {slugProps.slug ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {slugProps.status === 'free' || slugProps.status === 'current' ? <Pill>{slugProps.status === 'free' ? 'Free ✓' : 'Current ✓'}</Pill> : null}
                    <Pill tone={slugWords(slugProps.slug).length <= 5 && !hasStopWords(slugProps.slug) ? 'cyan' : 'warn'}>
                      {slugWords(slugProps.slug).length} words {hasStopWords(slugProps.slug) ? '· stop words ✕' : '✓'}
                    </Pill>
                    {keyword ? (
                      <Pill tone={slugProps.slug.includes(toAnchor(keyword)) ? 'cyan' : 'warn'}>
                        Has keyword {slugProps.slug.includes(toAnchor(keyword)) ? '✓' : '✕'}
                      </Pill>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div>
                <p className="text-ink-muted signal">Breadcrumb</p>
                <p className="mt-2.5 text-ink-dim body-sm">
                  Omega Wiki <span className="text-ink-muted">›</span> {doc.hub ? <>{titles[doc.hub] ?? doc.hub} <span className="text-ink-muted">›</span> </> : null}
                  <span className="text-ink">{doc.title || 'Untitled'}</span>
                </p>
                <Help>From the hub in 04. Shown on the page and sent as BreadcrumbList.</Help>
              </div>
            </div>
          </div>
        </Section>

        <Section n="02" title="Keywords" meta="Editor-only · never rendered">
          <div className={twMerge(BOX, 'grid md:grid-cols-2')}>
            <div className="flex flex-col gap-5 border-line p-6 md:border-r">
              <div>
                <FieldHead htmlFor={ids.kw} label="Focus keyword" />
                <Frame>
                  <input id={ids.kw} value={seo.keyword ?? ''} maxLength={DOC_LIMITS.keyword} placeholder="e.g. sky striker" onChange={(event) => setSeo({ keyword: event.target.value })} className={twMerge(INPUT, 'body')} />
                </Frame>
              </div>
              <div>
                <FieldHead htmlFor={ids.kw2} label="Secondary keywords" meta={`${seo.keywords?.length ?? 0} / ${DOC_LIMITS.keywords}`} />
                <TagInput
                  id={ids.kw2}
                  values={seo.keywords ?? []}
                  max={DOC_LIMITS.keywords}
                  normalise={(value) => value.trim().replace(/\s+/g, ' ').slice(0, DOC_LIMITS.keyword)}
                  onChange={(keywords) => setSeo({ keywords })}
                  placeholder="Add"
                  chipClassName="normal-case tracking-normal"
                />
              </div>
              <div className="border border-line bg-surface-200 p-3.5">
                <p className="text-ink-muted signal">Other articles on this search</p>
                {!keyword ? (
                  <p className="mt-2.5 text-ink-muted body-sm">Set a focus keyword to check.</p>
                ) : rivals === 'loading' ? (
                  <p className="mt-2.5 text-ink-muted body-sm">Searching…</p>
                ) : rivalRows.length ? (
                  <ul className="mt-2.5 flex flex-col gap-1.5">
                    {rivalRows.map((article) => (
                      <li key={article.slug} className="flex items-center gap-2.5">
                        <span className="min-w-0 flex-1 truncate text-ink-dim data">/wiki/{article.slug}</span>
                        <span className="text-gold signal-sm">Same search !</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2.5 text-win signal-sm">None ✓</p>
                )}
                <Help className="mt-2">
                  Titles and keywords matching “{keyword || '…'}”. Two pages chasing one search split its ranking.
                </Help>
              </div>
            </div>
            <div className="p-6">
              <p className="text-ink-muted signal">Where “{keyword || '…'}” appears</p>
              <dl className="mt-3 flex flex-col gap-px bg-line">
                {[
                  ['Title', hasKeyword(doc.title, keyword)],
                  ['SEO title', hasKeyword(seo.title || doc.title, keyword)],
                  ['Meta description', hasKeyword(searchDescription(doc), keyword)],
                  ['Address', !!keyword && slugProps.slug.includes(toAnchor(keyword))],
                  ['First paragraph', first?.type === 'text' && hasKeyword(plainText(first.md), keyword)],
                  ['An H2', firstH2 >= 0 ? String(firstH2 + 1).padStart(2, '0') : false],
                  ['Image alt text', inUse.length ? `${withKeywordAlt} of ${inUse.length}` : false],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex justify-between gap-3 bg-surface-100 px-3 py-2.25">
                    <dt className="text-ink body-sm">{label}</dt>
                    <dd className={twMerge('signal-sm', keyword && value ? 'text-win' : 'text-gold')}>
                      {!keyword ? '—' : value === true ? 'Yes ✓' : value ? `${value} ✓` : 'No ✕'}
                    </dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 bg-surface-100 px-3 py-2.25">
                  <dt className="text-ink body-sm">Uses in {words.toLocaleString('en-US')} words</dt>
                  <dd className="text-ink-dim signal-sm">
                    {uses} · {words ? ((uses * countWords(keyword)) / words * 100).toFixed(1) : '0.0'}%
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </Section>

        <Section n="03" title="Link previews" meta="Discord · X · WhatsApp">
          <div className={twMerge(BOX, 'grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_300px]')}>
            <div className="min-w-0">
              <fieldset>
                <legend className="text-ink-muted signal">
                  Share image · {DOC_LIMITS.shareWidth} × {DOC_LIMITS.shareHeight}
                </legend>
                <div className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
                  {assets.map((asset) => {
                    const fits = isShareSize(asset)
                    const picked = seo.image === asset.id
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        aria-pressed={picked}
                        disabled={!fits}
                        aria-label={`${asset.alt || asset.id}, ${asset.width} by ${asset.height}${fits ? '' : ', too small'}`}
                        onClick={() => setSeo({ image: picked ? '' : asset.id })}
                        className={twMerge(
                          'relative h-18 cursor-pointer overflow-hidden border border-line-mid bg-surface-200 disabled:cursor-not-allowed',
                          picked && 'border-2 border-cyan',
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- library thumbnail, any host the editor holds */}
                        <img src={imageSource(asset, 200).src} alt="" className={twMerge('size-full object-cover', !fits && 'opacity-35')} />
                        <span className={twMerge('absolute bottom-1.5 left-1.5 bg-scrim px-1 signal-sm', fits ? 'text-ink' : 'text-loss')}>
                          {asset.width}
                          {fits ? ' ✓' : ' px'}
                        </span>
                      </button>
                    )
                  })}
                  <label className={twMerge('flex h-18 cursor-pointer items-center justify-center border border-dashed border-line-mid text-ink-dim signal-sm hover:border-cyan hover:text-cyan', upload.busy && 'pointer-events-none opacity-40')}>
                    {upload.busy ? 'Working…' : 'Upload'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(event) => {
                        void uploadShare(event.target.files?.[0])
                        event.target.value = ''
                      }}
                    />
                  </label>
                </div>
              </fieldset>
              <Help className="mt-2.5">
                Picked from the Library, at least {DOC_LIMITS.shareWidth} px wide. Without one it falls back to the cover, then the infobox image. Cropped
                around the image&apos;s focal point.
              </Help>
              <p aria-live="polite" className="mt-2 text-loss body-sm empty:hidden">
                {upload.error ?? ''}
              </p>
            </div>
            <div>
              <p className="mb-2.5 text-ink-muted signal">Crop · 1.91 : 1</p>
              {share ? (
                <>
                  <ShareCrop asset={share} onFocal={(focal) => addAsset({ ...share, focal })} />
                  <Help className="mt-2">Click the image to move the focal point.</Help>
                </>
              ) : (
                <div className="dots flex aspect-[1200/630] items-center justify-center border border-line-mid bg-surface-200 text-ink-muted signal-sm">No image</div>
              )}
            </div>
          </div>
        </Section>

        <Section n="04" title="Site structure" meta="No orphan pages">
          <div className={twMerge(BOX, 'grid gap-6 p-6 md:grid-cols-[280px_minmax(0,1fr)]')}>
            <div className="min-w-0">
              <FieldHead label="Hub" />
              {doc.hub ? (
                <Frame className="justify-between gap-2 px-3 py-2.5">
                  <span className="min-w-0 truncate text-ink body">{titles[doc.hub] ?? doc.hub}</span>
                  <button type="button" onClick={() => setLinks({ hub: null })} className="cursor-pointer text-cyan signal-sm hover:text-ink">
                    Change
                  </button>
                </Frame>
              ) : (
                <ArticlePicker
                  label="Find the hub article"
                  exclude={exclude}
                  onPick={(article) => {
                    onTitle(article)
                    setLinks({ hub: article.slug })
                  }}
                />
              )}
              <Help>The hub page lists every article under it and links back here.</Help>
            </div>
            <div className="min-w-0">
              <FieldHead label="Related articles" meta={`${related.length} / ${DOC_LIMITS.related}`} />
              {related.length ? (
                <ul className="flex flex-col gap-px bg-line">
                  {related.map((slug) => (
                    <li key={slug} className="flex items-center gap-3 bg-surface-100 px-3 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-ink body-strong">{titles[slug] ?? slug}</span>
                      <span className="hidden text-ink-muted data sm:inline">/wiki/{slug}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${titles[slug] ?? slug}`}
                        onClick={() => setLinks({ related: related.filter((other) => other !== slug) })}
                        className="inline-flex size-7 cursor-pointer items-center justify-center border border-line text-ink-dim hover:border-loss hover:text-loss"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className={related.length ? 'mt-2' : undefined}>
                <ArticlePicker
                  label="Find an article by title"
                  exclude={exclude}
                  disabled={related.length >= DOC_LIMITS.related}
                  onPick={(article) => {
                    onTitle(article)
                    setLinks({ related: [...related, article.slug] })
                  }}
                />
              </div>
              <Help className="mt-2">
                Shown as “Read next” at the end of the page. Links inside the text count too: {internalLinks(doc)} found.
              </Help>
              {linkError ? (
                <p role="alert" className="mt-2 text-loss body-sm">
                  {linkError}
                </p>
              ) : null}
            </div>
          </div>
        </Section>

        <Section n="05" title="Indexing and schema" meta="Advanced">
          <div className={twMerge(BOX, 'flex flex-col gap-5.5 p-6')}>
            <fieldset>
              <legend className="mb-2.5 text-ink-muted signal">Page type</legend>
              <div className="grid grid-cols-2 gap-px bg-line md:grid-cols-4">
                {PAGE_TYPES.map((type) => (
                  <label
                    key={type.schema}
                    className="flex cursor-pointer flex-col gap-1 bg-surface-200 p-3.25 has-checked:bg-ground-cyan has-checked:outline has-checked:-outline-offset-1 has-checked:outline-cyan has-focus-visible:outline-2"
                  >
                    <input
                      type="radio"
                      name="wiki-schema"
                      className="sr-only"
                      checked={(seo.schema ?? 'Article') === type.schema}
                      onChange={() => setSeo({ schema: type.schema === 'Article' ? undefined : type.schema })}
                    />
                    <span className="text-ink signal-strong">{type.label}</span>
                    <span className="text-ink-muted caption">{type.hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="flex items-start gap-3 border border-line bg-surface-200 p-3.5">
                <input id={ids.index} type="checkbox" checked={!seo.noindex} onChange={(event) => setSeo({ noindex: !event.target.checked })} className="m-0 mt-0.75 size-4 shrink-0 accent-cyan" />
                <div>
                  <label htmlFor={ids.index} className="text-ink body-strong">
                    Let search engines index this page
                  </label>
                  <Help className="mt-1">Off adds noindex and keeps it out of the sitemap. Drafts are never indexed.</Help>
                </div>
              </div>
              <div>
                <FieldHead htmlFor={ids.canon} label="Canonical URL" />
                <Frame>
                  <input
                    id={ids.canon}
                    value={seo.canonical ?? ''}
                    maxLength={DOC_LIMITS.canonical}
                    spellCheck={false}
                    placeholder={`/wiki/${slugProps.slug || '…'} (this page)`}
                    onChange={(event) => setSeo({ canonical: event.target.value.trim() })}
                    className={twMerge(INPUT, 'data')}
                  />
                </Frame>
                <Help>Only when this copies another page: it also leaves the sitemap.</Help>
              </div>
            </div>
            <div>
              <p className="text-ink-muted signal">Added automatically from the blocks</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Pill>{PAGE_TYPES.find((type) => type.schema === (seo.schema ?? 'Article'))?.schema}</Pill>
                <Pill>BreadcrumbList{doc.hub ? ' · hub' : ''}</Pill>
                {faqBlocks.length ? <Pill>FAQPage · block {faqBlocks.map((n) => String(n).padStart(2, '0')).join(', ')}</Pill> : null}
                {videoBlocks.map((n) => (
                  <Pill key={n}>VideoObject · block {String(n).padStart(2, '0')}</Pill>
                ))}
              </div>
            </div>
          </div>
        </Section>
      </div>

      <aside className="flex flex-col gap-5 xl:sticky xl:top-44">
        <Panel
          title="Search result"
          meta={
            <span className="flex gap-px bg-line">
              {(['Desktop', 'Mobile'] as const).map((view) => {
                const active = (view === 'Mobile') === mobile
                return (
                  <button
                    key={view}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setMobile(view === 'Mobile')}
                    className={twMerge('cursor-pointer px-2.5 py-1.5 signal-sm', active ? 'bg-ground-cyan text-ink outline -outline-offset-1 outline-cyan' : 'bg-surface-200 text-ink-dim')}
                  >
                    {view}
                  </button>
                )
              })}
            </span>
          }
        >
          <div className="p-5">
            <SerpPreview doc={doc} crumbs={crumbs} narrow={mobile} faq />
            <Help className="mt-2.5">An approximation. Search engines rewrite titles and snippets when they think the page answers better.</Help>
          </div>
        </Panel>

        <Panel title="Link preview">
          <div className="p-5">
            <div className="flex flex-col gap-1.5 border border-line-mid bg-surface-200 p-3.5">
              <span className="text-ink-dim caption">{SITE_NAME}</span>
              <span className="text-cyan body-strong">{seo.title?.trim() || doc.title || 'Untitled'}</span>
              <span className="text-ink-dim body-sm">{clip(searchDescription(doc), 110)}</span>
              {share && isShareSize(share) ? (
                <ShareCrop asset={share} className="mt-1.5" />
              ) : share ? (
                <div className="mt-1.5 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- small-card preview */}
                  <img src={imageSource(share, 200).src} alt="" className="size-20 border border-line-mid object-cover" />
                  <span className="text-loss signal-sm">Small square card · {share.width} px</span>
                </div>
              ) : (
                <span className="mt-1.5 text-loss signal-sm">No image</span>
              )}
            </div>
          </div>
        </Panel>

        <Panel title="Checks" meta={<span className="text-win">{`${passed.length} pass · ${open.length} open`}</span>}>
          <div className="flex flex-col gap-3 px-5 py-4">
            {[...open, ...passed.slice(0, 3)].map((check) => (
              <CheckRow key={check.id} check={check} onGo={onGo} compact />
            ))}
          </div>
        </Panel>

        <details className={twMerge(BOX)}>
          <summary className="cursor-pointer px-5 py-3.5 text-ink-muted signal-strong">Structured data · JSON-LD</summary>
          {saved ? (
            <>
              <pre className="max-h-96 overflow-auto px-5 text-[12px] leading-4.25 whitespace-pre-wrap text-ink-dim data">{JSON.stringify(saved.jsonLd, null, 2)}</pre>
              <Help className="px-5 pb-5">As the server built it on the last save.</Help>
            </>
          ) : (
            <Help className="px-5 pb-5">The server builds it from the doc on save; it shows here after the first one.</Help>
          )}
        </details>
      </aside>
    </div>
  )
}
