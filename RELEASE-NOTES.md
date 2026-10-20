# Editor, MD — 0.1.2 Beta 2

Second portable Windows x64 beta, built with Rust and Tauri 2. Includes the locally tested 0.1.1 improvements and the new footnotes system.

- **Footnotes replace Comments.** Use the familiar document inspector to add, edit, delete, and navigate notes. They belong to the current document and are saved with its Markdown.
- **Automatic numbering follows document order.** Adding a note between 3 and 4 creates a new 4 and shifts the old 4 to 5. Deletion closes gaps, and repeated references share a number.
- **Optional initials.** Check **Append my initials** to add a signature such as ` -KF`, using your editable profile initials. Notes retain their existing signatures when your profile changes.
- **Portable footnote syntax.** References and definitions use `[^1]` and `[^1]: ...`; multiline note text and inline formatting are retained. Notes appear at the end of the document and in HTML/PDF output.
- **Explorer opens files as tabs.** Further launches of this executable forward files to its existing window, including multiple paths. Files received during startup or a dialog are queued; already-open documents keep pending edits.
- **Flexible document zoom.** The slider and buttons cover 25–200%. Double-click the percentage to enter a positive custom percentage, including above 200%. Keyboard users can focus it and press Enter or Space.
- **Shared UI zoom.** Appearance scales the entire interface from 50–200%, independently of document zoom and print layout.
- **Editable initials.** Click the profile circle or use Appearance; one to four characters are supported.

## Download and update

Use the standalone **.exe**, or extract the portable ZIP with the guide and dependency notices. Close any older Editor, MD version first. Keep the new executable beside your existing **EditorMD-data** folder to retain settings, templates, recovery buffers, and workspace. Explorer may need **Open with** to point to the new executable; Windows file associations are not changed automatically.

Windows 10/11 x64 and Microsoft Edge **WebView2 Runtime** are required. This unsigned portable beta uses the shared system WebView2 runtime; it does not bundle a browser engine or installer. No Node.js or local server is needed to run it.

## Known limits

Formatted editing may normalize Markdown or discard unsupported extensions; use Source for exact syntax. Other readers must support Markdown footnotes to render their syntax. Notes print at the end of the document, rather than being positioned at each page's bottom. Relative local images, advanced Writer features, editable pagination, Git integration, and the proposed MCP server remain planned. PDF uses the system print interface; PDF graphs are static. See the README for the full usage guide and beta boundaries.

## AI-assistance disclosure

Developed with assistance from **OpenAI Codex**, including interface design, Rust/frontend implementation, documentation, artwork tooling, and testing. Human review and feedback remain important. OpenAI does not sponsor or endorse this project.
