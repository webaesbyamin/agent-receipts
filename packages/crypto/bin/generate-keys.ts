#!/usr/bin/env npx tsx
import { generateKeyPair } from '../src/keys'

function main() {
  const { privateKey, publicKey } = generateKeyPair()

  console.log('\nAgent Receipts — Ed25519 Key Pair Generated\n')
  console.log('Add these to your .env file:\n')
  console.log(`RECEIPT_SIGNING_PRIVATE_KEY=${privateKey}`)
  console.log(`RECEIPT_SIGNING_PUBLIC_KEY=${publicKey}`)
  console.log('\nKeep the private key SECRET. Never commit it to git.')
  console.log("The public key is safe to share — it's published at /.well-known/receipt-public-key.json\n")
}

main()
