import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { renderArticle, renderCode } from './remark'

const html = async (md: string) => renderToStaticMarkup(<>{await renderArticle(md)}</>)

describe('code', () => {
  it('colours a fence in a known language and keeps its text', async () => {
    const page = renderToStaticMarkup(<>{await renderCode('echo "hi" # say', 'bash')}</>)
    expect(page).toMatch(/<span class="hljs-string [^"]*text-win[^"]*">&quot;hi&quot;<\/span>/)
    expect(page).toMatch(/<span class="hljs-comment [^"]*">/)
    expect(page.replace(/<[^>]+>/g, '')).toBe('echo &quot;hi&quot; # say\n')
  })

  it('leaves plain text and an unknown language uncoloured', async () => {
    for (const language of ['text', 'klingon']) expect(renderToStaticMarkup(<>{await renderCode('echo hi', language)}</>)).not.toContain('hljs')
  })

  it('never reads a code block as Markdown or HTML', async () => {
    const page = renderToStaticMarkup(<>{await renderCode('```\n<script>**x** [a](b)', 'text')}</>)
    expect(page).toContain('&lt;script&gt;**x** [a](b)')
    expect(page).not.toContain('<strong')
  })
})

describe('article classes', () => {
  it('survive the sanitizer on tags with their own className rule', async () => {
    const page = await html('1. [step](/download) `code`\n\n- item')
    for (const tag of ['ol', 'li', 'a', 'code', 'ul']) expect(page).toMatch(new RegExp(`<${tag} [^>]*class="[^"]+"`))
  })

  it('still drops an unsafe link', async () => {
    expect(await html('[x](javascript:alert(1))')).not.toContain('javascript:')
  })
})

describe('coloured text', () => {
  it('colours a run of text', async () => {
    expect(await html('[+1.2]{#4fdc8c} up')).toContain('<span style="color:#4fdc8c">+1.2</span> up')
  })

  it('takes bold around it, and bold or a link inside it', async () => {
    expect(await html('**[x]{#fff}**')).toMatch(/<strong[^>]*><span style="color:#fff">x<\/span><\/strong>/)
    expect(await html('[a **b** c]{#123456}')).toMatch(/<span style="color:#123456">a <strong[^>]*>b<\/strong> c<\/span>/)
    expect(await html('[see [the wiki](/wiki)]{#abc}')).toMatch(/<span style="color:#abc">see <a [^>]*>the wiki<\/a><\/span>/)
  })

  it('handles several in a row and in a table cell', async () => {
    const page = await html('| a |\n|---|\n| [1]{#111} and [2]{#222} |')
    expect(page).toContain('<span style="color:#111">1</span> and <span style="color:#222">2</span>')
  })

  it('leaves anything that is not a hex as typed, so no CSS can get in', async () => {
    const page = await html('[x]{#12} [y]{red} [z]{#fff;background:url(x)}')
    expect(page).not.toContain('style=')
    expect(page).toContain('[x]{#12}')
  })

  it('leaves code alone: the syntax can be documented', async () => {
    expect(await html('`[x]{#fff}`')).not.toContain('style=')
  })

  it('leaves a stray closer alone', async () => {
    expect(await html('x]{#fff}')).toContain('x]{#fff}')
  })
})

describe('footnotes', () => {
  const NOTE = 'Text.[^a]\n\n[^a]: Note.'

  it('links both ways: every href lands on an id that exists', async () => {
    const page = await html(NOTE)
    const ids = [...page.matchAll(/ id="([^"]+)"/g)].map((match) => match[1])
    const hrefs = [...page.matchAll(/ href="#([^"]+)"/g)].map((match) => match[1])
    expect(hrefs).toHaveLength(2)
    for (const href of hrefs) expect(ids).toContain(href)
  })

  it('lands both links clear of the fixed header', async () => {
    const page = await html(NOTE)
    for (const id of ['user-content-fn-a', 'user-content-fnref-a'])
      expect(page.match(new RegExp(`<[^>]* id="${id}"[^>]*>`))?.[0]).toContain('scroll-mt-24')
  })

  it('names the reference after the label with an attribute the browser reads', async () => {
    const page = await html(NOTE)
    expect(page).toContain('aria-describedby="footnote-label"')
    expect(page).toContain('id="footnote-label"')
    expect(page).not.toContain('aria-described-by')
  })

  it('keeps ids prefixed, so a label cannot clobber the page', async () => {
    expect(await html('x[^location]\n\n[^location]: y')).toContain('id="user-content-fn-location"')
  })

  it('gets no id or name from typed HTML', async () => {
    expect(await html('<a id="location" name="body">x</a>')).not.toMatch(/ (id|name)=/)
  })
})

describe('steps', () => {
  it('numbers a list from its own start', async () => {
    expect((await html('4. a\n5. b')).match(/step-no[^>]*>(\d)/g)?.map((tag) => tag.at(-1))).toEqual(['4', '5'])
  })

  it('leaves footnotes and bullet lists alone', async () => {
    expect(await html('x[^a]\n\n[^a]: y\n\n- z')).not.toContain('step-no')
  })
})

describe('card links', () => {
  const FRAMES = new Map([[26077387, 'effect']])

  it('take their frame as a CSS variable', async () => {
    const link = (await renderToStaticMarkup(<>{await renderArticle('[Raye](/wiki/card/26077387)', FRAMES)}</>)).match(/<a [^>]*>/)?.[0]
    expect(link).toContain('--frame:var(--color-type-effect)')
    expect(link).not.toContain('data-frame')
  })

  it('stay neutral for a card the lookup did not name, and set a bare passcode in mono', async () => {
    const page = await html('[63166095](/wiki/card/63166095)')
    expect(page).not.toContain('--frame:')
    expect(page).toContain('card-raw')
  })

  it('let nothing but a bare word through to the CSS variable', async () => {
    const page = renderToStaticMarkup(<>{await renderArticle('[x](/wiki/card/1)', new Map([[1, 'red);background:url(x']]))}</>)
    expect(page).not.toContain('--frame:')
    expect(page).not.toContain('url(x')
  })
})

describe('tables', () => {
  it('scroll with a hint from three columns, on a phone', async () => {
    const wide = await html('| a | b | c |\n|---|---|---|\n| 1 | 2 | 3 |')
    expect(wide).toContain('table-wide')
    expect(wide).toContain('Scroll for more')
    expect(await html('| a | b |\n|---|---|\n| 1 | 2 |')).not.toContain('Scroll for more')
  })

  it('lets a header follow its column, and keeps unaligned ones on the left', async () => {
    const page = await html('| a | b | c |\n|---|:-:|--:|\n| 1 | 2 | 3 |')
    const [plain, center, right] = page.match(/<th [^>]*>/g) ?? []
    expect(plain).toContain('text-left')
    expect(center).toContain('align="center"')
    expect(center).not.toContain('text-left')
    expect(right).toContain('align="right"')
    expect(right).not.toContain('text-left')
  })
})
