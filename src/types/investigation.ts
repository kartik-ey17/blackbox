import { EvidenceEvent, EvidenceSource } from './incident';

export type EvidenceRelationshipType = 'CHANGE' | 'ANOMALY' | 'ERROR' | 'IMPACT';

export interface EvidenceGraphNode {
  id: string; // unique node id, e.g. "node-evt-gh-412"
  event_id: string; // original evidence event ID
  label: string;
  source: EvidenceSource | string;
  category: EvidenceRelationshipType;
  timestamp: string;
  details: string;
  severity?: string;
  is_root_cause_candidate?: boolean;
}

export interface EvidenceGraphEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  reason: string;
  confidence: number; // 0-100
  relationship_type?: 'triggered' | 'propagated_to' | 'correlated_with' | 'mitigated_by';
}

export interface EvidenceGraph {
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
}

export interface TemporalCluster {
  id: string;
  start_time: string;
  end_time: string;
  event_ids: string[];
  event_count: number;
  dominant_source: string;
  classification: string; // e.g. "Deployment Window", "Cascading Failure Burst", "Mitigation Rollback"
  duration_seconds: number;
}

export interface CategorizedEvents {
  deployments: string[]; // event IDs
  config_changes: string[];
  errors: string[];
  error_spikes: string[];
  service_degradations: string[];
  dependency_failures: string[];
  restarts: string[];
  unusual_metrics: string[];
}

export interface CorrelationLink {
  event_a_id: string;
  event_b_id: string;
  relation: string;
  shared_identifiers: string[];
  temporal_delta_seconds: number;
  confidence: number;
}

export interface CandidateHypothesis {
  id: string;
  title: string;
  description: string;
  initial_score: number; // 0 - 100
  supporting_event_ids: string[];
  root_cause_candidate_id?: string;
  causality_chain?: string[];
}

export interface PreprocessedIncidentContext {
  normalized_event_count: number;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  clusters: TemporalCluster[];
  categorized_events: CategorizedEvents;
  correlations: CorrelationLink[];
  candidate_hypotheses: CandidateHypothesis[];
  evidence_graph: EvidenceGraph;
}

export interface SupportingEvidenceItem {
  event_id: string;
  claim: string;
  reason: string;
  source: string;
  distinction: 'SUPPORTED BY EVIDENCE' | 'CONTRADICTED BY EVIDENCE' | 'UNKNOWN';
}

export interface ContradictingEvidenceItem {
  event_id: string;
  claim: string;
  reason: string;
  source: string;
  distinction: 'SUPPORTED BY EVIDENCE' | 'CONTRADICTED BY EVIDENCE' | 'UNKNOWN';
}

export interface AlternativeHypothesis {
  hypothesis: string;
  why_unlikely: string;
  referenced_event_ids: string[];
  likelihood_pct: number;
}

export interface RecommendedAction {
  action: string;
  type: 'immediate_mitigation' | 'preventative';
  priority: 'high' | 'medium' | 'low';
  rationale: string;
  target_component?: string;
}

export interface TimelineEntry {
  timestamp: string;
  event_id: string;
  event_type: string;
  source: string;
  summary: string;
  phase: 'trigger' | 'propagation' | 'detection' | 'mitigation';
}

export interface DistinctionSummary {
  supported_by_evidence: string[];
  contradicted_by_evidence: string[];
  unknown: string[];
}

export interface ChallengeResult {
  hypothesis_challenged: string;
  evidence_supporting: {
    event_id: string;
    observation: string;
  }[];
  evidence_against: {
    event_id: string;
    contradiction: string;
    severity: 'minor' | 'significant' | 'critical';
  }[];
  missing_evidence: string[];
  original_confidence: number;
  revised_confidence: number;
  should_remain_primary: boolean;
  challenge_verdict: string;
  alternative_explanation_if_rejected?: string | null;
  challenged_at: string;
  used_ai: boolean;
}

export interface IncidentInvestigation {
  incident_id?: string;
  incident_summary: string;
  start_time: string;
  end_time: string;
  timeline: TimelineEntry[];
  detected_anomalies: string[];
  candidate_causes: string[];
  primary_hypothesis: string;
  confidence: number; // 0-100 investigation confidence
  distinction_summary: DistinctionSummary;
  supporting_evidence: SupportingEvidenceItem[];
  contradicting_evidence: ContradictingEvidenceItem[];
  alternative_hypotheses: AlternativeHypothesis[];
  recommended_actions: RecommendedAction[];
  missing_evidence: string[];
  investigation_limitations: string[];
  evidence_graph: EvidenceGraph;
  preprocessed_context?: PreprocessedIncidentContext;
  investigation_status: 'completed' | 'challenged' | 'fallback_deterministic' | 'insufficient_evidence';
  ai_investigation_available: boolean;
  investigator_mode: 'gemini_senior_investigator' | 'deterministic_rule_engine';
  generated_at: string;
  challenge_history?: ChallengeResult[];
}

export interface InvestigateRequest {
  incident_id?: string;
  incident_title?: string;
  evidence_events: EvidenceEvent[];
  force_refresh?: boolean;
}

export interface ChallengeRequest {
  incident_id?: string;
  primary_hypothesis: string;
  evidence_events: EvidenceEvent[];
}
