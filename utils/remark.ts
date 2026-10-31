// lib/markdown.ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeClassNames from 'rehype-class-names';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { createElement, Fragment, type ReactNode } from 'react';

/** A tag's own `className` rule beats `*`: the defaults' would strip our classes from a, code, ol, ul and li. */
const defaultRules = Object.fromEntries(
  Object.entries(defaultSchema.attributes ?? {}).map(([tag, rules]) => [tag, rules.filter((rule) => !Array.isArray(rule) || rule[0] !== 'className')]),
)

const customSanitizeSchema = {
  ...defaultSchema,
  // remark-rehype already prefixes footnote ids and their links, the only ids Markdown can make. A second prefix would break the links.
  clobberPrefix: '',
  attributes: {
    ...defaultRules,
    // Every tag keeps the classes rehype-class-names put on it.
    '*': [...(defaultSchema.attributes?.['*'] || []), 'className', 'class'],
    // Nothing but a hex reaches `style`: see `toReact`.
    span: [...(defaultSchema.attributes?.span || []), ['dataColor', /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i] as [string, RegExp]],
    // Nothing but a frame name reaches a CSS variable: see `toReact`.
    a: [...(defaultRules.a ?? []), ['dataFrame', /^[a-z]+$/] as [string, RegExp]],
  },
};

type MdNode = { type: string; value?: string; children?: MdNode[]; data?: Record<string, unknown> }

/** A single newline is a line break, not a soft wrap — people type in textareas, not Markdown. Code nodes aren't `text`, so they keep theirs. */
const remarkBreaks = () => (tree: MdNode) => {
  const walk = (node: MdNode) => {
    if (!node.children) return
    node.children = node.children.flatMap((child) => {
      if (child.type !== 'text' || !child.value?.includes('\n')) return (walk(child), [child])
      return child.value.split(/\r?\n/).flatMap((value, i) => [...(i ? [{ type: 'break' }] : []), { type: 'text', value }])
    })
  }
  walk(tree)
}

