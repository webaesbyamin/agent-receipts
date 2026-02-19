# @agentreceipts/schema

Zod schemas and TypeScript types for the [Action Receipt Protocol](https://github.com/webaesbyamin/agent-receipts).

## Install

```bash
npm install @agentreceipts/schema
```

## Usage

```typescript
import { ActionReceipt, validate, CreateReceiptInput } from '@agentreceipts/schema'

// Validate a receipt object
const result = validate(ActionReceipt, someObject)
if (result.success) {
  console.log('Valid receipt:', result.data.receipt_id)
} else {
  console.log('Invalid:', result.error)
}

// Validate create input
const input = validate(CreateReceiptInput, {
  action: 'generate_report',
  input_hash: 'sha256:abc123...',
})
```

## Schemas

| Schema | Description |
|--------|-------------|
| `ActionReceipt` | Full receipt with all fields |
| `SignablePayload` | Deterministic fields used for signing |
| `CreateReceiptInput` | Input for creating a new receipt |
| `CompleteReceiptInput` | Input for completing a pending receipt |
| `VerifyResponse` | Response from verification |
| `ListReceiptsQuery` | Query parameters for listing receipts |
| `PaginationMeta` | Pagination metadata |
| `ErrorResponse` | Structured error response |

## Enums

| Enum | Values |
|------|--------|
| `ReceiptStatus` | `pending`, `completed`, `failed`, `timeout` |
| `ReceiptType` | `action` |
| `Environment` | `development`, `staging`, `production` |
| `ErrorCode` | `VALIDATION_ERROR`, `NOT_FOUND`, `VERIFICATION_FAILED`, `INTERNAL_ERROR` |

## Utilities

- `validate(schema, data)` — Validate data against any schema, returns `{ success, data?, error? }`
- `formatZodError(error)` — Format a Zod error into a human-readable string
- `createErrorResponse(code, message)` — Create a structured error response

## JSON Schema

The package includes `receipt.schema.json` for non-TypeScript consumers. This is auto-generated from the Zod schemas.

## License

MIT
