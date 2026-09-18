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

export async function parseBio(markdownText: string) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeClassNames, {
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
    })
    .use(rehypeSanitize, customSanitizeSchema)
    .use(rehypeStringify);

  const processedContent = await processor.process(markdownText)
  return processedContent.toString()
}
