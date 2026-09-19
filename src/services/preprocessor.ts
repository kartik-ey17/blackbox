import { EvidenceEvent } from '../types/incident';
import {
  PreprocessedIncidentContext,
  TemporalCluster,
  CategorizedEvents,
  CorrelationLink,
  CandidateHypothesis,
  EvidenceGraph,
  EvidenceGraphNode,
  EvidenceGraphEdge,
  EvidenceRelationshipType,
} from '../types/investigation';

/**
 * Deterministic Preprocessing Pipeline for BlackBox Evidence.
 * Runs BEFORE any LLM invocation to build structured, grounded incident context.
 */

// Safe timestamp normalization to epoch millis and ISO string
export function normalizeTimestamp(raw: string | number | Date | undefined): { epoch: number; iso: string } {
  if (!raw) {
    const now = new Date();
    return { epoch: now.getTime(), iso: now.toISOString() };
  }

  if (raw instanceof Date) {
    return { epoch: raw.getTime(), iso: raw.toISOString() };
  }

  if (typeof raw === 'number') {
    const d = new Date(raw);
    return { epoch: d.getTime(), iso: d.toISOString() };
  }

  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    if (!isNaN(parsed)) {
      const d = new Date(parsed);
      return { epoch: d.getTime(), iso: d.toISOString() };
    }
  }

  // Fallback if parsing fails
  const now = new Date();
  return { epoch: now.getTime(), iso: now.toISOString() };
}

/**
 * Step 1 & 2: Normalize timestamps and sort events chronologically.
 */
export function normalizeAndSortEvents(events: EvidenceEvent[]): EvidenceEvent[] {
  return [...events]
    .map((evt) => {
      const { iso } = normalizeTimestamp(evt.timestamp);
      return {
        ...evt,
        timestamp: iso,
      };
    })
    .sort((a, b) => {
      const timeA = normalizeTimestamp(a.timestamp).epoch;
      const timeB = normalizeTimestamp(b.timestamp).epoch;
      return timeA - timeB;
    });
}

/**
 * Step 3: Group related events by identifiers and components.
 */
export function groupRelatedEvents(events: EvidenceEvent[]): Map<string, EvidenceEvent[]> {
  const groups = new Map<string, EvidenceEvent[]>();

  for (const evt of events) {
    const keys: string[] = [];

    // Service or component name
    const service = evt.metadata?.service || evt.metadata?.namespace || evt.metadata?.cluster;
    if (service) keys.push(`service:${service}`);

    // Repository or code identifier
    const repo = evt.metadata?.repo || evt.metadata?.repository;
    if (repo) keys.push(`repo:${repo}`);

    // Commit hash / PR
    const commit = evt.metadata?.commit_hash;
    if (commit) keys.push(`commit:${commit.slice(0, 7)}`);
    const pr = evt.metadata?.pr_number;
    if (pr) keys.push(`pr:${pr}`);

    // Issue ID / Culprit / Error class
    const issue = evt.metadata?.issue_id;
    if (issue) keys.push(`issue:${issue}`);
    const errClass = evt.metadata?.exception_type || evt.metadata?.error_class;
    if (errClass) keys.push(`error_class:${errClass}`);

    // Pod / Host / Endpoint
    const host = evt.metadata?.host || evt.metadata?.pod_name;
    if (host) keys.push(`host:${host}`);
    const endpoint = evt.metadata?.endpoint;
    if (endpoint) keys.push(`endpoint:${endpoint}`);

    // If no distinct keys, group by source
    if (keys.length === 0) {
      keys.push(`source:${evt.source}`);
    }

    for (const key of keys) {
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(evt);
    }
  }

  return groups;
}

/**
 * Step 4: Detect temporal clusters (bursts of events occurring close in time).
 */
export function detectTemporalClusters(
  events: EvidenceEvent[],
  maxGapSeconds = 600 // 10 minutes
): TemporalCluster[] {
  if (events.length === 0) return [];

  const clusters: TemporalCluster[] = [];
  let currentGroup: EvidenceEvent[] = [events[0]];

  for (let i = 1; i < events.length; i++) {
    const prevTime = normalizeTimestamp(events[i - 1].timestamp).epoch;
    const currTime = normalizeTimestamp(events[i].timestamp).epoch;
    const gapSec = (currTime - prevTime) / 1000;

    if (gapSec <= maxGapSeconds) {
      currentGroup.push(events[i]);
    } else {
      // Finalize current cluster
      clusters.push(buildClusterObject(`cluster-${clusters.length + 1}`, currentGroup));
      currentGroup = [events[i]];
    }
  }

  if (currentGroup.length > 0) {
    clusters.push(buildClusterObject(`cluster-${clusters.length + 1}`, currentGroup));
  }

  return clusters;
}

