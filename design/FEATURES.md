# Editor, MD — Office editor roadmap

## Product boundary

The final application is a standalone **Windows `.exe` written in Rust**, not a hosted website. It must launch directly, open/save real local files, work offline, integrate with Windows dialogs and shortcuts, and package its UI, fonts, diagram renderer, and printing resources. A local server and Node.js are development tools for this visual prototype only.

Take inspiration from LibreOffice/OpenOffice Writer's depth and discoverability, rather than duplicating every control at once. A command should have a discoverable menu entry, appropriate shortcut, relevant toolbar/ribbon affordance, and help text. Native windows should support resizing, keyboard navigation, and dockable panels.

## Two layers of document information

Markdown remains the portable text layer. Rich presentation includes font family/size/color, alignment, margins, page size, headers/footers, and print styles. Avoid silently claiming that plain Markdown represents these features.

- CommonMark/GFM text: headings, emphasis, links, lists, tables, task lists, fenced code, images.
- Mermaid extension: editable text inside a fenced `mermaid` block, rendered by compatible readers such as GitHub.
- Optional inline HTML: font color and other styling for readers that allow it; GitHub strips inline styles. The prototype preserves selected text color and point size this way.
- Layout metadata: retain page settings in the editor's document metadata. Decide between an explicit companion settings file or a richer project format during native design; never discard formatting without an export warning that names the affected features.
- PDF: preserve typography, colors, spacing, margins, page breaks, and static diagram artwork. Light/dark interface preferences should not recolor document output.
- Interactive graphs: zoom, inspect, pan, legend toggles, or editor controls belong to the reader/app. PDF is static; arbitrary interactive charts are not part of baseline Markdown. Offer HTML export with intentional interactive behavior as a separately specified future output mode.

## Writer-inspired capabilities

| Area | Intended product capabilities | Current design status |
| --- | --- | --- |
| Character formatting | Font family, exact point size, increase/decrease, color, highlight, emphasis, sub/superscript, clear direct formatting | Basic controls and color/point-size prototype; broader character dialog planned |
| Paragraph formatting | Left/center/right/justify, indent, tabs, line/paragraph spacing, lists, numbering, borders, keep-with-next | Core ribbon illustration; paragraph dialog planned |
| Styles | Paragraph, character, list, and page styles; create/update styles; direct-formatting indicators | Heading examples; style manager planned |
| Page design | Paper size, orientation, individual margins, gutter, mirrored pages, sections, columns | Size/orientation/margin dialog works in prototype; advanced layouts planned |
| Long documents | Outline navigator, bookmarks, TOC, cross-references, foot/endnotes, citations, indexes | Basic outline/navigation; reliable reference model planned |
| Headers and pagination | Header/footer sections, automatic page numbers, first-page differences, page/section breaks | Visual sample footer; true pagination planned |
| Tables | Insert/edit rows/columns, merge/split, widths, alignment, borders, repeated headers | Insert example; table editing panel planned |
| Images and objects | Local images, captions, crop/resize, anchoring, wrapping, equations, symbols | Image insertion preview; richer object tools planned |
| Charts and diagrams | Data-driven charts, flowcharts, Mermaid source, graph manager, re-editing, accessible descriptions | Working local Mermaid studio with data/source forms, zoom, and node inspection |
| Review | Spell/grammar checks, dictionary, autocorrect, tracked changes, anchored comments, compare documents | Browser spellcheck, session comments; review engine planned |
| Search | Find/replace, regular expressions, document/workspace scope, navigation through matches | Basic document search; replace and advanced search planned |
| Files and recovery | Open/save/save-as, recent files, autosave, crash recovery, external-change detection, encodings | Browser storage/export; native file services planned |
| Output | Markdown, styled HTML, print/PDF, accessibility tags, bookmarks, metadata, font embedding | Prototype Markdown/static HTML and print styles; native PDF engine planned |
| Workspace | Templates, archive, settings, document tabs, custom panels, command palette | Partial visual shell; template/archive functionality planned |
| Git | Repository configuration, status, diff, commit, history, pull/push, conflict resolution | Source repository only; app integration planned |
| Appearance and access | Independent light/dark main and accent colors, readable contrast, scalable controls, keyboard/screen reader support | Per-mode appearance customization; native accessibility audit planned |

## Immediate visual decisions

- Light default stays warm paper with green accents.
- Dark default uses navy main surfaces and orange highlights.
- Main and accent colors are independent settings per mode. Provide a reset for each mode.
- Place A− / point-size field / A+ beside the font family selector.
- Use mirrored ragged-line symbols for left/right alignment.
- Keep font color separate from highlighting and interface accent colors.
- Page setup includes margin presets and four explicit measurements with a layout preview.
- Graph studio is a resizable-window concept, with object properties, an editable data form, live preview, source editor, validation, and insert/update actions. The HTML prototype represents it as a modal; the native app may use a real floating window or dockable editor.

## References

- [LibreOffice Writer features](https://help.libreoffice.org/latest/en-US/text/swriter/main0503.html): styles, navigator, document structure, publishing tools, objects, and configurable interface.
- [LibreOffice page properties](https://help.libreoffice.org/latest/en-US/text/shared/01/05040200.html): page sizes, orientation, margins, gutter, and mirrored layouts.
- [GitHub diagram documentation](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams): fenced Mermaid diagrams and reader support.
- [Mermaid flowchart interaction](https://mermaid.js.org/syntax/flowchart.html#interaction): node interaction depends on renderer configuration. The prototype uses strict rendering and supplies its own local inspection controls.
- [CommonMark specification](https://spec.commonmark.org/0.31.2/): Markdown syntax and raw HTML handling.
