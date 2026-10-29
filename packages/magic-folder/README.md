# @agent-receipts/magic-folder

**Drop a file in a folder. Get the work back with a receipt anyone can check.**

Magic Folder is Agent Receipts for people who don't code. Each subfolder is a job ("Write product descriptions", "Fix typos"). Drop a file in, an AI agent does the job, and the result lands in `Done/` with your untouched original and a one-page `receipt.html`: what went in, what came out, how long it took, what it cost, and a seal that breaks if anything is changed afterwards.

```
Magic Folder/
  Write product descriptions/   drop a product photo or details
  Fix typos/                    drop a .txt / .md / .html / .csv
  Meeting notes to tasks/       drop notes or a transcript
  Image alt text and SEO/       drop images
  Draft a client email/         drop rough notes (needs your OK)
  Ask anything/                 drop files + a note.txt
  Done/                         results + receipt.html per job
  Needs your OK/                drafts waiting for approval
```

## Quick start

```bash
npm install -g @agent-receipts/magic-folder @anthropic-ai/claude-agent-sdk
export ANTHROPIC_API_KEY=sk-ant-...

magic-folder init ~/"Magic Folder"
magic-folder run ~/"Magic Folder" --issuer "Your Studio"
```

Drop a file into any job folder and leave it. A `… - working.txt` note appears while it runs.

API keys only: Anthropic doesn't allow third-party products to use claude.ai logins.

## Why the receipts are trustworthy

The point of a receipt is that the agent doesn't write it.

- **The runner writes the receipt, not the agent.** The runner moves the drop into an isolated job folder, runs the agent, then hashes the input and output files itself. Token counts and cost come from the API's result message, not from the agent.
- **Every field is signed** (receipt format v2): the summary, cost, model, file fingerprints, recipe, credits, the issuer and the failure reason. Change one character and the seal breaks.
- **Every job links to the one before it** (`prev_receipt_hash`), so removing or editing a receipt in the middle of a folder's history is detectable with `agent-receipts verify-chain`.
- **The agent is fenced in.** A PreToolUse hook checks every tool call before any permission rule: only the recipe's tools (read, write, edit, search; never a shell or the web), every path inside its job folder after resolving symlinks, search patterns can't climb out, and writes go only into `output/`. Nothing is pre-approved. There's a hard time limit and a spend cap per recipe.
- **Its own key.** Magic Folder signs with `~/.agent-receipts/magic-folder`, separate from the MCP server's key, so agents using the MCP tools can't mint receipts that look like jobs.
- **What you read is what was signed.** `receipt.html` renders every visible word from the signed record in the browser.

### Who signed it

A receipt file carries its own public key, so on its own it can only prove it hasn't been changed. Anyone could sign a fake with their own key. So the file's seal says **"Unchanged since signing"**, never "Verified".

**Verified** comes from a verify page that knows your key:

```bash
magic-folder key                       # prints your key id + public key to publish
magic-folder verify-page verify.html --trust-key key_… --trust-name "Your Studio" --title "Verify a Your Studio receipt"
```

Host that page (e.g. `yourstudio.com/verify`) and give clients the link. Receipts signed by your key show green **Verified, signed by Your Studio**. Anything signed by another key shows red. The generic page in [apps/verify](../../apps/verify) shows amber "signer not confirmed" until someone enters a key (or opens it as `…/verify?key=key_…`). On the command line: `magic-folder verify receipt.html --key-id key_…`.

## Recipes

A recipe is a folder with a hidden `.recipe.md`:

```markdown
---
credits: 1
tools: Read, Write
max_minutes: 5
max_cost_usd: 0.50
needs_approval: false
model: <model id>   # optional
---
Write a product description for each input file...
```

| Field | Default | Meaning |
| --- | --- | --- |
| `credits` | 1 | What a successful job costs. Failed jobs cost 0. |
| `tools` | Read, Write | Any of Read, Write, Edit, Glob, Grep. Nothing else is accepted. |
| `max_minutes` | 5 | Hard time limit |
| `max_cost_usd` | 0.50 | Spend cap passed to the Agent SDK |
| `needs_approval` | false | Results wait in `Needs your OK/`; moving the job to `Done/` signs an approval receipt |

A broken recipe never runs: the folder gets a `Recipe problem.txt` explaining why, and files dropped there are left alone.

## How a job runs

Results land in `Done/<job>/result/`, your original in `Done/<job>/original/`. Nothing is ever overwritten. A job journal lets a crash finish delivery (or put the drop back to run again) on the next start.

1. Files in a job folder are picked up once they stop changing (3 s by default), so a batch dropped together is one job. Partial downloads, hidden files and Office lock files are ignored.
2. They move into `.magic/jobs/<job>/input/` at once, so nothing runs twice.
3. The agent works in that folder and writes into `output/`.
4. The runner hashes outputs, signs the receipt, and delivers `result/`, `original/`, `receipt.json` and `receipt.html`.
5. A failed job (error, time limit, spend cap, or no files produced) still gets a signed receipt that says why, delivers only the original, and costs nothing.

## About cost

`cost_usd` is the Agent SDK's client-side estimate, and receipts label it as an estimate. Anthropic recommends not billing end users from it. Charge in credits per recipe, and use the estimates to set the credit price.

## Keys

Receipts and the signing key live in `~/.agent-receipts/magic-folder` (change with `--data-dir`). Keep that directory **off** shared or synced drives: the folder can live on Google Drive or Dropbox, but the key must not.

## Library use

```ts
import { MagicFolder, ClaudeExecutor } from '@agent-receipts/magic-folder'

const folder = new MagicFolder('/path/to/Magic Folder', {
  executor: new ClaudeExecutor(),
  issuer: { name: 'Webaes', keyUrl: 'https://webaes.com/.well-known/agent-receipts.json' },
  onEvent: (e) => console.log(e),
})
await folder.start()
```

Any object with `run(job) => Promise<ExecResult>` can be an executor.
