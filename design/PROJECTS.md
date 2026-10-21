# Project folders — 0.1.3 Beta 3

Released in 0.1.3 Beta 3, 2026-10-21. This milestone covers project folders, relative attachments, project search, and external-file change detection.

## Open and browse

Use **File → Open project**, or **Open project folder** above the left sidebar. The Files tree shows actual nested folders, Markdown documents, images, and other attachments. Expand a folder to browse it; select a Markdown file to open its existing buffer or a new tab. Individual Markdown files can still be opened without a project. Closing the project leaves document tabs open.

The last project folder is remembered in the portable data folder and reopened on startup. No conversion or import of the project is required. A refresh button rescans the folder. Dot-prefixed entries, dependency/build folders, application data, and symlinks/reparse points are excluded. The current scan limit is 10,000 entries and 32 directory levels; limits and unreadable entries are indicated in the sidebar.

## Search

Use the **Search** sidebar tab or **Ctrl+Shift+F**. With a project open, the existing Find button also opens project search. Search matches filenames and literal text in all project Markdown files, including unopened files. Pending text from open documents takes precedence over their saved disk contents. Match case is optional. Select a content result to open the document in Source mode with the match selected.

Search supports UTF-8 files and correctly maps Unicode matches into the source selection. Results are bounded to 200 overall and 20 text matches per file, with a 128 MiB content budget per search. The UI reports limits and skipped/unreadable files. Search is literal; regular expressions, tags, advanced filters, and saved searches are future work.

## Relative attachments

Existing relative PNG, JPEG, GIF, and WebP image references render inline. Paths resolve relative to the saved document. They must remain within the selected project, or the document's own containing folder when opened individually. Markdown retains its original relative URLs when switching views and saving; temporary display URLs are removed from stored content.

**Insert → Image** and **Insert → Attachment** choose a local file. A saved document is required. Files already inside the project are linked in place. Other files are copied into the project's **attachments** folder (or beside an individual document in its **attachments** folder), using unique filenames without overwriting existing attachments. The original source file is retained. Import and image preview currently support files up to 32 MiB.

**Ctrl+click** a relative Markdown link to open its target in a tab. Ctrl+click a supported attachment link, or select an attachment in the project tree, to open it in its Windows default application. Supported external attachment types include PDF, text/CSV, common images, media, and Office documents. Executable files are not launched by this command.

HTML export embeds relative raster images so the exported file can display them independently. Print/PDF waits for image loading and offers a clear choice if an image is unavailable. This milestone does not add an integrated PDF reader, document embeds, automatic attachment cleanup, or rebasing relative paths when Save as moves a document into another folder. Keep a copied Markdown document in its original folder to retain its existing relative paths.

## Changes made outside the app

Native filesystem monitoring watches the project recursively and folders containing individually opened documents. File events refresh the project tree and check saved content fingerprints. Refocusing the app and the Refresh button also check for changes.

- Clean documents reload the latest disk version automatically.
- Documents with pending edits keep their text, pause automatic saves, and show **Review** and **Save as** controls.
- Review displays the open text beside the disk version. Reload explicitly discards the open edits and reads the latest disk version again.
- Deleted/moved files keep their open text and are treated as unsaved work, including during tab/application close. Save offers a new destination.
- The original revision check still runs on disk saves, protecting against a change occurring before a watcher notification arrives.

Folder/file rename tracking, automatic merging, and persistent version history are future milestones. Wiki links are available from 0.2.0: double-click `[[Note]]`, `[[folder/Note]]` or `[[Note#Heading|Label]]` in Write view. Internal-link autocomplete, backlinks, properties, and the MCP server remain planned.

## Verification

Rust tests cover folder scans, unopened-file search, live-buffer overrides, Unicode offsets, path boundaries, result limits, and attachment import/collision handling. The isolated native integration test exercises the actual project tree, inline images, HTML embedding, relative document opening, unsaved-buffer search, Windows watcher events, conflict review, reload, and external deletion. Existing editor, footnote, save-isolation, and single-instance checks remain part of that test.
