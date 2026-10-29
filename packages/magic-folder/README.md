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

## Install

Magic Folder runs on Mac, Windows and Linux. It needs **Node.js 22 or 24** (24 recommended). Its database driver (better-sqlite3) has ready-made builds for those; on Node 20 (end-of-life) or Node 26 it would have to compile from source, which needs developer tools most computers don't have. Note that nodejs.org's "LTS" download is now Node 26, so pick 24 explicitly.

For free local jobs you also need [Ollama](https://ollama.com) with a model (`qwen3:8b`, about 5 GB). For Claude instead, see [Use Claude](#use-claude-optional).

How this is tested: every step below except installing Ollama and its model runs automatically on clean Mac, Windows and Linux machines on each change (Node, the install command, `init`, `doctor`, a job and its signed receipt, keeping it running, uninstall). Ollama is too large for those machines, so jobs that use it are tested by hand on a Mac.

### Mac

1. **Install Node 24.** With [Homebrew](https://brew.sh):

   ```bash
   brew install node@24
   echo 'export PATH="$(brew --prefix node@24)/bin:$PATH"' >> ~/.zshrc
   ```

   Close Terminal and open it again. Check: `node -v` prints `v24.…`.
   Without Homebrew: download the `.pkg` from [nodejs.org/dist/latest-v24.x](https://nodejs.org/dist/latest-v24.x/) and open it.

2. **Install Ollama** (free local AI). Download [Ollama for Mac](https://ollama.com/download/mac), open it and move it to Applications, then start it. Then get the model:

   ```bash
   ollama pull qwen3:8b
   ```

   Check: `ollama list` shows `qwen3:8b`.

3. **Install Magic Folder.**

   ```bash
   npm install -g --allow-scripts=better-sqlite3 @agent-receipts/magic-folder
   ```

   If you installed Node with the `.pkg` and see `EACCES`, run it again with `sudo ` in front. Check: `magic-folder --help` prints the commands.

4. **Create your folder, check, and start.**

   ```bash
   magic-folder init ~/"Magic Folder"
   magic-folder doctor
   magic-folder run ~/"Magic Folder" --engine ollama --issuer "Your Business"
   ```

   `doctor` should show Node, Ollama and `qwen3:8b` with a ✓. Leave the window open while it runs.

### Windows

1. **Install Node 24.** Download the Windows installer (`node-v24.…-x64.msi`) from [nodejs.org/dist/latest-v24.x](https://nodejs.org/dist/latest-v24.x/), run it and keep the defaults. Open a **new** PowerShell window (Start menu → type "PowerShell"). Check: `node -v` prints `v24.…`.

2. **Install Ollama.** Download [Ollama for Windows](https://ollama.com/download/windows) and run `OllamaSetup.exe`, or in PowerShell:

   ```powershell
   irm https://ollama.com/install.ps1 | iex
   ollama pull qwen3:8b
   ```

   Check: `ollama list` shows `qwen3:8b`.

3. **Install Magic Folder.**

   ```powershell
   npm install -g --allow-scripts=better-sqlite3 @agent-receipts/magic-folder
   ```

   If PowerShell says *running scripts is disabled on this system*, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, answer `Y`, and try again. Check: `magic-folder --help` prints the commands.

4. **Create your folder, check, and start.**

   ```powershell
   magic-folder init "$HOME\Magic Folder"
   magic-folder doctor
   magic-folder run "$HOME\Magic Folder" --engine ollama --issuer "Your Business"
   ```

### Linux

1. **Install Node 24** with [nvm](https://github.com/nvm-sh/nvm):

   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash
   ```

   Close the terminal and open it again, then:

   ```bash
   nvm install 24
   ```

   Check: `node -v` prints `v24.…`.

2. **Install Ollama** ([ollama.com/download/linux](https://ollama.com/download/linux)):

   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ollama pull qwen3:8b
   ```

3. **Install Magic Folder.**

   ```bash
   npm install -g --allow-scripts=better-sqlite3 @agent-receipts/magic-folder
   ```

4. **Create your folder, check, and start.**

   ```bash
   magic-folder init ~/"Magic Folder"
   magic-folder doctor
   magic-folder run ~/"Magic Folder" --engine ollama --issuer "Your Business"
   ```

### The run command

- `--engine ollama` runs jobs on Ollama, free, on your computer. Without it, jobs use Claude.
- `--issuer "Your Business"` is the name printed on your receipts.
- `--key-url` and `--verify-url` are only for when you host your own verify page (see [Who signed it](#who-signed-it)).

Drop a file into any job folder and leave it. A `… - working.txt` note appears while it runs, and the result lands in `Done`.

About `--allow-scripts=better-sqlite3`: npm 11 asks you to approve packages that run an install script. This approves the one Magic Folder needs (it fetches the SQLite driver's ready-made build). Older npm ignores the flag.

### Keep it running

#### Mac: start at login

This writes a LaunchAgent that starts Magic Folder when you log in and restarts it if it stops. Change `Your Business` first.

```bash
mkdir -p ~/Library/LaunchAgents
cat > ~/Library/LaunchAgents/com.agent-receipts.magic-folder.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.agent-receipts.magic-folder</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(command -v node)</string>
    <string>$(npm root -g)/@agent-receipts/magic-folder/dist/cli.js</string>
    <string>run</string>
    <string>$HOME/Magic Folder</string>
    <string>--engine</string><string>ollama</string>
    <string>--issuer</string><string>Your Business</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/magic-folder.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/magic-folder.log</string>
</dict>
</plist>
EOF
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.agent-receipts.magic-folder.plist
```

Check: `tail ~/Library/Logs/magic-folder.log` shows `Watching …`. The Ollama app starts at login by itself.

| | |
| --- | --- |
| Stop | `launchctl bootout gui/$(id -u)/com.agent-receipts.magic-folder` |
| Start again | `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.agent-receipts.magic-folder.plist` |
| Remove | `launchctl bootout gui/$(id -u)/com.agent-receipts.magic-folder; rm ~/Library/LaunchAgents/com.agent-receipts.magic-folder.plist` |

Or a double-click launcher on your Desktop instead:

```bash
cat > ~/Desktop/"Start Magic Folder.command" <<EOF
#!/bin/sh
if pgrep -f "magic-folder/dist/cli.js run" >/dev/null; then echo "Already running in the background."; exit 0; fi
echo "Magic Folder is running. Leave this window open."
exec "$(command -v node)" "$(npm root -g)/@agent-receipts/magic-folder/dist/cli.js" run "\$HOME/Magic Folder" --engine ollama --issuer "Your Business"
EOF
chmod +x ~/Desktop/"Start Magic Folder.command"
```

#### Windows: start at log on

This puts a small starter in your Startup folder, so Magic Folder opens (minimised) each time you log on. Change `Your Business` first.

```powershell
$startup = [Environment]::GetFolderPath('Startup')
Set-Content -Path "$startup\Start Magic Folder.bat" -Encoding ASCII -Value @'
@echo off
if not "%~1"=="min" (start "Magic Folder" /min "%~f0" min & exit /b)
powershell -NoProfile -Command "if (Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*magic-folder*run*' }) { exit 1 }"
if errorlevel 1 (echo Already running. & timeout /t 5 >nul & exit /b)
echo Magic Folder is running. Leave this window open.
magic-folder run "%USERPROFILE%\Magic Folder" --engine ollama --issuer "Your Business"
'@
Start-Process "$startup\Start Magic Folder.bat"
```

Check: a minimised "Magic Folder" window is in the taskbar and says `Watching …`. Ollama starts at log on by itself.

| | |
| --- | --- |
| Stop | Close the "Magic Folder" window |
| Start again | `Start-Process "$([Environment]::GetFolderPath('Startup'))\Start Magic Folder.bat"` |
| Remove | `Remove-Item "$([Environment]::GetFolderPath('Startup'))\Start Magic Folder.bat"` |

#### Linux: a systemd user service

Change `Your Business` first.

```bash
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/magic-folder.service <<EOF
[Unit]
Description=Magic Folder

[Service]
ExecStart=$(command -v node) $(npm root -g)/@agent-receipts/magic-folder/dist/cli.js run "%h/Magic Folder" --engine ollama --issuer "Your Business"
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now magic-folder
```

Check: `systemctl --user status magic-folder` says `active (running)`. To keep it running while you're logged out too: `sudo loginctl enable-linger $USER`.

| | |
| --- | --- |
| Logs | `journalctl --user -u magic-folder -f` |
| Stop | `systemctl --user stop magic-folder` |
| Start again | `systemctl --user start magic-folder` |
| Remove | `systemctl --user disable --now magic-folder; rm ~/.config/systemd/user/magic-folder.service` |

### If something goes wrong

- **`magic-folder: command not found`**: open a new terminal window. If it's still missing, check `node -v` works; if it does, run the install command again.
- **Wrong Node version** (`node -v` shows 25 or higher, or lower than 22): install Node 24 as above. On a Mac with Homebrew, make sure the `export PATH=…node@24…` line is in `~/.zshrc` and open a new window.
- **npm warns about install scripts for better-sqlite3**: use the install command with `--allow-scripts=better-sqlite3` as shown.
- **`doctor` says Ollama is not reachable**: start the Ollama app (Mac, Windows) or run `ollama serve` (Linux), then `ollama pull qwen3:8b`.
- **Nothing happens when I drop a file**: Magic Folder must be running (`magic-folder run …` in an open window, or the start-at-login setup above). Files are picked up once they stop changing, a few seconds after the copy finishes. Drop into a job folder like `Fix typos`, not into the top folder.

### Uninstall

```bash
npm uninstall -g @agent-receipts/magic-folder
```

Remove the start-at-login setup first (see above). Your `Magic Folder` (results and receipts) and the signing key in `~/.agent-receipts/magic-folder` (Windows: `%USERPROFILE%\.agent-receipts\magic-folder`) stay until you delete them yourself.

### Use Claude (optional)

For bigger jobs, Magic Folder can use Claude with your own Anthropic API key:

```bash
npm install -g @anthropic-ai/claude-agent-sdk
export ANTHROPIC_API_KEY=sk-ant-...        # Windows PowerShell: $env:ANTHROPIC_API_KEY = "sk-ant-..."
magic-folder run ~/"Magic Folder" --issuer "Your Business"
```

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

A receipt file carries its own public key, so on its own it can only prove it hasn't been changed. Anyone could sign a fake with their own key. So the file's seal says **"Unchanged since signing"** in amber, never a green "Verified".

**Verified** comes from a verify page that knows your key:

```bash
magic-folder key                       # prints your key id + public key to publish
magic-folder verify-page verify.html --trust-key <your public key> --trust-name "Your Studio" --title "Verify a Your Studio receipt"
```

Pass the public key (not just the `key_…` id) so the page can also check `receipt.json` files, which carry no key of their own. Host that page (e.g. `yourstudio.com/verify`) and give clients the link. Receipts signed by your key show green **Verified, signed by Your Studio**. Anything signed by another key shows red. The generic page in [apps/verify](../../apps/verify) shows amber "signer not confirmed" until the visitor types in the key you gave them. There's deliberately no `?key=` link option, because a link could carry an attacker's key. On the command line: `magic-folder verify receipt.html --key-id key_…`.

**A real example:** Webaes hosts its own page at [verify.webaes.com](https://verify.webaes.com), with its public key published at [verify.webaes.com/.well-known/agent-receipts.json](https://verify.webaes.com/.well-known/agent-receipts.json). Its jobs run with the issuer name, key URL and verify page set, so every receipt names Webaes and links to that page:

```bash
magic-folder run ~/"Magic Folder" --issuer "Webaes" \
  --key-url https://verify.webaes.com/.well-known/agent-receipts.json \
  --verify-url https://verify.webaes.com
```

## Run free on your own computer (Ollama)

Install [Ollama](https://ollama.com), pull a model, and jobs run locally: no API key, nothing leaves the computer, no credits used. Receipts say **Free (ran on this computer)** and name the model.

```bash
ollama pull qwen3:8b
magic-folder doctor                      # shows which models are ready and how they'll run
magic-folder run ~/"Magic Folder" --engine ollama
```

Or mix engines: keep Claude as the default and put `engine: ollama` in the recipes you want to run locally.

How local models work:
- **Tools mode** (models with tool calling, e.g. qwen3): the model reads and writes through tools Magic Folder implements itself, fenced by the same sandbox as the Claude engine.
- **JSON mode** (every other model, or `--ollama-mode json`): the files go into the prompt and the model answers with `{ summary, files }`, which the runner writes. This is the more reliable choice for small models.
- Images go only to models that can see them (`vision` in `ollama show`). PDFs and Word files need saving as .txt or .md first.

Local models are much smaller than Claude, so expect plainer writing and check results more closely.

| Flag | Default |
| --- | --- |
| `--engine claude\|ollama` | claude |
| `--ollama-model <name>` | the first installed model |
| `--ollama-host <url>` | `http://127.0.0.1:11434` (or `$OLLAMA_HOST`) |
| `--ollama-mode auto\|tools\|json` | auto |

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
| `engine` | the runner's default | `claude` or `ollama` |
| `model` | the engine's default | e.g. `qwen3:8b` for Ollama |

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
