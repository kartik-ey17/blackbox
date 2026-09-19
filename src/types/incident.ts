/**
 * BlackBox Frontend Types
 * Strictly aligned with Backend Pydantic Models (backend/models.py).
 */

export type EvidenceSource = 'github' | 'sentry' | 'logs' | 'metrics' | 'deployment' | 'network';

export type IncidentStatus = 'investigating' | 'identified' | 'mitigated' | 'resolved';

export type IncidentSeverity = 'P0' | 'P1' | 'P2' | 'P3';

export interface BlastRadius {
  services_impacted: string[];
  users_affected_count: number;
  error_rate_peak_pct: number;
  p99_latency_ms: number;
  regions_affected: string[];
}

export interface EvidenceEvent {
  id: string;
  source: EvidenceSource;
  event_type?: string; // 'commit' | 'pull_request' | 'deployment' | 'error' | 'metric_anomaly' | 'log_entry' | 'system_event'
  timestamp: string;
  title: string;
  message?: string;
  summary: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  metadata: Record<string, any>;
  related_identifiers?: string[];
  raw_reference?: string | null;
  correlated_event_ids: string[];
  is_root_cause_candidate: boolean;
}

export interface ConnectorStatus {
  connected: boolean;
  available: boolean;
  error?: string | null;
  fallback_available: boolean;
  details?: Record<string, any>;
}

export interface ConnectorsHealthResponse {
  github: ConnectorStatus;
  sentry: ConnectorStatus;
  file: ConnectorStatus;
  demo: ConnectorStatus;
  summary: string;
}

export interface GitHubAcquisitionRequest {
  repository: string;
  branch?: string;
  incident_start_time?: string;
  incident_end_time?: string;
  personal_access_token?: string;
  include_pull_requests?: boolean;
  include_deployments?: boolean;
}

export interface SentryAcquisitionRequest {
  organization?: string;
  project?: string;
  incident_start_time?: string;
  incident_end_time?: string;
  query?: string;
  auth_token?: string;
}

export interface FileAcquisitionRequest {
  filename: string;
  content: string;
  format_hint?: 'auto' | 'log' | 'json' | 'csv' | 'txt';
}

export interface AcquisitionResult {
  source: string;
  events_count: number;
  sources_count: number;
  summary_message: string;
  events: EvidenceEvent[];
  connector_status: ConnectorStatus;
  warnings: string[];
}

export interface Incident {
  id: string;
  title: string;
  summary: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  service: string;
  environment: string;
  started_at: string;
  detected_at: string;
  mitigated_at: string | null;
  sources_connected: EvidenceSource[];
  blast_radius: BlastRadius;
  evidence_count: number;
  primary_hypothesis: string | null;
}

export interface IncidentDetail extends Incident {
  evidence_events: EvidenceEvent[];
  timeline_summary: string;
  key_anomalies: string[];
  suggested_action_items: string[];
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  sample_incidents_loaded: number;
  environment: string;
}

export interface ConnectivityTestResponse {
  status: string;
  client_received?: string;
  latency_probe_echo: string;
  server_time: string;
  active_mode: string;
}