const COLOR_END = /\]\{(#[0-9a-f]{3}(?:[0-9a-f]{3})?)\}/i

/**
 * `[text]{#4fdc8c}`: coloured text in wiki Markdown. The closing `]{#hex}` and its `[` may sit in different
 * text nodes, which is how bold or a link inside the brackets arrive: everything between them moves into the span.
 * An unmatched one stays as typed.
 */
const remarkColor = () => (tree: MdNode) => {
  const text = (value: string): MdNode[] => (value ? [{ type: 'text', value }] : [])
  const walk = (node: MdNode) => {
    const kids = node.children
    if (!kids) return
    kids.forEach(walk)
    for (let i = 0; i < kids.length; i++) {
      const kid = kids[i]
      const match = kid?.type === 'text' ? COLOR_END.exec(kid.value ?? '') : null
      if (!kid || !match) continue
      const head = (kid.value ?? '').slice(0, match.index)
      let from = i
      let at = head.lastIndexOf('[')
      while (at < 0 && from > 0) {
        from--
        if (kids[from]?.type === 'text') at = kids[from]?.value?.lastIndexOf('[') ?? -1
      }
      if (at < 0) continue
      const opener = from === i ? head : (kids[from]?.value ?? '')
      const inner = from === i ? text(head.slice(at + 1)) : [...text(opener.slice(at + 1)), ...kids.slice(from + 1, i), ...text(head)]
      const before = text(opener.slice(0, at))
      const span: MdNode = { type: 'wikiColor', children: inner, data: { hName: 'span', hProperties: { dataColor: match[1]?.toLowerCase() } } }
      kids.splice(from, i - from + 1, ...before, span, ...text((kid.value ?? '').slice(match.index + match[0].length)))
      // Whatever followed `]{#hex}` is checked next: it may hold another one.
      i = from + before.length
    }
  }
  walk(tree)
}

/** One pipeline for every markdown surface: parse, class up, sanitize, stringify. */
const toHtml = async (markdownText: string, classes: Record<string, string>) => {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(remarkRehype)
    .use(rehypeClassNames, classes)
    .use(rehypeSanitize, customSanitizeSchema)
    .use(rehypeStringify)

  const processedContent = await processor.process(markdownText)
  return processedContent.toString()
}

const BIO_CLASSES = {
      'h1': 'font-display text-2xl uppercase leading-[1.06] text-white pb-1.5',
      'h2': 'font-display text-xl uppercase leading-[1.08] text-white pb-1.5',
      'h3': 'font-display text-lg uppercase leading-[1.1] text-white pb-1',
      'p': 'mb-3 last:mb-0 text-[17px] leading-[1.55] text-omega-gray',
      'strong': 'font-bold text-white',
      'em': 'italic text-white',
      'del': 'text-omega-gray-light',
      'a': 'border-b border-omega-green text-omega-green hover:border-omega-magenta hover:text-omega-magenta',
      'ul': 'mb-3 last:mb-0 list-none p-0',
      'ol': 'mb-3 last:mb-0 list-decimal pl-5 marker:font-mono marker:text-omega-magenta',
      'li': "relative text-[17px] leading-[1.5] text-omega-gray [&+li]:mt-1.5",
      'ul > li': "pl-5.5 before:absolute before:left-0 before:top-[.62em] before:h-0.5 before:w-2.25 before:bg-omega-magenta before:content-['']",
      'hr': 'border-none h-px my-5 bg-omega-faded w-full',
      'blockquote': 'my-3 border-l-2 border-omega-green bg-white/5 py-1.5 pl-3.5 italic',
      'table': 'w-full my-3',
      'thead': 'text-sm font-semibold text-white/75 border-b border-omega-faded whitespace-nowrap',
      'th:first-child': 'pl-0 px-3 py-3.5 text-left',
      'th:last-child': 'pr-0 px-3 py-3.5',
      'th': 'px-3 py-3.5',
      'tbody': 'text-sm divide-y divide-omega-faded',
      'td:first-child': 'pl-0 px-3 py-4 font-medium text-white/85',
      'td': 'px-3 py-4 text-omega-gray',
      'td:last-child': 'pr-0 px-3 py-4 text-omega-gray',
      'code': 'bg-white/10 px-1.5 py-px font-mono text-sm text-omega-green',
}

export const parseBio = (markdownText: string) => toHtml(markdownText, BIO_CLASSES)

/**
 * Wiki article body, in the site's own type scale and colour tokens.
 * The server rejects raw HTML and non-http(s) links on write; the sanitizer is the second wall.
 */
const ARTICLE_CLASSES = {
  'h1': 'mt-9 mb-3.5 text-ink display-2 first:mt-0',
  'h2': 'mt-8 mb-3 text-ink display-2 first:mt-0',
  'h3': 'mt-6 mb-2.5 text-ink display-3 first:mt-0',
  'h4': 'mt-5 mb-2 text-ink display-6 first:mt-0',
  'p': 'mb-5 last:mb-0 text-base/[27px] text-ink-dim max-sm:mb-4.5 max-sm:text-base/[26px]',
  'strong': 'font-bold text-ink',
  'em': 'italic',
  'del': 'text-ink-muted line-through',
  'a': 'text-cyan hover:text-ink',
  // Prose links underline. Card links carry a frame glyph instead, footnote links their brackets.
  'a:not([href^="/wiki/card/"]):not([data-footnote-ref])': 'underline decoration-cyan/40 underline-offset-3',
  'a[href^="/wiki/card/"]':
    "inline-flex items-baseline gap-1.5 font-medium before:inline-block before:h-[11px] before:w-2 before:translate-y-px before:bg-(--frame,var(--color-line-mid)) before:content-['']",
  // A passcode the lookup couldn't name.
  '.card-raw': 'font-mono text-sm',
  'ul': 'mb-4.5 flow-root last:mb-0 list-none p-0',
  'ol': 'mb-5 flow-root last:mb-0 list-none p-0',
  'li': 'relative text-base/[27px] text-ink-dim max-sm:text-base/[26px]',
  'ul > li': "pl-5.5 before:absolute before:top-[13px] before:left-0.5 before:h-0.5 before:w-2.5 before:bg-cyan before:content-[''] max-sm:before:top-3",
  'li ul': 'mt-1 mb-0 [&>li]:before:bg-line-mid',
  // The box sits where the dash would.
  'li.task-list-item': '[&.task-list-item]:pl-7.5 [&.task-list-item]:before:hidden',
  'input[type=checkbox]': 'wiki-check',
  // A numbered list reads as steps: chamfered number, rule down to the next one. Built in `rehypeArticle`.
  '.step':
    "grid grid-cols-[32px_minmax(0,1fr)] gap-4 pb-4.5 last:pb-0 max-sm:gap-3.5 max-sm:pb-4 after:absolute after:top-8.5 after:bottom-0.5 after:left-[15px] after:w-px after:bg-line-mid after:content-[''] last:after:hidden",
  '.step-no': 'cut flex size-8 items-center justify-center font-display text-base text-gold [--cut:var(--cut-xs)] [--fill:var(--color-surface-200)]',
  '.step-body': 'min-w-0',
  'hr': 'my-7 h-px w-full border-none bg-line',
  'blockquote': 'my-5 bg-surface-100 px-4.5 py-3.5 italic max-sm:px-4 max-sm:py-3 [&_p]:leading-[26px] [&_p]:text-ink',
  '.table-box': 'my-5',
  '.table-scroll': 'overflow-x-auto max-sm:-mr-gutter max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden',
  '.table-hint': 'mt-2 block text-ink-muted signal-sm sm:hidden',
  // Under 640px a table with three columns or more keeps its width and scrolls.
  '.table-wide': 'max-sm:min-w-[520px]',
  'table': 'w-full border-collapse border border-line',
  'th': 'border border-line bg-surface-200 px-3.5 py-[11px] text-ink-muted signal max-sm:px-3 max-sm:py-2.5 max-sm:text-[10px]',
  // Only where the column sets no alignment: the class would beat `align`, and a bare <th> centres.
  'th:not([align])': 'text-left',
  'td': 'border border-line bg-surface-100 px-3.5 py-[11px] text-sm/5 text-ink-dim max-sm:px-3 max-sm:py-2.5',
  ':not(pre) > code': 'bg-surface-200 px-1.5 py-px text-ink mono-data',
  'pre': 'my-5 overflow-x-auto border border-line bg-[#0b0e1a] px-4 py-3.5',
  'pre code': 'font-mono text-[13px]/[21px] text-ink-dim',
  '.hljs-keyword, .hljs-built_in, .hljs-literal, .hljs-type': 'text-cyan',
  '.hljs-string, .hljs-regexp': 'text-win',
  '.hljs-number, .hljs-variable, .hljs-template-variable, .hljs-attr': 'text-gold',
  '.hljs-comment, .hljs-meta': 'italic text-ink-muted',
  'img': 'my-5 max-w-full',
  '.footnotes': 'clear-both mt-5 border-t border-line pt-3',
  // The browser's own counter, so the number needs no markup.
  '.footnotes li':
    'pl-5 text-[13px]/5 before:absolute before:left-0 before:font-mono before:text-[11px] before:font-bold before:text-cyan before:content-[counter(list-item)] [&_p]:text-[13px]/5',
  'sup a': "ml-0.5 no-underline signal-strong before:content-['['] after:content-[']']",
  // Where footnote links land: clear of the fixed header, like heading anchors.
  '.footnotes li, sup a': 'scroll-mt-24',
}

type HastNode = {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

const VOID = new Set(['br', 'hr', 'img', 'input'])

/** remark-rehype puts newlines between table rows and cells; HTML allows no text there, so React flags it at hydration. */
const NO_TEXT = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr'])

const element = (tagName: string, className: string[], children: HastNode[]): HastNode => ({ type: 'element', tagName, properties: { className }, children })

const CARD_HREF = /^\/wiki\/card\/(\d+)$/

/**
 * What the class map can't add, because it isn't a class: the number and body of a step, the scroller around a table,
 * a card link's frame. `frames` holds the frames of the cards a doc links to; a passcode it doesn't know stays neutral.
 */
const rehypeArticle = (frames?: ReadonlyMap<number, string>) => (tree: HastNode) => {
  const walk = (node: HastNode, inFootnotes: boolean) => {
    if (!node.children) return
    const footnotes = inFootnotes || 'dataFootnotes' in (node.properties ?? {})
    node.children = node.children.map((child) => {
      walk(child, footnotes)
      if (child.tagName !== 'table') return child
      const head = child.children?.find((part) => part.tagName === 'thead')?.children?.find((part) => part.tagName === 'tr')
      const wide = (head?.children?.filter((cell) => cell.tagName === 'th').length ?? 0) >= 3
      if (wide) child.properties = { ...child.properties, className: ['table-wide'] }
      const hint = element('span', ['table-hint'], [{ type: 'text', value: 'Scroll for more →' }])
      return element('div', ['table-box'], [element('div', ['table-scroll'], [child]), ...(wide ? [hint] : [])])
    })

    if (node.tagName === 'ol' && !footnotes) {
      let step = Number(node.properties?.start ?? 1)
      for (const item of node.children ?? []) {
        if (item.tagName !== 'li') continue
        item.properties = { ...item.properties, className: ['step'] }
        item.children = [element('span', ['step-no'], [{ type: 'text', value: String(step++) }]), element('div', ['step-body'], item.children ?? [])]
      }
    }

    const passcode = node.tagName === 'a' ? String(node.properties?.href ?? '').match(CARD_HREF)?.[1] : undefined
    if (passcode) {
      const frame = frames?.get(Number(passcode))
      if (frame) node.properties = { ...node.properties, dataFrame: frame }
      if (node.children?.[0]?.value === passcode) node.properties = { ...node.properties, className: ['card-raw'] }
    }
  }
  walk(tree, false)
}

/** hast names `ariaDescribedBy` / `dataFootnoteRef`; React wants `aria-describedby` / `data-footnote-ref`. */
const propName = (name: string) => {
  if (/^aria[A-Z]/.test(name)) return `aria-${name.slice(4).toLowerCase()}`
  return /^data[A-Z]/.test(name) ? name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`) : name
}

/**
 * Sanitized hast → React elements. Only what `rehype-sanitize` let through reaches here, and it becomes
 * elements and text nodes, never an HTML string: nothing can be re-parsed into markup (REVISAO_WIKI §3).
 */
const toReact = (node: HastNode, key?: number): ReactNode => {
  if (node.type === 'text') return node.value
  const kids = NO_TEXT.has(node.tagName ?? '') ? node.children?.filter((child) => child.type !== 'text' || child.value?.trim()) : node.children
  const children = kids?.map(toReact) ?? []
  if (node.type === 'root') return createElement(Fragment, { key }, ...children)
  if (node.type !== 'element' || !node.tagName) return null

  const { dataColor, dataFrame, ...properties } = node.properties ?? {}
  const props: Record<string, unknown> = { key }
  // The sanitizer let only a hex or a bare word through (`customSanitizeSchema`), so these can't carry other CSS.
  if (typeof dataColor === 'string') props.style = { color: dataColor }
  if (typeof dataFrame === 'string') props.style = { '--frame': `var(--color-type-${dataFrame})` }
  for (const [name, value] of Object.entries(properties)) {
    if (value === null || value === undefined || value === false) continue
    props[propName(name)] = Array.isArray(value) ? value.join(' ') : value
  }
  // GFM task-list boxes arrive `checked` + `disabled`; React needs to know they are read-only.
  if (node.tagName === 'input') props.readOnly = true
  return VOID.has(node.tagName) ? createElement(node.tagName, props) : createElement(node.tagName, props, ...children)
}

/** Fences with a known language become `hljs-*` spans, coloured in `ARTICLE_CLASSES`. Any other stays plain text. */
const rehypeHighlight = () => async (tree: HastNode) => {
  const fences: HastNode[] = []
  const walk = (node: HastNode) => {
    if (node.tagName === 'code') fences.push(node)
    node.children?.forEach(walk)
  }
  walk(tree)
  if (!fences.length) return
  const { lowlight } = await import('./code-highlight')
  for (const code of fences) {
    const language = String(code.properties?.className ?? '').match(/language-(\S+)/)?.[1]
    const text = code.children?.[0]?.value
    if (language && text && lowlight.registered(language)) code.children = lowlight.highlight(language, text).children as HastNode[]
  }
}

/** The same pipeline as `toHtml`, stopped at the sanitized tree and turned into React nodes. */
const toNodes = async (markdownText: string, classes: Record<string, string>, frames?: ReadonlyMap<number, string>): Promise<ReactNode> => {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(remarkColor)
    .use(remarkRehype)
    .use(rehypeHighlight)
    .use(rehypeArticle, frames)
    .use(rehypeClassNames, classes)
    .use(rehypeSanitize, customSanitizeSchema)
  const tree = await processor.run(processor.parse(markdownText))
  return toReact(tree as HastNode)
}

/** Wiki Markdown (text, callout, FAQ answers, legacy bodies) as React nodes. `frames`: card frames by passcode, for card links. */
export const renderArticle = (markdownText: string, frames?: ReadonlyMap<number, string>) => toNodes(markdownText, ARTICLE_CLASSES, frames)

/** A wiki code block: literal text in a fence longer than any backtick run inside it, so nothing in it reads as Markdown. */
export const renderCode = (code: string, language: string) => {
  const fence = '`'.repeat(Math.max(3, ...(code.match(/`+/g) ?? []).map((run) => run.length + 1)))
  return renderArticle(`${fence}${language}\n${code}\n${fence}`)
}
