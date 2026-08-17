# Niagara Reno Estimator — deploy to Vercel

## What changed from the Claude.ai version
- `window.storage` (save/load estimates) now runs on `localStorage` — works immediately,
  but only on the same browser/device. To sync across devices later, swap this for a
  real database (Supabase is a good free option).
- "Chat with the assistant" mode is disabled — it called Anthropic's API directly with
  no key, which only works inside Claude.ai. Re-enabling it for real needs a small
  backend that holds the API key safely (never put an API key in browser code).

## Deploy steps (Vercel, free tier)
1. Go to vercel.com, sign up (free), click "Add New Project"
2. Choose "Upload" (or push this folder to a GitHub repo first, then import it — either works)
3. Upload this whole folder
4. Vercel auto-detects Vite + React, installs dependencies, and builds it — no config needed
5. You'll get a live URL like `niagara-estimator.vercel.app`
6. (Optional) Settings → Domains → add a custom domain, e.g. `estimator.dialsmartconstruction.com`

## Testing locally first (optional, needs Node.js installed)
```
npm install
npm run dev
```
Opens at http://localhost:5173

## Files
- `src/App.jsx` — the whole estimator (same file structure as the Claude.ai version)
- `src/main.jsx` — React entry point
- `package.json` — dependencies (react, lucide-react, recharts, tailwind)
