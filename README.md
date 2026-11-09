# RESONIX

RESONIX is a browser-based DJ studio. Imported audio files stay in your browser and are not uploaded to a server. The optional AI mix planner sends track names, artist, BPM/key when available, selected style, and your creative direction to Gemini; it never sends the audio files.

## Local music library

In browsers that support the File System Access API, importing tracks saves browser-managed file access handles in IndexedDB and remembers the tracks assigned to each deck. After restarting, the browser may ask you to grant access again. Your music stays on your device; the app does not save or expose raw filesystem paths.

Browsers without persistent file access can still import and play tracks, but those tracks must be imported again after restarting the app.

## Remix Studio

Choose two tracks and a style to ask Gemini for a live DJ plan with a tempo strategy, transition, energy arc, and performance cues. The source audio remains local; the resulting plan helps you play and mix the pair on Decks A and B. It does not render a new audio file. Gemini/Lyria can generate new music from prompts, but it does not remix the two selected audio files together.

The Remix AI endpoint requires a server-side Gemini API key. Never put the key in client-side code or a `VITE_` variable.

For local development, copy `.env.example` to `.env` and set `GEMINI_API_KEY` to a rotated key. The Vite development server loads it for the server-side Remix endpoint. For Vercel, add `GEMINI_API_KEY` under the project's Environment Variables and redeploy.

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

The production-ready frontend is written to `dist/`. Vercel also deploys the `api/remix-plan.js` serverless function. Deploying only `dist/` to a static host will keep the DJ studio working, but the Gemini mix planner requires a compatible server-side API endpoint.

Vercel is configured in `vercel.json` to run a clean `npm ci` install before building. Keep the Gemini key in Vercel's server-side environment settings; do not commit `.env` files.

## Deploy the static frontend to GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and publishes the frontend whenever changes are pushed to `main`. GitHub Pages does not run the Gemini API function, so the AI mix planner will require a separately hosted backend.

1. In the repository settings, open **Pages**.
2. Set the build and deployment source to **GitHub Actions**.
3. Push to `main` or run the **Deploy to GitHub Pages** workflow manually.

Vite uses relative asset paths so the same build works at the repository's Pages URL as well as a domain root.
