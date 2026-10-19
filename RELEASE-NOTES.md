# Editor, MD — 0.1.0 Beta 1

First portable Windows x64 desktop beta, built with Rust and Tauri 2.

- Native Open, Save, Save as, and export dialogs; real UTF-8 Markdown files.
- Atomic file replacement and a saved-revision check to protect external changes.
- Unsaved-tab and application-close prompts, per-file save isolation, autosave toggle, and local recovery.
- Approved office-style interface with Write / Split / Source and Page / Web layouts.
- Font controls, color/highlight, subscript/superscript, page size/orientation/margins, and system Print / PDF.
- Offline GFM parsing, Mermaid rendering, chart-data forms, and visual flowchart editing.
- Templates, recent-file Archive, independently customizable light/dark colors, optional app-wide mascot, and the MD project icon.
- Embedded fonts and UI assets; no Node.js or local server required.

## Files and requirements

Use the standalone **.exe**, or extract the portable ZIP with the documentation and dependency notices. Windows 10/11 x64 and Microsoft Edge WebView2 Runtime are required. This unsigned beta uses the system WebView2 runtime; it does not bundle a browser engine or installer. Settings and recovery are kept in **EditorMD-data** beside the executable when writable.

## Known limits

This is an early beta. Formatted editing may normalize Markdown or discard unsupported extensions; use Source for exact syntax. Relative local images, advanced Writer features, true editable pagination, Git integration, and the proposed MCP server remain planned. Comments are session-only. PDF output uses the system print interface, and PDF graphs are static. See the README for the feature boundary and brief usage guide.

## AI-assistance disclosure

Developed with assistance from **OpenAI Codex**, including interface design, Rust/frontend implementation, documentation, artwork tooling, and testing. Human review and feedback are still needed. OpenAI does not sponsor or endorse the project.
