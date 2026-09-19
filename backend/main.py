"""
BlackBox FastAPI Backend
Main entry point providing incident APIs, demo mode fixtures, and integration health checks.
"""

import os
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models import (
    Incident,
    IncidentDetail,
    EvidenceEvent,
    HealthResponse,
    ConnectivityTestRequest,
    ConnectivityTestResponse,
    ConnectorsHealthResponse,
    GitHubAcquisitionRequest,
    SentryAcquisitionRequest,
    FileAcquisitionRequest,
    AcquisitionResult,
)
from repository import IncidentRepository, get_incident_repository
from providers import AcquisitionService, get_acquisition_service

app = FastAPI(
    title="BlackBox AI Incident Investigator API",
    description="Backend API for correlating engineering evidence across GitHub, Sentry, and observability telemetry.",
    version="0.1.0",
)

# Configure CORS using environment variable
cors_env = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,https://*.vercel.app,*")
origins = [origin.strip() for origin in cors_env.split(",") if origin.strip()]
if "*" in origins:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if "*" not in origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse, tags=["System"])
@app.get("/api/health", response_model=HealthResponse, tags=["System"])
async def health_check(repo: IncidentRepository = Depends(get_incident_repository)):
    """
    Health check probe exposed for cloud orchestrators (Render/Railway/Fly.io)
    and frontend connectivity diagnostics.
    """
    count = await repo.count()
    return HealthResponse(
        status="ok",
        service="blackbox-api",
        version="0.1.0",
        timestamp=datetime.now(timezone.utc).isoformat(),
        sample_incidents_loaded=count,
        environment=os.getenv("ENVIRONMENT", "production"),
    )


@app.post("/api/integrations/test", response_model=ConnectivityTestResponse, tags=["Integrations"])
async def test_connectivity(payload: ConnectivityTestRequest = None):
    """
    Endpoint for frontend connectivity diagnostics and latency verification.
    """
    return ConnectivityTestResponse(
        status="connected",
        client_received=payload.client_id if payload else "unknown",
        latency_probe_echo="pong",
        server_time=datetime.now(timezone.utc).isoformat(),
        active_mode="demo_in_memory",
    )


# -------------------------------------------------------------------------
# Evidence Acquisition & Connector Layer (Stage 2)
# -------------------------------------------------------------------------

@app.get("/api/connectors/status", response_model=ConnectorsHealthResponse, tags=["Connectors"])
async def get_connectors_status(
    service: AcquisitionService = Depends(get_acquisition_service),
):
    """
    Retrieve live health and fallback availability across all 4 evidence providers:
    GitHub, Sentry, File Ingestion, and Demo Provider.
    """
    return await service.get_all_connector_statuses()


@app.post("/api/connectors/github/collect", response_model=AcquisitionResult, tags=["Connectors"])
async def collect_github_evidence(
    payload: GitHubAcquisitionRequest,
    service: AcquisitionService = Depends(get_acquisition_service),
):
    """
    Acquire normalized commits, pull requests, and deployments from GitHub.
    Falls back gracefully to demo Git evidence if credentials are absent or fail.
    """
    return await service.acquire_from_github(payload)


@app.post("/api/connectors/sentry/collect", response_model=AcquisitionResult, tags=["Connectors"])
async def collect_sentry_evidence(
    payload: SentryAcquisitionRequest,
    service: AcquisitionService = Depends(get_acquisition_service),
):
    """
    Acquire normalized unhandled exceptions and issue groups from Sentry.
    Falls back gracefully to demo exception evidence if credentials are absent or fail.
    """
    return await service.acquire_from_sentry(payload)


@app.post("/api/connectors/file/collect", response_model=AcquisitionResult, tags=["Connectors"])
async def collect_file_evidence(
    payload: FileAcquisitionRequest,
    service: AcquisitionService = Depends(get_acquisition_service),
):
    """
    Ingest and parse heterogeneous log bundles (.log, .txt, .json, .csv).
    Guarantees line/record preservation on parse errors.
    """
    return await service.acquire_from_file(payload)


class DemoAcquisitionRequest(BaseModel):
    incident_id: Optional[str] = "inc-db-pool-exhaustion"
    filter_source: Optional[str] = None


@app.post("/api/connectors/demo/collect", response_model=AcquisitionResult, tags=["Connectors"])
async def collect_demo_evidence(
    payload: DemoAcquisitionRequest = None,
    service: AcquisitionService = Depends(get_acquisition_service),
):
    """
    Acquire pre-correlated baseline demo evidence events.
    Always available with zero external dependencies.
    """
    inc_id = payload.incident_id if payload else "inc-db-pool-exhaustion"
    src = payload.filter_source if payload else None
    return await service.acquire_from_demo(incident_id=inc_id, filter_source=src)


# -------------------------------------------------------------------------
# Incident Retrieval Endpoints
# -------------------------------------------------------------------------


@app.get("/api/incidents", response_model=List[Incident], tags=["Incidents"])
async def list_incidents(repo: IncidentRepository = Depends(get_incident_repository)):
    """
    Retrieve list of available incidents (including realistic demo incidents).
    """
    return await repo.list_incidents()


@app.get("/api/incidents/{incident_id}", response_model=IncidentDetail, tags=["Incidents"])
async def get_incident(incident_id: str, repo: IncidentRepository = Depends(get_incident_repository)):
    """
    Retrieve full incident details, including correlated evidence events, blast radius,
    and root-cause hypotheses.
    """
    incident = await repo.get_incident_by_id(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident with ID '{incident_id}' not found")
    return incident


@app.get("/api/incidents/{incident_id}/timeline", response_model=List[EvidenceEvent], tags=["Incidents"])
async def get_incident_timeline(incident_id: str, repo: IncidentRepository = Depends(get_incident_repository)):
    """
    Retrieve sorted chronological evidence timeline for an incident.
    """
    incident = await repo.get_incident_by_id(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail=f"Incident with ID '{incident_id}' not found")
    return await repo.get_timeline(incident_id)


class IngestionResponse(BaseModel):
    status: str
    filename: str
    events_parsed: int
    message: str
    events: List[EvidenceEvent] = []


@app.post("/api/ingest/file", response_model=IngestionResponse, tags=["Ingestion"])
async def ingest_file(
    file: UploadFile = File(...),
    service: AcquisitionService = Depends(get_acquisition_service),
):
    """
    Ingest and parse heterogeneous log bundles (.log, .txt, .json, .csv).
    Guarantees line/record preservation on parse errors.
    """
    content_bytes = await file.read()
    content_text = content_bytes.decode("utf-8", errors="replace")
    
    result = await service.acquire_from_file(
        FileAcquisitionRequest(
            filename=file.filename or "uploaded_bundle.log",
            content=content_text,
            format_hint="auto",
        )
    )
    
    return IngestionResponse(
        status="parsed",
        filename=file.filename or "uploaded_bundle.log",
        events_parsed=result.events_count,
        message=result.summary_message,
        events=result.events,
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
