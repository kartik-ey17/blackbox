# BlackBox Backend (FastAPI + Pydantic)

The incident investigation engine backend for BlackBox.

## Features
- **FastAPI & Async Architecture**: High-performance REST endpoints for incidents, evidence aggregation, and health checks.
- **Clean Pydantic v2 Models**: Strongly typed contracts for `Incident`, `EvidenceEvent`, `EvidenceSource`, `IncidentStatus`, `BlastRadius`, and `HealthResponse`.
- **Abstracted Incident Repository**: Pluggable `IncidentRepository` interface with `InMemoryIncidentRepository` for demo fixtures, architected for drop-in PostgreSQL integration.
- **3 Realistic Production Incident Fixtures**:
  1. PostgreSQL connection pool exhaustion (`inc-db-pool-exhaustion`)
  2. Kubernetes OOMKilled memory leak cascade (`inc-mem-leak-k8s`)
  3. Third-party payment gateway webhook delivery outage (`inc-third-party-api-outage`)

## Quick Start (Local)

1. Create a virtual environment and activate it:
```bash
python3 -m venv .venv
source .venv/bin/activate  # Or .venv\Scripts\activate on Windows
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run the development server:
```bash
uvicorn main:app --reload --port 8000
```
API Documentation will be live at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- Healthcheck: `http://localhost:8000/health`

## Deploy to Cloud

### Render
1. Create a new **Web Service** on Render.
2. Select your repository and root directory as `backend`.
3. Set Build Command: `pip install -r requirements.txt`
4. Set Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Configure Environment Variables:
   - `CORS_ORIGINS`: `https://your-frontend.vercel.app`

Or use the provided `render.yaml` blueprint.

### Railway / Fly.io
The included `Dockerfile` and `Procfile` provide automatic zero-config containerized deployment.
```bash
fly launch --dockerfile backend/Dockerfile
```

## API Endpoints
- `GET /health` & `GET /api/health`: Service health and sample incident count
- `GET /api/incidents`: List all incidents with summary metrics and blast radius
- `GET /api/incidents/{id}`: Detailed incident payload with correlated evidence events
- `GET /api/incidents/{id}/timeline`: Chronological correlated evidence event timeline
- `POST /api/integrations/test`: Connectivity and latency probe
- `POST /api/ingest/file`: File ingestion endpoint for manual log bundles
