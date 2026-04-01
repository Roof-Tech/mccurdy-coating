# McCurdy Coatings — Roof Investment Proposal Platform

Full-stack proposal app for McCurdy Roofing with AI-powered before/after roof visualizations.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Radix UI, TanStack Query |
| Backend | Express.js, TypeScript, Drizzle ORM, SQLite |
| AI | Perplexity LLM API (via Python scripts) |
| Deployment | Vercel (frontend) + Render (backend) |

## Hybrid Deployment (Vercel + Render)

The app is split across two services:

- **Frontend on Vercel** — static React SPA served from your custom domain
- **Backend on Render** — Express API server with SQLite database, file uploads, and AI scripts

### 1. Deploy Backend on Render

The repo already includes `render.yaml` and `Dockerfile` for Render.

1. Connect this repo to [Render](https://render.com)
2. Deploy as a **Web Service** (Docker or Node)
3. Set environment variables:
   - `NODE_ENV` = `production`
   - `FRONTEND_URL` = `https://your-domain.com` (your Vercel frontend URL, for CORS)
   - `DATA_DIR` = `/var/data` (persistent disk path)
4. Add a **persistent disk** mounted at `/var/data` (for uploads and SQLite)
5. Note the backend URL (e.g. `https://mccurdy-api.onrender.com`)

### 2. Deploy Frontend on Vercel

1. Connect this repo to [Vercel](https://vercel.com)
2. The `vercel.json` file handles build and SPA routing automatically
3. Set environment variable:
   - `VITE_API_URL` = `https://mccurdy-api.onrender.com` (your Render backend URL)
4. Connect your custom domain in Vercel settings

### Environment Variables Summary

| Variable | Where | Value |
|----------|-------|-------|
| `VITE_API_URL` | Vercel (frontend) | Your Render backend URL |
| `FRONTEND_URL` | Render (backend) | Your Vercel frontend URL (comma-separated for multiple origins) |
| `NODE_ENV` | Render | `production` |
| `DATA_DIR` | Render | `/var/data` |

### How It Works

- When `VITE_API_URL` is set, the frontend sends all API requests to the backend URL instead of the same origin
- The backend CORS middleware allows requests from the `FRONTEND_URL` origin
- Uploaded file URLs (images, documents) are automatically resolved to the backend URL

## Local Development

```bash
npm install
npm run dev
```

Runs both the Express API and Vite dev server on port 5000.

## Build

```bash
npm run build    # Builds client (Vite) + server (esbuild)
npm start        # Runs production bundle
```

## AI Image Generation

The AI roof transformation uses the Perplexity LLM API via Python scripts (`server/transform-roof.py`, `server/generate_image.py`). No local GPU or Docker is required — the AI runs as a cloud service. You just need a Perplexity API key.