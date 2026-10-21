# Discrete screen pages — 0.2.0 Beta 1

Page view uses fixed physical sheets: Letter is 816 × 1056 CSS pixels, with 96 pixels per inch and one-inch default margins. A4, Legal, orientation and margins use the same shared page metadata as print. A 24-pixel gap separates sheets. Document zoom scales the whole stack; UI zoom remains independent.

`page-layout.js` calculates the required sheet count and renders the paper backgrounds outside the editable article. A generated CSS float reserves the bottom margin, sheet gap and next top margin. Inline text flows around those areas, including a paragraph spanning multiple sheets. A repeating mask stops decoration and selection backgrounds from painting across margins or page gaps.

The editable document keeps its original paragraphs, text nodes, lists, tables, footnote identities and graph elements. Pagination does not split or clone document text. This preserves native editing, selection ranges, undo/redo and Markdown structure. Tables flow by rows on screen; very large indivisible objects fit the writing area. The original dimensions remain in the document.

Temporary fitting changes only the owned view properties. Cleanup restores those properties while preserving other edits made by the user. Both Markdown serialization and HTML export remove view metadata. Browser and native capture paths must continue using this cleanup.

Web view removes pagination and remains continuous. Source is the existing automatically sized Markdown textarea. Split combines that source editor with the paginated article. Only the outer document canvas owns document scrolling.

Print hides screen backgrounds, generated exclusions, masks and fixed stack heights. It uses the existing print stylesheet and physical `@page` settings. The browser print layout can choose different line/table breaks. Running headers/footers, repeated screen table headers and widow/orphan controls remain future work.

## Verification

`tests/page-layout.test.cjs` checks physical geometry and exclusions. `pagination-checks.js` runs only in the explicit test harness or native smoke test. It measures sheet dimensions, gaps and the rectangle of each text line; it also checks long single paragraphs, mixed formatting, tables, annotations, graph controls, image fitting, large fonts, themes, zoom, source preservation, undo/redo and shrinking back to one sheet.

The native stress case contains 24,207 words. `samples/Pagination-stress-test.md` supplies a larger manual test document in the portable ZIP. Image fitting checks both writing-area dimensions. Layout work yields to painting and input while fonts and images settle; a defensive 5,000-sheet ceiling bounds malformed content.
