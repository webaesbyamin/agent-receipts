import type { ActionReceipt, ConstraintDefinition, ConstraintResult, SingleConstraintResult } from '@agent-receipts/schema'
import { validateJsonSchema } from './json-schema-validator.js'

export interface ConstraintContext {
  rawOutput?: unknown
}

const RECEIPT_FIELD_NAMES = new Set([
  'receipt_id', 'parent_receipt_id', 'chain_id', 'receipt_type',
  'agent_id', 'org_id', 'action', 'input_hash', 'output_hash',
  'output_summary', 'model', 'tokens_in', 'tokens_out', 'cost_usd',
  'latency_ms', 'tool_calls', 'timestamp', 'completed_at', 'status',
  'error', 'environment', 'tags', 'constraints', 'constraint_result',
  'signature', 'verify_url', 'callback_verified', 'confidence', 'metadata',
])

function evaluateMaxLatencyMs(receipt: ActionReceipt, constraint: ConstraintDefinition): SingleConstraintResult {
  const expected = constraint.value as number
  const actual = receipt.latency_ms
  if (actual === null || actual === undefined) {
    return {
      type: constraint.type,
      passed: false,
      expected,
      actual: null,
      message: constraint.message ?? 'latency_ms is null',
    }
  }
  return {
    type: constraint.type,
    passed: actual <= expected,
    expected,
    actual,
    message: constraint.message,
  }
}

function evaluateMaxCostUsd(receipt: ActionReceipt, constraint: ConstraintDefinition): SingleConstraintResult {
  const expected = constraint.value as number
  const actual = receipt.cost_usd
  if (actual === null || actual === undefined) {
    return {
      type: constraint.type,
      passed: false,
      expected,
      actual: null,
      message: constraint.message ?? 'cost_usd is null',
    }
  }
  return {
    type: constraint.type,
    passed: actual <= expected,
    expected,
    actual,
    message: constraint.message,
  }
}

function evaluateMinConfidence(receipt: ActionReceipt, constraint: ConstraintDefinition): SingleConstraintResult {
  const expected = constraint.value as number
  const actual = receipt.confidence
  if (actual === null || actual === undefined) {
    return {
      type: constraint.type,
      passed: false,
      expected,
      actual: null,
      message: constraint.message ?? 'confidence is null',
    }
  }
  return {
    type: constraint.type,
    passed: actual >= expected,
    expected,
    actual,
    message: constraint.message,
  }
}

function evaluateRequiredFields(receipt: ActionReceipt, constraint: ConstraintDefinition): SingleConstraintResult {
  const fields = constraint.value
  if (!Array.isArray(fields)) {
    return {
      type: constraint.type,
      passed: false,
      expected: fields,
      actual: null,
      message: constraint.message ?? 'value must be an array of field names',
    }
  }

  const receiptRecord = receipt as unknown as Record<string, unknown>
  const missingFields: string[] = []
  const unknownFields: string[] = []

  for (const field of fields) {
    if (!RECEIPT_FIELD_NAMES.has(field as string)) {
      unknownFields.push(field as string)
    } else if (receiptRecord[field as string] === null || receiptRecord[field as string] === undefined) {
      missingFields.push(field as string)
    }
  }

  if (unknownFields.length > 0) {
    return {
      type: constraint.type,
      passed: false,
      expected: fields,
      actual: unknownFields,
      message: constraint.message ?? `Unknown field(s): ${unknownFields.join(', ')}`,
    }
  }

  return {
    type: constraint.type,
    passed: missingFields.length === 0,
    expected: fields,
    actual: missingFields.length > 0 ? missingFields : fields,
    message: constraint.message ?? (missingFields.length > 0 ? `Missing field(s): ${missingFields.join(', ')}` : undefined),
  }
}

function evaluateStatusMustBe(receipt: ActionReceipt, constraint: ConstraintDefinition): SingleConstraintResult {
  const expected = constraint.value
  const actual = receipt.status
  const allowedStatuses = Array.isArray(expected) ? expected : [expected]
  return {
    type: constraint.type,
    passed: allowedStatuses.includes(actual),
    expected,
    actual,
    message: constraint.message,
  }
}

function evaluateOutputSchema(constraint: ConstraintDefinition, rawOutput?: unknown): SingleConstraintResult {
  if (rawOutput === undefined) {
    return {
      type: 'output_schema',
      passed: false,
      expected: constraint.value,
      actual: null,
      message: constraint.message ?? 'output_schema requires raw output data — only available during track() or create()',
    }
  }

  const schema = constraint.value as Record<string, unknown>
  const errors = validateJsonSchema(rawOutput, schema)

  return {
    type: 'output_schema',
    passed: errors.length === 0,
    expected: schema,
    actual: errors.length > 0 ? errors : rawOutput,
    message: errors.length > 0
      ? constraint.message ?? `Schema validation failed: ${errors.join(', ')}`
      : undefined,
  }
}

export function evaluateConstraints(
  receipt: ActionReceipt,
  constraints: ConstraintDefinition[],
  context?: ConstraintContext,
): ConstraintResult {
  if (constraints.length === 0) {
    return {
      passed: true,
      results: [],
      evaluated_at: new Date().toISOString(),
    }
  }

  const results: SingleConstraintResult[] = []

  for (const constraint of constraints) {
    let result: SingleConstraintResult
    switch (constraint.type) {
      case 'max_latency_ms':
        result = evaluateMaxLatencyMs(receipt, constraint)
        break
      case 'max_cost_usd':
        result = evaluateMaxCostUsd(receipt, constraint)
        break
      case 'min_confidence':
        result = evaluateMinConfidence(receipt, constraint)
        break
      case 'required_fields':
        result = evaluateRequiredFields(receipt, constraint)
        break
      case 'status_must_be':
        result = evaluateStatusMustBe(receipt, constraint)
        break
      case 'output_schema':
        result = evaluateOutputSchema(constraint, context?.rawOutput)
        break
      default:
        result = {
          type: constraint.type,
          passed: false,
          expected: constraint.value,
          actual: null,
          message: constraint.message ?? `Unknown constraint type: ${constraint.type}`,
        }
    }
    results.push(result)
  }

  return {
    passed: results.every((r) => r.passed),
    results,
    evaluated_at: new Date().toISOString(),
  }
}
