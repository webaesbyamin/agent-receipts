/**
 * Generates a portable memory bundle JSON string and triggers browser download.
 */

interface BundleEntity {
  entity_id: string
  entity_type: string
  name: string
  aliases: string[]
  scope: string
  created_at: string
  created_by_agent: string
  created_by_receipt: string
  forgotten_at: string | null
  merged_into: string | null
  attributes: Record<string, unknown>
  metadata: Record<string, unknown>
}

interface BundleObservation {
  observation_id: string
  entity_id: string
  content: string
  confidence: string
  source_receipt_id: string
  source_agent_id: string
  source_context: string | null
  observed_at: string
  forgotten_at: string | null
  forgotten_by: string | null
  superseded_by: string | null
  expires_at: string | null
  tags: string[]
  metadata: Record<string, unknown>
}

interface BundleRelationship {
  relationship_id: string
  from_entity_id: string
  to_entity_id: string
  relationship_type: string
  strength: string
  source_receipt_id: string
  created_at: string
  forgotten_at: string | null
  metadata: Record<string, unknown>
}

interface BundleReceipt {
  receipt_id: string
  timestamp: string
  action: string
}

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return 'sha256:' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function generateWalkthroughBundle(
  entities: BundleEntity[],
  observations: BundleObservation[],
  relationships: BundleRelationship[],
  receipts: BundleReceipt[]
): Promise<string> {
  const timestamps = [
    ...entities.map(e => e.created_at),
    ...observations.map(o => o.observed_at),
    ...receipts.map(r => r.timestamp),
  ].sort()

  const bundleData = {
    entities,
    observations,
    relationships,
    receipts,
  }

  const checksum = await sha256(JSON.stringify(bundleData))

  const bundle = {
    bundle_id: `bundle_wt_${Date.now().toString(36)}`,
    bundle_version: '1.0',
    created_at: new Date().toISOString(),
    created_by_agent: 'walkthrough-agent',
    description: 'Interactive walkthrough memory bundle',
    public_key: 'ed25519:DEMO_WALKTHROUGH_PUBLIC_KEY',
    entities,
    observations,
    relationships,
    receipts,
    checksum,
    stats: {
      entity_count: entities.length,
      observation_count: observations.length,
      relationship_count: relationships.length,
      receipt_count: receipts.length,
      agents: ['walkthrough-agent'],
      date_range: {
        earliest: timestamps[0] ?? new Date().toISOString(),
        latest: timestamps[timestamps.length - 1] ?? new Date().toISOString(),
      },
    },
  }

  return JSON.stringify(bundle, null, 2)
}

export function downloadBundle(jsonString: string, filename?: string): void {
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? `agent-receipts-walkthrough-${Date.now()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
