# Troubleshooting

Quick fixes for the most common issues. If your problem isn't here, open an [issue](https://github.com/XyzElias/prismatic-claude-statusline/issues).

## The status line doesn't appear at all

Work through these in order:

1. **Is Node.js installed and on your PATH?** Run `node --version`. If it errors, install [Node.js](https://nodejs.org) (you likely already have it, since Claude Code uses it).
2. **Is `statusline.js` actually in `~/.claude/`?** Confirm the file is there and the path in `settings.json` matches. See [where `~/.claude` is](installation.md#where-is-claude).
3. **Is the `settings.json` valid JSON?** A stray comma or missing brace silently disables the block. Paste it into a JSON validator if unsure. It should contain:
   ```json
   { "statusLine": { "type": "command", "command": "node ~/.claude/statusline.js" } }
   ```
4. **Did you restart Claude Code?** Settings reload, but the change shows up only on your next interaction.
5. **Test the script directly** with the [verification command](installation.md#verify-it-works-optional). If it prints a status line in your terminal, the script is fine and the issue is in `settings.json` or the path.
6. **Workspace trust:** because the status line runs a command, Claude Code only runs it after you've accepted the workspace trust prompt. If you see `statusline skipped · restart to fix`, restart and accept the prompt.
7. **`disableAllHooks`:** if this is set to `true` in your settings, the status line is disabled too. Remove it or set it to `false`.

You can also run `claude --debug`, which logs the exit code and any error output from the status line command.

## The pill ends show as boxes (▯) or question marks

You have `style: nerd` but your terminal isn't using a Nerd Font. Either:

- Install and select a Nerd Font — see the [Nerd Font guide](nerd-fonts.md); **or**
- Switch to `style: unicode` in `~/.claude/statusline_config.yml` (no special font needed).

## Colors look wrong, washed out, or like raw codes (`\x1b[38;2…`)

- **Raw escape codes printed as text** → your terminal doesn't support ANSI colors, or output is being captured somewhere that strips them. Virtually all modern terminals support truecolor; try Windows Terminal, iTerm2, Kitty, or the VS Code terminal.
- **Colors are flat / only 16 colors** → your terminal may not support **truecolor** (24-bit). Most do. In tmux, you may need `set -g default-terminal "tmux-256color"` and the `Tc` terminal-override to pass truecolor through.

## On Windows, the status line silently fails

If Claude Code routes through **Git Bash** (the usual case on Windows), backslashes in the command path are eaten as escape characters. Always use **forward slashes**:

```json
{ "statusLine": { "type": "command", "command": "node ~/.claude/statusline.js" } }
```

If you only have PowerShell, use an absolute path with forward slashes — see [Windows setup](installation.md#windows).

## The USAGE pill never shows

This is expected if you're on an **API / pay-per-use** plan. Claude Code only sends rate-limit data to **Pro/Max subscribers**, so the USAGE pill auto-hides otherwise. It will also be absent until the first API response of a session. There's nothing to fix — see [Why no monthly-budget pill](../README.md#why-no-monthly-budget-pill).

## The DIFF pill is missing

The DIFF pill only appears once there are line changes in the session (`+`/`−` counts above zero). With no edits yet, it's hidden by design.

## My config changes don't take effect

- Changes apply on your **next message** to Claude Code, not instantly.
- Make sure you edited `~/.claude/statusline_config.yml` (the one next to `statusline.js`), not a copy elsewhere.
- If you hand-edited the YAML, a syntax slip can make the file fall back to defaults. Use the [visual editor](../config-editor.html) to regenerate a known-good file, and remember the reader uses **block form**, not inline `{ ... }` maps (see [Configuration](configuration.md#a-minimal-example)).

## I edited the script and now it's blank

A script that errors or prints nothing makes the status line go blank. Re-download a fresh [`statusline.js`](../statusline.js), or run the [verification command](installation.md#verify-it-works-optional) to see the actual error in your terminal.

## Still stuck?

Open an issue with: your OS, terminal, the `statusLine` block from `settings.json`, and the output of the [verification command](installation.md#verify-it-works-optional). That's almost always enough to pinpoint it.
