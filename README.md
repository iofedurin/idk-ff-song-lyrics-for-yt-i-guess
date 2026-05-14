# YouTube Lyrics

Firefox extension. Adds a floating button on YouTube and YouTube Music pages — click it to open a draggable, resizable panel that fetches the lyrics for the currently playing video.

Sources (in order):

1. **LRCLib** (default) — large free catalog, supports search with multiple candidates, plain + synced LRC.
2. **lyrics.ovh** — English fallback.
3. **Genius** (optional) — requires a free API key in the options page; without a key, disabled.

## Develop

```bash
bun install
bun run dev          # opens Firefox with the extension loaded
bun run test         # vitest
bun run lint
bun run build        # production build → .output/firefox-mv3/
bun run zip          # zipped distribution → .output/*.zip
```

### Chrome (dev only)

```bash
bun run dev:chrome
bun run build:chrome   # → .output/chrome-mv3/
```

Chrome is supported for local development / debugging only — Firefox is the release target (signed via AMO). The codebase is browser-agnostic; the only practical difference is the Genius parser, which falls back from `DOMParser` (Firefox event page) to regex-based HTML extraction so Chrome's service-worker background doesn't break.

## Release

1. Bump `version` in `package.json`.
2. Commit.
3. `git tag v0.1.0 && git push origin master --tags`.

GitHub Actions:

- **`build.yml`** — runs on every push: lint, test, build, uploads the `.output/firefox-mv3/` folder and `.zip` as an artifact (download via the Actions tab, kept 90 days).
- **`release.yml`** — runs on `v*` tags: signs with `web-ext sign` (AMO unlisted) and creates a GitHub Release with the `.xpi` attached. Needs `AMO_API_KEY` and `AMO_API_SECRET` repo secrets.

## Stack

WXT · TypeScript · React 19 · Bun · Tailwind v4 (options page only) · Biome · Vitest · `react-rnd` (drag + resize) · `@webext-core/messaging` (content ↔ background).
