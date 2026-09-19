"""
BlackBox Pydantic Models
Data contracts for incident investigation, evidence aggregation, and timeline correlation.
"""

from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class EvidenceSource(str, Enum):
    GITHUB = "github"
    SENTRY = "sentry"
    LOGS = "logs"
    METRICS = "metrics"
    DEPLOYMENT = "deployment"
    NETWORK = "network"


class IncidentStatus(str, Enum):
    INVESTIGATING = "investigating"
    IDENTIFIED = "identified"
    MITIGATED = "mitigated"
    RESOLVED = "resolved"


class IncidentSeverity(str, Enum):
    P0_CRITICAL = "P0"
    P1_HIGH = "P1"
    P2_MEDIUM = "P2"
    P3_LOW = "P3"


class BlastRadius(BaseModel):
    services_impacted: List[str] = Field(..., description="Names of microservices or systems directly impacted")
    users_affected_count: int = Field(..., description="Estimated count of affected end-users")
    error_rate_peak_pct: float = Field(..., description="Peak error percentage recorded during incident")
    p99_latency_ms: int = Field(..., description="P99 response latency in milliseconds")
    regions_affected: List[str] = Field(default_factory=list, description="Cloud regions or clusters impacted")


class EvidenceEvent(BaseModel):
    id: str = Field(..., description="Unique event identifier, e.g. evt-gh-412")
    source: EvidenceSource = Field(..., description="Source system where event originated")
    event_type: str = Field(default="alert", description="Type of event: commit, pull_request, deployment, error, metric_anomaly, log_entry, system_event")
    timestamp: str = Field(..., description="ISO 8601 formatted timestamp of occurrence")
    title: str = Field(..., description="Concise human-readable headline")
    message: Optional[str] = Field(None, description="Descriptive event message or log line")
    summary: str = Field(..., description="Detailed description of the event or anomaly")
    severity: str = Field(default="info", description="Severity level: info, warning, error, critical")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Arbitrary structured metadata specific to the source")
    related_identifiers: List[str] = Field(default_factory=list, description="Associated identifiers, e.g. PR numbers, commit SHAs, issue IDs, hostnames")
    raw_reference: Optional[str] = Field(None, description="Pointer to raw external entity, URL, or raw log index")
    correlated_event_ids: List[str] = Field(default_factory=list, description="IDs of related events in causality graph")
    is_root_cause_candidate: bool = Field(default=False, description="Flag indicating high likelihood of root cause contributor")


class ConnectorStatus(BaseModel):
    connected: bool = Field(..., description="Whether live authentication and connectivity succeeded")
    available: bool = Field(..., description="Whether the connector can be queried (live or fallback)")
    error: Optional[str] = Field(None, description="Human-readable reason for lack of live connectivity")
    fallback_available: bool = Field(default=True, description="Whether authentic demo data is available as fallback")
    details: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Diagnostic connector metadata without secrets")


class ConnectorsHealthResponse(BaseModel):
    github: ConnectorStatus
    sentry: ConnectorStatus
    file: ConnectorStatus
    demo: ConnectorStatus
    summary: str


class GitHubAcquisitionRequest(BaseModel):
    repository: str = Field(..., description="GitHub repository in owner/repo format")
    branch: Optional[str] = Field("main", description="Target Git branch to inspect")
    incident_start_time: Optional[str] = Field(None, description="ISO timestamp for incident start")
    incident_end_time: Optional[str] = Field(None, description="ISO timestamp for incident end")
    personal_access_token: Optional[str] = Field(None, description="Optional GitHub Personal Access Token if not in env")
    include_pull_requests: bool = Field(default=True, description="Query associated merged PRs")
    include_deployments: bool = Field(default=True, description="Query deployment events")


class SentryAcquisitionRequest(BaseModel):
    organization: Optional[str] = Field(None, description="Sentry organization slug")
    project: Optional[str] = Field(None, description="Sentry project slug")
    incident_start_time: Optional[str] = Field(None, description="ISO timestamp for incident start")
    incident_end_time: Optional[str] = Field(None, description="ISO timestamp for incident end")
    query: Optional[str] = Field(None, description="Optional issue search query e.g. is:unresolved")
    auth_token: Optional[str] = Field(None, description="Optional Sentry API auth token if not in env")


class FileAcquisitionRequest(BaseModel):
    filename: str = Field(..., description="Original filename (.log, .txt, .json, .csv)")
    content: str = Field(..., description="Raw text content of the file")
    format_hint: Optional[str] = Field("auto", description="Format hint: log, txt, json, csv, or auto")


class AcquisitionResult(BaseModel):
    source: str = Field(..., description="Primary evidence source acquired")
    events_count: int = Field(..., description="Number of normalized evidence events acquired")
    sources_count: int = Field(..., description="Number of distinct evidence sources represented")
    summary_message: str = Field(..., description="Summary string, e.g. 'Collected X evidence events from Y sources.'")
    events: List[EvidenceEvent] = Field(default_factory=list, description="Normalized EvidenceEvent objects")
    connector_status: ConnectorStatus
    warnings: List[str] = Field(default_factory=list, description="Non-fatal warnings encountered during acquisition")


class Incident(BaseModel):
    id: str = Field(..., description="Unique incident identifier, e.g. inc-db-pool-exhaustion")
    title: str = Field(..., description="Incident title")
    summary: str = Field(..., description="Executive summary of the outage")
    severity: IncidentSeverity = Field(..., description="Incident severity level")
    status: IncidentStatus = Field(..., description="Current lifecycle state")
    service: str = Field(..., description="Primary service affected")
    environment: str = Field(default="production", description="Runtime environment")
    started_at: str = Field(..., description="ISO 8601 timestamp when anomaly began")
    detected_at: str = Field(..., description="ISO 8601 timestamp when alert fired")
    mitigated_at: Optional[str] = Field(None, description="ISO 8601 timestamp when mitigation applied")
    sources_connected: List[EvidenceSource] = Field(..., description="List of evidence sources associated with this incident")
    blast_radius: BlastRadius = Field(..., description="Quantified blast radius")
    evidence_count: int = Field(..., description="Total number of correlated evidence items")
    primary_hypothesis: Optional[str] = Field(None, description="Initial root-cause hypothesis")


class IncidentDetail(Incident):
    evidence_events: List[EvidenceEvent] = Field(default_factory=list, description="Full list of correlated chronological evidence events")
    timeline_summary: str = Field(..., description="Narrative synthesis of the incident progression")
    key_anomalies: List[str] = Field(default_factory=list, description="Key anomalies identified by evidence collector")
    suggested_action_items: List[str] = Field(default_factory=list, description="Recommended remediation and preventive measures")


class HealthResponse(BaseModel):
    status: str = Field("ok", description="Service health status")
    service: str = Field("blackbox-api", description="Service identifier")
    version: str = Field("0.1.0", description="API version")
    timestamp: str = Field(..., description="Current server UTC timestamp")
    sample_incidents_loaded: int = Field(..., description="Number of demo incidents available")
    environment: str = Field("production", description="Active runtime environment")


class ConnectivityTestRequest(BaseModel):
    client_id: Optional[str] = Field("blackbox-frontend", description="Identifier of calling client")
    client_timestamp: Optional[str] = None


class ConnectivityTestResponse(BaseModel):
    status: str = "connected"
    client_received: Optional[str]
    latency_probe_echo: str = "pong"
    server_time: str
    active_mode: str = "demo_in_memory"
