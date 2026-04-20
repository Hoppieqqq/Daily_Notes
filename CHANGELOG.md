# Changelog

## 1.0.5 - 2026-04-20

- Replaced the filename format placeholder with sentence-case helper text to satisfy the final automated UI text review check.

## 1.0.4 - 2026-04-20

- Removed the initial settings heading entirely to match Obsidian guidance for general settings.
- Lowercased the remaining source selector strings and date-format placeholder to satisfy the automated sentence-case review checks.

## 1.0.3 - 2026-04-19

- Removed the plugin name from the settings heading to match Obsidian Community Plugin review guidance.
- Normalized the remaining settings and notice strings to sentence case.
- Fixed legacy mojibake in settings copy and refreshed the built plugin bundle.

## 1.0.2 - 2026-04-19

- Removed the default Obsidian hotkey from the command registration to avoid conflicts with user shortcuts.
- Reworked plugin initialization and unload flow to satisfy Obsidian plugin API expectations.
- Replaced loose `any` usage with explicit bridge and plugin interfaces across the resolver, window manager, and global shortcut code.
- Normalized settings and command labels to sentence case for Community Plugin review.
- Updated the plugin CI and release workflows to use Node 24.

## 1.0.1 - 2026-04-18

- Added a global Alt+F shortcut path through Electron so today's floating daily note can open even when Obsidian is not focused but still running.
- Localized command labels for clearer Hotkeys UI.

## 1.0.0 - 2026-04-18

- Initial public release.
- Added floating popout Daily Note window commands.
- Added always-on-top toggle command and persisted pin state.
- Added source resolver for Core Daily Notes / Periodic Notes / custom config.
- Added settings tab with all core controls.
- Added remember window bounds and repeat-hotkey behavior.

