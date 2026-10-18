# Editor, MD — Design reference 01

## Direction

A familiar office editor that gives plain-text writing the comfort of a document workspace. The interface balances dense, discoverable commands with an uncluttered page. The medical reference lives in the name, cross monogram, and quiet green accent; avoid using medical language for ordinary editing actions.

## Desktop composition

At 1440 px, use a 54 px application header, 44 px ribbon navigation, 100 px ribbon, and 31 px bottom status bar. The left file navigator is 222 px and the document inspector is 245 px. The canvas takes the remaining width, with a centered page of up to 690 px and 64 px horizontal page padding. Document tabs sit above the canvas. A narrow ruler anchors the page visually.

The left pane contains the local workspace, Files / Outline / Bookmarks, folder tree, and local-storage status. The right pane contains Details / Comments, document metrics, metadata, tags, outline, and a quiet structural-status message. Native implementations should calculate any document-health indicator from actual diagnostics rather than always showing success.

## Theme tokens

| Role | Light | Dark |
| --- | --- | --- |
| Application workspace | `#eeefec` | `#111e33` |
| Controls and sidebars | `#fafbf8` | Derived darker navy |
| Writing page | `#fffefa` | Derived lighter navy |
| Main text | `#28332f` | `#e6edf7` |
| Secondary text | `#7b837c` | `#a2b1c6` |
| Borders | `#dfe3dc` | Derived from navy |
| Accent | `#35644d` | `#f0a15a` |
| Selected surface | `#e6ede3` | Navy/orange blend |

Use DM Sans for interface controls, Libre Baskerville for editorial titles, and a monospace face for source. Bundle licensed fonts with the native app or use system fallbacks. Each theme has customizable main and accent colors. Green is the light default accent; orange is the dark default accent. Yellow highlighting associates passage annotations with comments. Add focus indicators and labels independently of color.

## Interaction model

The default Home ribbon exposes clipboard, text formatting, paragraph structure, styles, and common inserts. Other ribbon tabs group discoverable commands by task. Maintain selection when executing formatting commands. In the native app, keep ribbon state synchronized with the selection and support one undo history across editing modes.

Write is a document-focused editing view. Source exposes Markdown. Split shows source beside rendered content. The final app should preserve Markdown as the source of truth, synchronize cursor positions and scrolling, and avoid lossy conversions between independent HTML and text models.

Local files and user control are central. Show actual save state and actionable failures. Distinguish saving, exporting, and Git synchronization. Keep Git commands separate from ordinary document saving, and explain authentication or merge conflicts when they occur.

The comparison view intentionally scales two 1440 × 1040 desktop shells together so the layouts are identical. Use the full-size editor for readability and interaction. At narrower full-size widths, hide the inspector first, then the file navigator, and retain essential editing commands.

## Feature map for the Rust application

| Area | Target capability | Prototype representation |
| --- | --- | --- |
| Documents | Open/save/save-as, file watching, recovery, recent files | Browser storage, sample files, new document, Markdown download |
| Editing | Markdown model, selection, undo/redo, shortcuts, GFM | Contenteditable + small Markdown converter |
| Office tools | Styles, lists, tables, links, images, page layout | Ribbon commands and illustrative layout controls |
| Navigation | Folder tree, document tabs, search, outline, bookmarks | Sample tree, tabs, document search, heading navigation |
| Review | Anchored comments, diagnostics, spelling, word count | Session comments, browser spelling, live basic statistics |
| Output | Markdown, HTML, accessible PDF, print layouts | Markdown download and browser print |
| Accessibility | Full keyboard navigation, semantic controls, scalable UI, screen-reader support | Labeled controls and native browser focus behavior |
| Workspace | Templates, archive, workspace configuration | Planned placeholders |
| Git | Repository settings, status, diff, commit, push/pull | Future implementation; no simulated sync controls |

## Implementation boundaries

No Rust framework or library has been selected. The deliverable must be a standalone Windows `.exe`, working offline with native local file access. Keep the eventual document model, filesystem services, diagnostics, and Git integration independent from the UI toolkit. This repository currently supplies the visual reference, not a working native backend. See [the feature roadmap](FEATURES.md) for Writer-inspired scope and format/export decisions.

Prototype comments, dates, author identity, tags, and document-health wording are sample content. The article is authored for this mock-up except the short attributed-by-context simplicity quotation; replace sample content before product release. Character and word counts are simple browser-text estimates.
