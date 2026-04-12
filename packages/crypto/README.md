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
  signReceipt,
  verifyReceipt,
  getSignablePayload,
  getPublicKeyFromPrivate,
} from '@agent-receipts/crypto'

// Generate a new Ed25519 key pair
const { privateKey, publicKey } = generateKeyPair()

// Sign a receipt
const signable = getSignablePayload(receipt)
const signature = signReceipt(signable, privateKey)

// Verify a receipt
const valid = verifyReceipt(signable, signature, publicKey)

// Derive public key from private
const pub = getPublicKeyFromPrivate(privateKey)
```

## API

| Function | Description |
|----------|-------------|
| `generateKeyPair()` | Generate an Ed25519 key pair (returns `{ privateKey, publicKey }` as hex strings) |
| `signReceipt(payload, privateKey)` | Sign a canonical payload, returns hex signature |
| `verifyReceipt(payload, signature, publicKey)` | Verify a signature against a payload and public key |
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
