export const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  completed: { bg: 'bg-success-subtle', text: 'text-success', dot: 'bg-success' },
  failed: { bg: 'bg-danger-subtle', text: 'text-danger', dot: 'bg-danger' },
  pending: { bg: 'bg-warning-subtle', text: 'text-warning', dot: 'bg-warning' },
  timeout: { bg: 'bg-danger-subtle', text: 'text-danger', dot: 'bg-danger' },
}

export const CONSTRAINT_TYPES: Record<string, string> = {
  max_latency_ms: 'Max Latency',
  max_cost_usd: 'Max Cost',
  min_confidence: 'Min Confidence',
  required_fields: 'Required Fields',
  status_must_be: 'Status Must Be',
  output_schema: 'Output Schema',
}

export const RECEIPT_TYPES: Record<string, string> = {
  action: 'Action',
  judgment: 'Judgment',
  arbitration: 'Arbitration',
  verification: 'Verification',
}

export const VERDICT_COLORS: Record<string, { bg: string; text: string }> = {
  pass: { bg: 'bg-success-subtle', text: 'text-success' },
  fail: { bg: 'bg-danger-subtle', text: 'text-danger' },
  partial: { bg: 'bg-warning-subtle', text: 'text-warning' },
}

export const DEFAULT_PAGE_SIZE = 50
export const AUTO_REFRESH_INTERVAL = 10000
