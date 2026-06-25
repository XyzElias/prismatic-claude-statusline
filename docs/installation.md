# Installation

This guide walks you through installing the status line from scratch — no prior experience required. It takes about two minutes.

## What you need

- **[Claude Code](https://code.claude.com)** installed and working.
- **[Node.js](https://nodejs.org)** — you almost certainly already have it, since Claude Code uses it. To check, run `node --version` in a terminal. If you see a version number (anything 14 or higher), you're set.

## Where is `~/.claude`?

Throughout these docs, `~` means your **home folder**, and `~/.claude` is the hidden configuration folder Claude Code created when you first ran it.

| OS | `~/.claude` is here |
|----|---------------------|
| **macOS** | `/Users/yourname/.claude` |
| **Linux** | `/home/yourname/.claude` |
| **Windows** | `C:\Users\yourname\.claude` |

The folder name starts with a dot, which makes it hidden by default. You can always reach it by typing the path into your file manager's address bar, or by using a terminal.

## Step 1 — Download `statusline.js`

Save [`statusline.js`](../statusline.js) into your `~/.claude` folder.

**macOS / Linux / Git Bash:**

```bash
curl -fsSL https://raw.githubusercontent.com/XyzElias/prismatic-claude-statusline/main/statusline.js -o ~/.claude/statusline.js
```

**Windows PowerShell:** in PowerShell, `curl` is an alias for `Invoke-WebRequest` and does **not** understand the `-fsSL` flags (you'll see `Es wurde kein Parameter gefunden, der dem Parameternamen "fsSL" entspricht` / `A parameter cannot be found that matches parameter name 'fsSL'`). Use the real curl via `curl.exe`, or the native command:

```powershell
# Option A — real curl (bundled with Windows 10/11)
curl.exe -fsSL https://raw.githubusercontent.com/XyzElias/prismatic-claude-statusline/main/statusline.js -o "$HOME\.claude\statusline.js"

# Option B — native PowerShell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/XyzElias/prismatic-claude-statusline/main/statusline.js" -OutFile "$HOME\.claude\statusline.js"
```

**Windows CMD:**

```bat
curl -fsSL https://raw.githubusercontent.com/XyzElias/prismatic-claude-statusline/main/statusline.js -o "%USERPROFILE%\.claude\statusline.js"
```

**Manual (no terminal):** open [`statusline.js`](../statusline.js) on GitHub, click **Download raw file**, and move it into `~/.claude/`.

## Step 2 — Tell Claude Code to use it

Open `~/.claude/settings.json` in any text editor. If the file doesn't exist yet, create it. Add the `statusLine` block:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/statusline.js"
  }
}
```

If your `settings.json` already has other settings, just add `"statusLine": { ... }` as another top-level key (don't forget the comma between entries). A complete file might look like:

```json
{
  "model": "opus",
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/statusline.js"
  }
}
```

## Step 3 — Restart Claude Code

Quit and reopen Claude Code (or start a new session). The status line appears at the bottom. Done!

On first run, the script writes `~/.claude/statusline_config.yml` (your config, with defaults). Leave it as-is, edit it by hand, or generate it with the visual editor. See [Configuration](configuration.md).

## The visual config editor

There's nothing extra to install. The editor is hosted online:

**→ [Open the visual editor](https://xyzelias.github.io/prismatic-claude-statusline/config-editor.html)**

It's a self-contained web page that runs entirely in your browser (it does **not** run with Claude Code and sends nothing anywhere). Design your status line, click **Copy YAML**, and save the result to `~/.claude/statusline_config.yml`.

Prefer to run it offline? Download [`config-editor.html`](../config-editor.html) from the repo and open the local file in your browser — same thing.

## Windows

On Windows, Claude Code runs status line commands through **Git Bash** if it's installed (the common case), otherwise through **PowerShell**.

- **If you have Git Bash** (installed alongside Git for Windows, which most Claude Code setups have), the standard command works as-is:

  ```json
  { "statusLine": { "type": "command", "command": "node ~/.claude/statusline.js" } }
  ```

  > ⚠️ Always write the path with **forward slashes** (`~/.claude/...`). Git Bash treats backslashes as escape characters, and a Windows-style path like `C:\Users\...` will silently fail.

- **If you only have PowerShell** (no Git Bash), point the command at the absolute path with forward slashes:

  ```json
  { "statusLine": { "type": "command", "command": "node C:/Users/yourname/.claude/statusline.js" } }
  ```

For the prettiest output (rounded pill caps), install a Nerd Font and set `style: nerd` — see the [Nerd Font guide](nerd-fonts.md). Otherwise the default `unicode` style looks great and needs no extra setup.

## Verify it works (optional)

You can test the script without Claude Code by piping it a sample of the JSON Claude Code would send:

**macOS / Linux / Git Bash:**

```bash
echo '{"model":{"id":"claude-opus-4-8","display_name":"Opus 4.8"},"workspace":{"current_dir":"/home/me/projects/demo"},"context_window":{"used_percentage":42,"context_window_size":1000000},"cost":{"total_cost_usd":1.85,"total_lines_added":142,"total_lines_removed":38,"total_duration_ms":754000}}' | node ~/.claude/statusline.js
```

You should see the framed, colored status line printed to your terminal. If you do, Claude Code will too.

If something's off, head to [Troubleshooting](troubleshooting.md).

## Updating

To update later, just download `statusline.js` again (Step 1) — it replaces the old one. Your `statusline_config.yml` is left untouched, so your customizations survive.

If a new release adds a segment or color (for example the **BRANCH** pill added in v1.1), the script **migrates your config for you**: on its next run it inserts only the new keys — with their defaults and explanatory comments — directly into your existing file, without changing a single line you already have. The migration is idempotent, so it's safe to update as often as you like. After updating, open the [visual editor](https://xyzelias.github.io/prismatic-claude-statusline/config-editor.html) if you'd like to tweak the new segment.

## Uninstalling

1. Remove the `statusLine` block from `~/.claude/settings.json` (or run `/statusline` in Claude Code and ask it to remove the status line).
2. Optionally delete `~/.claude/statusline.js` and `~/.claude/statusline_config.yml`.
