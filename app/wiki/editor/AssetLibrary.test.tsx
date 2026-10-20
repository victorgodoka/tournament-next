// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WikiAsset } from '@utils/wiki-doc'
import { AssetLibrary } from './AssetLibrary'

vi.mock('next/image', () => ({ default: () => null }))
vi.mock('@utils/articles', () => ({
  uploadWikiAsset: vi.fn(async () => ({ id: 'shot', src: '/shot.png', width: 10, height: 10, alt: 'shot' })),
}))

const asset = (credit?: string): WikiAsset => ({ id: 'shot', src: '/shot.png', width: 10, height: 10, alt: 'shot', credit })
const noop = () => {}

afterEach(cleanup)

describe('AssetLibrary credit', () => {
  it('starts a new upload on Duelists Unite, with no free-text box', async () => {
    const onAdd = vi.fn<(added: WikiAsset) => void>()
    const { container } = render(<AssetLibrary assets={[]} used={new Set()} onAdd={onAdd} onChange={noop} onRemove={noop} />)
    fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [new File(['x'], 'shot.png')] } })
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ credit: 'Duelists Unite' })))

    cleanup()
    render(<AssetLibrary assets={[onAdd.mock.calls[0]![0]]} used={new Set()} onAdd={noop} onChange={noop} onRemove={noop} />)
    expect((screen.getByLabelText('Credit for shot') as HTMLSelectElement).value).toBe('Duelists Unite')
    expect(screen.queryByLabelText('Custom credit for shot')).toBeNull()
  })

  it('opens an older credit on "Other" with its text, and "Other" clears a preset', () => {
    const onChange = vi.fn()
    render(<AssetLibrary assets={[asset('Photo: Konami Japan')]} used={new Set()} onAdd={noop} onChange={onChange} onRemove={noop} />)
    const select = screen.getByLabelText('Credit for shot') as HTMLSelectElement
    expect([...select.options].map((option) => option.text)).toEqual([
      'Duelists Unite',
      '©1996 KAZUKI TAKAHASHI',
      '©2020 Studio Dice/SHUEISHA, TV TOKYO, KONAMI',
      'Other…',
    ])
    expect(select.value).toBe('')
    expect((screen.getByLabelText('Custom credit for shot') as HTMLInputElement).value).toBe('Photo: Konami Japan')

    cleanup()
    render(<AssetLibrary assets={[asset('Duelists Unite')]} used={new Set()} onAdd={noop} onChange={onChange} onRemove={noop} />)
    fireEvent.change(screen.getByLabelText('Credit for shot'), { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ credit: undefined }))
  })
})
