# Research Notes (Context7)

Date: 2026-04-18

## Sources queried
- Obsidian developer docs (`/obsidianmd/obsidian-developer-docs`)
- Electron docs (`/electron/electron`)

## Key findings used in implementation

1. **Commands + Hotkeys**
- Obsidian plugins register commands via `this.addCommand(...)`.
- Commands are available in Command Palette and can be mapped in Hotkeys settings.
- Default hotkeys can be declared in command registration, but user can override via UI.

2. **Settings Tab API**
- Use `PluginSettingTab` + `Setting` components.
- Persist plugin settings via `loadData()` / `saveData()`.
- Build settings UI with toggles, dropdowns, text inputs, action buttons.

3. **Popout windows**
- Desktop API provides `app.workspace.openPopoutLeaf(...)`.
- `app.workspace.revealLeaf(leaf)` ensures focus/reveal behavior.
- Popout init supports optional coordinates and size (used for remembered bounds).

4. **Window lifecycle events**
- Workspace emits `window-open` and `window-close` events.
- `window-close` was used to clear floating window references and persist state.

5. **Electron always-on-top**
- `BrowserWindow.setAlwaysOnTop(flag[, level])` controls pin behavior.
- `BrowserWindow.isAlwaysOnTop()` exposes current state.
- `show()`, `focus()`, `minimize()`, `restore()` used for repeat-hotkey behavior.

## Practical integration notes

- Obsidian popout window ownership was resolved through `WorkspaceWindow` traversal from the leaf.
- Electron bridge is attempted via `@electron/remote` first, then `electron.remote` fallback.
- If bridge is unavailable on a platform/setup, plugin falls back gracefully and keeps note opening behavior working.

## Daily Notes integration strategy

The plugin supports three sources for daily note rules:
- Core Daily Notes plugin settings.
- Periodic Notes plugin settings.
- Plugin-owned custom settings.

Resolver logic:
- Resolve folder/date format/template based on selected source.
- If selected source is unavailable, fallback to plugin custom settings.
- Create note if missing, optionally with template content.
