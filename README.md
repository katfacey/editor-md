# Editor, MD

**A healthy place for your words.**

A visual and interactive design reference for a future Markdown editor written in Rust. The name plays on MD as both Markdown and doctor. The identity uses a small cross and a calm green palette.

![Light and dark desktop interface](design/light-dark-comparison.png)

## Preview

Run `npm ci` once, then `npm start` and open **http://127.0.0.1:4173** for the light/dark comparison. Use **Explore light** or **Explore dark** to try the full-size editor.

Mermaid is installed locally so diagram rendering works offline after installation. Google Fonts is optional; system font fallbacks work offline. This preview uses a local server; the final product will be a standalone Windows `.exe` written in Rust, with assets bundled into the application and native file access.

## Try it

- Edit the document directly, or switch between Write, Split, and Source views.
- Explore the Home, Insert, Layout, References, Review, and View ribbons.
- Apply headings, emphasis, lists, quotes, tables, links, and code blocks.
- Navigate files, create a document, or search document names and content with Ctrl+K.
- Inspect document statistics, jump to headings, and add or resolve preview comments.
- Switch color themes, enter focus mode, and adjust document zoom.
- Customize main and accent colors independently for light and dark mode with the palette button. Light retains the original warm paper/green palette; dark defaults to navy blue/orange.
- Increase/decrease exact font sizes in points and apply font colors to selected text.
- Choose paper size/orientation and individual margins from Layout → Page setup.
- Create or edit bar charts, line charts, pie charts, flowcharts, and custom Mermaid in Insert → Graph studio. Use live preview, data forms, source editing, and zoom; inserted graphs can be reopened with Edit graph.
- Save changes in browser storage with Ctrl+S; export a `.md` copy from Export.

## Scope

This is a **design prototype**, not the Rust application. Its lightweight Markdown conversion supports common structures but does not implement the full CommonMark/GFM specification. Font color and point size export using inline HTML, which some Markdown readers strip (including GitHub styling). Mermaid exports as fenced code blocks; readers need Mermaid support. In-app graph zoom and node selection are editor features, not a promise of portable Markdown interactivity. Arbitrary diagram scripts and callbacks are disabled.

Export offers Markdown, styled HTML with static graph artwork, and PDF through the browser's print interface. Print styling hides application controls and applies document margins independently of screen theme. PDF graphs are static. Some office formatting remains preview-only or HTML/PDF-only. Comments are session-only; templates and archives remain planned features.

See [the design reference](design/DESIGN.md) for layout, colors, behavior, and a proposed native-app feature map.
See [the Writer-inspired feature roadmap](design/FEATURES.md) for the broader office-editor scope and the Markdown/rich document boundary.

## Files

| File | Purpose |
| --- | --- |
| `compare.html` | Side-by-side light and dark presentation |
| `index.html` | Full-size interactive desktop shell |
| `styles.css` | Layout, responsive behavior, and theme tokens |
| `app.js` | Prototype editing and interface interactions |
| `office.js`, `office.css` | Appearance, font controls, page setup, and export presentation |
| `graphs.js` | Local Mermaid renderer, graph studio, and document graph interaction |
| `serve.cjs` | Dependency-free local preview server |
| `design/` | Comparison image and implementation reference |

The project has no chosen open-source license yet.

## Validation

`npm run check` checks JavaScript syntax. Browser validation covers theme defaults and customization, font size/color round-trips, page-margin presets/persistence, graph generation/editing/source export, invalid graph input, and the desktop comparison layout.
