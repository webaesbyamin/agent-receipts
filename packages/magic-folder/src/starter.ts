import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { RECIPE_FILE } from './recipe.js'
import { DONE_DIR, APPROVAL_DIR, NOTE_FILE } from './runner.js'
import { exists } from './files.js'

/**
 * Starter recipes. Each is a real, narrow job taken from agency work.
 * Text formats only for editing recipes (the agent's tools read and write
 * files; they don't edit .docx or .pdf in place).
 */
export const STARTER_RECIPES: Record<string, string> = {
  'Write product descriptions': `---
credits: 1
tools: Read, Write
max_minutes: 5
max_cost_usd: 0.50
needs_approval: false
---
Each input file describes one product: a product photo, or a text, markdown or CSV file with product details.

For each product, write one markdown file named "<product name> - description.md" containing:
1. A product title.
2. A 80 to 120 word description in a warm, premium, plain-spoken voice. No hype words ("amazing", "revolutionary"), no emoji.
3. Five short feature bullets.
4. An SEO title of 60 characters or fewer.
5. A meta description of 155 characters or fewer.

Write the SEO title and meta description from the product's real details only: no filler phrases such as "perfect for any home or office".

Only state facts you can see in the photo or read in the file. If something important is unknown (material, size, price), leave it out rather than guessing, and list what was missing at the end under "Missing details".
`,
  'Fix typos': `---
credits: 1
tools: Read, Write
max_minutes: 5
max_cost_usd: 0.40
needs_approval: false
---
Fix spelling, grammar and punctuation in each input file. Keep the author's wording, tone and formatting; do not rewrite sentences that are already correct.

Works on plain text formats: .txt, .md, .html, .csv. For each one, write the corrected copy with the same name plus " (fixed)" before the extension, and a file "changes.md" listing every change, one per line, as "before -> after" (no heading line). Never list a line whose before and after are the same: that is not a change. Before finishing, compare the corrected copy with the original line by line and make sure changes.md lists every single change, and nothing you didn't change.

If a file is not plain text (for example .docx or .pdf), don't change it. Instead add a line to changes.md saying it needs to be saved as .txt or .md first.
`,
  'Meeting notes to tasks': `---
credits: 1
tools: Read, Write
max_minutes: 5
max_cost_usd: 0.40
needs_approval: false
---
The input is meeting notes or a transcript. Write "tasks.md" with:
1. A one-paragraph summary of what was decided.
2. A checklist of tasks as "- [ ] task — owner — due date". Use the owner and date only if the notes say them; otherwise write "owner?" or "date?".
3. Open questions nobody answered.

Do not invent tasks, owners or dates that are not in the notes.
`,
  'Image alt text and SEO': `---
credits: 1
tools: Read, Write
max_minutes: 5
max_cost_usd: 0.50
needs_approval: false
---
The inputs are images for a website or store. Look at each one and write "alt-text.csv" with the columns: file, alt_text, suggested_file_name, caption.

- alt_text: 125 characters or fewer, describes what is in the image for someone who can't see it. Don't start with "Image of".
- suggested_file_name: lowercase, words joined by hyphens, keeps the original extension.
- caption: one short sentence suitable under the image.

Describe only what is visible. Don't guess brand names or people's identities.
`,
  'Draft a client email': `---
credits: 1
tools: Read, Write
max_minutes: 5
max_cost_usd: 0.40
needs_approval: true
---
The input is rough notes about what needs to be said to a client. Write "email.md" with a subject line and a clear, friendly, professional email that covers every point in the notes, in the same order of importance.

Keep it short. Don't promise dates, prices or deliverables that the notes don't state. End with one clear next step.

This recipe needs approval: the draft waits in "Needs your OK" until someone moves it to "Done".
`,
  'Ask anything': `---
credits: 2
tools: Read, Write
max_minutes: 10
max_cost_usd: 1.00
needs_approval: false
---
Do what the note asks, using the dropped files as the material. Put every result in the output folder as files a non-technical person can open (.md, .txt or .csv).

If the note is missing or unclear, write "question.md" explaining what you need instead of guessing.
`,
}

const HOW_IT_WORKS = `HOW THIS FOLDER WORKS

1. Drop a file into the folder named after the job you want done.
   For "Ask anything", also drop a ${NOTE_FILE} saying what you want.
2. A "... - working.txt" file appears while the job runs.
3. The result shows up in "${DONE_DIR}", in its own folder, with:
   - the result files
   - your original, untouched, in "original"
   - receipt.html: open it to see what was done, how long it took,
     and a seal that proves nothing was changed afterwards.
4. Some jobs (like client emails) land in "${APPROVAL_DIR}" first.
   Check them, then move the folder into "${DONE_DIR}" to approve.
   The approval gets its own signed receipt.

A job that fails says why on its receipt and costs nothing.

To add your own job: duplicate a job folder, rename it, and edit the hidden
${RECIPE_FILE} file inside (show hidden files: Cmd+Shift+. on a Mac).
`

/** Create a Magic Folder with the starter recipes. Never overwrites an existing recipe. */
export async function initMagicFolder(root: string, recipes: Record<string, string> = STARTER_RECIPES): Promise<string[]> {
  const created: string[] = []
  await mkdir(join(root, DONE_DIR), { recursive: true })
  await mkdir(join(root, APPROVAL_DIR), { recursive: true })
  for (const [name, body] of Object.entries(recipes)) {
    const dir = join(root, name)
    await mkdir(dir, { recursive: true })
    const file = join(dir, RECIPE_FILE)
    if (!(await exists(file))) {
      await writeFile(file, body)
      created.push(name)
    }
  }
  const readme = join(root, 'How this folder works.txt')
  if (!(await exists(readme))) await writeFile(readme, HOW_IT_WORKS)
  return created
}
