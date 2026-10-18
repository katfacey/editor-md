# Editor, MD

**A healthy place for your words.**

A visual and interactive design reference for a future Markdown editor written in Rust. The name plays on MD as both Markdown and doctor. The identity uses a small cross and a calm green palette.

![Light and dark desktop interface](design/light-dark-comparison.png)

## Preview

Run `node serve.cjs` and open **http://127.0.0.1:4173** for the light/dark comparison. Use **Explore light** or **Explore dark** to try the full-size editor. You can also open `compare.html` directly in a browser.

No package installation or build step is required. Google Fonts is optional; system font fallbacks work offline.

## Try it

- Edit the document directly, or switch between Write, Split, and Source views.
- Explore the Home, Insert, Layout, References, Review, and View ribbons.
- Apply headings, emphasis, lists, quotes, tables, links, and code blocks.
- Navigate files, create a document, or search document names and content with Ctrl+K.
- Inspect document statistics, jump to headings, and add or resolve preview comments.
- Switch color themes, enter focus mode, and adjust document zoom.
- Save changes in browser storage with Ctrl+S; export a `.md` copy from Export.

## Scope

This is a **design prototype**, not the Rust application. Its lightweight Markdown conversion supports common structures but does not preserve all formatting or support the full CommonMark/GFM specification. Office-style fonts, colors, alignment, underlining, and embedded images are illustrative; plain Markdown export does not retain them. Print/PDF currently uses the browser's normal print interface. Comments are session-only. Templates and archives are labeled as future features.

See [the design reference](design/DESIGN.md) for layout, colors, behavior, and a proposed native-app feature map.

## Files

| File | Purpose |
| --- | --- |
| `compare.html` | Side-by-side light and dark presentation |
| `index.html` | Full-size interactive desktop shell |
| `styles.css` | Layout, responsive behavior, and theme tokens |
| `app.js` | Prototype editing and interface interactions |
| `serve.cjs` | Dependency-free local preview server |
| `design/` | Comparison image and implementation reference |

The project has no chosen open-source license yet.
