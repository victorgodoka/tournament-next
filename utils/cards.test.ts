import { afterEach, describe, expect, it, vi } from 'vitest'
import { cardsByIds, EMPTY_POOL_QUERY, poolParams } from './cards'
import { CARD_IMAGE_URL } from './const'

afterEach(() => vi.unstubAllGlobals())

describe('card scans', () => {
  it('points at the common scan folder', () => {
    expect(CARD_IMAGE_URL(44649322)).toBe('https://ygopro.online/assets/card-images/common/44649322.jpg')
  })
})

describe('card pool', () => {
  it('maps the query onto the API parameters, omitting empty ones', () => {
    expect(poolParams({ ...EMPTY_POOL_QUERY, text: 'ash', kind: ['monster'], banlist: 2 }, 1).toString())
      .toBe('fname=ash&kind=monster&banlist=2&legal=true&sort=name&order=asc&page=1&limit=60')
    expect(poolParams({ ...EMPTY_POOL_QUERY, text: 'draw 2', textMode: 'text' }, 3).get('q')).toBe('draw 2')
    // legal and status mean nothing without a banlist: the API would 400.
    expect(poolParams({ ...EMPTY_POOL_QUERY, status: ['limited'] }, 1).has('legal')).toBe(false)
    expect(poolParams({ ...EMPTY_POOL_QUERY, status: ['limited'] }, 1).has('status')).toBe(false)
    expect(poolParams({ ...EMPTY_POOL_QUERY, types: ['synchro', 'tuner'], levelMin: 0 }, 1).get('types')).toBe('synchro,tuner')
    expect(poolParams({ ...EMPTY_POOL_QUERY, levelMin: 0 }, 1).get('levelMin')).toBe('0')
  })

  it('keys looked-up cards by the passcode asked for, so alt arts resolve', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ cards: [{ idSearched: 46986431, id: 46986414, name: 'Dark Magician' }], total: 1 })))
    const map = await cardsByIds([46986431])
    expect(map.get(46986431)?.id).toBe(46986414)
  })

  it('maps every requested passcode of a card that came back once', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ cards: [{ idSearched: 46986414, id: 46986414, name: 'Dark Magician', alternateArts: [46986431] }], total: 1 })))
    const map = await cardsByIds([46986414, 46986431])
    expect(map.get(46986414)?.id).toBe(46986414)
    expect(map.get(46986431)?.id).toBe(46986414)
  })
})
