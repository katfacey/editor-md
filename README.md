<h1><img src="assets/editor-md-icon.png" alt="" width="48" height="48"> Editor, MD</h1>

**A healthy place for your words.** A Windows Markdown editor with an office-style ribbon, a page canvas, a source editor, and an optional doctor mascot. MD means both *Markdown* and *doctor*.

**0.1.2 Beta 2** adds document footnotes, opening Explorer files as tabs, flexible document zoom, interface scaling, and editable initials. The application host and file services are written in **Rust with Tauri 2**; the shared interface uses HTML, CSS, and JavaScript. Its interface, fonts, mascot, icon, and Mermaid renderer are embedded in the executable. No Node.js, browser tab, local web server, account, or subscription is needed to use the desktop app.

![Light and dark design reference](design/light-dark-comparison.png)

## Download and run

Download the Windows x64 executable or portable ZIP from [Releases](https://github.com/katfacey/editor-md/releases). The ZIP also includes this guide, release notes, dependency notices, and checksums.

1. Put the executable in a writable folder and run it. There is no installer.
2. Editor, MD creates an **EditorMD-data** folder beside the executable for settings, templates, its WebView profile, and recovery buffers. Keep that folder with the executable when moving the app.
3. Your Markdown files stay wherever you choose to save them. A recovery buffer is separate from a saved file.

**Requirements:** Windows 10/11 x64 and the Microsoft Edge **WebView2 Runtime**. WebView2 is a shared runtime, so this is a portable application rather than an executable containing its own browser engine. If it is missing, install it from [Microsoft's official WebView2 download page](https://developer.microsoft.com/en-us/microsoft-edge/webview2/). The beta executable is unsigned.

If its folder is read-only, workspace data falls back to the user's local application-data directory. File → Local storage shows the actual data location.

## Brief usage guide

| Task | How |
| --- | --- |
| Create a document | Click **+**, or press **Ctrl+N** |
| Open Markdown | **File → Open…**, or **Ctrl+O**; Explorer files opened with this executable join the existing window as tabs |
| Save to disk | **File → Save now**, or **Ctrl+S**; a new draft opens a native Save dialog |
| Save another file | **File → Save as…**, or **Ctrl+Shift+S** |
| Close a tab | Its **×**, or **Ctrl+W**; unsaved work offers Save / Don't save / Cancel |
| Edit Markdown directly | **Source** or **Split** above the document; **Write** returns to the formatted editor |
| Change the canvas | **Page / Web** above the document; **Layout → Page setup** changes paper size and margins |
| Change appearance | Palette button: light/dark colors, **Show mascot**, opacity, and **Restore defaults** |
| Scale the interface | **Appearance → UI zoom** (50–200%); shared by light and dark mode |
| Zoom the document | Bottom-right slider and buttons (25–200%); double-click the percentage for any positive custom zoom, including above 200% |
| Set your initials | Click the initials circle at the top right, or use **Appearance → Your initials** |
| Add a footnote | Place the cursor or select text, open **Review → Footnotes**, write your note, optionally check **Append my initials**, then **Add footnote** |
| Create graphs | **Insert → Graph studio**; edit chart data, flowchart nodes/connections, or Mermaid source |
| Reuse a document | **File → Save as template**, then expand **Templates** |
| Find recent work | Expand **Archive**; it lists recently created, edited, and opened documents |
| Export or print | **Export** for a Markdown copy, styled HTML, or Print / PDF; select **Microsoft Print to PDF** in the system print interface |

The **File → Autosave file** switch controls automatic disk writes for documents with a saved path. New drafts are recovered locally until you explicitly choose a filename. Turning autosave off keeps edits in the buffer and recovery workspace; Ctrl+S still saves. Closing the application prompts for unsaved work. Discarding restores the saved snapshot or removes a never-saved draft.

Default page setup is **US Letter, 8.5 × 11 inches, with 1-inch margins**. Page/Web switching preserves page setup. Custom page settings are stored in an unobtrusive leading Markdown comment beginning with **editor-md-page**; ordinary readers hide it.

Footnotes replace the old temporary comments panel. Each document owns its notes, saved as Markdown references such as `[^1]` and definitions such as `[^1]: A note. -KF`. Numbers follow the order of references: inserting between 3 and 4 creates a new 4 and shifts the old 4 to 5; deleting a note closes the gap. The panel supports editing, deletion, and jumping to references. The optional initials signature uses your current profile initials; existing signatures remain unchanged when you edit your profile. Notes also appear at the end of the formatted document and in HTML/PDF output. Other readers need the [Markdown footnote extension](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#footnotes) to render this syntax.

When updating, close the old app and place the new executable beside its existing **EditorMD-data** folder to retain your workspace. If Explorer still launches the old version, use **Open with** to select the new executable. The app does not change Windows file associations automatically. Interface zoom and document zoom are independent and do not alter PDF page size.

The default light theme uses warm paper and green accents. Dark mode uses navy and orange. Mascot visibility and opacity are shared by both modes, defaulting to **shown at 20%**. The image fits the entire application and sits behind opaque document surfaces. It is excluded from document exports.

## Project goals

- Combine familiar Writer-style tools with portable Markdown and an accessible source view.
- Keep documents local, support safe saves and recovery, and work offline.
- Provide useful typography, templates, page setup, diagrams, and PDF output without hiding the Markdown.
- Grow toward styles, better tables, long-document navigation, true pagination, and reliable rich-text/source round trips.
- Add a local agent interface with revision-checked operations. The [Rust/MCP interface design](design/AGENT-INTERFACE.md) and [tool schemas](design/agent-tools.json) are prepared; **an MCP server is not implemented or running in this beta**.

The [feature roadmap](design/FEATURES.md) distinguishes the broader intended Writer feature set from implemented features.

## Beta boundaries

- This is an early beta, not a complete replacement for LibreOffice Writer. Advanced review, citations, Git integration, styles, and editable multipage pagination are unfinished. Footnotes print as an end-of-document list, rather than being placed automatically at the bottom of each printed page.
- Markdown opens with a GFM parser. Source text is retained verbatim through view changes and saves until it is edited. Editing the formatted **Write** view serializes the document back to Markdown and may normalize spacing or lose unsupported extensions. Use **Source** for syntax-sensitive documents.
- Font color, point size, subscript/superscript, highlighting, and some paragraph formatting use inline HTML. Readers that strip HTML styles, including GitHub, may display them differently.
- Mermaid source is portable to compatible readers; graph zoom and inspection are application features. PDF graphs are static.
- Images pasted/inserted through the editor are embedded. Local relative-image resolution and richer image management are not implemented; network images require a connection.
- PDF output uses the system print interface. The screen canvas is a fixed-size paper preview with scrolling, rather than true editable multipage pagination.
- UTF-8 documents up to 20 MiB are supported. A changed-on-disk revision blocks an ordinary save, preserving the open buffer; reopen the file or use **Save as** to keep both versions. The revision check occurs at save time rather than through a live filesystem watcher.
- Documents and recovery data are stored unencrypted on the local device. The app has no telemetry or cloud sync; remotely linked images may make network requests.

## Development

Install Node.js 22+, stable Rust for **x86_64-pc-windows-msvc**, the Microsoft C++ Build Tools with a Windows SDK, and WebView2.

    npm ci
    npm run check
    npm test
    npm run build:ui
    cargo test --manifest-path src-tauri/Cargo.toml --locked
    cargo build --manifest-path src-tauri/Cargo.toml --release --locked

The executable is **src-tauri/target/release/editor-md.exe**. **scripts/build-windows.ps1** performs the offline-asset build and Rust release build. **scripts/package-release.ps1** creates the portable artifacts after validation.

The built executable supports **--self-test** for a non-GUI file-service check and **--smoke-test** for an isolated, hidden native-WebView integration test. The latter writes a report in **EditorMD-smoke** beside the executable, opens a test file, renders Markdown/Mermaid, checks native saving and unsaved-tab behavior, and exits automatically.

Running **npm start** retains the [browser design preview](design/PROTOTYPE.md) at **http://127.0.0.1:4173**; the desktop app runs independently of that server.

## AI assistance and ownership

**This project was developed with assistance from OpenAI Codex.** AI assisted with interface design, Rust and frontend code, artwork tooling, documentation, and testing. AI assistance does not imply that the application is error-free or independently audited; human review and beta feedback remain important. OpenAI does not sponsor or endorse this project.

The project is maintained by Kat Facey. No open-source license has been selected for the project's own code/artwork; third-party components retain their respective licenses. See the distributed **THIRD_PARTY_NOTICES.txt** and bundled font licenses.
