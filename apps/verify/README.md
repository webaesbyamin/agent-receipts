# Public verify page

`index.html` is a single static file. Host it anywhere (Vercel, Netlify, GitHub Pages, S3) or open it straight from disk.

Drop a `receipt.html` or `receipt.json` on it and it checks the Ed25519 signature in the browser. Nothing is uploaded. It then shows the signed record using its own copy of the renderer, so a receipt file that has had its script rewritten can't fool it.

Paste the issuer's key ID or public key to confirm **who** signed the receipt, not just that it wasn't changed.

The page is generated, so don't edit it by hand:

```bash
npx @agent-receipts/magic-folder verify-page apps/verify/index.html
```

A test fails if the committed file drifts from the generator.
