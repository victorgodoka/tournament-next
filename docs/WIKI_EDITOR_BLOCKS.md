# Wiki editor: deck and article previews

The Write view uses one left column with **Outline** and **Add block** tabs. Both tabs
retain the existing selection, insertion point and drag-and-drop behavior. Arrow keys,
Home and End switch tabs through the shared `TabBar` component.

## Statistics Deck

```json
{
  "id": "deck-example",
  "type": "statistics-deck",
  "deck": {
    "key": "115>482",
    "name": "Sky Striker / Angelechy",
    "ladder": "tcg",
    "faces": [63166095, 26077387]
  },
  "caption": "Open this build's matchups and sample deck."
}
```

The picker reads the selected ladder's `band=all` meta and searches names and keys.
The selection stores its name and up to five distinct cover passcodes; dated articles
keep that artwork. The renderer shows the lead cover with secondary covers overlaid as
squares and derives the internal statistics URL from key and ladder. No arbitrary link or
image URL lives in this block.

Every link in an article's content opens in a new tab (`target="_blank"`, `rel="noopener noreferrer"`):
Markdown links in text, callouts, tables and FAQ answers, `[card:ID]` links, Cards blocks, Statistics
Deck blocks, the infobox's deck covers and Article Preview cards. In-page anchors (`#section`, footnotes,
the table of contents) and the page chrome (breadcrumbs, hub, related articles) stay in the same tab.

`infobox.statisticsDeck` accepts the same `deck` object instead of `infobox.asset`.
The two image sources are exclusive. The covers link to the deck's statistics. The desktop
infobox shows the caption under them; the phone infobox, 112px wide, shows covers and facts only.
The infobox changes only its image area; it does not replace the article title or facts with a deck card.

The tier-list generator gives Tier 1 and Tier 1.5 a block each and the lead deck the infobox.
Longer tiers keep to their table, whose deck names link to the same statistics. The first
cover is the build's own board art, so two builds of one archetype never open on the same
cover. It places **What this list can't tell you** after the opening text.
Cards that refer to actual individual cards can still use the Cards block.

## Article Preview

```json
{ "id": "related-guide", "type": "article-preview", "slug": "yu-gi-oh-tcg-tier-list" }
```

Choose **Article Preview**, search published articles by name or enter a slug. The block
stores only the slug. The renderer reads the referenced article's public cover, title and
summary without credentials and shows a linked card. It follows a redirected slug when
the API resolves an older address. It never renders the referenced body, so self-references
and mutual references cannot recurse.

Inside a text block, the same card expands from:

```text
Read the current rankings below.

[article=yu-gi-oh-tcg-tier-list]

Then compare the matchups with your expected field.
```

The Article toolbar button inserts the tag. The parser separates surrounding paragraphs
before rendering the card, keeping valid HTML when the tag shares a line with text.
Inline code, fenced code and link labels keep the syntax literal. Callouts, FAQ answers
and legacy wiki Markdown use the same renderer. Invalid tags remain literal text, and so
does a tag inside bold, italics, a table cell or a heading: put it in plain paragraph text.

Metadata reads time out after three seconds and coalesce duplicate in-flight requests.
The renderer shows a slug link with “Preview unavailable” if the article is missing,
unpublished or unavailable. It sends no session cookies. The server keeps a published
article's metadata for five minutes (`next.revalidate`), so a page with several previews
costs no API read on most views and an unpublished article drops out within that window;
the editor always reads fresh. Cover URLs must match
the wiki's image sources. Metadata fetching does not recursively visit article links.

## Contract and release order

Both types extend the v1 document contract. Existing v1 documents remain valid. The
updated `omega-server-v3/src/modules/wiki/wiki.doc.ts` validates the block types, slug,
ladder and cover passcodes and includes their text in the search projection. Deploy the
server validator before the editor: an older server rejects unknown block types and
the new infobox field. Generating or editing local JSON files does not publish them.

The shared cover files live at `/wiki-images/article-cover.png` and
`/wiki-images/article-seo-preview.png`.
