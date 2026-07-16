const TCG_AFFILIATE_BASE = 'https://partner.tcgplayer.com/c/4924450/1830156/21018'

/**
 * Build a TCGplayer affiliate search link for a card name. The card name is
 * encoded on its own (so names with `&`, `#`, spaces, etc. survive), then the
 * whole search URL is encoded again as the affiliate `u` parameter.
 */
export const tcgHref = (name?: string) => {
  const search = `https://www.tcgplayer.com/search/yugioh/product?Language=English&productLineName=yugioh&q=${encodeURIComponent(
    name ?? '',
  )}&view=grid`

  return `${TCG_AFFILIATE_BASE}?u=${encodeURIComponent(search)}`
}
