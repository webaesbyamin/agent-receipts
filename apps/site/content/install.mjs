// The install guide, per OS. Every command here must also appear, character
// for character, in packages/magic-folder/README.md, which CI follows on
// clean Mac, Windows and Linux machines (.github/workflows/install.yml).
// `node scripts/check-guide.mjs` (the site's test) enforces that.
//
// `body`, `check` and `note` are trusted HTML written here.

const RUN_FLAGS = [
  '<code>--engine ollama</code> runs jobs on Ollama, free, on your computer.',
  '<code>--issuer "Your Business"</code> is the name printed on your receipts. Use your own.',
  '<code>--key-url</code> and <code>--verify-url</code> are only for when you host your own verify page. <a href="https://github.com/webaesbyamin/agent-receipts/tree/main/packages/magic-folder#who-signed-it">How that works</a>.',
]

export const OSES = [
  {
    id: 'mac',
    name: 'Mac',
    terminal: 'Terminal (in Applications → Utilities)',
    lang: 'bash',
    steps: [
      {
        title: 'Install Node 24',
        body: 'Magic Folder runs on Node.js. Use version 24: newer versions such as 26 aren’t supported yet, and the “LTS” download on nodejs.org is now 26. With <a href="https://brew.sh">Homebrew</a>:',
        code: `brew install node@24
echo 'export PATH="$(brew --prefix node@24)/bin:$PATH"' >> ~/.zshrc`,
        after: 'Then close Terminal and open it again.',
        check: '<code>node -v</code> prints <code>v24.</code> and a number.',
        note: 'No Homebrew? Download the <code>.pkg</code> file from <a href="https://nodejs.org/dist/latest-v24.x/">nodejs.org/dist/latest-v24.x</a> and open it.',
      },
      {
        title: 'Install Ollama, the free local AI',
        body: 'Download <a href="https://ollama.com/download/mac">Ollama for Mac</a>, move it to Applications and open it. Then get the model (about 5 GB):',
        code: 'ollama pull qwen3:8b',
        check: '<code>ollama list</code> shows <code>qwen3:8b</code>.',
      },
      {
        title: 'Install Magic Folder',
        code: 'npm install -g @agent-receipts/magic-folder',
        check: '<code>magic-folder --help</code> lists the commands.',
        note: 'If you installed Node with the <code>.pkg</code> and see <code>EACCES</code>, run the same command with <code>sudo </code> in front.',
      },
      {
        title: 'Create your Magic Folder',
        code: 'magic-folder init ~/"Magic Folder"',
        check: 'It prints <code>Magic Folder ready</code>, and a <em>Magic Folder</em> appears in your home folder with six job folders.',
      },
      {
        title: 'Check everything',
        code: 'magic-folder doctor',
        check: 'Node, Ollama and <code>qwen3:8b</code> each have a ✓.',
      },
      {
        title: 'Start it',
        code: 'magic-folder run ~/"Magic Folder" --engine ollama --issuer "Your Business"',
        check: 'It prints <code>Watching …</code>. Leave the window open and drop a file into <em>Fix typos</em>.',
        list: RUN_FLAGS,
      },
    ],
    keep: {
      intro: 'To start Magic Folder every time you log in, and restart it if it stops, paste this into Terminal. Change <code>Your Business</code> first.',
      code: `mkdir -p ~/Library/LaunchAgents
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
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.agent-receipts.magic-folder.plist`,
      check: '<code>tail ~/Library/Logs/magic-folder.log</code> shows <code>Watching …</code>. The Ollama app starts at login by itself.',
      controls: [
        ['Stop', 'launchctl bootout gui/$(id -u)/com.agent-receipts.magic-folder'],
        ['Start again', 'launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.agent-receipts.magic-folder.plist'],
        ['Remove', 'launchctl bootout gui/$(id -u)/com.agent-receipts.magic-folder; rm ~/Library/LaunchAgents/com.agent-receipts.magic-folder.plist'],
      ],
      alt: {
        intro: 'Prefer to start it yourself? This puts a <em>Start Magic Folder</em> launcher on your Desktop. Double-click it to start; it won’t start a second copy.',
        code: `cat > ~/Desktop/"Start Magic Folder.command" <<EOF
#!/bin/sh
if pgrep -f "magic-folder/dist/cli.js run" >/dev/null; then echo "Already running in the background."; exit 0; fi
echo "Magic Folder is running. Leave this window open."
exec "$(command -v node)" "$(npm root -g)/@agent-receipts/magic-folder/dist/cli.js" run "\\$HOME/Magic Folder" --engine ollama --issuer "Your Business"
EOF
chmod +x ~/Desktop/"Start Magic Folder.command"`,
      },
    },
  },
  {
    id: 'windows',
    name: 'Windows',
    terminal: 'PowerShell (Start menu → type “PowerShell”)',
    lang: 'powershell',
    steps: [
      {
        title: 'Install Node 24',
        body: 'Magic Folder runs on Node.js. Use version 24: newer versions such as 26 aren’t supported yet, and the “LTS” download on nodejs.org is now 26. Download the Windows installer (<code>node-v24.…-x64.msi</code>) from <a href="https://nodejs.org/dist/latest-v24.x/">nodejs.org/dist/latest-v24.x</a>, run it and keep the defaults. Then open a <strong>new</strong> PowerShell window.',
        check: '<code>node -v</code> prints <code>v24.</code> and a number.',
      },
      {
        title: 'Install Ollama, the free local AI',
        body: 'Download <a href="https://ollama.com/download/windows">Ollama for Windows</a> and run <code>OllamaSetup.exe</code>, or in PowerShell (the model is about 5 GB):',
        code: `irm https://ollama.com/install.ps1 | iex
ollama pull qwen3:8b`,
        check: '<code>ollama list</code> shows <code>qwen3:8b</code>.',
      },
      {
        title: 'Install Magic Folder',
        code: 'npm install -g @agent-receipts/magic-folder',
        check: '<code>magic-folder --help</code> lists the commands.',
        note: 'If PowerShell says <em>running scripts is disabled on this system</em>, run <code>Set-ExecutionPolicy -Scope CurrentUser RemoteSigned</code>, answer <code>Y</code>, and try again.',
      },
      {
        title: 'Create your Magic Folder',
        code: 'magic-folder init "$HOME\\Magic Folder"',
        check: 'It prints <code>Magic Folder ready</code>, and a <em>Magic Folder</em> appears in your user folder with six job folders.',
      },
      {
        title: 'Check everything',
        code: 'magic-folder doctor',
        check: 'Node, Ollama and <code>qwen3:8b</code> each have a ✓.',
      },
      {
        title: 'Start it',
        code: 'magic-folder run "$HOME\\Magic Folder" --engine ollama --issuer "Your Business"',
        check: 'It prints <code>Watching …</code>. Leave the window open and drop a file into <em>Fix typos</em>.',
        list: RUN_FLAGS,
      },
    ],
    keep: {
      intro: 'To start Magic Folder each time you log on, paste this into PowerShell. It puts a small starter in your Startup folder that opens Magic Folder in a minimised window. Change <code>Your Business</code> first.',
      code: `$startup = [Environment]::GetFolderPath('Startup')
Set-Content -Path "$startup\\Start Magic Folder.bat" -Encoding ASCII -Value @'
@echo off
if not "%~1"=="min" (start "Magic Folder" /min "%~f0" min & exit /b)
powershell -NoProfile -Command "if (Get-CimInstance Win32_Process -Filter \\"Name='node.exe'\\" | Where-Object { $_.CommandLine -like '*magic-folder*run*' }) { exit 1 }"
if errorlevel 1 (echo Already running. & timeout /t 5 >nul & exit /b)
echo Magic Folder is running. Leave this window open.
magic-folder run "%USERPROFILE%\\Magic Folder" --engine ollama --issuer "Your Business"
'@
Start-Process "$startup\\Start Magic Folder.bat"`,
      check: 'A minimised <em>Magic Folder</em> window is in the taskbar and says <code>Watching …</code>. Ollama starts at log on by itself.',
      controls: [
        ['Stop', 'Close the “Magic Folder” window'],
        ['Start again', 'Start-Process "$([Environment]::GetFolderPath(\'Startup\'))\\Start Magic Folder.bat"'],
        ['Remove', 'Remove-Item "$([Environment]::GetFolderPath(\'Startup\'))\\Start Magic Folder.bat"'],
      ],
    },
  },
  {
    id: 'linux',
    name: 'Linux',
    terminal: 'a terminal',
    lang: 'bash',
    steps: [
      {
        title: 'Install Node 24',
        body: 'Magic Folder runs on Node.js. Use version 24: newer versions such as 26 aren’t supported yet. The easiest way is <a href="https://github.com/nvm-sh/nvm">nvm</a>:',
        code: 'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash',
        after: 'Close the terminal and open it again, then:',
        code2: 'nvm install 24',
        check: '<code>node -v</code> prints <code>v24.</code> and a number.',
      },
      {
        title: 'Install Ollama, the free local AI',
        body: 'From <a href="https://ollama.com/download/linux">ollama.com</a> (the model is about 5 GB):',
        code: `curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen3:8b`,
        check: '<code>ollama list</code> shows <code>qwen3:8b</code>.',
      },
      {
        title: 'Install Magic Folder',
        code: 'npm install -g @agent-receipts/magic-folder',
        check: '<code>magic-folder --help</code> lists the commands.',
      },
      {
        title: 'Create your Magic Folder',
        code: 'magic-folder init ~/"Magic Folder"',
        check: 'It prints <code>Magic Folder ready</code>, and a <em>Magic Folder</em> appears in your home folder with six job folders.',
      },
      {
        title: 'Check everything',
        code: 'magic-folder doctor',
        check: 'Node, Ollama and <code>qwen3:8b</code> each have a ✓.',
      },
      {
        title: 'Start it',
        code: 'magic-folder run ~/"Magic Folder" --engine ollama --issuer "Your Business"',
        check: 'It prints <code>Watching …</code>. Leave the terminal open and drop a file into <em>Fix typos</em>.',
        list: RUN_FLAGS,
      },
    ],
    keep: {
      intro: 'To run Magic Folder in the background as a systemd user service, paste this. Change <code>Your Business</code> first.',
      code: `mkdir -p ~/.config/systemd/user
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
systemctl --user enable --now magic-folder`,
      check: '<code>systemctl --user status magic-folder</code> says <code>active (running)</code>. To keep it running while you’re logged out too: <code>sudo loginctl enable-linger $USER</code>.',
      controls: [
        ['Logs', 'journalctl --user -u magic-folder -f'],
        ['Stop', 'systemctl --user stop magic-folder'],
        ['Start again', 'systemctl --user start magic-folder'],
        ['Remove', 'systemctl --user disable --now magic-folder; rm ~/.config/systemd/user/magic-folder.service'],
      ],
    },
  },
]

