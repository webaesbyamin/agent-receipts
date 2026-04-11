import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'
import type { MemoryEngine } from '../engine/memory-engine.js'
import type { MemoryStore } from '../storage/memory-store.js'
import { registerCreateReceipt } from './create-receipt.js'
import { registerCompleteReceipt } from './complete-receipt.js'
import { registerTrackAction } from './track-action.js'
import { registerVerifyReceipt } from './verify-receipt.js'
import { registerGetReceipt } from './get-receipt.js'
import { registerListReceipts } from './list-receipts.js'
import { registerGetChain } from './get-chain.js'
import { registerGetPublicKey } from './get-public-key.js'
import { registerJudgeReceipt } from './judge-receipt.js'
import { registerCompleteJudgment } from './complete-judgment.js'
import { registerGetJudgments } from './get-judgments.js'
import { registerCleanup } from './cleanup.js'
import { registerGenerateInvoice } from './generate-invoice.js'
import { registerGetStarted } from './get-started.js'
import { registerMemoryObserve } from './memory-observe.js'
import { registerMemoryRecall } from './memory-recall.js'
import { registerMemoryForget } from './memory-forget.js'
import { registerMemoryEntities } from './memory-entities.js'
import { registerMemoryRelate } from './memory-relate.js'
import { registerMemoryProvenance } from './memory-provenance.js'
import { registerMemoryAudit } from './memory-audit.js'

export function registerAllTools(
  server: McpServer,
  engine: ReceiptEngine,
  memoryEngine?: MemoryEngine,
  memoryStore?: MemoryStore,
  agentId?: string,
): void {
  registerCreateReceipt(server, engine)
  registerCompleteReceipt(server, engine)
  registerTrackAction(server, engine)
  registerVerifyReceipt(server, engine)
  registerGetReceipt(server, engine)
  registerListReceipts(server, engine)
  registerGetChain(server, engine)
  registerGetPublicKey(server, engine)
  registerJudgeReceipt(server, engine)
  registerCompleteJudgment(server, engine)
  registerGetJudgments(server, engine)
  registerCleanup(server, engine)
  registerGenerateInvoice(server, engine)
  registerGetStarted(server, engine)

  // Memory tools
  if (memoryEngine && memoryStore && agentId) {
    registerMemoryObserve(server, memoryEngine, agentId)
    registerMemoryRecall(server, memoryEngine, agentId)
    registerMemoryForget(server, memoryEngine, agentId)
    registerMemoryEntities(server, memoryStore)
    registerMemoryRelate(server, memoryEngine, agentId)
    registerMemoryProvenance(server, memoryEngine)
    registerMemoryAudit(server, memoryEngine)
  }
}
