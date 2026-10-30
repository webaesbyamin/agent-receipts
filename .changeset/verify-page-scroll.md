---
"@agent-receipts/magic-folder": patch
---

The verify page starts at the top on reload and on back/forward, instead of restoring an old scroll position that no longer matches the page (the result is gone after a reload). A `#section` in the URL still goes to that section.
