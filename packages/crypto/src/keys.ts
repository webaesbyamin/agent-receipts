import { getPublicKey, etc, utils } from '@noble/ed25519'

/**
 * Generate a new Ed25519 key pair.
 *
 * @returns { privateKey: string, publicKey: string } — both hex-encoded (64 chars each)
 */
export function generateKeyPair(): {
  privateKey: string
  publicKey: string
} {
  const privateKeyBytes = utils.randomPrivateKey()
  const publicKeyBytes = getPublicKey(privateKeyBytes)
  return {
    privateKey: etc.bytesToHex(privateKeyBytes),
    publicKey: etc.bytesToHex(publicKeyBytes),
  }
}

/**
 * Derive public key from private key.
 *
 * @param privateKeyHex - Ed25519 private key as hex string (64 chars)
 * @returns Public key as hex string (64 chars)
 */
export function getPublicKeyFromPrivate(privateKeyHex: string): string {
  const privKeyBytes = etc.hexToBytes(privateKeyHex)
  const pubKeyBytes = getPublicKey(privKeyBytes)
  return etc.bytesToHex(pubKeyBytes)
}
