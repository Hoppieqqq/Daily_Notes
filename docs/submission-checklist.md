# Community Plugin Submission Checklist

## Metadata
- [x] `manifest.json` exists
- [x] unique `id`: `daily-floating-note`
- [x] `name`, `description`, `author`, `version` present
- [x] `minAppVersion` set
- [x] `isDesktopOnly: true`

## Compatibility
- [x] `versions.json` exists
- [x] version key includes current release (`1.0.0`)

## Build artifacts for release
- [x] `main.js`
- [x] `manifest.json`
- [x] `styles.css`

## Repository docs
- [x] `README.md` in English
- [x] `CHANGELOG.md`
- [x] `LICENSE` (MIT)

## Policy
- [x] no telemetry
- [x] no network calls required for core functionality
- [x] desktop-only behavior documented

## Manual test checklist
- [ ] install into `.obsidian/plugins/daily-floating-note/`
- [ ] enable plugin
- [ ] run command "Open floating daily note for today"
- [ ] verify popout opens and focuses
- [ ] verify pin toggle command works
- [ ] verify settings toggles persist
