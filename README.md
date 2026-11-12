# RESONIX

RESONIX is a browser-based DJ studio. Imported audio files and the local DJ planner stay in your browser; no AI service or API key is required.

## Local music library

In browsers that support the File System Access API, importing tracks saves browser-managed file access handles in IndexedDB and remembers the tracks assigned to each deck. After restarting, the browser may ask you to grant access again. Your music stays on your device; the app does not save or expose raw filesystem paths.

Browsers without persistent file access can still import and play tracks, but those tracks must be imported again after restarting the app.

## Concert mix

The local set builder orders every song in your library using available BPM and key metadata, then blends into each next song around the outgoing song's midpoint. When BPM values are available, the incoming deck matches tempo and starts on its first beat; beat alignment assumes the first beat is at the start of the audio and BPM detection is approximate. Songs without BPM data are still included, but need an ear-checked handoff. The mix returns to the selected opening song for its finale and fades out at the end. This is a lightweight local recommendation algorithm, not a trained neural model; it does not upload audio or train on your files. Keep the browser tab open while the mix is playing.

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
