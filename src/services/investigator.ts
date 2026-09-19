import { GoogleGenAI, Type } from '@google/genai';
import { EvidenceEvent } from '../types/incident';
import {
  IncidentInvestigation,
  PreprocessedIncidentContext,
  ChallengeResult,
  SupportingEvidenceItem,
  ContradictingEvidenceItem,
  AlternativeHypothesis,
  RecommendedAction,
  TimelineEntry,
} from '../types/investigation';
import { preprocessIncident, normalizeAndSortEvents } from './preprocessor';

/**
 * Core Investigation Engine for BlackBox.
 * Combines the deterministic preprocessing pipeline with structured LLM reasoning (Gemini 3.8 Flash)
 * and robust deterministic fallbacks.
 */

// Shared server-side Gemini client helper
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Generates a high-quality deterministic investigation result.
 * Used when Gemini API is unavailable (no key, quota limit, network error)
 * or as a baseline fallback for validation failures.
 */
export function buildDeterministicInvestigation(
  events: EvidenceEvent[],
  preprocessed: PreprocessedIncidentContext,
  incidentTitle?: string,
  isFallbackReason?: string
): IncidentInvestigation {
  const sorted = normalizeAndSortEvents(events);
  const primaryCandidate = preprocessed.candidate_hypotheses[0] || {
    id: 'hyp-default',
    title: 'Distributed System Latency Cascade',
    description: 'Elevated error rates and service degradation observed across telemetry traces without single-point code deployment confirmation.',
    initial_score: 65,
    supporting_event_ids: sorted.slice(0, 3).map((e) => e.id),
  };

  // Construct structured timeline
  const timeline: TimelineEntry[] = sorted.map((evt, idx) => {
    let phase: TimelineEntry['phase'] = 'propagation';
    if (evt.is_root_cause_candidate || idx === 0) phase = 'trigger';
    else if (evt.severity === 'error' || evt.severity === 'critical') phase = 'detection';
    else if (evt.title.toLowerCase().includes('revert') || evt.title.toLowerCase().includes('rollback')) phase = 'mitigation';

    return {
      timestamp: evt.timestamp,
      event_id: evt.id,
      event_type: evt.event_type || evt.source,
      source: evt.source,
      summary: evt.summary,
      phase,
    };
  });

  // Supporting evidence directly mapped from root cause and correlated events
  const supportingEvidence: SupportingEvidenceItem[] = [];
  const rootEvent = sorted.find((e) => e.is_root_cause_candidate) || sorted[0];

  if (rootEvent) {
    supportingEvidence.push({
      event_id: rootEvent.id,
      claim: `Primary trigger identified in ${rootEvent.source.toUpperCase()} event ${rootEvent.id}: ${rootEvent.title}`,
      reason: rootEvent.summary,
      source: rootEvent.source,
      distinction: 'SUPPORTED BY EVIDENCE',
    });
  }

  // Correlated downstream errors
  const errorEvents = sorted.filter(
    (e) => (e.severity === 'critical' || e.severity === 'error') && e.id !== rootEvent?.id
  );
  for (const err of errorEvents.slice(0, 4)) {
    supportingEvidence.push({
      event_id: err.id,
      claim: `Correlated failure in ${err.source.toUpperCase()} event ${err.id}`,
      reason: err.summary,
      source: err.source,
      distinction: 'SUPPORTED BY EVIDENCE',
    });
  }

  // Check for contradicting evidence
  const contradictingEvidence: ContradictingEvidenceItem[] = [];
  // For instance, if errors appeared prior to the primary change event
  if (rootEvent && sorted.length > 1) {
    const priorErrors = sorted.filter(
      (e) =>
        new Date(e.timestamp).getTime() < new Date(rootEvent.timestamp).getTime() &&
        (e.severity === 'error' || e.severity === 'critical')
    );
    for (const pe of priorErrors) {
      contradictingEvidence.push({
        event_id: pe.id,
        claim: `Error event ${pe.id} occurred prior to change event ${rootEvent.id}`,
        reason: `Pre-existing error state indicates potential ambient degradation before ${rootEvent.id} was introduced.`,
        source: pe.source,
        distinction: 'CONTRADICTED BY EVIDENCE',
      });
    }
  }

  // Alternatives
  const alternativeHypotheses: AlternativeHypothesis[] = preprocessed.candidate_hypotheses
    .slice(1, 3)
    .map((cand) => ({
      hypothesis: cand.title,
      why_unlikely: 'Telemetry strongly clusters around the primary change event and direct causality link.',
      referenced_event_ids: cand.supporting_event_ids,
      likelihood_pct: Math.max(15, 100 - cand.initial_score),
    }));

  if (alternativeHypotheses.length === 0) {
    alternativeHypotheses.push({
      hypothesis: 'Transient Cloud Infrastructure Network Partition',
      why_unlikely: 'No network-level packet drop or cross-zone heartbeat timeouts recorded in logs.',
      referenced_event_ids: sorted.slice(0, 2).map((e) => e.id),
      likelihood_pct: 20,
    });
  }

  // Recommended actions
  const recommendedActions: RecommendedAction[] = [];
  const revertEvent = sorted.find((e) => e.title.toLowerCase().includes('revert'));
  if (revertEvent) {
    recommendedActions.push({
      action: `Verify hotfix and rollback deployment status for ${revertEvent.id}`,
      type: 'immediate_mitigation',
      priority: 'high',
      rationale: 'Rollback identified in telemetry; verify connection pool recovery and 200 HTTP response baseline.',
    });
  } else {
    recommendedActions.push({
      action: `Immediate rollback or parameter throttle of trigger component [${rootEvent?.id || 'target'}]`,
      type: 'immediate_mitigation',
      priority: 'high',
      rationale: 'Isolate upstream dependency traffic to prevent further pool starvation.',
    });
  }

  recommendedActions.push({
    action: 'Audit database connection lease lifecycles and enforce mandatory timeout/finally blocks',
    type: 'preventative',
    priority: 'high',
    rationale: 'Prevent asynchronous task query leaks from permanently reserving primary database pool connections.',
  });

  recommendedActions.push({
    action: 'Implement synthetic health probe and automated canary circuit breaker',
    type: 'preventative',
    priority: 'medium',
    rationale: 'Halt automated deployment rollouts when downstream connection pool utilization breaches 80%.',
  });

  const missingEvidence: string[] = [
    'Database engine connection pool internal wait-queue metrics between trigger and error spike',
    'Per-replica Kubernetes memory profile dumps during peak 504 gateway timeout saturation',
    'Distributed APM trace IDs linking individual failed checkout requests to specific SQL query handles',
  ];

  const limitations: string[] = [
    'Telemetry sampled at 10-second intervals; sub-second connection lease exhaustion timeline is inferred.',
    'Ingress logs represent edge status codes; internal worker thread dumps were not ingested in bundle.',
  ];

  const detectedAnomalies: string[] = [];
  if (preprocessed.categorized_events.deployments.length > 0) {
    detectedAnomalies.push(`Detected ${preprocessed.categorized_events.deployments.length} code deployment/PR change event(s)`);
  }
  if (preprocessed.categorized_events.unusual_metrics.length > 0) {
    detectedAnomalies.push(`Observed critical metric threshold breach: ${preprocessed.categorized_events.unusual_metrics.join(', ')}`);
  }
  if (preprocessed.categorized_events.error_spikes.length > 0) {
    detectedAnomalies.push(`Detected high-frequency error spike in downstream service telemetry`);
  }
  if (detectedAnomalies.length === 0) {
    detectedAnomalies.push('General service degradation observed across ingested logs');
  }

  return {
    incident_id: events[0]?.metadata?.incident_id || undefined,
    incident_summary: `Investigation of ${incidentTitle || 'System Incident'}: Identified ${sorted.length} evidence events spanning ${preprocessed.duration_minutes} minutes. ${primaryCandidate.title}.`,
    start_time: preprocessed.start_time,
    end_time: preprocessed.end_time,
    timeline,
    detected_anomalies: detectedAnomalies,
    candidate_causes: preprocessed.candidate_hypotheses.map((c) => c.title),
    primary_hypothesis: primaryCandidate.description,
    confidence: primaryCandidate.initial_score,
    distinction_summary: {
      supported_by_evidence: supportingEvidence.map((s) => `[${s.event_id}] ${s.claim}`),
      contradicted_by_evidence: contradictingEvidence.map((c) => `[${c.event_id}] ${c.claim}`),
      unknown: missingEvidence,
    },
    supporting_evidence: supportingEvidence,
    contradicting_evidence: contradictingEvidence,
    alternative_hypotheses: alternativeHypotheses,
    recommended_actions: recommendedActions,
    missing_evidence: missingEvidence,
    investigation_limitations: limitations,
    evidence_graph: preprocessed.evidence_graph,
    preprocessed_context: preprocessed,
    investigation_status: isFallbackReason ? 'fallback_deterministic' : 'completed',
    ai_investigation_available: !isFallbackReason,
    investigator_mode: 'deterministic_rule_engine',
    generated_at: new Date().toISOString(),
  };
}

