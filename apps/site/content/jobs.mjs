// Plain-words "drop in / you get" for each starter job, and a short "you get"
// for the printed listing on the home page. The job names and the
// recipe text on the page come from STARTER_RECIPES at build time;
// scripts/generate.mjs fails the build if this list and the recipes differ.
export const JOBS = {
  'Write product descriptions': {
    short: 'title, 5 bullets, SEO title + meta',
    in: 'A product photo, or a text or spreadsheet file with the product’s details.',
    out: 'A description with a title, five feature bullets, an SEO title and a meta description, written from the real details only.',
    note: 'Photos need Claude, or an Ollama model that can see images.',
  },
  'Fix typos': {
    short: 'a corrected copy + a list of every change',
    in: 'A .txt, .md, .html or .csv file.',
    out: 'A corrected copy, plus changes.md listing every change. Magic Folder writes that list itself by comparing the two files, so it can’t include a change that wasn’t made.',
  },
  'Meeting notes to tasks': {
    short: 'decisions, tasks, open questions',
    in: 'Meeting notes or a transcript, as text.',
    out: 'tasks.md: what was decided, a task checklist (owners and dates only where the notes say them) and the open questions.',
  },
  'Image alt text and SEO': {
    short: 'alt text, file name + caption per image',
    in: 'Images for your website or shop.',
    out: 'alt-text.csv with alt text, a suggested file name and a caption for each image.',
    note: 'Needs Claude, or an Ollama model that can see images.',
  },
  'Draft a client email': {
    short: 'subject + email, waits for your OK',
    in: 'Rough notes about what you need to tell a client.',
    out: 'email.md: a subject line and a short, friendly email covering every point. It waits in “Needs your OK” until you approve it.',
  },
  'Ask anything': {
    short: 'the files your note asks for',
    in: 'Your files, plus a note.txt saying what you want done with them.',
    out: 'The results as files you can open (.md, .txt or .csv), or a question back if the note isn’t clear.',
  },
}
