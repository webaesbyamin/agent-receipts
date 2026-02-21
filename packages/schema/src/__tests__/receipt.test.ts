import { describe, it, expect } from 'vitest'
import {
  ActionReceipt,
  SignablePayload,
  CreateReceiptInput,
  CompleteReceiptInput,
  VerifyResponse,
  ListReceiptsQuery,
  PaginationMeta,
  ErrorResponse,
} from '../index'

const validReceipt = {
  receipt_id: 'rcpt_abc123',
  parent_receipt_id: null,
  chain_id: 'chain_xyz',
  receipt_type: 'action' as const,
  agent_id: 'quote-generator-v2',
  org_id: 'org_test123',
  action: 'generate_report',
  input_hash: 'sha256:abc123def456',
  output_hash: 'sha256:789ghi012jkl',
  output_summary: 'Generated Q4 revenue report',
  model: 'gpt-4',
  tokens_in: 150,
  tokens_out: 300,
  cost_usd: 0.0045,
  latency_ms: 1200,
  tool_calls: ['query_database', 'format_output'],
  timestamp: '2026-02-18T12:00:00.000Z',
  completed_at: '2026-02-18T12:00:01.200Z',
  status: 'completed' as const,
  error: null,
  environment: 'production' as const,
  tags: ['report', 'revenue'],
  constraints: null,
  constraint_result: null,
  signature: 'ed25519:abc123base64signature==',
  verify_url: 'https://agentreceipts.com/verify/rcpt_abc123',
  callback_verified: true,
  confidence: 0.95,
  metadata: { source: 'api', version: '1.0' },
}

