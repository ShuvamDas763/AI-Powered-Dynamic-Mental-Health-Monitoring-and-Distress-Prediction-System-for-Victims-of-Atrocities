# Preview run doc

## How to reproduce uncommitted artifacts

No artifacts to reproduce — the checkout is complete with `node_modules` already
installed and `.env` present at the project root.

If starting from a fresh checkout:
1. `npm install` from the project root (installs all workspace dependencies).
2. `cp .env.example .env` and add a `GROQ_API_KEY` if live LLM analysis is needed.
   The app runs without one in cached-fallback mode.

## How to run the server

```bash
npm run dev
```

This starts both the API server (port 3001) and the Vite client dev server (port 5173)
via `concurrently`. The Vite proxy forwards `/api` requests to the API server, so the
client talks to one origin.

- API server: http://localhost:3001
- Client dev server: http://localhost:5173 (use this URL in the preview)

The `.env` file controls LLM mode. Without a valid `GROQ_API_KEY`, the app serves
cached fallback responses and is fully demoable.

**IMPORTANT:** `dotenv` in `server/src/config/env.js` loads `.env` relative to the
project root (3 levels up from `server/src/config/`). If you move or rename the
`.env` file, update the path in that file.

## Preview status

- Preview URL: http://localhost:5173
- Ports: 3001 (API), 5173 (client)
- LLM mode: live (Groq API key present)
- Verified: login page renders with NHAA tagline, role cards, SIH26094 badge,
  accessibility tree shows all expected elements
- Last verified: 2026-08-29