function buildClusterObject(id: string, group: EvidenceEvent[]): TemporalCluster {
  const start = group[0].timestamp;
  const end = group[group.length - 1].timestamp;
  const startTime = normalizeTimestamp(start).epoch;
  const endTime = normalizeTimestamp(end).epoch;
  const durationSec = Math.max(0, Math.round((endTime - startTime) / 1000));

  // Determine dominant source
  const sourceCounts: Record<string, number> = {};
  for (const e of group) {
    sourceCounts[e.source] = (sourceCounts[e.source] || 0) + 1;
  }
  let dominantSource = 'mixed';
  let maxCount = 0;
  for (const [s, count] of Object.entries(sourceCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantSource = s;
    }
  }

  // Classification logic
  let classification = 'Activity Window';
  const hasDeploy = group.some(
    (e) =>
      e.source === 'deployment' ||
      e.event_type === 'deployment' ||
      e.title.toLowerCase().includes('rollout') ||
      e.title.toLowerCase().includes('merged')
  );
  const hasErrors = group.some(
    (e) =>
      e.severity === 'error' ||
      e.severity === 'critical' ||
      e.source === 'sentry' ||
      e.title.toLowerCase().includes('timeout') ||
      e.title.toLowerCase().includes('pool')
  );
  const hasRevert = group.some((e) => e.title.toLowerCase().includes('revert') || e.title.toLowerCase().includes('rollback'));

  if (hasRevert) {
    classification = 'Mitigation / Rollback Window';
  } else if (hasDeploy && hasErrors) {
    classification = 'Deployment & Immediate Fault Cascade';
  } else if (hasDeploy) {
    classification = 'Release / Deployment Window';
  } else if (hasErrors) {
    classification = 'Failure Propagation & Alert Spike';
  }

  return {
    id,
    start_time: start,
    end_time: end,
    event_ids: group.map((e) => e.id),
    event_count: group.length,
    dominant_source: dominantSource,
    classification,
    duration_seconds: durationSec,
  };
}

/**
 * Step 5: Identify event categories (deployments, config changes, errors, etc.).
 */
export function categorizeEvents(events: EvidenceEvent[]): CategorizedEvents {
  const categories: CategorizedEvents = {
    deployments: [],
    config_changes: [],
    errors: [],
    error_spikes: [],
    service_degradations: [],
    dependency_failures: [],
    restarts: [],
    unusual_metrics: [],
  };

  for (const evt of events) {
    const text = `${evt.title} ${evt.summary} ${evt.message || ''} ${JSON.stringify(evt.metadata || {})}`.toLowerCase();

    // Deployments
    if (
      evt.source === 'deployment' ||
      evt.event_type === 'deployment' ||
      evt.event_type === 'pull_request' ||
      evt.event_type === 'commit' ||
      text.includes('rollout') ||
      text.includes('release') ||
      text.includes('merged pr') ||
      text.includes('canary') ||
      text.includes('kubernetes deployment')
    ) {
      categories.deployments.push(evt.id);
    }

    // Config changes
    if (
      text.includes('config') ||
      text.includes('parameter') ||
      text.includes('pool size') ||
      text.includes('env var') ||
      text.includes('threshold') ||
      text.includes('flag') ||
      text.includes('settings') ||
      text.includes('rule_id')
    ) {
      categories.config_changes.push(evt.id);
    }

    // Errors
    if (
      evt.severity === 'error' ||
      evt.severity === 'critical' ||
      evt.source === 'sentry' ||
      text.includes('exception') ||
      text.includes('error') ||
      text.includes('fatal')
    ) {
      categories.errors.push(evt.id);
    }

    // Error spikes
    if (
      text.includes('spike') ||
      text.includes('burst') ||
      text.includes('rate_per_sec') ||
      text.includes('4,210 events') ||
      text.includes('100/100') ||
      text.includes('504 gateway timeout') ||
      text.includes('error rate')
    ) {
      categories.error_spikes.push(evt.id);
    }

    // Service degradation
    if (
      text.includes('timeout') ||
      text.includes('latency') ||
      text.includes('p99') ||
      text.includes('degraded') ||
      text.includes('unresponsive') ||
      text.includes('slow') ||
      text.includes('wait queue') ||
      text.includes('backlog')
    ) {
      categories.service_degradations.push(evt.id);
    }

    // Dependency failures
    if (
      text.includes('database') ||
      text.includes('connection pool') ||
      text.includes('rds') ||
      text.includes('postgres') ||
      text.includes('aurora') ||
      text.includes('upstream server') ||
      text.includes('upstream timed out') ||
      text.includes('pooltimeout') ||
      text.includes('third party') ||
      text.includes('stripe') ||
      text.includes('sqs')
    ) {
      categories.dependency_failures.push(evt.id);
    }

    // Restarts / Crashing
    if (
      text.includes('restart') ||
      text.includes('revert') ||
      text.includes('crash') ||
      text.includes('oomkilled') ||
      text.includes('exit code') ||
      text.includes('rollback')
    ) {
      categories.restarts.push(evt.id);
    }

    // Unusual metrics
    if (
      evt.source === 'metrics' ||
      evt.event_type === 'metric_anomaly' ||
      text.includes('metric alert') ||
      text.includes('threshold') ||
      text.includes('saturated') ||
      text.includes('cpu spike') ||
      text.includes('memory')
    ) {
      categories.unusual_metrics.push(evt.id);
    }
  }

  return categories;
}

