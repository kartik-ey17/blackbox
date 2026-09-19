# BlackBox — AI Incident Investigator for Software Systems

BlackBox aggregates telemetry and engineering artifacts across **GitHub**, **Sentry**, and **system logs**, reconstructs correlated incident timelines, and produces evidence-backed root-cause investigations.

## Architecture Overview

- **Frontend**: React 19, TypeScript, Tailwind CSS, Motion, Lucide icons.
  - Premium developer-tool dark aesthetic.
  - Interactive correlated timeline with source filtering (GitHub, Sentry, Logs, Metrics, Deployments).
  - Node-based causality evidence graph preview.
  - In-browser live backend connectivity tester with latency measurement and diagnostics.
  - Ready for deployment to **Vercel**.
- **Backend (Python / FastAPI)**:
  - Located in `/backend`.
  - Clean **Pydantic v2** models (`Incident`, `EvidenceEvent`, `EvidenceSource`, `IncidentStatus`, `BlastRadius`).
  - Abstracted `IncidentRepository` interface with `InMemoryIncidentRepository` containing 3 realistic production incident fixtures.
  - Ready for drop-in PostgreSQL migration.
  - Deployable to **Render**, **Railway**, or **Fly.io** with included `Dockerfile`, `Procfile`, and `render.yaml`.
- **Full-Stack Bridge (Port 3000)**:
  - Integrated Express + Vite server providing unified preview and zero-config local testing.

## Acquisition Modes

1. **Demo Mode (Active)**:
   - Three production-grade incident fixtures with raw git diffs, stack traces, metrics spikes, and blast radius calculations:
     - `inc-db-pool-exhaustion`: PostgreSQL Connection Pool Exhaustion on Payments Service (P0)
     - `inc-mem-leak-k8s`: Kubernetes OOMKilled Pod Cascades in Search & Recommender (P1)
     - `inc-third-party-api-outage`: Third-Party Payment Gateway Webhook Delivery Failure (P1)
2. **Live Integrations**:
   - Connector shells for GitHub and Sentry.
3. **File Ingestion**:
   - Drag-and-drop log, JSON, and CSV bundle ingestion shell.

## Environment Variables

### Frontend
Configure in `.env` (or Vercel project settings):
```env
# URL of the backend API (if deploying frontend separately from backend)
# Leave empty or unset when running in unified mode
VITE_API_URL=https://your-blackbox-backend.onrender.com

# For Next.js environments
NEXT_PUBLIC_API_URL=https://your-blackbox-backend.onrender.com
```

### Backend (`/backend`)
Configure in `backend/.env` (or Render/Railway/Fly.io settings):
```env
PORT=8000
ENVIRONMENT=production
CORS_ORIGINS="https://your-frontend.vercel.app,http://localhost:3000"
DATABASE_URL="postgresql://..." # Optional for future Postgres stage
```

## Running the Project

### Standalone Python FastAPI Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend / Full-Stack Dev Server
```bash
npm install
npm run dev
```
Navigate to `http://localhost:3000`.
Use the **API Health & Connectivity Test** indicator in the navigation bar to test live communication with the backend.
