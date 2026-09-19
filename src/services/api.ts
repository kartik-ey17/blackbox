import {
  Incident,
  IncidentDetail,
  EvidenceEvent,
  HealthResponse,
  ConnectivityTestResponse,
  ConnectorsHealthResponse,
  GitHubAcquisitionRequest,
  SentryAcquisitionRequest,
  FileAcquisitionRequest,
  AcquisitionResult,
} from '../types/incident';
import {
  IncidentInvestigation,
  InvestigateRequest,
  ChallengeRequest,
  ChallengeResult,
  PreprocessedIncidentContext,
} from '../types/investigation';
import { SAMPLE_INCIDENTS } from '../data/fixtures';
import { getAcquisitionService } from './providers';
import { preprocessIncident } from './preprocessor';
import { buildDeterministicInvestigation } from './investigator';

const DEFAULT_API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

let activeApiBase = localStorage.getItem('blackbox_api_override') || DEFAULT_API_BASE;

export function getActiveApiUrl(): string {
  return activeApiBase;
}

export function setActiveApiUrl(url: string) {
  activeApiBase = url.trim().replace(/\/$/, '');
  if (activeApiBase) {
    localStorage.setItem('blackbox_api_override', activeApiBase);
  } else {
    localStorage.removeItem('blackbox_api_override');
  }
}

export function resetApiUrl() {
  activeApiBase = DEFAULT_API_BASE;
  localStorage.removeItem('blackbox_api_override');
}

export interface HealthCheckResult {
  ok: boolean;
  latencyMs: number;
  urlTested: string;
  data?: HealthResponse;
  error?: string;
  statusCode?: number;
}

export async function checkBackendHealth(targetBaseUrl?: string): Promise<HealthCheckResult> {
  const base = (targetBaseUrl !== undefined ? targetBaseUrl : activeApiBase).replace(/\/$/, '');
  const url = base ? `${base}/health` : '/health';
  const startTime = performance.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      // Try fallback to /api/health
      const fallbackUrl = base ? `${base}/api/health` : '/api/health';
      const fallbackResp = await fetch(fallbackUrl, {
        headers: { 'Accept': 'application/json' },
      });
      if (fallbackResp.ok) {
        const data = (await fallbackResp.json()) as HealthResponse;
        return {
          ok: true,
          latencyMs,
          urlTested: fallbackUrl,
          data,
          statusCode: fallbackResp.status,
        };
      }

      return {
        ok: false,
        latencyMs,
        urlTested: url,
        statusCode: response.status,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = (await response.json()) as HealthResponse;
    return {
      ok: true,
      latencyMs,
      urlTested: url,
      data,
      statusCode: response.status,
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      ok: false,
      latencyMs,
      urlTested: url,
      error: err.name === 'AbortError' ? 'Connection timed out (>6s)' : (err.message || 'Network error'),
    };
  }
}

export async function testConnectivityProbe(targetBaseUrl?: string): Promise<{ ok: boolean; latencyMs: number; data?: ConnectivityTestResponse; error?: string }> {
  const base = (targetBaseUrl !== undefined ? targetBaseUrl : activeApiBase).replace(/\/$/, '');
  const url = base ? `${base}/api/integrations/test` : '/api/integrations/test';
  const startTime = performance.now();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        client_id: 'blackbox-web-client',
        client_timestamp: new Date().toISOString(),
      }),
    });
    const latencyMs = Math.round(performance.now() - startTime);
    if (!response.ok) {
      throw new Error(`Status ${response.status}`);
    }
    const data = await response.json();
    return { ok: true, latencyMs, data };
  } catch (err: any) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - startTime),
      error: err.message || 'Failed to reach probe endpoint',
    };
  }
}

export async function fetchIncidents(): Promise<Incident[]> {
  const base = activeApiBase;
  const url = base ? `${base}/api/incidents` : '/api/incidents';

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch incidents: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.warn('[BlackBox API] Network request failed, using in-memory demo fixtures:', err);
    // Return base models from fixtures
    return SAMPLE_INCIDENTS.map(({ evidence_events, timeline_summary, key_anomalies, suggested_action_items, ...base }) => base);
  }
}