/**
 * Step 6: Calculate basic correlations between events.
 */
export function calculateCorrelations(events: EvidenceEvent[]): CorrelationLink[] {
  const correlations: CorrelationLink[] = [];
  const eventMap = new Map<string, EvidenceEvent>(events.map((e) => [e.id, e]));

  for (let i = 0; i < events.length; i++) {
    const a = events[i];
    const timeA = normalizeTimestamp(a.timestamp).epoch;

    for (let j = i + 1; j < events.length; j++) {
      const b = events[j];
      const timeB = normalizeTimestamp(b.timestamp).epoch;
      const deltaSec = Math.round((timeB - timeA) / 1000);

      // Check explicit correlated_event_ids
      const isExplicitlyCorrelated =
        a.correlated_event_ids?.includes(b.id) || b.correlated_event_ids?.includes(a.id);

      // Check shared identifiers
      const shared: string[] = [];
      const getTokens = (e: EvidenceEvent) => {
        const tokens: string[] = [];
        if (e.metadata?.pr_number) tokens.push(`PR #${e.metadata.pr_number}`);
        if (e.metadata?.commit_hash) tokens.push(`commit:${e.metadata.commit_hash}`);
        if (e.metadata?.issue_id) tokens.push(`issue:${e.metadata.issue_id}`);
        if (e.metadata?.service) tokens.push(`service:${e.metadata.service}`);
        if (e.metadata?.cluster) tokens.push(`cluster:${e.metadata.cluster}`);
        if (e.metadata?.pod_name) tokens.push(`pod:${e.metadata.pod_name}`);
        return tokens;
      };

      const tokensA = getTokens(a);
      const tokensB = getTokens(b);
      for (const t of tokensA) {
        if (tokensB.includes(t)) shared.push(t);
      }

      // Proximity check (within 20 minutes)
      const withinProximity = deltaSec >= 0 && deltaSec <= 1200;

      if (isExplicitlyCorrelated || shared.length > 0 || (withinProximity && (a.is_root_cause_candidate || b.is_root_cause_candidate))) {
        let confidence = 50;
        let relation = 'temporal_cooccurrence';

        if (isExplicitlyCorrelated) {
          confidence += 35;
          relation = 'telemetry_trace_link';
        }
        if (shared.length > 0) {
          confidence += 25;
          relation = `shared_identity(${shared.join(', ')})`;
        }
        if (withinProximity) {
          confidence += 15;
        }

        correlations.push({
          event_a_id: a.id,
          event_b_id: b.id,
          relation,
          shared_identifiers: shared,
          temporal_delta_seconds: deltaSec,
          confidence: Math.min(100, confidence),
        });
      }
    }
  }

  return correlations;
}

/**
 * Step 7: Generate candidate hypotheses deterministically.
 */
