---
"@agent-receipts/magic-folder": patch
---

`verify-page` can be branded for an issuer: `--heading`, `--brand-name`, `--brand-sub`, `--home-url`, `--ink`, `--paper`, `--accent`, `--font-display`, `--font-body`, `--font-mono`, `--font-css` (a stylesheet URL, or a CSS file to inline), `--icon`, `--apple-icon`, `--theme-color`, `--description`, `--og-image`, `--canonical` and `--link <label>=<url>` (also `renderVerifyPage({ theme })`). Without them the page looks exactly as before. Every value is checked or escaped: colours must be hex, URLs http(s) or a /path, font names plain text.

The verify page is easier to use and never shows a wrong answer: the drop zone works from the keyboard (Tab, then Enter or Space), focus moves to the result so screen readers read it, files over 5 MB and several files at once get a plain message, a file that isn't a receipt gets a calm amber "Not a receipt", and there's a message when JavaScript is off. A browser that can't check Ed25519 now gets an amber "can't check" on the verify page and on receipt.html, instead of a red "Not verified".
