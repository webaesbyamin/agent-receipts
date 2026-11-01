// Storage
export { SqliteReceiptStore as ReceiptStore } from './storage/sqlite-receipt-store.js'
export { SqliteReceiptStore } from './storage/sqlite-receipt-store.js'
export { ReceiptStore as JsonReceiptStore } from './storage/receipt-store.js'
export { KeyManager } from './storage/key-manager.js'
export { ConfigManager } from './storage/config-manager.js'

// Memory
export { MemoryStore } from './storage/memory-store.js'
export { openDatabase, assertSupportedNode, isSupportedNode, unsupportedNodeMessage, MIN_NODE } from './storage/sqlite-driver.js'
export type { SqlDatabase, SqlStatement } from './storage/sqlite-driver.js'
export type { SearchResult, ProvenanceChain, MemoryRecallResult } from './storage/memory-store.js'

// Engine
export { ReceiptEngine, verifyChainReceipts } from './engine/receipt-engine.js'
export { MemoryEngine } from './engine/memory-engine.js'
export type {
  ObserveParams, ObserveResult, RecallParams, RecallResult,
  ForgetParams, RelateParams, MergeParams, AuditParams,
  AuditReport, TimelineEntry, ContextParams, ContextResult,
  ExportBundleParams, ImportBundleResult,
} from './engine/memory-engine.js'
export type { TrackParams, CreateParams, CompleteParams, ChainVerification } from './engine/receipt-engine.js'
export { evaluateConstraints } from './engine/constraint-evaluator.js'
export { validateJsonSchema } from './engine/json-schema-validator.js'

// Invoice
export { generateInvoice } from './engine/invoice.js'
export type { InvoiceOptions, InvoiceLineItem, InvoiceGroup, InvoiceSummary, Invoice } from './engine/invoice.js'
export { formatInvoiceJSON, formatInvoiceCSV, formatInvoiceMarkdown, formatInvoiceHTML } from './engine/invoice-formatters.js'

// Seed
export { seedDemoData } from './engine/seed.js'
export type { SeedOptions } from './engine/seed.js'

// Hash utility
export { hashData } from './hash.js'

// Types
export type { StorageConfig, AppConfig, ReceiptFilter, PaginatedResult } from './types.js'
