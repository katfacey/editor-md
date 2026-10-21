# Editor, MD — 0.1.3.1 Beta Hotfix

Portable Windows x64 hotfix for Beta 3. This release fixes document scrolling and paper layout while retaining the project-folder, attachment, search, and file-monitoring features from 0.1.3.

## Fixed

- Removed the scrollbar inside the document paper. The outer canvas now scrolls the complete document in Page and Web layouts.
- Paper uses the selected width, margins, and minimum height. Long documents grow naturally instead of being trapped inside a fixed-height page.
- Letter is 8.5 × 11 inches with 1-inch default margins. Letter, A4, Legal, landscape, and custom margins visibly affect the page; Page → Web → Page preserves the selected setup.
- Source and Split editors grow and shrink with their text, sharing the outer document scrollbar. Document zoom and UI scaling continue to work independently.

The screen canvas is continuous paper, rather than an editable multipage pagination system. Print/PDF continues to use the selected physical paper size and margins.

## Download and update

Download **Editor-MD-0.1.3.1-beta-hotfix-windows-x64.exe**, or extract the portable ZIP for the application, guides, dependency notices, and checksums.

Close the older version first. Place the new executable beside your existing **EditorMD-data** folder to retain settings, templates, recovery buffers, and workspace. Explorer may need **Open with** to select the new executable; the app does not change Windows file associations automatically.

Windows 10/11 x64 and Microsoft Edge **WebView2 Runtime** are required. This unsigned portable beta uses the shared system runtime. No Node.js or local server is needed to run it.

## Usage

Use **Page / Web** above the document to switch layouts. Open **Layout → Page setup** to select paper size, orientation, and margins. Use the outer scrollbar to reach the rest of a long document in Write, Split, or Source.

Beta 3's **File → Open project**, Files tree, **Ctrl+Shift+F** project search, relative images and attachments, and external-file change review are included. See the README and **design/PROJECTS.md** in the ZIP for the full guide and beta limitations.

## Validation

29 JavaScript tests, 12 Rust tests, and all 69 native integration checks pass. The optimized executable is checked in the actual Windows WebView, including paper measurements, margins, all layout/editor modes, long-document scrolling, source resizing, zoom, native saves, footnotes, project search, and filesystem watcher events.

The displayed release version is **0.1.3.1**; Cargo, Tauri, and npm use the SemVer-compatible internal version **0.1.3-hotfix.1**.

## AI-assistance disclosure

Developed with assistance from **OpenAI Codex**, including interface design, Rust/frontend implementation, documentation, artwork tooling, and testing. Human review and feedback remain important. OpenAI does not sponsor or endorse this project.
