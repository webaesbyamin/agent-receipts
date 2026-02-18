import { createHash } from 'node:crypto'

/**
 * Deep canonical JSON serialization: sorts keys at every depth,
 * handles arrays by recursing into elements.
 * Distinct from crypto's flat canonicalize() — this handles nested objects/arrays
 * for hashing arbitrary user input/output.
 */
function deepCanonicalize(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(deepCanonicalize)
  }
  if (typeof value === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = deepCanonicalize((value as Record<string, unknown>)[key])
    }
    return sorted
  }
  return value
}

/**
 * Hash arbitrary data using deep canonical JSON + SHA-256.
 * Returns format: `sha256:<hex>`
 *
 * @param data - Any JSON-serializable value (string, object, array, etc.)
 * @returns Hash string in format "sha256:<hex>"
 */
export function hashData(data: unknown): string {
  const canonical = JSON.stringify(deepCanonicalize(data)) ?? 'null'
  const hash = createHash('sha256').update(canonical).digest('hex')
  return `sha256:${hash}`
}