export async function fetchIncidentDetail(incidentId: string): Promise<IncidentDetail> {
  const base = activeApiBase;
  const url = base ? `${base}/api/incidents/${incidentId}` : '/api/incidents/${incidentId}';

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch incident ${incidentId}: ${response.statusText}`);
    }

    return await response.json();
  } catch (err) {
    console.warn(`[BlackBox API] Request failed for ${incidentId}, using fixture fallback:`, err);
    const found = SAMPLE_INCIDENTS.find(i => i.id === incidentId);
    if (!found) {
      throw new Error(`Incident ${incidentId} not found`);
    }
    return found;
  }
}

export async function fetchIncidentTimeline(incidentId: string): Promise<EvidenceEvent[]> {
  const base = activeApiBase;
  const url = base ? `${base}/api/incidents/${incidentId}/timeline` : `/api/incidents/${incidentId}/timeline`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch timeline for ${incidentId}`);
    }

    return await response.json();
  } catch (err) {
    console.warn(`[BlackBox API] Timeline request failed for ${incidentId}, using fixture fallback:`, err);
    const found = SAMPLE_INCIDENTS.find(i => i.id === incidentId);
    return found ? found.evidence_events : [];
  }
}

export async function uploadIncidentFile(file: File): Promise<{ ok: boolean; message: string; filename: string }> {
  const base = activeApiBase;
  const url = base ? `${base}/api/ingest/file` : '/api/ingest/file';

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed with status ${response.status}`);
    }

    const result = await response.json();
    return { ok: true, message: result.message, filename: file.name };
  } catch (err: any) {
    return {
      ok: false,
      message: err.message || 'File ingestion error',
      filename: file.name,
    };
  }
}

// -------------------------------------------------------------------------
// Evidence Acquisition Client Methods (Stage 2)
// -------------------------------------------------------------------------

export async function fetchConnectorsStatus(): Promise<ConnectorsHealthResponse> {
  const base = activeApiBase;
  const url = base ? `${base}/api/connectors/status` : '/api/connectors/status';

  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.warn('[BlackBox API] Connectors status probe failed, using in-memory provider status:', err);
    const service = getAcquisitionService();
    return await service.getAllConnectorStatuses();
  }
}

export async function acquireGitHubEvidence(payload: GitHubAcquisitionRequest): Promise<AcquisitionResult> {
  const base = activeApiBase;
  const url = base ? `${base}/api/connectors/github/collect` : '/api/connectors/github/collect';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.warn('[BlackBox API] GitHub remote fetch failed, using local provider fallback:', err);
    const service = getAcquisitionService();
    return await service.acquireFromGitHub(payload);
  }
}

export async function acquireSentryEvidence(payload: SentryAcquisitionRequest): Promise<AcquisitionResult> {
  const base = activeApiBase;
  const url = base ? `${base}/api/connectors/sentry/collect` : '/api/connectors/sentry/collect';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.warn('[BlackBox API] Sentry remote fetch failed, using local provider fallback:', err);
    const service = getAcquisitionService();
    return await service.acquireFromSentry(payload);
  }
}

export async function acquireFileEvidence(payload: FileAcquisitionRequest): Promise<AcquisitionResult> {
  const base = activeApiBase;
  const url = base ? `${base}/api/connectors/file/collect` : '/api/connectors/file/collect';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.warn('[BlackBox API] File ingestion request failed, using local provider fallback:', err);
    const service = getAcquisitionService();
    return await service.acquireFromFile(payload);
  }
}

export async function acquireDemoEvidence(incidentId: string, filterSource?: string): Promise<AcquisitionResult> {
  const base = activeApiBase;
  const url = base ? `${base}/api/connectors/demo/collect` : '/api/connectors/demo/collect';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ incident_id: incidentId, filter_source: filterSource }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.warn('[BlackBox API] Demo acquisition request failed, using local provider fallback:', err);
    const service = getAcquisitionService();
    return await service.acquireFromDemo({ incident_id: incidentId, filter_source: filterSource });
  }
}

// -------------------------------------------------------------------------
// Stage 3 Investigation Engine Client Methods
// -------------------------------------------------------------------------

export async function investigateIncidentApi(
  payload: InvestigateRequest
): Promise<IncidentInvestigation> {
  const base = activeApiBase;
  const url = base ? `${base}/api/investigate` : '/api/investigate';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.warn('[BlackBox API] Investigation API request failed, executing client-side deterministic pipeline:', err);
    const preprocessed = preprocessIncident(payload.evidence_events);
    return buildDeterministicInvestigation(
      payload.evidence_events,
      preprocessed,
      payload.incident_title,
      'Client-side fallback: backend unreachable'
    );
  }
}

export async function fetchIncidentInvestigationApi(
  incidentId: string
): Promise<IncidentInvestigation> {
  const base = activeApiBase;
  const url = base ? `${base}/api/incidents/${incidentId}/investigation` : `/api/incidents/${incidentId}/investigation`;

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.warn(`[BlackBox API] Get investigation failed for ${incidentId}, generating client-side fallback:`, err);
    const found = SAMPLE_INCIDENTS.find((i) => i.id === incidentId) || SAMPLE_INCIDENTS[0];
    const preprocessed = preprocessIncident(found.evidence_events);
    return buildDeterministicInvestigation(
      found.evidence_events,
      preprocessed,
      found.title,
      'Client-side fallback: server endpoint unreachable'
    );
  }
}

export async function challengeHypothesisApi(
  payload: ChallengeRequest
): Promise<ChallengeResult> {
  const base = activeApiBase;
  const url = base
    ? payload.incident_id
      ? `${base}/api/incidents/${payload.incident_id}/challenge`
      : `${base}/api/challenge`
    : payload.incident_id
    ? `/api/incidents/${payload.incident_id}/challenge`
    : '/api/challenge';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.warn('[BlackBox API] Challenge endpoint failed, evaluating client-side challenge heuristics:', err);
    const events = payload.evidence_events;
    const rootEvt = events.find((e) => e.is_root_cause_candidate);
    const contradictions: { event_id: string; contradiction: string; severity: 'minor' | 'significant' | 'critical' }[] = [];
    const support: { event_id: string; observation: string }[] = [];

    for (const evt of events) {
      if (evt.is_root_cause_candidate) {
        support.push({
          event_id: evt.id,
          observation: `Identified as root-cause candidate in ${evt.source}: ${evt.title}`,
        });
      }
      if (rootEvt && new Date(evt.timestamp).getTime() < new Date(rootEvt.timestamp).getTime() && (evt.severity === 'error' || evt.severity === 'critical')) {
        contradictions.push({
          event_id: evt.id,
          contradiction: `Error ${evt.id} occurred before trigger ${rootEvt.id}; potential confounding factor.`,
          severity: 'significant',
        });
      }
    }

    return {
      hypothesis_challenged: payload.primary_hypothesis,
      evidence_supporting: support,
      evidence_against: contradictions,
      missing_evidence: [
        'Pre-incident connection pool baseline metrics',
        'Database query execution wait histograms',
      ],
      original_confidence: 90,
      revised_confidence: contradictions.length > 0 ? 70 : 85,
      should_remain_primary: contradictions.length === 0,
      challenge_verdict: contradictions.length > 0
        ? 'Hypothesis challenged: Pre-existing errors detected before trigger timestamp.'
        : 'Hypothesis upheld: Temporal alignment and rollback resolution strongly substantiate root cause.',
      alternative_explanation_if_rejected: null,
      challenged_at: new Date().toISOString(),
      used_ai: false,
    };
  }
}

