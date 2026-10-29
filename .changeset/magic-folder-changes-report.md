---
"@agent-receipts/magic-folder": patch
---

Cleaner Magic Folder receipts. Summaries no longer show the job's internal `input/` and `output/` folders or job paths. New recipe field `changes_report: true`: the runner compares each original with its "(fixed)" copy and writes `changes.md` itself, so it lists only real changes. The Fix typos starter recipe uses it. Branded verify pages (`verify-page --trust-key`) no longer show the key input box.
