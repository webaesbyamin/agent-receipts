# @agent-receipts/crypto

Ed25519 signing and verification for the Agent Receipts protocol. Signs receipts, verifies signatures, manages key pairs. Pure JavaScript, zero native dependencies, audited cryptography via @noble/ed25519.

## Install

```bash
npm install @agent-receipts/crypto
```

## Usage

```typescript
import {
  generateKeyPair,
  signReceiptV2,
  verifyAnyReceipt,
  computeKeyId,
  hashReceipt,
} from '@agent-receipts/crypto'

// Generate a new Ed25519 key pair
const { privateKey, publicKey } = generateKeyPair()

// Sign a receipt (format v2: every field except signature + verify_url)
const receipt = { ...fields, sig_version: 2, key_id: computeKeyId(publicKey) }
receipt.signature = signReceiptV2(receipt, privateKey)

// Verify any receipt (v1 or v2). Use requireV2 when you show summary, cost or files to people.
const { valid, sig_version, covers_all_fields, key_id_matches } = verifyAnyReceipt(receipt, publicKey, { requireV2: true })

// Link the next receipt in a chain to this one
const prev_receipt_hash = hashReceipt(receipt)
```

## API

| Function | Description |
|----------|-------------|
| `generateKeyPair()` | Generate an Ed25519 key pair (returns `{ privateKey, publicKey }` as hex strings) |
| `signReceiptV2(receipt, privateKey)` | Sign every field of a v2 receipt (deep canonical JSON) |
| `verifyAnyReceipt(receipt, publicKey, { requireV2? })` | Verify v1 or v2; reports `sig_version`, `covers_all_fields`, `key_id_matches` |
| `computeKeyId(publicKey)` | Short key name: `key_` + 16 hex of sha256(key) |
| `hashReceipt(receipt)` | sha256 of a whole stored receipt (for `prev_receipt_hash`) |
| `canonicalizeDeep(value)` | Keys sorted at every depth; the bytes v2 signs |
| `signReceipt(payload, privateKey)` | Legacy v1: sign the 12-field payload |
| `verifyReceipt(payload, signature, publicKey)` | Legacy v1: verify a 12-field payload (does not verify v2 receipts) |
| `getSignablePayload(receipt)` | Extract the deterministic signable fields from a receipt |
| `getPublicKeyFromPrivate(privateKey)` | Derive the public key from a private key |
| `canonicalize(obj)` | Deterministic JSON serialization for signing |

## Key Generation CLI

```bash
npx @agent-receipts/crypto generate-keys
```

Outputs `RECEIPT_SIGNING_PRIVATE_KEY` and `RECEIPT_SIGNING_PUBLIC_KEY` for your `.env` file.

## License

MIT