export const TROUBLE = [
  ['“magic-folder: command not found”', 'Open a new terminal window. If it’s still missing, check that <code>node -v</code> works; if it does, run the install command again.'],
  ['Wrong Node version', '<code>node -v</code> shows lower than 22.16, or 27 or higher: install Node 24 as above. On a Mac with Homebrew, make sure the <code>export PATH=…node@24…</code> line is in <code>~/.zshrc</code> and open a new window.'],
  ['doctor says Ollama is not reachable', 'Start the Ollama app (Mac, Windows) or run <code>ollama serve</code> (Linux), then <code>ollama pull qwen3:8b</code>.'],
  ['Nothing happens when I drop a file', 'Magic Folder must be running: <code>magic-folder run …</code> in an open window, or the start-at-login setup. Files are picked up a few seconds after they stop changing. Drop into a job folder such as <em>Fix typos</em>, not into the top folder.'],
]

export const UNINSTALL = {
  code: 'npm uninstall -g @agent-receipts/magic-folder',
  body: 'Remove the start-at-login setup first (see “Keep it running”). Your <em>Magic Folder</em>, with its results and receipts, and your signing key in <code>~/.agent-receipts/magic-folder</code> (Windows: <code>%USERPROFILE%\\.agent-receipts\\magic-folder</code>) stay until you delete them yourself.',
}
