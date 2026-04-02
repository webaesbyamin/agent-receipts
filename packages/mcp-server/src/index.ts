// Storage
export { SqliteReceiptStore as ReceiptStore } from './storage/sqlite-receipt-store.js'
export { SqliteReceiptStore } from './storage/sqlite-receipt-store.js'
export { ReceiptStore as JsonReceiptStore } from './storage/receipt-store.js'
export { KeyManager } from './storage/key-manager.js'
export { ConfigManager } from './storage/config-manager.js'

// Engine
export { ReceiptEngine } from './engine/receipt-engine.js'
export type { TrackParams, CreateParams, CompleteParams } from './engine/receipt-engine.js'
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
