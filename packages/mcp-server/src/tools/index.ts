import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ReceiptEngine } from '../engine/receipt-engine.js'
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

export function registerAllTools(server: McpServer, engine: ReceiptEngine): void {
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
}
