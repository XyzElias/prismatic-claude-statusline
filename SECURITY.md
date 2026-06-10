# Security Policy

Prismatic is a single, dependency-free Node.js script that reads the JSON Claude Code passes on stdin and prints text. It makes **no network requests** and uses **no third-party packages**, so its attack surface is intentionally tiny.

## Reporting a vulnerability

If you find a security issue, please **do not open a public issue**. Instead, use GitHub's private [**Report a vulnerability**](https://github.com/XyzElias/prismatic-claude-statusline/security/advisories/new) flow, or open a minimal issue asking for a private contact channel. You'll get a response as soon as possible.

## Scope notes

- The status line runs locally and is only executed by Claude Code in trusted workspaces.
- `statusline.js` writes one file (`~/.claude/statusline_config.yml`) on first run and otherwise only reads its config and prints output.
- The visual editor (`config-editor.html`) runs entirely in your browser and sends nothing anywhere.
