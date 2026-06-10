# Contributing

Thanks for your interest in **Prismatic**! Issues and pull requests are very welcome — especially new color themes, extra segments, and platform fixes.

## Project layout

| Path | What it is |
|------|------------|
| `statusline.js` | The status line itself — one readable, zero-dependency Node.js file. |
| `config-editor.html` | The visual config editor (also served live via GitHub Pages). |
| `statusline_config.yml` | Example config with all defaults documented. |
| `tools/render-svg.js` | Generates the README images in `assets/` from the engine's own color math. |
| `docs/` | Installation, configuration, Nerd Fonts, and troubleshooting guides. |

## Making changes

1. **Edit `statusline.js`** for behavior/segments/colors. Test it with mock input:
   ```bash
   echo '{"model":{"display_name":"Opus"},"workspace":{"current_dir":"/a/b"},"context_window":{"used_percentage":42,"context_window_size":1000000},"cost":{"total_cost_usd":1.85,"total_lines_added":10,"total_lines_removed":2,"total_duration_ms":60000}}' | node statusline.js
   ```
2. **If you change the README images**, regenerate them:
   ```bash
   node tools/render-svg.js
   ```
   CI fails if the committed SVGs don't match the generator output, so run this before pushing.
3. **Keep it dependency-free.** No runtime `npm install` — that's a core feature.
4. Match the existing code style (the file is plain, commented, and readable on purpose).

## Pull requests

- Keep PRs focused and describe what changed and why.
- For new segments, make sure they degrade gracefully when their data field is absent (see how `rate`/`diff` hide themselves).
- Be kind. See the [Code of Conduct](CODE_OF_CONDUCT.md).
