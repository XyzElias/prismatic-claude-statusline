# Nerd Fonts

The `nerd` style gives the status line its smooth, rounded pill caps (the look in the README hero image). To get them you need a **Nerd Font** installed and selected in your terminal. This guide explains what that means and how to set it up — and how to skip it entirely if you'd rather not.

## Do I even need this?

**No — it's optional.** The status line ships with `style: unicode`, which uses ordinary block characters that render in any modern terminal with no special font. It looks great. You only need a Nerd Font if you specifically want the rounded Powerline pill ends.

| Style | Pill caps | Needs a Nerd Font? |
|-------|-----------|--------------------|
| `nerd` | Smooth rounded `` `` | **Yes** |
| `unicode` *(default)* | Half-blocks `▐ ▌` | No |
| `ascii` | Brackets `[ ]` | No |

If you set `style: nerd` **without** a Nerd Font, the caps show up as empty boxes or question marks. That's the #1 symptom that you need this guide.

## What is a Nerd Font?

A **Nerd Font** is a normal programming font (like Fira Code or JetBrains Mono) that has been "patched" to include thousands of extra glyphs — icons, Powerline separators, and symbols — in the private-use area of Unicode. The rounded pill caps this project uses (`U+E0B6` and `U+E0B4`) are two of those Powerline glyphs.

Regular fonts don't have them, which is why you need a patched one. The fonts are free and open source. Project site: **[nerdfonts.com](https://www.nerdfonts.com)**.

## Step 1 — Install a Nerd Font

Pick any font you like from [nerdfonts.com/font-downloads](https://www.nerdfonts.com/font-downloads). Popular choices: **CaskaydiaCove** (Cascadia Code), **FiraCode**, **JetBrainsMono**, **Hack**.

### macOS

The easiest route is [Homebrew](https://brew.sh):

```bash
brew install --cask font-jetbrains-mono-nerd-font
# or: font-caskaydia-cove-nerd-font, font-fira-code-nerd-font, font-hack-nerd-font
```

Or download the `.zip` from nerdfonts.com, unzip it, select all the `.ttf` files, and open them with **Font Book → Install**.

### Windows

1. Download the font `.zip` from [nerdfonts.com/font-downloads](https://www.nerdfonts.com/font-downloads) (e.g. `CascadiaCode.zip`).
2. Unzip it.
3. Select the `.ttf` files, right-click, and choose **Install** (or **Install for all users**).

Or with [winget](https://learn.microsoft.com/windows/package-manager/):

```powershell
winget install --id DEVCOM.JetBrainsMonoNerdFont
```

### Linux

```bash
# Download and unzip into your local fonts folder, then refresh the cache:
mkdir -p ~/.local/share/fonts
cd ~/.local/share/fonts
curl -fLO https://github.com/ryanoasis/nerd-fonts/releases/latest/download/JetBrainsMono.zip
unzip -o JetBrainsMono.zip
fc-cache -f
```

Many distros also package them (e.g. `sudo pacman -S ttf-jetbrains-mono-nerd` on Arch, or `nerd-fonts` packages on others).

## Step 2 — Set your terminal to use it

Installing the font isn't enough — your terminal has to be told to *use* it. The setting is usually under the terminal's preferences/settings, named **Font** or **Font Family**. Choose the Nerd Font you installed (its name usually ends in **"Nerd Font"**, e.g. `JetBrainsMono Nerd Font`).

| Terminal | Where to set the font |
|----------|----------------------|
| **Windows Terminal** | Settings → your profile → *Appearance* → **Font face** |
| **VS Code** (integrated terminal) | Settings → search `terminal.integrated.fontFamily` → set to e.g. `JetBrainsMono Nerd Font` |
| **iTerm2** (macOS) | Settings → Profiles → Text → **Font** |
| **macOS Terminal** | Settings → Profiles → Text → **Font** → Change |
| **GNOME Terminal** | Preferences → your profile → **Custom font** |
| **Kitty** | add `font_family JetBrainsMono Nerd Font` to `kitty.conf` |
| **Alacritty** | set `font.normal.family` in `alacritty.toml` |
| **WezTerm** | `config.font = wezterm.font("JetBrainsMono Nerd Font")` |

> **VS Code tip:** for ligatures and icons to work, you may also want `"editor.fontFamily"` set, but for the status line only the **terminal** font matters.

## Step 3 — Enable the `nerd` style

Edit `~/.claude/statusline_config.yml`:

```yaml
style: nerd
```

…or open [`config-editor.html`](../config-editor.html), set **Pill style** to **Nerd Font**, and copy the result.

Restart Claude Code (or trigger a refresh with a new message). You should now see the smooth rounded pill caps.

## Troubleshooting

- **Empty boxes (▯) or question marks where the caps should be** → the terminal isn't using a Nerd Font. Re-check Step 2; make sure you picked the variant whose name contains "Nerd Font", and restart the terminal.
- **It works in one terminal but not another** → each terminal has its own font setting. Set it everywhere you use Claude Code.
- **You don't want to deal with fonts** → just use `style: unicode`. It looks clean and needs nothing. See [Configuration](configuration.md#style).

More fixes in the [Troubleshooting guide](troubleshooting.md).
