# Editor, MD 0.1.1 — local test build

Historical local test guide for 0.1.1. That build was not published; its changes are included in the 0.1.2 Beta 2 release.

- Open a Markdown file in Explorer using the 0.1.1 executable. Further files opened with that executable join its existing window as tabs. An already-open file focuses its existing tab and keeps pending edits. Requests received while the app starts or a dialog is open are queued.
- Close older Editor, MD versions before testing. Windows may still associate Markdown files with the older executable; use **Open with** and select the new 0.1.1 executable when testing Explorer.
- The document zoom slider and plus/minus controls cover 25–200%. Double-click the percentage number to enter any positive percentage, including values above 200%. Keyboard users can focus that button and press Enter or Space.
- **Appearance → UI zoom** scales the application interface from 50–200%. It is shared by light and dark mode, remembered locally, and separate from document zoom and print size. The 100% button restores normal interface size.
- Click the initials circle at the top right to edit it, or use **Appearance → Your initials**. One to four characters are supported, and the setting is shared by both themes.
- To retain an existing portable workspace, place the new executable beside its existing **EditorMD-data** folder. Otherwise the test executable creates its own data folder.

The application's own code and dependencies remain those described in the main README; this update adds Tauri's official single-instance plugin. AI development assistance remains disclosed in the README and About dialog.
