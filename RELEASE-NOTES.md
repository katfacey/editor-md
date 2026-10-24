# Editor, MD — 0.2.6 Beta 3

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
