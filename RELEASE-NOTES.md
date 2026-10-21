# Editor, MD — 0.2.0 Beta 1

This beta adds document and workspace controls, native font selection, wiki links, and editable image sizes and placement. It includes the separate-page improvements from the unpublished 0.1.3.2 local build.

## New controls

- **Ctrl+mouse wheel** zooms the Page or Web document. Quick controls use 25–200%; double-click the percentage for any positive custom percentage.
- Drag either sidebar divider to resize it independently. Widths are remembered; document zoom does not alter them. Focus a divider and use arrow keys for keyboard resizing.
- **Appearance → UI text size** provides A− / A+ buttons, shared across themes. UI text, UI zoom, document font size, document zoom and sidebar widths remain separate settings.
- The Home font menu lists installed system families. **Custom… Load font file** opens a Windows picker for TTF/OTF fonts, validates them, and saves a private copy in the portable data folder. No Windows font installation is required.
- **Wiki links** such as `[[Note]]`, `[[folder/Note]]`, and `[[Note#Heading|Label]]` appear as links in Write view. Their tooltip explains double-clicking to open the target in an editor tab. Existing tabs are reused. Code examples remain literal; aliases and headings survive Markdown saves. Duplicate filenames require a folder path.

## Pictures

- Local picture import and preview run through background Rust file operations. Repeated hydration reuses the decoded image rather than restarting it.
- Large images fit both the page's writing width and height. Continuous Web view fits the document width. Layout work yields to input and painting while images settle.
- Click a picture to expose corner handles, **Image…**, and **Fit to page**. Drag a handle to resize proportionally, or use explicit width/height fields, an aspect-ratio checkbox, and inline/left/center/right placement.
- Resizing and placement support Undo/Redo and persist in Markdown as inline HTML. Relative attachment paths remain relative when saved and are embedded when exporting styled HTML.

## Separate pages

Page view uses fixed physical sheets and visible gaps, with one outer document scrollbar. Letter is 8.5 × 11 inches with 1-inch default margins. Long paragraphs, tables, lists, footnotes and diagrams flow across sheets. A4, Legal, landscape and custom margins retain their selected sizes through Page/Web and Write/Split/Source changes. Screen-only pagination does not add page markup to saved documents.

## Download and update

Run **Editor-MD-0.2.0-beta.1-windows-x64.exe**, or extract the portable ZIP. Close the older app first and keep the new executable beside its existing **EditorMD-data** folder to retain workspace, settings, templates and custom fonts. Windows 10/11 x64 and the shared Microsoft Edge WebView2 Runtime are required. The app is portable and unsigned; no Node.js or local server is needed.

The ZIP includes **samples/Pagination-stress-test.md**, with 28,156 words and mixed formatting for manual testing.

## Validation

The final executable passes **128 native integration checks**, alongside **37 JavaScript tests** and **15 Rust tests**. These exercise over 24,000 words across 67 exact Letter sheets, measure 1,762 text-line rectangles, import a real 4096 × 3072 PNG, resize/reposition it, check Undo/Redo, and verify native fonts, wiki-link navigation, independent zoom and sidebar controls. Existing footnote, graph, tab, disk-save and filesystem-watcher checks remain included. Physical dragging of both sidebar dividers and an image corner is also checked in the shared interface.

## Beta limits

Print/PDF uses the system print interface and may choose different line/table breaks from screen pages. Advanced Writer pagination, backlinks, link autocomplete, automatic attachment rebasing and the MCP server remain planned. Image sizing and rich typography use inline HTML; readers may strip styles. Imported font files travel with app data and are not embedded in Markdown. See the README for the full usage guide and current boundaries.

## AI-assistance disclosure

Developed with assistance from **OpenAI Codex**, including interface design, Rust/frontend implementation, documentation, artwork tooling and testing. Human review and feedback remain important. OpenAI does not sponsor or endorse this project.
