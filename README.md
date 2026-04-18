# Daily Floating Note

Open your Daily Note in a dedicated floating Obsidian popout window, with optional always-on-top behavior.

## Features

- Open **today's Daily Note** in a floating window.
- If today's note does not exist, it is created automatically.
- Supports 3 daily config sources:
  - Core **Daily Notes** plugin
  - **Periodic Notes** plugin
  - Plugin custom settings
- Optional **always-on-top** pin behavior.
- Remembers floating window **size and position**.
- Remembers pin state across sessions (optional).
- Smart repeat-hotkey behavior:
  - Focus existing window
  - Hide/show
  - Reopen
- Commands for today / yesterday / tomorrow daily notes.

## Commands

- `Open floating daily note for today`
- `Open floating daily note for yesterday`
- `Open floating daily note for tomorrow`
- `Toggle always-on-top for floating daily window`
- `Close floating daily window`

## Hotkey

The default hotkey for opening today's floating note is:
- **Alt+F** (desktop)

You can remap it in Obsidian Hotkeys settings.

## Settings

- Pin window on top by default
- Remember pin state between sessions
- Remember window size and position
- Daily source: Core Daily Notes / Periodic Notes / Plugin custom
- Custom source options:
  - Daily folder
  - File date format
  - Template file path
- Repeat-hotkey behavior
- Open mode: editing or reading
- Open daily now (test button)
- Reset to defaults

## Install (manual)

1. Open your vault folder.
2. Create directory:
   - `.obsidian/plugins/daily-floating-note/`
3. Copy these files into it:
   - `main.js`
   - `manifest.json`
   - `styles.css`
4. In Obsidian:
   - Settings → Community plugins → Reload plugins
   - Enable **Daily Floating Note**.

## Install via BRAT

1. Install BRAT plugin.
2. In BRAT, add this repository:
   - `https://github.com/Hoppieqqq/Daily_Notes`
3. Select latest release.

## Development

```bash
npm install
npm run build
```

Watch mode:

```bash
npm run dev
```

## Release requirements

Each GitHub release must include these assets (no zip):
- `main.js`
- `manifest.json`
- `styles.css`

Tag must match `manifest.json` version.

## Platform notes

- Plugin is desktop-only (`isDesktopOnly: true`).
- Always-on-top relies on Obsidian/Electron bridge.
- If platform/window manager blocks pinning, note opening still works.

## Privacy

- No telemetry.
- No external network requests.

## License

MIT