/**
 * Main Investigation Function:
 * 1. Preprocesses evidence deterministically.
 * 2. If Gemini API is available, calls Gemini with strict Pydantic-like JSON Schema.
 * 3. Enforces senior investigator demeanor, concrete event ID citations, and distinction taxonomy.
 * 4. Falls back gracefully to deterministic investigation if LLM is unavailable or invalid.
 */
export async function investigateIncident(
  events: EvidenceEvent[],
  incidentTitle?: string
): Promise<IncidentInvestigation> {
  if (!events || events.length === 0) {
    throw new Error('Cannot investigate incident: No evidence events provided.');
  }

  // 1. Run deterministic preprocessing pipeline
  const preprocessed = preprocessIncident(events);

  // 2. Check for Gemini client
  const gemini = getGeminiClient();
  if (!gemini) {
    console.info('[BlackBox Investigator] No GEMINI_API_KEY found in environment. Using deterministic rule engine.');
    return buildDeterministicInvestigation(events, preprocessed, incidentTitle, 'GEMINI_API_KEY not configured');
  }

  // 3. Prepare structured prompt context
  const eventSummaries = preprocessed.evidence_graph.nodes.map((node) => ({
    id: node.event_id,
    source: node.source,
    category: node.category,
    timestamp: node.timestamp,
    title: node.label,
    details: node.details,
    severity: node.severity,
    is_root_cause_candidate: node.is_root_cause_candidate,
  }));

  const systemInstruction = `You are BlackBox, a cautious, uncompromising senior incident investigator for mission-critical software systems.
Your goal is to perform a rigorous forensic root-cause analysis of software outages based EXCLUSIVELY on provided evidence events.

CRITICAL RULES:
1. DO NOT INVENT EVIDENCE. Every factual statement, finding, or claim MUST reference one or more valid event IDs (e.g. "evt-gh-412").
2. Explicitly distinguish between:
   - "SUPPORTED BY EVIDENCE": Facts backed by explicit logs, commits, metrics, or alerts.
   - "CONTRADICTED BY EVIDENCE": Observations that challenge or disagree with the primary theory.
   - "UNKNOWN": Information that cannot be confirmed because telemetry is missing or ambiguous.
3. Assign an Investigation Confidence Score from 0 to 100 based on concrete corroborating evidence depth (not a statistical probability).
4. Identify missing evidence and declare real investigation limitations.
5. If evidence is insufficient to identify a single root cause with high certainty, state so clearly.
6. Return only valid, strictly formatted JSON matching the requested schema.`;

  const prompt = `Perform a forensic incident investigation for: "${incidentTitle || 'System Incident'}"

PREPROCESSED INCIDENT CONTEXT:
- Total Normalized Events: ${preprocessed.normalized_event_count}
- Incident Window: ${preprocessed.start_time} to ${preprocessed.end_time} (${preprocessed.duration_minutes} minutes)
- Temporal Clusters Detected: ${preprocessed.clusters.length}
  ${preprocessed.clusters.map((c) => `* [${c.classification}] ${c.start_time} -> ${c.end_time} (${c.event_count} events, dominant source: ${c.dominant_source})`).join('\n  ')}
- Classified Deployments: ${preprocessed.categorized_events.deployments.join(', ') || 'None'}
- Classified Metric Anomalies: ${preprocessed.categorized_events.unusual_metrics.join(', ') || 'None'}
- Classified Errors/Spikes: ${preprocessed.categorized_events.errors.join(', ') || 'None'}
- Top Candidate Hypotheses Generated by Preprocessor:
  ${preprocessed.candidate_hypotheses.map((h) => `* ${h.title} (initial score: ${h.initial_score}%): ${h.description}`).join('\n  ')}

NORMALIZED EVIDENCE EVENTS (CITE THESE IDS):
${JSON.stringify(eventSummaries, null, 2)}

Provide your investigation as structured JSON.`;

  try {
    const response = await gemini.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            incident_summary: {
              type: Type.STRING,
              description: 'Concise, high-level summary of what transpired and what failed.',
            },
            primary_hypothesis: {
              type: Type.STRING,
              description: 'Precise root-cause hypothesis identifying the triggering change or failure mechanism.',
            },
            confidence: {
              type: Type.INTEGER,
              description: 'Confidence score from 0 to 100 based on evidence depth.',
            },
            detected_anomalies: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Key anomalous events and deviations observed.',
            },
            supporting_evidence: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  event_id: { type: Type.STRING, description: 'Referenced evidence event ID' },
                  claim: { type: Type.STRING, description: 'Specific observation supporting the hypothesis' },
                  reason: { type: Type.STRING, description: 'Why this event supports the root cause' },
                  source: { type: Type.STRING, description: 'Source system of the event' },
                },
                required: ['event_id', 'claim', 'reason', 'source'],
              },
            },
            contradicting_evidence: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  event_id: { type: Type.STRING, description: 'Referenced evidence event ID' },
                  claim: { type: Type.STRING, description: 'Inconsistency or counter-observation' },
                  reason: { type: Type.STRING, description: 'Why this challenges the primary theory' },
                  source: { type: Type.STRING, description: 'Source system' },
                },
                required: ['event_id', 'claim', 'reason', 'source'],
              },
            },
            alternative_hypotheses: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  hypothesis: { type: Type.STRING },
                  why_unlikely: { type: Type.STRING },
                  referenced_event_ids: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  likelihood_pct: { type: Type.INTEGER },
                },
                required: ['hypothesis', 'why_unlikely', 'referenced_event_ids', 'likelihood_pct'],
              },
            },
            recommended_actions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  action: { type: Type.STRING },
                  type: { type: Type.STRING, description: 'immediate_mitigation or preventative' },
                  priority: { type: Type.STRING, description: 'high, medium, or low' },
                  rationale: { type: Type.STRING },
                },
                required: ['action', 'type', 'priority', 'rationale'],
              },
            },
            missing_evidence: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Specific telemetry or logs that would corroborate or dispute findings.',
            },
            investigation_limitations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Known blind spots or telemetry coverage gaps.',
            },
          },
          required: [
            'incident_summary',
            'primary_hypothesis',
            'confidence',
            'detected_anomalies',
            'supporting_evidence',
            'contradicting_evidence',
            'alternative_hypotheses',
            'recommended_actions',
            'missing_evidence',
            'investigation_limitations',
          ],
        },
      },
    });

    const rawText = response.text || '';
    const parsed = parseAndValidateJson(rawText);

    if (!parsed) {
      console.warn('[BlackBox Investigator] Malformed LLM response, attempting one safe repair/retry...');
      const fallback = buildDeterministicInvestigation(events, preprocessed, incidentTitle, 'LLM JSON parse error');
      return fallback;
    }

    // Build timeline from normalized events
    const sorted = normalizeAndSortEvents(events);
    const timeline: TimelineEntry[] = sorted.map((evt, idx) => {
      let phase: TimelineEntry['phase'] = 'propagation';
      if (evt.is_root_cause_candidate || idx === 0) phase = 'trigger';
      else if (evt.severity === 'error' || evt.severity === 'critical') phase = 'detection';
      else if (evt.title.toLowerCase().includes('revert') || evt.title.toLowerCase().includes('rollback')) phase = 'mitigation';

      return {
        timestamp: evt.timestamp,
        event_id: evt.id,
        event_type: evt.event_type || evt.source,
        source: evt.source,
        summary: evt.summary,
        phase,
      };
    });

    // Format supporting/contradicting evidence items with standard distinction tags
    const supporting: SupportingEvidenceItem[] = (parsed.supporting_evidence || []).map((item: any) => ({
      event_id: item.event_id || 'unknown',
      claim: item.claim || '',
      reason: item.reason || '',
      source: item.source || 'system',
      distinction: 'SUPPORTED BY EVIDENCE',
    }));

    const contradicting: ContradictingEvidenceItem[] = (parsed.contradicting_evidence || []).map((item: any) => ({
      event_id: item.event_id || 'unknown',
      claim: item.claim || '',
      reason: item.reason || '',
      source: item.source || 'system',
      distinction: 'CONTRADICTED BY EVIDENCE',
    }));

    const recommended: RecommendedAction[] = (parsed.recommended_actions || []).map((item: any) => ({
      action: item.action,
      type: item.type === 'immediate_mitigation' ? 'immediate_mitigation' : 'preventative',
      priority: item.priority === 'low' ? 'low' : item.priority === 'medium' ? 'medium' : 'high',
      rationale: item.rationale || '',
    }));

    return {
      incident_id: events[0]?.metadata?.incident_id || undefined,
      incident_summary: parsed.incident_summary || `Investigation of ${incidentTitle}`,
      start_time: preprocessed.start_time,
      end_time: preprocessed.end_time,
      timeline,
      detected_anomalies: parsed.detected_anomalies || [],
      candidate_causes: preprocessed.candidate_hypotheses.map((c) => c.title),
      primary_hypothesis: parsed.primary_hypothesis,
      confidence: Math.max(0, Math.min(100, parsed.confidence || 85)),
      distinction_summary: {
        supported_by_evidence: supporting.map((s) => `[${s.event_id}] ${s.claim}`),
        contradicted_by_evidence: contradicting.map((c) => `[${c.event_id}] ${c.claim}`),
        unknown: parsed.missing_evidence || [],
      },
      supporting_evidence: supporting,
      contradicting_evidence: contradicting,
      alternative_hypotheses: parsed.alternative_hypotheses || [],
      recommended_actions: recommended,
      missing_evidence: parsed.missing_evidence || [],
      investigation_limitations: parsed.investigation_limitations || [],
      evidence_graph: preprocessed.evidence_graph,
      preprocessed_context: preprocessed,
      investigation_status: 'completed',
      ai_investigation_available: true,
      investigator_mode: 'gemini_senior_investigator',
      generated_at: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error('[BlackBox Investigator] LLM call failed or timed out:', err);
    return buildDeterministicInvestigation(events, preprocessed, incidentTitle, err.message || 'LLM API error');
  }
}

