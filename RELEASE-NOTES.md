# Editor, MD — 0.2.8 Beta 7

Changes since the previous GitHub release, **0.2.6 Beta 3**:

- Added a document outline with collapsible headings, live section tracking, and link checking.
- Added Find and Replace, a command palette, local version comparisons, reopen closed tab, and richer paste options.
- Added Word-style table insertion: a size grid from Home → Table and hover guides for adding rows and columns. Row hover is easier to catch, added rows keep a usable height, and the guides use theme colors.
- Streamlined ribbon collapse and Focus. The collapsed ribbon keeps the full title bar and a separate document-tab row; the top controls stay in place. Focus is beside the ribbon chevron.
- Removed the unwanted orange page focus outline. Page sheets and Web view can now show the mascot through a blurred, translucent background, adjustable from 0–100% under Appearance → Background. Printing and PDF export remain opaque.
- Fixed active-tab styling so the accent stays visible around angular corners and across tab shapes when hovered. The mascot opacity control is clearly labeled. Optional text shadow and backing help keep writing readable on transparent pages.
- Ctrl+wheel zooms the document when the pointer is over the page and zooms the interface when the pointer is over the surrounding UI.

## Earlier local candidate: 0.2.8 Beta 6

- Page sheets and Web view use a lightly translucent, blurred background so the mascot can show through. Appearance → Background has a shared Page opacity slider (20–100%, default 80%). Printing and PDF export retain solid pages.

## Earlier local candidate: 0.2.8 Beta 5

- The table insert plus now swaps the current theme's accent and main colors on hover or keyboard focus.
- Focus now sits beside the ribbon chevron in the top bar, in both expanded and collapsed layouts.

## Earlier local candidate: 0.2.8 Beta 4

- Row separators have a larger hover area and take priority where row and column guides cross. Empty inserted rows keep the table's normal row height.
- Table insertion guides and plus buttons now use the selected theme accent. The ribbon chevron stays in the same position when the ribbon expands or collapses; the collapsed header keeps the full logo and puts document tabs on their own row beneath it.

## Earlier local candidate: 0.2.8 Beta 3

- Table row and column separators highlight on hover with a circular **+**. Clicking a row separator inserts beneath it; clicking a column separator inserts to its left. The former floating row/column toolbar has been removed.
- Home → Table now opens an 8 × 10 grid picker, with a live size preview and keyboard-focusable cells. The chosen grid size determines the inserted table.

## Earlier local candidate: 0.2.8 Beta 2

- Clicking the document no longer draws an orange focus rectangle around Page or Web layout.
- Selecting a table cell shows **+ Row** and **+ Column** quick actions. The full table editor remains available for insertion, deletion and alignment.
- The ribbon chevron now represents the compact view with both sidebars visible. Focus uses the same compact header and hides both sidebars; exiting Focus brings both sidebars back. The right dock is hidden even when it previously set its own display style.

## Earlier local candidate: 0.2.8 Beta 1

- The Outline sidebar now shows heading hierarchy, collapses branches, and marks the current section while scrolling.
- Ctrl+Shift+P opens a searchable command palette for common file, editing, view, and review actions.
- Write/Split paste accepts rich text and spreadsheet cells; pasting a URL over selected text creates a link. The palette also offers Copy as Markdown and Paste as plain text.
- Review → Check links reports missing headings and checks relative file and wiki-note destinations when a project folder is open. It does not contact web links.
- Version history now shows added and removed Markdown lines before restoring a version.
- Ctrl+Shift+T or File → Reopen tab reopens the most recently closed saved document. Tab view positions are remembered between open documents and sessions.

## Earlier local candidate: 0.2.7 Beta 1

- Find/Replace searches the active document’s Markdown with case and whole-word controls. Replace Next and Replace All change only matched source text, leaving all other Markdown bytes intact. Ctrl+H opens it.
- Table editing adds or removes rows and columns and sets GFM column alignment. Tab and Shift+Tab move between cells, and Tab from the final cell extends the table.
- Tab and Shift+Tab indent or outdent list items in Write view.
- Local version history retains up to 20 saved/source versions per document. A restore remains unsaved until explicitly saved, including when autosave is on. Exact Markdown is recorded before Write view needs to reserialize it.
- Print styling reduces split rows and orphaned headings, repeats table headers where the print engine supports it, and preserves the document’s configured paper size and margins.
- A keyboard skip link moves directly to the editor; document focus indicators and labels are clearer.

