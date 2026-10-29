---
"@agent-receipts/magic-folder": patch
---

Windows and Linux support, tested in CI on all three systems. On Windows: sandbox path checks ignore case and handle `\\?\` long paths, UNC and drive paths; a junction pointing outside the job folder is refused; moves and deletes wait out brief file locks; more Office and Windows temp files are ignored. New install guide for Mac, Windows and Linux, including keeping it running (LaunchAgent, Startup folder, systemd). `doctor` flags Node versions outside 22–24, `run` stops cleanly on SIGTERM, the help text covers showing hidden files on every OS, and `BROWSER_RENDER_JS` and `RECEIPT_CSS` are exported. Requires Node 22 or 24: better-sqlite3 ships no ready-made build for Node 20.
