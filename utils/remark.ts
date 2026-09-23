// lib/markdown.ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeClassNames from 'rehype-class-names';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

const customSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // Permite que qualquer tag HTML válida mantenha suas classes
    'h1': [...(defaultSchema.attributes?.['*'] || []), 'className', 'class'],
    'h2': [...(defaultSchema.attributes?.['*'] || []), 'className', 'class'],
    'h3': [...(defaultSchema.attributes?.['*'] || []), 'className', 'class'],
    'p': [...(defaultSchema.attributes?.['*'] || []), 'className', 'class'],
    'li': [...(defaultSchema.attributes?.['*'] || []), 'className', 'class'],
    'ul': [...(defaultSchema.attributes?.['*'] || []), 'className', 'class'],
    'hr': [...(defaultSchema.attributes?.['*'] || []), 'className', 'class'],
    'table': [...(defaultSchema.attributes?.['*'] || []), 'className', 'class'],
    'thead': [...(defaultSchema.attributes?.['*'] || []), 'className', 'class'],
    'th': [...(defaultSchema.attributes?.['*'] || []), 'className', 'class'],
    'tbody': [...(defaultSchema.attributes?.['*'] || []), 'className', 'class'],
    'td': [...(defaultSchema.attributes?.['*'] || []), 'className', 'class'],
    'code': [...(defaultSchema.attributes?.['*'] || []), 'className', 'class'],
    '*': [...(defaultSchema.attributes?.['*'] || []), 'className', 'class']
  }
};

type MdNode = { type: string; value?: string; children?: MdNode[] }

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
  'h1': 'mt-9 mb-3.5 text-ink display-3 first:mt-0',
  'h2': 'mt-8 mb-3 text-ink display-4 first:mt-0',
  'h3': 'mt-6 mb-2.5 text-ink display-5 first:mt-0',
  'h4': 'mt-5 mb-2 text-ink display-6 first:mt-0',
  'p': 'mb-4 last:mb-0 text-ink-dim body',
  'strong': 'font-bold text-ink',
  'em': 'italic',
  'del': 'text-ink-muted line-through',
  'a': 'text-gold underline underline-offset-2 hover:text-cyan',
  'ul': 'mb-4 flow-root last:mb-0 list-none p-0',
  'ol': 'mb-4 flow-root last:mb-0 list-decimal pl-5 text-ink-dim marker:font-mono marker:text-gold',
  'li': 'relative text-ink-dim body [&+li]:mt-1.5',
  'ul > li': "pl-5.5 before:absolute before:left-0 before:top-[.62em] before:h-0.5 before:w-2.5 before:bg-gold before:content-['']",
  'hr': 'my-7 h-px w-full border-none bg-line',
  'blockquote': 'my-4 border-l-2 border-gold bg-ground-gold py-2 pl-4 text-ink-dim italic',
  'table': 'my-5 w-full border border-line',
  'thead': 'border-b border-line bg-ground-soft text-ink-muted',
  'th': 'px-3.5 py-2.5 text-left signal-sm',
  'tbody': 'divide-y divide-line',
  'td': 'px-3.5 py-3 text-ink-dim body-sm',
  'code': 'border border-line bg-surface-200 px-1.5 py-px text-gold mono-note',
  'pre': 'my-4 overflow-x-auto border border-line bg-surface-200 p-4',
  'pre code': 'border-none bg-transparent p-0 text-ink-dim',
  'img': 'my-4 max-w-full border border-line',
}

export const renderArticle = (markdownText: string) => toHtml(markdownText, ARTICLE_CLASSES)