describe('ActionReceipt', () => {
  it('valid receipt passes validation', () => {
    const result = ActionReceipt.safeParse(validReceipt)
    expect(result.success).toBe(true)
  })

  it('missing required field (receipt_id) fails', () => {
    const { receipt_id, ...rest } = validReceipt
    const result = ActionReceipt.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('invalid receipt_type fails', () => {
    const result = ActionReceipt.safeParse({ ...validReceipt, receipt_type: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('invalid status fails', () => {
    const result = ActionReceipt.safeParse({ ...validReceipt, status: 'unknown' })
    expect(result.success).toBe(false)
  })

  it('invalid environment fails', () => {
    const result = ActionReceipt.safeParse({ ...validReceipt, environment: 'dev' })
    expect(result.success).toBe(false)
  })

  it('nullable fields accept null', () => {
    const receipt = {
      ...validReceipt,
      parent_receipt_id: null,
      output_hash: null,
      output_summary: null,
      model: null,
      tokens_in: null,
      tokens_out: null,
      cost_usd: null,
      latency_ms: null,
      tool_calls: null,
      completed_at: null,
      error: null,
      tags: null,
      constraints: null,
      constraint_result: null,
      callback_verified: null,
      confidence: null,
    }
    const result = ActionReceipt.safeParse(receipt)
    expect(result.success).toBe(true)
  })

  it('metadata accepts arbitrary objects', () => {
    const receipt = {
      ...validReceipt,
      metadata: { nested: { deep: { value: 42 } }, arr: [1, 2, 3] },
    }
    const result = ActionReceipt.safeParse(receipt)
    expect(result.success).toBe(true)
  })
})

describe('SignablePayload', () => {
  const validPayload = {
    receipt_id: 'rcpt_abc123',
    chain_id: 'chain_xyz',
    receipt_type: 'action' as const,
    agent_id: 'test-agent',
    org_id: 'org_test',
    action: 'test_action',
    input_hash: 'sha256:abc',
    output_hash: null,
    status: 'pending' as const,
    timestamp: '2026-02-18T12:00:00.000Z',
    completed_at: null,
    environment: 'test' as const,
  }

  it('valid payload passes', () => {
    const result = SignablePayload.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('exactly 12 fields', () => {
    const result = SignablePayload.safeParse(validPayload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(Object.keys(result.data)).toHaveLength(12)
    }
  })
})

describe('CreateReceiptInput', () => {
  it('minimal input passes (agent_id, action, input_hash only)', () => {
    const result = CreateReceiptInput.safeParse({
      agent_id: 'my-agent',
      action: 'do_thing',
      input_hash: 'sha256:abc123',
    })
    expect(result.success).toBe(true)
  })

  it('defaults applied (receipt_type, status, environment)', () => {
    const result = CreateReceiptInput.parse({
      agent_id: 'my-agent',
      action: 'do_thing',
      input_hash: 'sha256:abc123',
    })
    expect(result.receipt_type).toBe('action')
    expect(result.status).toBe('pending')
    expect(result.environment).toBe('production')
  })

  it('empty agent_id fails (min length 1)', () => {
    const result = CreateReceiptInput.safeParse({
      agent_id: '',
      action: 'do_thing',
      input_hash: 'sha256:abc123',
    })
    expect(result.success).toBe(false)
  })

  it('all optional fields work', () => {
    const result = CreateReceiptInput.safeParse({
      agent_id: 'my-agent',
      action: 'do_thing',
      input_hash: 'sha256:abc123',
      receipt_type: 'verification',
      status: 'completed',
      environment: 'staging',
      parent_receipt_id: 'rcpt_parent',
      output_hash: 'sha256:def456',
      output_summary: 'Done',
      model: 'gpt-4',
      tokens_in: 100,
      tokens_out: 200,
      cost_usd: 0.01,
      latency_ms: 500,
      tool_calls: ['tool1'],
      tags: ['tag1', 'tag2'],
      confidence: 0.9,
      callback_verified: true,
      metadata: { key: 'value' },
    })
    expect(result.success).toBe(true)
  })
})

describe('CompleteReceiptInput', () => {
  it('valid completion passes', () => {
    const result = CompleteReceiptInput.safeParse({
      status: 'completed',
      output_hash: 'sha256:result',
      latency_ms: 1500,
    })
    expect(result.success).toBe(true)
  })

  it('status "pending" rejected', () => {
    const result = CompleteReceiptInput.safeParse({ status: 'pending' })
    expect(result.success).toBe(false)
  })

  it('status "completed" accepted', () => {
    const result = CompleteReceiptInput.safeParse({ status: 'completed' })
    expect(result.success).toBe(true)
  })

  it('status "failed" accepted with error object', () => {
    const result = CompleteReceiptInput.safeParse({
      status: 'failed',
      error: { code: 'TIMEOUT', message: 'Agent timed out' },
    })
    expect(result.success).toBe(true)
  })
})

describe('VerifyResponse', () => {
  it('valid response passes', () => {
    const result = VerifyResponse.safeParse({
      verified: true,
      receipt: {
        receipt_id: 'rcpt_abc',
        chain_id: 'chain_xyz',
        receipt_type: 'action',
        agent_id: 'test-agent',
        action: 'do_thing',
        status: 'completed',
        input_hash: 'sha256:abc',
        output_hash: 'sha256:def',
        signature: 'ed25519:abc123==',
        timestamp: '2026-02-18T12:00:00.000Z',
        completed_at: '2026-02-18T12:00:01.000Z',
        environment: 'production',
        latency_ms: 1200,
      },
      signature_valid: true,
      chain_length: 3,
      public_key_url: 'https://agentreceipts.com/.well-known/receipt-public-key.json',
    })
    expect(result.success).toBe(true)
  })

  it('public_key_url must be valid URL', () => {
    const result = VerifyResponse.safeParse({
      verified: true,
      receipt: {
        receipt_id: 'rcpt_abc',
        chain_id: 'chain_xyz',
        receipt_type: 'action',
        agent_id: 'test-agent',
        action: 'do_thing',
        status: 'completed',
        input_hash: 'sha256:abc',
        output_hash: null,
        signature: 'ed25519:abc==',
        timestamp: '2026-02-18T12:00:00.000Z',
        completed_at: null,
        environment: 'production',
        latency_ms: null,
      },
      signature_valid: true,
      chain_length: 1,
      public_key_url: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })
})

describe('ListReceiptsQuery', () => {
  it('defaults applied (page 1, limit 50, sort created_at:desc)', () => {
    const result = ListReceiptsQuery.parse({})
    expect(result.page).toBe(1)
    expect(result.limit).toBe(50)
    expect(result.sort).toBe('created_at:desc')
  })

  it('invalid sort format rejected', () => {
    const result = ListReceiptsQuery.safeParse({ sort: 'invalid_sort' })
    expect(result.success).toBe(false)
  })

  it('coerces string numbers to numbers', () => {
    const result = ListReceiptsQuery.parse({ page: '2', limit: '25' })
    expect(result.page).toBe(2)
    expect(result.limit).toBe(25)
  })
})

describe('ErrorResponse', () => {
  it('valid error passes', () => {
    const result = ErrorResponse.safeParse({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid API key',
        status: 401,
      },
    })
    expect(result.success).toBe(true)
  })

  it('invalid error code fails', () => {
    const result = ErrorResponse.safeParse({
      error: {
        code: 'NONEXISTENT_CODE',
        message: 'Test',
        status: 400,
      },
    })
    expect(result.success).toBe(false)
  })
})

describe('PaginationMeta', () => {
  it('valid meta passes', () => {
    const result = PaginationMeta.safeParse({
      page: 1,
      limit: 50,
      total: 200,
      total_pages: 4,
      has_next: true,
      has_prev: false,
    })
    expect(result.success).toBe(true)
  })
})
