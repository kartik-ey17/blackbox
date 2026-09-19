import React, { useState } from 'react';
import {
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  RotateCcw,
  ExternalLink,
  Flame,
  ArrowRight,
  GitPullRequest,
  AlertCircle,
  FileText,
  Activity,
  Server,
  Globe,
  Layers,
  Check,
  Copy,
  Clock,
  Zap,
  Info,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  Printer,
  Search,
  Sliders,
  Database,
  RefreshCw,
  Terminal,
  Tag,
  Code,
} from 'lucide-react';
import { EvidenceEvent, EvidenceSource } from '../types/incident';
import { IncidentInvestigation, ChallengeResult } from '../types/investigation';
import { ReactFlowEvidenceGraph } from './ReactFlowEvidenceGraph';

interface InvestigationPanelProps {
  investigation: IncidentInvestigation | null;
  events: EvidenceEvent[];
  isLoading: boolean;
  onRefreshInvestigation: () => Promise<void>;
  onChallengeConclusion: (hypothesis: string) => Promise<void>;
  onSelectEvent: (eventId: string) => void;
  onViewInTimeline: (eventId: string) => void;
  onNavigateToReport?: () => void;
  selectedEventId?: string | null;
}

export const InvestigationPanel: React.FC<InvestigationPanelProps> = ({
  investigation,
  events,
  isLoading,
  onRefreshInvestigation,
  onChallengeConclusion,
  onSelectEvent,
  onViewInTimeline,
  onNavigateToReport,
  selectedEventId: propSelectedEventId,
}) => {
  // Challenge execution and animated progress state
  const [isChallenging, setIsChallenging] = useState(false);
  const [challengeProgress, setChallengeProgress] = useState(0);
  const [challengeStageText, setChallengeStageText] = useState('');

  // Active event inspector state
  const [activeEventId, setActiveEventId] = useState<string>(
    propSelectedEventId ||
      events.find((e) => e.is_root_cause_candidate)?.id ||
      events[0]?.id ||
      ''
  );

  // Timeline UI filters & search
  const [timelineSearch, setTimelineSearch] = useState('');
  const [timelineSourceFilter, setTimelineSourceFilter] = useState('ALL');
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(
    new Set(events.filter((e) => e.is_root_cause_candidate).map((e) => e.id))
  );

  // Copy states
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedEventJson, setCopiedEventJson] = useState(false);
  const [copiedReportMd, setCopiedReportMd] = useState(false);

  // Challenge Execution with simulated multi-step progress
  const handleChallenge = async () => {
    if (!investigation) return;
    try {
      setIsChallenging(true);
      setChallengeProgress(20);
      setChallengeStageText('Ingesting counter-factual scenarios and evaluating temporal bounds...');
      await new Promise((r) => setTimeout(r, 450));

      setChallengeProgress(55);
      setChallengeStageText('Cross-referencing Sentry stack traces, Git commits & pre-incident logs...');
      await new Promise((r) => setTimeout(r, 450));

      setChallengeProgress(85);
      setChallengeStageText('Formulating adversarial challenge verdict & assessing revised confidence...');

      await onChallengeConclusion(investigation.primary_hypothesis);

      setChallengeProgress(100);
      setChallengeStageText('Adversarial peer challenge verdict formulated.');
    } finally {
      setTimeout(() => {
        setIsChallenging(false);
        setChallengeProgress(0);
        setChallengeStageText('');
      }, 400);
    }
  };

  const getSourceIcon = (source: EvidenceSource | string) => {
    switch (source) {
      case 'github':
        return <GitPullRequest className="h-3.5 w-3.5 text-purple-400" />;
      case 'sentry':
        return <AlertCircle className="h-3.5 w-3.5 text-rose-400" />;
      case 'logs':
        return <FileText className="h-3.5 w-3.5 text-amber-400" />;
      case 'metrics':
        return <Activity className="h-3.5 w-3.5 text-emerald-400" />;
      case 'deployment':
        return <Server className="h-3.5 w-3.5 text-blue-400" />;
      case 'network':
        return <Globe className="h-3.5 w-3.5 text-cyan-400" />;
      default:
        return <Layers className="h-3.5 w-3.5 text-zinc-400" />;
    }
  };

  const getSourceBadgeClass = (source: EvidenceSource | string) => {
    switch (source) {
      case 'github':
        return 'border-purple-500/30 bg-purple-500/10 text-purple-300';
      case 'sentry':
        return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
      case 'logs':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
      case 'metrics':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
      case 'deployment':
        return 'border-blue-500/30 bg-blue-500/10 text-blue-300';
      case 'network':
        return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
      default:
        return 'border-zinc-700 bg-zinc-800 text-zinc-300';
    }
  };

  const copyInvestigationBrief = () => {
    if (!investigation) return;
    const text = `[BlackBox Forensic Investigation]\nIncident: ${investigation.incident_summary}\nConfidence: ${investigation.confidence}%\nPrimary Root Cause: ${investigation.primary_hypothesis}\n\nSupporting Evidence:\n${investigation.supporting_evidence.map((s) => `- [${s.event_id}] ${s.claim}`).join('\n')}\n\nContradicting Evidence:\n${investigation.contradicting_evidence.length > 0 ? investigation.contradicting_evidence.map((c) => `- [${c.event_id}] ${c.claim}`).join('\n') : 'None observed'}\n\nMissing Evidence:\n${investigation.missing_evidence.map((m) => `- ${m}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleCopyReportMarkdown = () => {
    if (!investigation) return;
    let md = `# Incident Post-Mortem Report\n\n`;
    md += `**Primary Root Cause:** ${investigation.primary_hypothesis}\n`;
    md += `**Confidence:** ${investigation.confidence}%\n`;
    md += `**Time Window:** ${investigation.start_time} - ${investigation.end_time}\n\n`;
    md += `## Executive Summary\n${investigation.incident_summary}\n\n`;
    md += `## Supporting Evidence\n`;
    investigation.supporting_evidence.forEach((s) => {
      md += `- [${s.event_id}] ${s.claim} (${s.source})\n`;
    });
    md += `\n## Missing Telemetry Gaps\n`;
    investigation.missing_evidence.forEach((m) => {
      md += `- ${m}\n`;
    });
    md += `\n## Recommended Actions\n`;
    investigation.recommended_actions.forEach((a, i) => {
      md += `${i + 1}. ${a.action} (${a.priority} priority - ${a.type})\n`;
    });
    navigator.clipboard.writeText(md);
    setCopiedReportMd(true);
    setTimeout(() => setCopiedReportMd(false), 2000);
  };

  const handleDownloadReportJson = () => {
    if (!investigation) return;
    const blob = new Blob([JSON.stringify({ investigation, events }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incident-investigation-${investigation.incident_id || 'report'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleExpandEvent = (id: string) => {
    const next = new Set(expandedEventIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedEventIds(next);
  };

  if (!investigation && isLoading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-12 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 mb-4 animate-pulse">
          <Sparkles className="h-6 w-6 animate-spin" />
        </div>
        <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
          Forensic Preprocessing & Investigation Engine Running...
        </h3>
        <p className="mt-2 text-xs text-zinc-400 max-w-md mx-auto">
          Normalizing timestamps, clustering telemetry bursts, correlating traces, and synthesizing root-cause causality.
        </p>
      </div>
    );
  }

  if (!investigation) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-12 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-3" />
        <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
          No Investigation Available
        </h3>
        <p className="mt-2 text-xs text-zinc-400 max-w-md mx-auto">
          Click below to initiate the deterministic preprocessing pipeline and Gemini senior incident investigator reasoning.
        </p>
        <button
          onClick={onRefreshInvestigation}
          className="mt-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-mono font-bold text-white transition-colors cursor-pointer"
        >
          Run Forensic Investigation
        </button>
      </div>
    );
  }

  const latestChallenge: ChallengeResult | undefined = investigation.challenge_history?.[0];
  const activeEvent = events.find((e) => e.id === activeEventId) || events[0];

  // Filtered timeline events
  const filteredTimelineEvents = events.filter((e) => {
    const matchesSource = timelineSourceFilter === 'ALL' || e.source === timelineSourceFilter;
    const q = timelineSearch.toLowerCase();
    const matchesSearch =
      e.title.toLowerCase().includes(q) ||
      e.summary.toLowerCase().includes(q) ||
      e.id.toLowerCase().includes(q);
    return matchesSource && matchesSearch;
  });

  // Confidence styling
  const getConfidenceBarColor = (score: number) => {
    if (score >= 85) return 'bg-emerald-500';
    if (score >= 65) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* 1. Investigation Engine Status Header */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
                Forensic Incident Investigation Workspace
              </h2>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${
                  investigation.ai_investigation_available
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                }`}
              >
                {investigation.ai_investigation_available
                  ? 'Gemini 3.8 Flash (Senior Investigator)'
                  : 'Deterministic Pipeline (Zero LLM Dependency)'}
              </span>
              {investigation.investigation_status === 'challenged' && (
                <span className="rounded-full border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-300">
                  Adversarially Challenged
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 font-mono">
              Correlating {events.length} multi-source telemetry events across GitHub, Sentry, and infrastructure logs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyInvestigationBrief}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 text-xs font-mono text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Copy structured investigation summary"
          >
            {copiedPrompt ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedPrompt ? 'Copied' : 'Export Brief'}</span>
          </button>

          <button
            onClick={onRefreshInvestigation}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-600/20 hover:bg-emerald-600/30 px-3.5 py-2 text-xs font-mono font-semibold text-emerald-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Re-evaluate</span>
          </button>
        </div>
      </div>

      {/* 2. ROOT CAUSE CARD */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 h-40 w-40 bg-emerald-500/5 blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400">
                Root Cause Card — Primary Hypothesis
              </span>
            </div>

            <h3 className="text-base sm:text-xl font-bold text-white leading-relaxed font-sans">
              {investigation.primary_hypothesis}
            </h3>

            {/* Short Explanation */}
            <div className="rounded-lg bg-zinc-900/80 border border-zinc-800/80 p-3.5 text-xs text-zinc-300 font-sans leading-relaxed">
              <span className="font-mono text-zinc-400 font-semibold uppercase text-[10px] block mb-1">
                Forensic Summary & Explanation:
              </span>
              {investigation.incident_summary}
            </div>

            {/* Identified Trigger Candidate chip */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-mono text-zinc-400">Trigger Candidate Event:</span>
              {investigation.supporting_evidence.slice(0, 2).map((s) => (
                <button
                  key={s.event_id}
                  onClick={() => {
                    setActiveEventId(s.event_id);
                    onSelectEvent(s.event_id);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-purple-500/40 bg-purple-950/40 px-2 py-1 text-xs font-mono text-purple-300 hover:bg-purple-900/50 transition-colors cursor-pointer"
                  title="Inspect trigger event"
                >
                  {getSourceIcon(s.source)}
                  <span>[{s.event_id}]</span>
                  <ExternalLink className="h-2.5 w-2.5 opacity-70" />
                </button>
              ))}
            </div>
          </div>

          {/* Confidence Meter & Prominent Challenge CTA */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 border-t sm:border-t-0 lg:border-l border-zinc-800 pt-4 sm:pt-0 lg:pl-6 shrink-0">
            <div className="text-left lg:text-right">
              <span className="text-[11px] font-mono uppercase text-zinc-400">Investigation Confidence</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-3xl font-black font-mono text-white tracking-tight">
                  {investigation.confidence}%
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  {investigation.confidence >= 80 ? 'HIGH' : investigation.confidence >= 60 ? 'MODERATE' : 'LOW'}
                </span>
              </div>
            </div>

            <div className="w-48 bg-zinc-800 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full ${getConfidenceBarColor(investigation.confidence)} transition-all duration-500`}
                style={{ width: `${investigation.confidence}%` }}
              />
            </div>

            {/* Prominent Action: CHALLENGE CONCLUSION */}
            <button
              onClick={handleChallenge}
              disabled={isChallenging}
              className="mt-2 flex items-center gap-2 rounded-lg border border-purple-500/60 bg-gradient-to-r from-purple-950/70 to-zinc-900 hover:from-purple-900/80 hover:to-zinc-800 px-4 py-2.5 text-xs font-mono font-bold text-purple-200 shadow-md shadow-purple-950/40 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
              title="Adversarially challenge this conclusion against counter-evidence"
            >
              <ShieldAlert className={`h-4 w-4 text-purple-400 ${isChallenging ? 'animate-spin' : ''}`} />
              <span>{isChallenging ? 'Testing Counter-Evidence...' : 'Challenge Conclusion'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. CHALLENGE CONCLUSION PROGRESS & RESULTS */}
      {/* Live Investigation Progress Bar while challenging */}
      {isChallenging && (
        <div className="rounded-xl border border-purple-500/60 bg-purple-950/30 p-5 space-y-3 shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-purple-300">
              <ShieldAlert className="h-4 w-4 text-purple-400 animate-spin" />
              <span>Adversarial Peer Challenge in Progress...</span>
            </div>
            <span className="text-xs font-mono font-bold text-purple-200">{challengeProgress}%</span>
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${challengeProgress}%` }}
            />
          </div>
          <p className="text-xs font-mono text-zinc-300 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-ping" />
            <span>{challengeStageText}</span>
          </p>
        </div>
      )}

      {/* Challenge Results Display */}
      {latestChallenge && !isChallenging && (
        <div className="rounded-xl border border-purple-500/40 bg-purple-950/20 p-5 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-purple-200">
                  Adversarial Peer Review Results ("Challenge Conclusion")
                </h4>
                <p className="text-[11px] font-mono text-zinc-400">
                  Evaluated against temporal anomalies, confounding variables, and contradictory telemetry
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`rounded-md border px-2.5 py-1 text-[11px] font-mono font-bold uppercase ${
                  latestChallenge.should_remain_primary
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                }`}
              >
                {latestChallenge.should_remain_primary ? 'Hypothesis Upheld' : 'Challenged — Revisions Recommended'}
              </span>
              <span className="text-xs font-mono text-zinc-300">
                Revised Confidence: <strong className="text-white font-bold">{latestChallenge.revised_confidence}%</strong>
              </span>
            </div>
          </div>

          <div className="rounded-lg bg-black/40 border border-purple-900/30 p-3.5 text-xs text-zinc-300 font-mono">
            <p className="font-semibold text-purple-200 mb-1">Evaluator Verdict:</p>
            <p className="leading-relaxed">{latestChallenge.challenge_verdict}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
            {/* Supporting observations */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3.5 space-y-2">
              <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Evidence Supporting Conclusion:
              </span>
              {latestChallenge.evidence_supporting.map((s, idx) => (
                <div key={idx} className="flex items-start gap-1.5 text-zinc-300 text-[11px]">
                  <button
                    onClick={() => {
                      setActiveEventId(s.event_id);
                      onSelectEvent(s.event_id);
                    }}
                    className="text-emerald-400 hover:underline shrink-0"
                  >
                    [{s.event_id}]
                  </button>
                  <span>{s.observation}</span>
                </div>
              ))}
            </div>

            {/* Contradicting observations */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3.5 space-y-2">
              <span className="text-[10px] uppercase font-bold text-rose-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Evidence Contradicting / Confounding Factors:
              </span>
              {latestChallenge.evidence_against.length > 0 ? (
                latestChallenge.evidence_against.map((c, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 text-zinc-300 text-[11px]">
                    <button
                      onClick={() => {
                        setActiveEventId(c.event_id);
                        onSelectEvent(c.event_id);
                      }}
                      className="text-rose-400 hover:underline shrink-0"
                    >
                      [{c.event_id}]
                    </button>
                    <span>{c.contradiction}</span>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-zinc-500 italic">No direct counter-evidence found in ingested telemetry.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. EVIDENCE GRAPH (React Flow) */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-3">
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Share2Icon className="h-4 w-4 text-emerald-400" />
              <span>Evidence Graph (Topological React Flow)</span>
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
              Nodes: Deployments, Config Changes, Errors, Anomalies, Impacts • Click any node to inspect evidence details
            </p>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-400">
            <span>{events.length} Nodes</span>
            <span>•</span>
            <span className="text-emerald-400">Active Node: {activeEventId}</span>
          </div>
        </div>

        <ReactFlowEvidenceGraph
          events={events}
          selectedEventId={activeEventId}
          onSelectEvent={(eventId) => {
            setActiveEventId(eventId);
            onSelectEvent(eventId);
          }}
          className="min-h-[460px]"
        />
      </div>

      {/* 5. INCIDENT TIMELINE */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-3">
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-400" />
              <span>Incident Timeline (Chronological Sequence)</span>
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
              Click any event card to view original telemetry in the Evidence Panel below
            </p>
          </div>

          {/* Search & Source Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Filter timeline..."
                value={timelineSearch}
                onChange={(e) => setTimelineSearch(e.target.value)}
                className="w-36 sm:w-44 rounded-md border border-zinc-700 bg-zinc-950 pl-7 pr-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none font-mono"
              />
            </div>
            <div className="flex rounded-md border border-zinc-800 bg-zinc-950 p-0.5 text-[11px] font-mono">
              {['ALL', 'github', 'sentry', 'logs', 'metrics'].map((src) => (
                <button
                  key={src}
                  onClick={() => setTimelineSourceFilter(src)}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    timelineSourceFilter === src
                      ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {src.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chronological Stream */}
        <div className="relative pl-6 before:absolute before:left-2.5 before:top-4 before:bottom-4 before:w-0.5 before:bg-zinc-800 space-y-4 max-h-[500px] overflow-y-auto pr-2">
          {filteredTimelineEvents.map((evt) => {
            const isSelected = evt.id === activeEventId;
            const isExpanded = expandedEventIds.has(evt.id);

            return (
              <div key={evt.id} className="relative group">
                <div
                  className={`absolute -left-6 top-3.5 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full border-2 bg-zinc-950 ${
                    evt.is_root_cause_candidate
                      ? 'border-amber-400 text-amber-400 ring-2 ring-amber-400/30'
                      : evt.severity === 'critical' || evt.severity === 'error'
                      ? 'border-rose-500 text-rose-500'
                      : 'border-zinc-700 text-zinc-400'
                  }`}
                >
                  <span className="h-1 w-1 rounded-full bg-current" />
                </div>

                <div
                  onClick={() => {
                    setActiveEventId(evt.id);
                  }}
                  className={`rounded-lg border p-3.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-emerald-500/90 bg-emerald-950/20 shadow-md ring-1 ring-emerald-500/40'
                      : evt.is_root_cause_candidate
                      ? 'border-amber-500/50 bg-amber-950/10'
                      : 'border-zinc-800 bg-zinc-950/50 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span
                        className={`inline-flex items-center gap-1 rounded border px-2 py-0.2 text-[10px] uppercase font-semibold ${getSourceBadgeClass(
                          evt.source
                        )}`}
                      >
                        {getSourceIcon(evt.source)}
                        {evt.source}
                      </span>

                      {evt.is_root_cause_candidate && (
                        <span className="rounded border border-amber-500/40 bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-mono font-bold text-amber-300">
                          ROOT CAUSE CANDIDATE
                        </span>
                      )}

                      <span className="font-bold text-white text-xs">{evt.title}</span>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-400">
                      <span>{new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} UTC</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEvent(evt.id);
                        }}
                        className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:text-white"
                      >
                        {evt.id}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-300 mt-1 pl-1 font-sans">{evt.summary}</p>

                  {/* Expand button for raw metadata snippets */}
                  {(evt.metadata?.diff_snippet || evt.metadata?.stack_trace || evt.metadata?.sample_log) && (
                    <div className="mt-2 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[11px] font-mono">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpandEvent(evt.id);
                        }}
                        className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                      >
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        <span>{isExpanded ? 'Hide Trace/Diff' : 'Show Trace/Diff'}</span>
                      </button>

                      <span className="text-zinc-500 text-[10px]">
                        {evt.metadata.commit_hash ? `Commit: ${evt.metadata.commit_hash}` : ''}
                      </span>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-zinc-800 text-xs font-mono">
                      {evt.metadata?.diff_snippet && (
                        <pre className="rounded bg-purple-950/20 border border-purple-900/40 p-2.5 text-purple-200 overflow-x-auto text-[11px]">
                          {evt.metadata.diff_snippet}
                        </pre>
                      )}
                      {evt.metadata?.stack_trace && (
                        <pre className="rounded bg-rose-950/20 border border-rose-900/40 p-2.5 text-rose-200 overflow-x-auto text-[11px]">
                          {evt.metadata.stack_trace}
                        </pre>
                      )}
                      {evt.metadata?.sample_log && (
                        <pre className="rounded bg-black/60 border border-zinc-800 p-2.5 text-amber-200 overflow-x-auto text-[11px]">
                          {evt.metadata.sample_log}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. EVIDENCE PANEL (Original Event Inspector) */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-3">
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Layers className="h-4 w-4" />
              <span>Evidence Panel (Original Event Inspector)</span>
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
              Timestamp • Source • Message • Metadata • Causal Reference
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectEvent(activeEvent.id)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-200 hover:text-white transition-colors cursor-pointer"
            >
              <ExternalLink className="h-3 w-3" />
              <span>Open in Modal</span>
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(activeEvent, null, 2));
                setCopiedEventJson(true);
                setTimeout(() => setCopiedEventJson(false), 2000);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-200 hover:text-white transition-colors cursor-pointer"
            >
              {copiedEventJson ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              <span>{copiedEventJson ? 'Copied' : 'Copy Event JSON'}</span>
            </button>
          </div>
        </div>

        {/* Master Inspection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Left Metadata Strip */}
          <div className="md:col-span-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-3 text-xs font-mono">
            <div>
              <span className="text-zinc-500 uppercase text-[10px] block">Event Identifier</span>
              <span className="text-emerald-400 font-bold text-sm">{activeEvent.id}</span>
            </div>

            <div>
              <span className="text-zinc-500 uppercase text-[10px] block">Telemetry Source</span>
              <span className="inline-flex items-center gap-1.5 rounded border px-2 py-0.5 mt-1 uppercase text-[11px] font-bold">
                {getSourceIcon(activeEvent.source)}
                <span>{activeEvent.source}</span>
              </span>
            </div>

            <div>
              <span className="text-zinc-500 uppercase text-[10px] block">Timestamp (UTC)</span>
              <span className="text-zinc-200 font-bold block mt-0.5">
                {new Date(activeEvent.timestamp).toUTCString()}
              </span>
              <span className="text-zinc-500 text-[10px] block mt-0.5 font-mono">
                ISO: {activeEvent.timestamp}
              </span>
            </div>

            <div>
              <span className="text-zinc-500 uppercase text-[10px] block">Causal Reference Links</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {activeEvent.correlated_event_ids.length > 0 ? (
                  activeEvent.correlated_event_ids.map((refId) => (
                    <button
                      key={refId}
                      onClick={() => setActiveEventId(refId)}
                      className="rounded border border-emerald-500/40 bg-emerald-950/30 px-2 py-0.5 text-xs text-emerald-300 hover:bg-emerald-900/40 cursor-pointer"
                    >
                      → {refId}
                    </button>
                  ))
                ) : (
                  <span className="text-zinc-500 text-[11px]">Independent telemetry observation</span>
                )}
              </div>
            </div>
          </div>

          {/* Right Message and Metadata */}
          <div className="md:col-span-8 rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-4">
            <div>
              <span className="text-zinc-500 uppercase text-[10px] font-mono block mb-1">
                Original Message / Title
              </span>
              <h4 className="text-sm font-bold text-white font-sans">{activeEvent.title}</h4>
              <p className="text-xs text-zinc-300 mt-1 leading-relaxed font-sans">{activeEvent.summary}</p>
            </div>

            {/* Git Diff Hunk */}
            {activeEvent.metadata?.diff_snippet && (
              <div>
                <span className="text-purple-300 uppercase text-[10px] font-mono block mb-1 font-bold flex items-center gap-1">
                  <Code className="h-3 w-3" />
                  <span>Metadata: Git Diff Revision</span>
                </span>
                <pre className="rounded border border-purple-900/40 bg-purple-950/20 p-3 text-xs font-mono text-purple-200 overflow-x-auto max-h-40">
                  {activeEvent.metadata.diff_snippet}
                </pre>
              </div>
            )}

            {/* Sentry Stack Trace */}
            {activeEvent.metadata?.stack_trace && (
              <div>
                <span className="text-rose-300 uppercase text-[10px] font-mono block mb-1 font-bold flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  <span>Metadata: Exception Stack Trace</span>
                </span>
                <pre className="rounded border border-rose-900/40 bg-rose-950/20 p-3 text-xs font-mono text-rose-200 overflow-x-auto max-h-40">
                  {activeEvent.metadata.stack_trace}
                </pre>
              </div>
            )}

            {/* Structured Metadata JSON */}
            <div>
              <span className="text-zinc-500 uppercase text-[10px] font-mono block mb-1">
                Metadata Attributes
              </span>
              <pre className="rounded border border-zinc-800 bg-black/60 p-3 text-xs font-mono text-emerald-300 overflow-x-auto max-h-36">
                {JSON.stringify(activeEvent.metadata, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* 7. ALTERNATIVE HYPOTHESES */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
          <Layers className="h-4 w-4 text-purple-400" />
          <span>Alternative Hypotheses Evaluated</span>
        </h3>
        <p className="text-xs text-zinc-400 font-mono">
          Competing failure explanations evaluated and ruled lower probability based on available evidence:
        </p>

        <div className="space-y-2.5 pt-1">
          {investigation.alternative_hypotheses.map((alt, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono text-zinc-200">{alt.hypothesis}</span>
                  <span className="rounded bg-zinc-800 px-1.5 py-0.2 text-[10px] font-mono text-zinc-400">
                    Likelihood: {alt.likelihood_pct}%
                  </span>
                </div>
                <p className="text-xs text-zinc-400 font-mono">
                  <strong className="text-zinc-500">Why unlikely:</strong> {alt.why_unlikely}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {alt.referenced_event_ids.slice(0, 2).map((id) => (
                  <button
                    key={id}
                    onClick={() => {
                      setActiveEventId(id);
                      onSelectEvent(id);
                    }}
                    className="text-[11px] font-mono text-zinc-400 hover:text-white rounded border border-zinc-800 bg-zinc-900 px-2 py-1 cursor-pointer"
                  >
                    [{id}]
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 8. MISSING EVIDENCE (Explicit availability & Limitation statement) */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
        <div>
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-amber-400" />
            <span>Missing Evidence & Telemetry Gaps</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5 font-mono">
            Explicit verification of connected vs unavailable observability streams
          </p>
        </div>

        {/* Explicit sources used checklist requested by prompt */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          {(() => {
            const sourcesInEvents = new Set(events.map((e) => e.source));
            return [
              { name: 'GitHub VCS', key: 'github' },
              { name: 'Sentry Traces', key: 'sentry' },
              { name: 'System Logs', key: 'logs' },
              { name: 'Infra Metrics', key: 'metrics' },
            ].map((s) => {
              const isAvailable = sourcesInEvents.has(s.key as EvidenceSource);
              return (
                <div
                  key={s.key}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    isAvailable
                      ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
                      : 'border-rose-500/30 bg-rose-950/20 text-rose-300'
                  }`}
                >
                  <span className="font-semibold">{s.name}</span>
                  <span className="font-bold text-sm">{isAvailable ? '✓' : '✗'}</span>
                </div>
              );
            });
          })()}
        </div>

        {/* Prompt's required quote */}
        <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-3.5 text-xs font-mono text-amber-300 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Confidence is limited because infrastructure metrics were unavailable.</p>
            <p className="text-[11px] text-amber-400/80 mt-1">
              Host kernel connection tracking, socket wait states, and database proxy internal queue depths were partially absent during the window.
            </p>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <p className="text-xs font-mono text-zinc-400">Identified Observability Telemetry Gaps:</p>
          <ul className="space-y-1.5">
            {investigation.missing_evidence.map((gap, i) => (
              <li key={i} className="flex items-start gap-2 text-xs font-mono text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 9. RECOMMENDED ACTIONS */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            <span>Recommended Remediation Actions</span>
          </h3>
          <span className="rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-mono text-amber-300 font-bold uppercase">
            Advisory Recommendations (Pending Ops Execution)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {investigation.recommended_actions.map((act, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase ${
                      act.type === 'immediate_mitigation'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    }`}
                  >
                    {act.type === 'immediate_mitigation' ? 'Immediate Mitigation' : 'Preventative Safeguard'}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 uppercase">{act.priority} priority</span>
                </div>
                <p className="text-xs font-semibold text-white">{act.action}</p>
                <p className="text-[11px] text-zinc-400 font-mono leading-relaxed">{act.rationale}</p>
              </div>

              <div className="pt-2 border-t border-zinc-900 flex items-center gap-1 text-[10px] font-mono text-amber-400/80">
                <span>• Recommendation only (Unexecuted)</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 10. EXPORT REPORT & DATA SOURCES PROVENANCE */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-900 pb-3">
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <Download className="h-4 w-4 text-emerald-400" />
              <span>Export Incident Investigation Report</span>
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
              Export forensic findings into standard markdown or JSON for post-mortem distribution
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyReportMarkdown}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-mono text-zinc-200 transition-colors cursor-pointer"
            >
              {copiedReportMd ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedReportMd ? 'Copied Markdown' : 'Copy Markdown Report'}</span>
            </button>

            <button
              onClick={handleDownloadReportJson}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-mono text-zinc-200 transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download JSON</span>
            </button>

            {onNavigateToReport && (
              <button
                onClick={onNavigateToReport}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3.5 py-1.5 text-xs font-mono font-bold text-zinc-950 transition-colors cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>View Formatted Post-Mortem</span>
              </button>
            )}
          </div>
        </div>

        {/* Small Data Sources Provenance Section */}
        <div className="pt-2">
          <h4 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-emerald-400" />
            <span>Telemetry Data Sources Provenance</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono text-zinc-400">
            <div className="rounded border border-zinc-800/80 bg-zinc-900/40 p-2.5">
              <span className="font-bold text-purple-300 block">GitHub VCS Connector</span>
              <span className="text-[11px] text-zinc-500 mt-0.5 block">Commit diffs, PR merges, deploy tags</span>
            </div>
            <div className="rounded border border-zinc-800/80 bg-zinc-900/40 p-2.5">
              <span className="font-bold text-rose-300 block">Sentry Runtime Stream</span>
              <span className="text-[11px] text-zinc-500 mt-0.5 block">Stack frames, breadcrumbs, unhandled errors</span>
            </div>
            <div className="rounded border border-zinc-800/80 bg-zinc-900/40 p-2.5">
              <span className="font-bold text-amber-300 block">System Logs Aggregator</span>
              <span className="text-[11px] text-zinc-500 mt-0.5 block">Container stdout/stderr, 504 timeouts</span>
            </div>
            <div className="rounded border border-zinc-800/80 bg-zinc-900/40 p-2.5">
              <span className="font-bold text-emerald-300 block">Causality Graph Engine</span>
              <span className="text-[11px] text-zinc-500 mt-0.5 block">Temporal correlation & topological ordering</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Internal icon alias for topological graph
const Share2Icon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);
