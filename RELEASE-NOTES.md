# Editor, MD — 0.1.3 Beta 3

Third portable Windows x64 beta, built with Rust and Tauri 2. Adds optional project folders and dependable access to related files while retaining individual-document editing.

- **Project folders.** Use **File → Open project**, or the folder control above the sidebar. Browse actual nested folders, Markdown files, images, and attachments. The last project reopens on startup; closing it leaves document tabs open.
- **Project-wide search.** Use **Search** in the sidebar or **Ctrl+Shift+F**. Search filenames and Markdown text, including unopened files and unsaved edits. Results open Source with the matching text selected; Unicode offsets and optional case matching are supported.
- **Relative images and attachments.** Local PNG, JPEG, GIF, and WebP references render inline while their original relative URLs remain in Markdown. **Insert → Image** and **Insert → Attachment** link existing project files or copy outside files into an attachments folder, using unique names without overwriting attachments.
- **Open related files.** Ctrl+click a relative Markdown link to open its document tab, or an attachment link to open a supported file in its Windows default application. Attachments can also be opened from the project tree.
- **Portable image output.** HTML export embeds relative raster images. Print/PDF waits for image loading and offers a choice when an image is unavailable.
- **Live external-change detection.** Native filesystem monitoring refreshes the project tree and reloads clean documents. Unsaved edits stay intact, automatic saves pause for conflicts, and **Review** shows both versions with explicit reload and Save as choices.
- **Deleted-file protection.** Files moved or deleted outside the app keep their open text and require saving before close. The existing revision check continues to guard disk saves before watcher notifications arrive.
- Includes Beta 2's saved footnotes with ordered numbering and optional initials, single-window file opening, custom document zoom, UI scaling, and editable profile initials.

## Quick start

1. Open a project folder and expand its folders in Files.
2. Use **Ctrl+Shift+F** to search across its Markdown documents.
3. Save a document before importing images or attachments; Ctrl+click its relative links to follow them.
4. If another app changes a document with pending edits, use **Review** to compare the versions, reload explicitly, or save a separate copy.

The ZIP includes the detailed project guide at **design/PROJECTS.md**, the README, release notes, license notices, and checksums.

## Download and update

Use the standalone **.exe**, or extract the portable ZIP with the guide and dependency notices. Close any older Editor, MD version first. Keep the new executable beside your existing **EditorMD-data** folder to retain settings, templates, recovery buffers, and workspace. Explorer may need **Open with** to point to the new executable; Windows file associations are not changed automatically.

Windows 10/11 x64 and Microsoft Edge **WebView2 Runtime** are required. This unsigned portable beta uses the shared system WebView2 runtime; it does not bundle a browser engine or installer. No Node.js or local server is needed to run it.

## Known limits

Project scanning is limited to 10,000 entries and 32 folder levels. Dot-prefixed entries, dependency/build folders, app data, and symlinks/reparse points are excluded. Search is literal, with 200 results overall, 20 text matches per file, and a 128 MiB content budget; the interface reports limits and skipped files.

Attachment import and inline image preview support files up to 32 MiB. Relative references must remain inside the project, or the containing folder for individually opened files. Save as does not automatically rebase relative paths when moving a document to another folder. Integrated PDF viewing, document embeds, automatic merging, rename tracking, backlinks, properties, persistent history, advanced Writer features, Git integration, and the proposed MCP server remain planned.

Formatted editing may normalize Markdown or discard unsupported extensions; use Source for exact syntax. Footnotes require compatible readers and print as an end-of-document list. PDF uses the system print interface and graphs are static. See the README for the full beta boundaries.

## Validation

29 JavaScript tests and 12 Rust tests cover document/save state, footnotes, charts, project scanning/search, Unicode positions, path boundaries, and attachment imports. The optimized Windows executable also passes 51 isolated native integration checks, including real filesystem watcher events and deleted-file close protection.

## AI-assistance disclosure

Developed with assistance from **OpenAI Codex**, including interface design, Rust/frontend implementation, documentation, artwork tooling, and testing. Human review and feedback remain important. OpenAI does not sponsor or endorse this project.
