# Configuration

Everything about the status line is controlled by one file: `~/.claude/statusline_config.yml`. The script creates it with sensible defaults on first run, so configuration is entirely optional.

There are two ways to edit it:

1. **The visual editor** — open [`config-editor.html`](../config-editor.html) in any browser. No setup, nothing to install. Drag segments to reorder them, toggle them on and off, pick colors with a color picker, edit the per-model gradients, and watch a **live preview** update as you go. When you're happy, click **Copy YAML** (or **Download**) and save the result as `~/.claude/statusline_config.yml`.
2. **By hand** — open the YAML file in a text editor. Every option is described below and commented in the file itself.

Changes apply on your **next interaction** with Claude Code (the status line refreshes after each message).

---

## Top-level options

```yaml
style: unicode        # nerd | unicode | ascii  — how the pill "caps" are drawn
show_labels: true     # show the small text label under each pill
path_segments: 2      # how many trailing folders the PATH pill shows
```

### `style`

How the rounded ends of each pill are rendered:

| Value | Looks like | Needs |
|-------|-----------|-------|
| `nerd` | Smooth rounded Powerline caps (as in the README hero) | A [Nerd Font](nerd-fonts.md) |
| `unicode` | Half-block caps `▐ ▌` | Nothing — works in any modern terminal |
| `ascii` | Plain `[ ]` brackets | Nothing — maximum compatibility |

Start with `unicode`. Switch to `nerd` once you've installed a Nerd Font.

### `show_labels`

When `true`, a small dim label (`MODEL`, `PATH`, …) is centered under each pill. Set to `false` for a more compact, single-row look.

### `path_segments`

How many trailing directories the **PATH** pill shows. `2` turns `/home/me/dev/my-project/src` into `…/my-project/src`.

---

## Segments (pills)

Each entry under `pills:` is one segment. They share three options, and a couple have extras.

```yaml
pills:
  model:
    enabled: true     # show this segment at all
    label: MODEL      # the text shown under the pill
    order: 1          # left-to-right position (lower = further left)
```

- **`enabled`** — set to `false` to hide a segment completely.
- **`label`** — the caption under the pill. Rename it to anything you like.
- **`order`** — sorts the pills left to right. In the visual editor you just drag them.

### Segment reference

| Key | Shows | Extra options |
|-----|-------|---------------|
| `model` | Model name with a per-model gradient | — |
| `path` | Working directory | controlled by top-level `path_segments` |
| `context` | Context-window usage + bar | `bar_width` |
| `rate` | Pro/Max subscription usage | `bar_width`, `show_seven_day` |
| `diff` | Lines added/removed this session | — (auto-hides when there are no changes) |
| `cost` | Estimated cost of the current session | — |
| `time` | Session duration | — |

- **`bar_width`** (context, rate) — the width of the progress bar in characters. Default `10`.
- **`show_seven_day`** (rate) — when `true`, also shows the 7-day usage window next to the 5-hour one, e.g. `23% ━━━ 14:30 · 7d 41%`. Default `false`.

> **About the USAGE pill:** it only appears for Claude **Pro/Max** subscribers, because Claude Code only sends rate-limit data to subscribers. On API / pay-per-use plans the pill simply doesn't show — no configuration needed. See [Why no monthly-budget pill](../README.md#why-no-monthly-budget-pill) for the reasoning.

---

## Colors

All colors are `[R, G, B]` arrays (0–255).

```yaml
colors:
  pill_bg:  [58, 62, 72]      # background of every pill
  frame:    [120, 120, 138]   # the rounded frame
  label:    [120, 120, 138]   # label text under pills
  dim:      [200, 185, 175]   # secondary text (units, separators, reset time)
  path:     [120, 200, 255]   # PATH text
  time:     [130, 210, 255]   # TIME text
  diff_add: [60, 255, 110]    # "+N" added lines
  diff_sep: [70, 95, 90]      # separator between + and −
  diff_rm:  [255, 75, 75]     # "−N" removed lines
  cost_grad: [[255, 220, 60], [255, 170, 30]]   # COST gradient (start → end)
```

### Model gradients

The model name is drawn with a two-color gradient, matched to the model by a substring of its id or display name (case-insensitive). For example, any model whose name contains `opus` gets the `opus` gradient.

```yaml
  model_themes:
    opus:    [[175, 100, 255], [255, 120, 230]]   # violet → magenta
    sonnet:  [[40, 230, 160], [120, 255, 180]]    # emerald → mint
    haiku:   [[255, 140, 60], [255, 90, 140]]     # amber → rose
    fable:   [[64, 224, 208], [255, 198, 88]]     # turquoise → gold
    default: [[200, 200, 230], [240, 240, 255]]   # any unrecognized model
```

Each theme is `[[startR,G,B], [endR,G,B]]`. Add your own key for any model name you use; `default` is the fallback.

### Thresholds

The context bar (and the usage bar) change color based on how full they are. The first threshold whose `below` value exceeds the current percentage wins.

<div align="center">
<img src="../assets/context-states.svg" alt="The context bar at four fill levels showing green, lime, orange and red" width="70%">
</div>

```yaml
  thresholds:
    - below: 40
      color: [50, 255, 160]    # < 40%  — green
    - below: 65
      color: [200, 255, 50]    # < 65%  — lime
    - below: 80
      color: [255, 210, 30]    # < 80%  — yellow
    - below: 92
      color: [255, 120, 30]    # < 92%  — orange
    - below: 999
      color: [255, 50, 50]     # everything else — red
```

---

## Frame

```yaml
frame:
  enabled: true       # set false to drop the box entirely
  top_left: "╭"
  top_right: "╮"
  bot_left: "╰"
  bot_right: "╯"
  horizontal: "─"
  vertical: "│"
```

Set `enabled: false` for a frameless, minimal look (just the pills). Or swap the characters for square corners (`┌ ┐ └ ┘`), double lines (`╔ ╗ ╚ ╝`), or anything else.

---

## A minimal example

Just the model and context, no frame, no labels:

```yaml
style: unicode
show_labels: false
pills:
  model:
    enabled: true
    label: MODEL
    order: 1
  context:
    enabled: true
    label: CONTEXT
    order: 2
    bar_width: 12
  path:
    enabled: false
  rate:
    enabled: false
  diff:
    enabled: false
  cost:
    enabled: false
  time:
    enabled: false
frame:
  enabled: false
```

> Use the **block form** shown here (one `key: value` per line), not the inline `{ ... }` flow-map style — the built-in config reader is intentionally minimal and does not parse flow maps.
