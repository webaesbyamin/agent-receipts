# Public verify page

`index.html` is a single static file. Host it anywhere (Vercel, Netlify, GitHub Pages, S3) or open it straight from disk.

Drop a `receipt.html` or `receipt.json` on it and it checks the Ed25519 signature in the browser. Nothing is uploaded. It then shows the signed record using its own copy of the renderer, so a receipt file that has had its script rewritten can't fool it.

A receipt carries its own key, so a valid signature alone only means "unchanged". This generic page shows amber **signer not confirmed** until the visitor enters the issuer's key ID (or opens `index.html?key=key_…`). Older-format receipts, which sign only 12 fields, are never shown as verified.

Issuers should host their own copy with their key baked in. It shows green **Verified, signed by <name>** for their receipts and red for any other key:

```bash
npx @agent-receipts/magic-folder verify-page verify.html --trust-key key_… --trust-name "Webaes"
```

The page is generated, so don't edit it by hand:

```bash
npx @agent-receipts/magic-folder verify-page apps/verify/index.html
```

A test fails if the committed file drifts from the generator.
