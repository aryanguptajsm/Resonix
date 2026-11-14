# RESONIX

RESONIX is a browser-based DJ studio. Imported audio files and the local DJ planner stay in your browser; no AI service or API key is required.

## Local music library

Open **Songs** from the top navigation and choose **Upload song** to add audio from your device. You can select multiple audio files at once; imported songs appear in the list and can be loaded onto either deck.

In browsers that support the File System Access API, importing tracks saves browser-managed file access handles in IndexedDB and remembers the tracks assigned to each deck. After restarting, the browser may ask you to grant access again. Your music stays on your device; the app does not save or expose raw filesystem paths.

Browsers without persistent file access can still import and play tracks, but those tracks must be imported again after restarting the app.

## Auto-DJ / Concert mix

Open **Concert mix**, choose an opening song and a mix style, then reorder the queue and select **Start Auto-DJ**. Resonix analyzes local audio in a Web Worker, caches results in IndexedDB, and uses a pitch-preserving AudioWorklet for close tempo matches. The UI shows the current and next songs and transition progress; **Stop Auto-DJ** stops the set. All analysis and playback remain in your browser.

Tempo, key and phrase analysis are approximate. Transitions use the estimated phrase grid, which assumes the first detected beat is the song's first beat. Timing is not guaranteed to land within 10 ms, and the beat/key accuracy target has not been validated against a licensed test corpus. Vocal overlap detection, mashups, recording and a shared master limiter are not implemented. See [docs/autodj.md](./docs/autodj.md) for architecture, usage and known limits. Keep the browser tab open while the set is playing.

The mixer’s **Balanced Bass** button applies a gentle -2 dB low-EQ trim to both decks; use EQ Reset for a flat response. Speaker, room, and track mastering vary, so no single EQ preset can guarantee perfect bass on every system. The set transition automates crossfader volume, EQ bass handoff, filter opening, reverb, and outgoing echo. A peak guard helps control brief output peaks but is not a substitute for safe speaker levels.

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
