import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { renderArticle } from './remark'

const html = async (md: string) => renderToStaticMarkup(<>{await renderArticle(md)}</>)

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