export function generateCandidateHypotheses(
  events: EvidenceEvent[],
  categories: CategorizedEvents
): CandidateHypothesis[] {
  const candidates: CandidateHypothesis[] = [];
  const rootCauseEvents = events.filter((e) => e.is_root_cause_candidate);

  // Pattern A: Change -> Dependency Failure -> Error Cascade
  const changes = events.filter(
    (e) => categories.deployments.includes(e.id) || categories.config_changes.includes(e.id)
  );
  const depFailures = events.filter((e) => categories.dependency_failures.includes(e.id));
  const errors = events.filter((e) => categories.errors.includes(e.id));

  // If we have an explicit root cause candidate event
  for (const root of rootCauseEvents) {
    const isChange = categories.deployments.includes(root.id) || categories.config_changes.includes(root.id);
    const relatedErrors = errors.filter((err) => root.correlated_event_ids?.includes(err.id));

    candidates.push({
      id: `hyp-${root.id}`,
      title: `${isChange ? 'Code/Deployment Change' : 'Primary Trigger'}: ${root.title}`,
      description: `Analysis of event ${root.id} indicates it initiated resource pressure or failure state. ${root.summary} Subsequent telemetry shows correlated failures propagating across dependent components.`,
      initial_score: 90,
      supporting_event_ids: [root.id, ...relatedErrors.map((e) => e.id)],
      root_cause_candidate_id: root.id,
      causality_chain: [root.id, ...relatedErrors.map((e) => e.id)],
    });
  }

  // Pattern B: Resource Saturation or Metric Anomaly
  const metricAnomalies = events.filter((e) => categories.unusual_metrics.includes(e.id));
  for (const met of metricAnomalies) {
    if (!candidates.some((c) => c.supporting_event_ids.includes(met.id))) {
      candidates.push({
        id: `hyp-${met.id}`,
        title: `Resource Exhaustion / Saturation: ${met.title}`,
        description: `Observed metric anomaly ${met.id} exceeded alert thresholds. ${met.summary} May represent the direct causal mechanism for application timeout cascade.`,
        initial_score: 75,
        supporting_event_ids: [met.id],
        root_cause_candidate_id: met.id,
      });
    }
  }

  // Pattern C: External Dependency or Upstream Outage
  if (candidates.length === 0) {
    candidates.push({
      id: 'hyp-generic-upstream',
      title: 'Upstream or Infrastructure Degradation',
      description: 'Multiple errors observed without a clear internal deployment trigger in recent telemetry. Potential external service disruption or infrastructure network partition.',
      initial_score: 60,
      supporting_event_ids: errors.slice(0, 3).map((e) => e.id),
    });
  }

  return candidates.sort((a, b) => b.initial_score - a.initial_score);
}

/**
 * Step 8: Build the Evidence Graph.
 * Node Categories: CHANGE -> ANOMALY -> ERROR -> IMPACT
 */
