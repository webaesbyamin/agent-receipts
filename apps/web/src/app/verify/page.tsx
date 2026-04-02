'use client'

import { useState, useCallback } from 'react'
import { verifyReceipt as verifyReceiptApi, type VerifyResponse } from '@/lib/api'
import { ErrorState } from '@/components/shared/error-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { CopyButton } from '@/components/shared/copy-button'
import { formatDate, truncateId } from '@/lib/formatters'
import { cn } from '@/lib/cn'
import { ShieldCheck, ShieldX, Upload } from 'lucide-react'

export default function VerifyPage() {
  const [jsonInput, setJsonInput] = useState('')
  const [publicKey, setPublicKey] = useState('')
  const [result, setResult] = useState<VerifyResponse | null>(null)
  const [parsedReceipt, setParsedReceipt] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
      if (typeof reader.result === 'string') {
        setJsonInput(reader.result)
      }
    }
    reader.readAsText(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setJsonInput(reader.result)
      }
    }
    reader.readAsText(file)
  }, [])

  const handleUseLocalKey = useCallback(async () => {
    try {
      const res = await fetch('/api/config')
      const config = await res.json()
      if (config.public_key) {
        setPublicKey(config.public_key)
      }
    } catch {}
  }, [])

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

  const loadDemoReceipt = useCallback(async () => {
    try {
      const res = await fetch('/api/receipts?limit=1')
      const data = await res.json()
      if (data.data?.[0]) {
        setJsonInput(JSON.stringify(data.data[0], null, 2))
      }
      const configRes = await fetch('/api/config')
      const config = await configRes.json()
      if (config.public_key) setPublicKey(config.public_key)
    } catch {}
  }, [])

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-lg font-semibold text-text-primary">Verify a Receipt</h1>

      {isDemoMode && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
            <strong>Demo:</strong> In production, receipts are signed with Ed25519 cryptography. Try loading a demo receipt to see the verification flow.
          </p>
          <button
            onClick={loadDemoReceipt}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded font-medium transition-colors"
          >
            Load demo receipt &rarr;
          </button>
        </div>
      )}

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
        <button
          onClick={handleUseLocalKey}
          className="mt-2 text-xs text-primary hover:underline"
        >
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

      {/* Result */}
      {result && (
        <div className={cn(
          'card p-6',
          result.verified ? 'border-success/30' : 'border-danger/30'
        )}>
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
              {!result.verified && isDemoMode && (
                <p className="text-xs text-text-muted mt-1">Demo signatures are placeholders. Real receipts use cryptographic Ed25519 signatures.</p>
              )}
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
    </div>
  )
}
