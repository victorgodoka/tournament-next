/**
 * Self-check for the wiki block contract. Run: `npx tsx --tsconfig tsconfig.json scripts/check-wiki-doc.ts`
 * The backend's validator should agree with every assertion here (docs/WIKI_BLOCKS.md §5).
 */
import assert from 'node:assert'
import { EXAMPLE_DOC } from '../app/wiki/example/doc'
import { docFromMarkdown, emptyDoc, parseYouTube, renderDocHtml, toAnchor, validateDoc } from '../utils/wiki-doc'

assert.deepStrictEqual(validateDoc(EXAMPLE_DOC), [], 'the example article must be valid')

const broken = validateDoc({
  ...EXAMPLE_DOC,
  blocks: [
    ...EXAMPLE_DOC.blocks,
    { id: 'x', type: 'heading', level: 2, text: 'History', anchor: 'history' },
    { id: 'y', type: 'figure', asset: 'missing', align: 'wide' },
  ],
})
assert(broken.some((problem) => problem.includes('repeats the anchor')), 'duplicate anchors are refused')
assert(broken.some((problem) => problem.includes('has no image')), 'dangling asset ids are refused')

const foreign = validateDoc({
  ...emptyDoc(),
  assets: { a: { id: 'a', src: 'https://example.com/x.png', width: 1, height: 1, alt: '' } },
})
assert(foreign.some((problem) => problem.includes("can't serve")), 'foreign hosts are refused')
assert(foreign.some((problem) => problem.includes('alt text')), 'alt text is required')

assert.strictEqual(toAnchor('Sky Striker: História!'), 'sky-striker-historia')

// YouTube links in every shape the editor accepts.
const id = 'fzwWvs-6FEs'
assert.deepStrictEqual(parseYouTube(id), { videoId: id })
assert.deepStrictEqual(parseYouTube(`https://www.youtube.com/watch?v=${id}&t=1m30s`), { videoId: id, start: 90 })
assert.deepStrictEqual(parseYouTube(`https://youtu.be/${id}?t=42`), { videoId: id, start: 42 })
assert.deepStrictEqual(parseYouTube(`https://youtube.com/shorts/${id}`), { videoId: id })
assert.deepStrictEqual(parseYouTube(`https://www.youtube-nocookie.com/embed/${id}?start=10`), { videoId: id, start: 10 })
assert.strictEqual(parseYouTube('https://vimeo.com/123'), null)
assert.strictEqual(parseYouTube('not a link'), null)
assert(
  validateDoc({ ...EXAMPLE_DOC, blocks: [{ id: 'v', type: 'video', videoId: 'x', title: '' }] }).length >= 2,
  'a video needs an id and a title',
)

// Markdown → blocks: headings split, fences respected, repeated anchors made unique, result valid.
const converted = docFromMarkdown('Legacy', '# Intro\nHello\n\n## Rules\n```\n## not a heading\n```\n### Rules\ntext')
assert.deepStrictEqual(
  converted.blocks.map((block) => (block.type === 'heading' ? `h${block.level}:${block.anchor}` : block.type)),
  ['h2:intro', 'text', 'h2:rules', 'text', 'h3:rules-2', 'text'],
)
assert.deepStrictEqual(validateDoc(converted), [], 'a converted article is valid as-is')

renderDocHtml(EXAMPLE_DOC).then((html) => {
  assert(html.b1?.includes('<strong'), 'text blocks render their Markdown')
  console.log('wiki-doc: ok')
})