**Still to refine:** Visual edits can normalize Markdown outside the edited span; history protects the original but does not yet provide a fully lossless block-level round trip. Browser print pagination can differ from screen sheets. More keyboard and screen-reader auditing is needed.

## Previous GitHub release: 0.2.6 Beta 3

This release builds on the last GitHub release, **0.2.0 Beta 1**. It brings the Markdown writing tools, document styling, workspace controls and Print/PDF flow developed through the local 0.2.1–0.2.6 builds into one portable Windows beta.

## Major changes since 0.2.0

- **Print and PDF work from the editor.** File → Print / PDF and Ctrl+P open the system print flow using a clean document snapshot. Printing preserves the editing mode and document zoom.
- **Write view understands Markdown as you type.** Completed emphasis, strikethrough, code, ordinary links and `[[note]]` links render in place. A compact toolbar appears when text is selected, with bold, italic, underline, strike, code, link, highlight, footnote and additional text-format controls. The Link dialog accepts web addresses, note links, relative Markdown files and headings.
- **The ribbon and workspace are easier to navigate.** A chevron collapses the ribbon into a compact header. The MD logo opens File, Home, Insert, Layout, References, Review, View and Help categories. Home groups the existing editing controls into a shorter panel. Document tabs gain a right-click menu for saving and closing one or many tabs, while sidebar tabs can be reordered and moved between sides.
- **Document styles are customizable.** Classic, Studio and Manuscript presets style body text, headings, code, quotes and links in Write view and styled HTML/PDF. Custom presets can be saved and edited. Styles are app preferences; they do not add theme metadata to Markdown files. Appearance settings now have separate categories for colors, interface, background, tabs, document styles and workspace.

## Smaller improvements and fixes since 0.2.0

- The default dark palette uses navy **#0b121e** and orange **#df873a**, with a collapsed ribbon and **MD** initials. Classic dark H1 uses the full accent orange, H2 a muted orange, and H3–H6 a softer orange. Light mode follows the same progression with navy tones. Existing customized palettes and explicit preferences remain saved.
- The workspace header shows the current folder name in bold and its path below, with refresh and close controls. After closing a project folder, local Documents and Writing groups can collapse independently; their states persist.
- Document tabs offer Square, Curved, Angular and Pill shapes and an option to bold the active name. Save all and bulk-close operations respect cancellation and unsaved work.
- The Markdown guide opens from View, Help or F1. Code block is available from Home → Paragraph. The text-selection toolbar has a clearer outline, and Save/Export now have distinct icons.
- Links in Write retain formatting within their labels, including bold, italic, strike, code, nested emphasis, underline, subscript, superscript and highlighting. Hover hints explain double-click navigation. Same-document `#heading` links no longer navigate on the first click; double-click or Ctrl+click jumps to the heading. The numbered, bold Fireworks Festival example and its overescaped form are covered by regression checks.
- Opening the MD command menu from an expanded ribbon keeps the document steady. The compact header retains Appearance, theme and initials controls.

## Download and update

Run **Editor-MD-0.2.6-beta.3-windows-x64.exe**, or extract the portable ZIP. Close older Editor, MD windows first. Keep the new executable beside your existing **EditorMD-data** folder to retain settings, templates, custom fonts and recovery buffers. If Explorer still associates `.md` files with an older build, choose the new executable explicitly.

Windows 10/11 x64 and the shared Microsoft Edge WebView2 Runtime are required. The app is portable and unsigned; no installer, Node.js or local web server is needed.

## Verification and beta limits

The final executable passed **312 native WebView integration checks** and **58 JavaScript tests**. The Rust code is unchanged since its **16 passing Rust tests** in the preceding local beta. Checks include the numbered bold heading link, ordinary and overescaped source, full editing and formatting paths, print, file conflict protection, custom fonts, images, tabs, sidebars, document styles, and a **24,207-word** document across **74** separate Letter sheets.

Print/PDF can choose different line and table breaks from screen pages. Advanced Writer pagination, per-page footnotes, backlinks, link autocomplete, automatic attachment rebasing and the MCP server remain planned. Image sizing and rich typography use inline HTML, which some Markdown readers may strip. Imported fonts travel with the app's data folder and are not embedded in Markdown. See the README for usage and current boundaries.

## AI-assistance disclosure

Developed with assistance from **OpenAI Codex**, including interface design, Rust and frontend implementation, documentation, artwork tooling and testing. Human review and feedback remain important. OpenAI does not sponsor or endorse this project.