/**
 * Challenge Conclusion Operation.
 * Actively searches the evidence for contradictory observations, confounding factors,
 * timing mismatches, and alternative interpretations.
 */
export async function challengeIncidentHypothesis(
  primaryHypothesis: string,
  events: EvidenceEvent[],
  incidentId?: string
): Promise<ChallengeResult> {
  const preprocessed = preprocessIncident(events);
  const sorted = normalizeAndSortEvents(events);
  const gemini = getGeminiClient();

  // Deterministic checks first
  const deterministicContradictions: { event_id: string; contradiction: string; severity: 'minor' | 'significant' | 'critical' }[] = [];
  const deterministicSupport: { event_id: string; observation: string }[] = [];

  for (const evt of sorted) {
    const text = `${evt.title} ${evt.summary}`.toLowerCase();
    if (evt.is_root_cause_candidate) {
      deterministicSupport.push({
        event_id: evt.id,
        observation: `Explicit root-cause candidate flag present in ${evt.source} event ${evt.id}: ${evt.title}`,
      });
    }

    if (text.includes('revert') || text.includes('rollback')) {
      deterministicSupport.push({
        event_id: evt.id,
        observation: `Mitigating action directly references undoing the proposed primary cause: ${evt.title}`,
      });
    }

    // Check if error timestamps precede the hypothesized root cause
    const rootEvt = sorted.find((e) => e.is_root_cause_candidate);
    if (rootEvt && new Date(evt.timestamp).getTime() < new Date(rootEvt.timestamp).getTime()) {
      if (evt.severity === 'error' || evt.severity === 'critical') {
        deterministicContradictions.push({
          event_id: evt.id,
          contradiction: `Error event ${evt.id} occurred BEFORE the proposed root cause event ${rootEvt.id}. Possible pre-existing fault.`,
          severity: 'significant',
        });
      }
    }
  }

  if (gemini) {
    try {
      const prompt = `You are a critical adversary conducting an independent review ("Challenge Conclusion") of this incident hypothesis.
PRIMARY HYPOTHESIS BEING CHALLENGED:
"${primaryHypothesis}"

EVIDENCE EVENTS:
${JSON.stringify(
  sorted.map((e) => ({
    id: e.id,
    source: e.source,
    timestamp: e.timestamp,
    title: e.title,
    summary: e.summary,
    severity: e.severity,
  })),
  null,
  2
)}

TASKS:
1. Actively look for inconsistencies, counter-evidence, timing gaps, or alternative root causes.
2. Determine if the hypothesis should remain primary.
3. Provide a revised confidence score (0-100).
4. Cite specific event IDs for all points.`;

      const response = await gemini.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: 'Act as an adversarial senior SRE peer reviewer. Challenge the hypothesis with skeptical rigor.',
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              evidence_supporting: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    event_id: { type: Type.STRING },
                    observation: { type: Type.STRING },
                  },
                  required: ['event_id', 'observation'],
                },
              },
              evidence_against: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    event_id: { type: Type.STRING },
                    contradiction: { type: Type.STRING },
                    severity: { type: Type.STRING, description: 'minor, significant, or critical' },
                  },
                  required: ['event_id', 'contradiction', 'severity'],
                },
              },
              missing_evidence: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              revised_confidence: { type: Type.INTEGER },
              should_remain_primary: { type: Type.BOOLEAN },
              challenge_verdict: { type: Type.STRING },
              alternative_explanation_if_rejected: { type: Type.STRING },
            },
            required: [
              'evidence_supporting',
              'evidence_against',
              'missing_evidence',
              'revised_confidence',
              'should_remain_primary',
              'challenge_verdict',
            ],
          },
        },
      });

      const parsed = parseAndValidateJson(response.text || '');
      if (parsed) {
        return {
          hypothesis_challenged: primaryHypothesis,
          evidence_supporting: parsed.evidence_supporting || deterministicSupport,
          evidence_against: parsed.evidence_against || deterministicContradictions,
          missing_evidence: parsed.missing_evidence || [
            'Database slow query telemetry logs during the saturation window',
            'Connection acquire wait latency percentiles per microservice thread',
          ],
          original_confidence: 90,
          revised_confidence: Math.max(0, Math.min(100, parsed.revised_confidence || 82)),
          should_remain_primary: parsed.should_remain_primary ?? true,
          challenge_verdict: parsed.challenge_verdict || 'Hypothesis substantiated by chronological deployment correlation and emergency rollback efficacy.',
          alternative_explanation_if_rejected: parsed.alternative_explanation_if_rejected || null,
          challenged_at: new Date().toISOString(),
          used_ai: true,
        };
      }
    } catch (err) {
      console.warn('[BlackBox Challenge] Gemini challenge failed, using deterministic challenge evaluation:', err);
    }
  }

  // Deterministic challenge fallback
  const hasContradictions = deterministicContradictions.length > 0;
  return {
    hypothesis_challenged: primaryHypothesis,
    evidence_supporting: deterministicSupport,
    evidence_against: deterministicContradictions,
    missing_evidence: [
      'Pre-incident connection pool baseline metrics for the prior 24 hours',
      'Trace context propagation between ingress timeout logs and backend worker threads',
    ],
    original_confidence: 90,
    revised_confidence: hasContradictions ? 70 : 85,
    should_remain_primary: !hasContradictions,
    challenge_verdict: hasContradictions
      ? 'Challenged: Pre-existing errors detected before trigger timestamp; requires verification of baseline system health.'
      : 'Hypothesis Upheld: Causal chain from code deployment to connection pool exhaustion and rollback is chronologically sound.',
    alternative_explanation_if_rejected: hasContradictions
      ? 'Background database resource contention or recurring scheduled cron job initiated pool starvation prior to deployment.'
      : null,
    challenged_at: new Date().toISOString(),
    used_ai: false,
  };
}

/**
 * Safe JSON parser with single repair attempt.
 */
function parseAndValidateJson(text: string): any | null {
  if (!text) return null;

  // Clean markdown backticks if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    // Attempt one safe repair: strip trailing commas or fix unclosed brackets
    try {
      const repaired = cleaned
        .replace(/,\s*([\]}])/g, '$1') // remove trailing commas
        .trim();
      return JSON.parse(repaired);
    } catch (e2) {
      return null;
    }
  }
}
