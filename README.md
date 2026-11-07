# RESONIX

RESONIX is a browser-based DJ studio. Audio files are processed locally in your browser and are not uploaded to a server.

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

The production-ready static site is written to `dist/`. Deploy the contents of that directory to any static web host.

Vercel is configured in `vercel.json` to run a clean `npm ci` install before building, avoiding stale cached executable permissions.

## Deploy to GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds the site and publishes it whenever changes are pushed to `main`.

1. In the repository settings, open **Pages**.
2. Set the build and deployment source to **GitHub Actions**.
3. Push to `main` or run the **Deploy to GitHub Pages** workflow manually.

Vite uses relative asset paths so the same build works at the repository's Pages URL as well as a domain root. No backend or server-side environment variables are required.
