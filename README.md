# RESONIX

RESONIX is a browser-based DJ studio. Imported audio files and the local DJ planner stay in your browser; no AI service or API key is required.

## Local music library

In browsers that support the File System Access API, importing tracks saves browser-managed file access handles in IndexedDB and remembers the tracks assigned to each deck. After restarting, the browser may ask you to grant access again. Your music stays on your device; the app does not save or expose raw filesystem paths.

Browsers without persistent file access can still import and play tracks, but those tracks must be imported again after restarting the app.

## Remix Studio

Choose two tracks and a style to build a live DJ plan in your browser. The planner uses available BPM and key metadata plus practical phrase, EQ, and transition rules. When analysis data is missing or tempos do not safely match, it recommends beatmatching by ear instead of inventing values. The plan helps you mix the pair on Decks A and B; it does not render a new audio file.

## Requirements

- Node.js 22.12 or newer
- npm

## Run locally

```sh
npm ci
npm run dev
```

## Build and preview

```sh
npm run build
npm run preview
```

The production-ready frontend is written to `dist/`. The DJ studio and local mix planner work on static hosts; no separate API endpoint is required.

Vercel is configured in `vercel.json` to run a clean `npm ci` install before building.

## Deploy the static frontend to GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and publishes the frontend whenever changes are pushed to `main`. The local mix planner works on GitHub Pages without a separately hosted backend.

1. In the repository settings, open **Pages**.
2. Set the build and deployment source to **GitHub Actions**.
3. Push to `main` or run the **Deploy to GitHub Pages** workflow manually.

Vite uses relative asset paths so the same build works at the repository's Pages URL as well as a domain root.