export function buildEvidenceGraph(
  events: EvidenceEvent[],
  categories: CategorizedEvents
): EvidenceGraph {
  const nodes: EvidenceGraphNode[] = [];
  const edges: EvidenceGraphEdge[] = [];
  const nodeMap = new Map<string, EvidenceGraphNode>();

  // Classify each event into CHANGE, ANOMALY, ERROR, or IMPACT
  for (const evt of events) {
    let category: EvidenceRelationshipType = 'ERROR';
    const text = `${evt.title} ${evt.summary}`.toLowerCase();

    if (
      categories.deployments.includes(evt.id) ||
      categories.config_changes.includes(evt.id) ||
      evt.source === 'github' ||
      evt.source === 'deployment'
    ) {
      category = 'CHANGE';
    } else if (
      categories.unusual_metrics.includes(evt.id) ||
      text.includes('saturated') ||
      text.includes('pool exhausted') ||
      text.includes('memory') ||
      text.includes('queue')
    ) {
      category = 'ANOMALY';
    } else if (
      text.includes('504') ||
      text.includes('gateway timeout') ||
      text.includes('users affected') ||
      text.includes('impact') ||
      evt.source === 'network'
    ) {
      category = 'IMPACT';
    } else {
      category = 'ERROR';
    }

    const node: EvidenceGraphNode = {
      id: `node-${evt.id}`,
      event_id: evt.id,
      label: evt.title,
      source: evt.source,
      category,
      timestamp: evt.timestamp,
      details: evt.summary,
      severity: evt.severity,
      is_root_cause_candidate: evt.is_root_cause_candidate,
    };

    nodes.push(node);
    nodeMap.set(evt.id, node);
  }

  // Generate edges based on explicit correlations, timestamps, and causal categories
  let edgeId = 1;
  const edgeKeys = new Set<string>();

  const addEdge = (
    fromEvtId: string,
    toEvtId: string,
    reason: string,
    confidence: number,
    relationship_type?: EvidenceGraphEdge['relationship_type']
  ) => {
    const key = `${fromEvtId}->${toEvtId}`;
    if (edgeKeys.has(key) || fromEvtId === toEvtId) return;
    edgeKeys.add(key);

    edges.push({
      id: `edge-${edgeId++}`,
      source_node_id: `node-${fromEvtId}`,
      target_node_id: `node-${toEvtId}`,
      reason,
      confidence,
      relationship_type: relationship_type || 'propagated_to',
    });
  };

  // 1. Explicit correlations
  for (const evt of events) {
    if (evt.correlated_event_ids) {
      for (const targetId of evt.correlated_event_ids) {
        if (nodeMap.has(targetId)) {
          const fromNode = nodeMap.get(evt.id)!;
          const toNode = nodeMap.get(targetId)!;

          let reason = `Correlated telemetry between ${fromNode.source} and ${toNode.source}`;
          if (fromNode.category === 'CHANGE' && toNode.category === 'ANOMALY') {
            reason = 'Deployment change triggered resource anomaly';
          } else if (fromNode.category === 'ANOMALY' && toNode.category === 'ERROR') {
            reason = 'Resource exhaustion caused application connection exceptions';
          } else if (fromNode.category === 'ERROR' && toNode.category === 'IMPACT') {
            reason = 'Backend errors propagated to ingress gateway timeouts';
          } else if (toNode.label.toLowerCase().includes('revert')) {
            reason = 'Root cause identified; rollback applied to mitigate';
          }

          addEdge(evt.id, targetId, reason, 90, 'triggered');
        }
      }
    }
  }

  // 2. Causal sequence fallback if few edges
  if (edges.length < nodes.length - 1) {
    const changes = nodes.filter((n) => n.category === 'CHANGE' && !n.label.toLowerCase().includes('revert'));
    const anomalies = nodes.filter((n) => n.category === 'ANOMALY');
    const errors = nodes.filter((n) => n.category === 'ERROR');
    const impacts = nodes.filter((n) => n.category === 'IMPACT');

    for (const ch of changes) {
      for (const an of anomalies) {
        addEdge(ch.event_id, an.event_id, 'Change preceded metric anomaly', 75, 'triggered');
      }
    }

    for (const an of anomalies) {
      for (const er of errors) {
        addEdge(an.event_id, er.event_id, 'Resource anomaly caused exceptions', 80, 'propagated_to');
      }
    }

    for (const er of errors) {
      for (const im of impacts) {
        addEdge(er.event_id, im.event_id, 'Errors resulted in user-facing timeout impact', 85, 'propagated_to');
      }
    }
  }

  return { nodes, edges };
}

/**
 * Main Deterministic Preprocessing Pipeline Entrypoint.
 * Executes steps 1 through 8.
 */
export function preprocessIncident(events: EvidenceEvent[]): PreprocessedIncidentContext {
  // Step 1 & 2: Normalize and sort
  const sorted = normalizeAndSortEvents(events);

  // Step 3: Group related events
  const groups = groupRelatedEvents(sorted);

  // Step 4: Detect temporal clusters
  const clusters = detectTemporalClusters(sorted);

  // Step 5: Categorize events
  const categories = categorizeEvents(sorted);

  // Step 6: Calculate correlations
  const correlations = calculateCorrelations(sorted);

  // Step 7: Generate candidate hypotheses
  const candidateHypotheses = generateCandidateHypotheses(sorted, categories);

  // Step 8: Build evidence graph
  const evidenceGraph = buildEvidenceGraph(sorted, categories);

  const startTime = sorted.length > 0 ? sorted[0].timestamp : new Date().toISOString();
  const endTime = sorted.length > 0 ? sorted[sorted.length - 1].timestamp : new Date().toISOString();
  const durationMinutes = Math.max(
    1,
    Math.round(
      (normalizeTimestamp(endTime).epoch - normalizeTimestamp(startTime).epoch) / (1000 * 60)
    )
  );

  return {
    normalized_event_count: sorted.length,
    start_time: startTime,
    end_time: endTime,
    duration_minutes: durationMinutes,
    clusters,
    categorized_events: categories,
    correlations,
    candidate_hypotheses: candidateHypotheses,
    evidence_graph: evidenceGraph,
  };
}
