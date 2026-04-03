'use client'

import { useState, useCallback, useEffect } from 'react'
import { verifyReceipt as verifyReceiptApi, type VerifyResponse } from '@/lib/api'
import { StatusBadge } from '@/components/shared/status-badge'
import { CopyButton } from '@/components/shared/copy-button'
import { formatDate, truncateId } from '@/lib/formatters'
import { cn } from '@/lib/cn'
import { ShieldCheck, ShieldX, Upload, Info } from 'lucide-react'

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export default function VerifyPage() {
  const [jsonInput, setJsonInput] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [result, setResult] = useState<VerifyResponse | null>(null)
  const [parsedReceipt, setParsedReceipt] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Auto-load demo receipt on mount
  useEffect(() => {
    if (!isDemoMode) return
    async function loadDemo() {
      try {
        const [receiptsRes, configRes] = await Promise.all([
          fetch('/api/receipts?limit=1'),
          fetch('/api/config'),
        ])
        const receipts = await receiptsRes.json()
        const config = await configRes.json()
        if (receipts.data?.[0]) setJsonInput(JSON.stringify(receipts.data[0], null, 2))
        if (config.public_key) setPublicKey(config.public_key)
      } catch {}
    }
    loadDemo()
  }, [])

  const handleVerify = useCallback(async () => {
    setError(null)
    setResult(null)
    setParsedReceipt(null)

    let receipt: Record<string, unknown>
    try {
      receipt = JSON.parse(jsonInput)
    } catch {
      setError('Invalid JSON. Please paste a valid receipt JSON.')
      return
    }

    if (!receipt.receipt_id) {
      setError('Missing receipt_id. This doesn\'t look like a valid receipt.')
      return
    }

    setLoading(true)
    try {
      const res = await verifyReceiptApi(receipt, publicKey || undefined)
      setResult(res)
      setParsedReceipt(receipt)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }, [jsonInput, publicKey])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setJsonInput(reader.result)
    }
    reader.readAsText(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setJsonInput(reader.result)
    }
    reader.readAsText(file)
  }, [])

  const handleUseLocalKey = useCallback(async () => {
    try {
      const res = await fetch('/api/config')
      const config = await res.json()
      if (config.public_key) setPublicKey(config.public_key)
    } catch {}
  }, [])

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-lg font-semibold text-text-primary">Verify a Receipt</h1>

      {/* Receipt JSON input */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Receipt</label>
        <textarea
          value={jsonInput}
          onChange={e => setJsonInput(e.target.value)}
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          placeholder="Paste receipt JSON here..."
          className="w-full h-48 px-4 py-3 text-sm font-mono border border-border rounded-lg bg-bg-primary text-text-primary placeholder:text-text-muted resize-y"
        />
        <div className="mt-2 flex items-center gap-2">
          <label className="flex items-center gap-1 px-3 py-1.5 text-xs border border-border rounded-md text-text-secondary hover:bg-bg-secondary cursor-pointer transition-colors">
            <Upload className="w-3 h-3" />
            Upload .json file
            <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* Public key input */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Public Key</label>
        <input
          type="text"
          value={publicKey}
          onChange={e => setPublicKey(e.target.value)}
          placeholder="Enter public key (hex) or use local key"
          className="w-full px-4 py-2 text-sm font-mono border border-border rounded-lg bg-bg-primary text-text-primary placeholder:text-text-muted"
        />
        <button onClick={handleUseLocalKey} className="mt-2 text-xs text-primary hover:underline">
          Use local key
        </button>
      </div>

      {/* Verify button */}
      <button
        onClick={handleVerify}
        disabled={loading || !jsonInput.trim()}
        className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <ShieldCheck className="w-4 h-4" />
        {loading ? 'Verifying...' : 'Verify'}
      </button>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-danger-subtle border border-danger/20">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* Result — demo mode: rich explanation */}
      {result && isDemoMode && !result.verified && parsedReceipt && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-6">
          <div className="flex items-start gap-4">
            <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Demo Verification</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                This demo uses placeholder signatures. In a real installation, this receipt would be verified by:
              </p>
              <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-2 list-decimal list-inside">
                <li>Extracting 12 fields from the receipt into a signable payload</li>
                <li>Canonicalizing the payload (alphabetical key sort &rarr; JSON)</li>
                <li>Verifying the Ed25519 signature against your public key</li>
                <li>Confirming the result: &check; Valid or &cross; Tampered</li>
              </ol>
              <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700 space-y-1">
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Receipt ID: <span className="font-mono">{parsedReceipt.receipt_id as string}</span>
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Action: <span className="font-mono">{parsedReceipt.action as string}</span>
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Agent: <span className="font-mono">{parsedReceipt.agent_id as string}</span>
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  Signed fields: action, agent_id, chain_id, completed_at, environment, input_hash, org_id, output_hash, receipt_id, receipt_type, status, timestamp
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result — real mode or verified */}
      {result && (!isDemoMode || result.verified) && (
        <div className={cn('card p-6', result.verified ? 'border-success/30' : 'border-danger/30')}>
          <div className="flex items-center gap-3 mb-4">
            {result.verified ? (
              <ShieldCheck className="w-8 h-8 text-success" />
            ) : (
              <ShieldX className="w-8 h-8 text-danger" />
            )}
            <div>
              <h3 className={cn('text-lg font-semibold', result.verified ? 'text-success' : 'text-danger')}>
                {result.verified ? 'SIGNATURE VALID' : 'SIGNATURE INVALID'}
              </h3>
              <p className="text-sm text-text-secondary">
                {result.verified
                  ? 'This receipt was signed by the holder of the provided public key and has not been tampered with.'
                  : result.error ?? 'The signature could not be verified.'}
              </p>
            </div>
          </div>

          {parsedReceipt && (
            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted w-20">Receipt ID</span>
                <code className="text-xs font-mono text-text-primary">{parsedReceipt.receipt_id as string}</code>
                <CopyButton value={parsedReceipt.receipt_id as string} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted w-20">Action</span>
                <span className="text-sm text-text-primary">{parsedReceipt.action as string}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted w-20">Agent</span>
                <span className="text-sm text-text-primary">{parsedReceipt.agent_id as string}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted w-20">Status</span>
                <StatusBadge status={parsedReceipt.status as string} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted w-20">Created</span>
                <span className="text-sm text-text-secondary">{formatDate(parsedReceipt.timestamp as string)}</span>
              </div>
              {result.public_key_used && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted w-20">Signed with</span>
                  <code className="text-xs font-mono text-text-secondary">{truncateId(result.public_key_used, 20)}</code>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* What real verification looks like */}
      {isDemoMode && (
        <div className="mt-4">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">What a real verification looks like</p>
          <div className="rounded-lg border border-success/30 bg-success-subtle p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-success" />
              <span className="font-semibold text-success">Signature Valid</span>
            </div>
            <div className="space-y-1 text-xs font-mono text-text-secondary">
              <p>Receipt: rcpt_abc123def456</p>
              <p>Action: generate_code</p>
              <p>Agent: my-agent</p>
              <p>Status: completed</p>
              <p>Signed at: Apr 2, 2026, 14:23:01</p>
              <p className="pt-2">Verification method: Ed25519</p>
              <p>Public key: a1b2c3d4e5f6...{truncateId('a1b2c3d4e5f6a7b8c9d0e1f2', 16)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
