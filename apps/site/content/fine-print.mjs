// The home page's FINE PRINT, and the FAQPage JSON-LD built from it, so the
// two can never say different things. Answers are trusted HTML written here.

export const FINE_PRINT = [
  ['Is my data sent anywhere?', 'Not with Ollama: the AI runs on your computer, and your files stay in your Magic Folder. If you choose Claude instead, the files for that job are sent to Anthropic’s API with your own key. Checking a receipt, here or on a verify page, happens in your browser; nothing is uploaded. This website counts page views with Vercel Web Analytics (no cookies, no personal data). Magic Folder and the receipt checker send nothing.'],
  ['What if a job fails?', 'You still get a signed receipt that says why it failed, your original comes back untouched in <em>Done</em>, and the job costs nothing.'],
  ['Which computers?', 'Mac, Windows and Linux, with Node.js 22 or 24. The <a href="/install" data-install-link>install guide</a> walks through each one.'],
  ['Do I need a subscription?', 'No. With Ollama, a free program, jobs run on your own computer. Claude is optional, with your own Anthropic API key.'],
  ['What does it cost?', 'Nothing. Magic Folder and Agent Receipts are free and open source under the MIT licence.'],
  ['Where do I get help?', 'Open an issue on <a href="https://github.com/webaesbyamin/agent-receipts/issues">GitHub</a>.'],
  ['Who holds my waitlist email?', 'Buttondown, which sends the confirmation and, if it gets built, the one email saying so. See the <a href="https://webaes.com/privacy-policy">webaes.com privacy policy</a>.'],
]

/** The answer as plain text, for structured data. */
export const plain = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
