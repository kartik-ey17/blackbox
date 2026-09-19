import React, { useState, useEffect } from 'react';
import { IncidentDetail, EvidenceEvent, EvidenceSource } from '../types/incident';
import { IncidentInvestigation, ChallengeResult } from '../types/investigation';
import {
  fetchIncidentInvestigationApi,
  investigateIncidentApi,
  challengeHypothesisApi,
} from '../services/api';
import { preprocessIncident } from '../services/preprocessor';
import { buildDeterministicInvestigation } from '../services/investigator';
import { InvestigationPanel } from './InvestigationPanel';
import { EventDetailModal } from './EventDetailModal';
import { ReactFlowEvidenceGraph } from './ReactFlowEvidenceGraph';
import { EvidencePanelTab } from './EvidencePanelTab';
import {
  ArrowLeft,
  Flame,
  AlertTriangle,
  Clock,
  Layers,
  GitPullRequest,
  AlertCircle,
  FileText,
  Activity,
  Server,
  Share2,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Terminal,
  ShieldAlert,
  ArrowRight,
  Cpu,
  Globe,
  Database,
  Download,
  Printer,
} from 'lucide-react';

interface IncidentWorkspaceProps {
  incident: IncidentDetail;
  onBack: () => void;
  onOpenGitHub?: () => void;
  onOpenSentry?: () => void;
  onOpenBundle?: () => void;
  onNavigateToReport?: () => void;
  onNavigateToEvidence?: () => void;
  onInvestigationChange?: (inv: IncidentInvestigation | null) => void;
}

export const IncidentWorkspace: React.FC<IncidentWorkspaceProps> = ({
  incident,
  onBack,
  onOpenGitHub,
  onOpenSentry,
  onOpenBundle,
  onNavigateToReport,
  onNavigateToEvidence,
  onInvestigationChange,
}) => {
  const [evidenceEvents, setEvidenceEvents] = useState<EvidenceEvent[]>(incident.evidence_events);
  const [activeTab, setActiveTab] = useState<'investigation' | 'timeline' | 'graph' | 'evidence_panel' | 'blast_radius' | 'raw_json'>('investigation');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>('ALL');
  const [timelineSearch, setTimelineSearch] = useState<string>('');
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(new Set(incident.evidence_events.map(e => e.id)));
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [selectedGraphNode, setSelectedGraphNode] = useState<EvidenceEvent | null>(
    incident.evidence_events.find(e => e.is_root_cause_candidate) || incident.evidence_events[0] || null
  );

  // Investigation Engine State (Stage 3 & 4)
  const [investigation, setInvestigation] = useState<IncidentInvestigation | null>(null);
  const [isInvestigating, setIsInvestigating] = useState<boolean>(false);
  const [selectedModalEvent, setSelectedModalEvent] = useState<EvidenceEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);

  // Load or generate initial investigation on mount or when incident changes
  useEffect(() => {
    setEvidenceEvents(incident.evidence_events);
    setExpandedEventIds(new Set(incident.evidence_events.map(e => e.id)));
    if (!selectedGraphNode) {
      setSelectedGraphNode(incident.evidence_events.find(e => e.is_root_cause_candidate) || incident.evidence_events[0] || null);
    }

    let isMounted = true;
    const loadInvestigation = async () => {
      try {
        setIsInvestigating(true);
        const inv = await fetchIncidentInvestigationApi(incident.id);
        if (isMounted) {
          setInvestigation(inv);
        }
      } catch (err) {
        console.warn('API investigation fetch failed, executing deterministic pipeline fallback:', err);
        if (isMounted) {
          const pre = preprocessIncident(incident.evidence_events);
          const fallback = buildDeterministicInvestigation(
            incident.evidence_events,
            pre,
            incident.title,
            'API unreachable, deterministic baseline engaged'
          );
          fallback.incident_id = incident.id;
          setInvestigation(fallback);
        }
      } finally {
        if (isMounted) setIsInvestigating(false);
      }
    };

    loadInvestigation();

    return () => {
      isMounted = false;
    };
  }, [incident.id, incident.evidence_events]);

  useEffect(() => {
    onInvestigationChange?.(investigation);
  }, [investigation, onInvestigationChange]);

  const handleRefreshInvestigation = async () => {
    try {
      setIsInvestigating(true);
      const updated = await investigateIncidentApi({
        incident_id: incident.id,
        evidence_events: evidenceEvents,
        incident_title: incident.title,
        force_refresh: true,
      });
      setInvestigation(updated);
    } catch (err) {
      console.error('Refresh investigation failed:', err);
    } finally {
      setIsInvestigating(false);
    }
  };

  const handleChallengeConclusion = async (hypothesis: string) => {
    try {
      const challengeResult = await challengeHypothesisApi({
        incident_id: incident.id,
        primary_hypothesis: hypothesis,
        evidence_events: evidenceEvents,
      });

      // Update local investigation state with new challenge result
      setInvestigation((prev) => {
        if (!prev) return prev;
        const currentHistory = prev.challenge_history || [];
        return {
          ...prev,
          investigation_status: 'challenged',
          confidence: challengeResult.revised_confidence,
          challenge_history: [challengeResult, ...currentHistory],
        };
      });
    } catch (err) {
      console.error('Challenge failed:', err);
    }
  };

  const handleSelectEvent = (eventId: string) => {
    const found = evidenceEvents.find((e) => e.id === eventId);
    if (found) {
      setSelectedModalEvent(found);
      setIsModalOpen(true);
    } else {
      console.warn(`Event ${eventId} not found in evidence collection`);
    }
  };

  const handleViewInTimeline = (eventId: string) => {
    setActiveTab('timeline');
    setSelectedSourceFilter('ALL');
    setTimelineSearch('');
    setExpandedEventIds((prev) => new Set([...prev, eventId]));
    setHighlightedEventId(eventId);

    setTimeout(() => {
      const el = document.getElementById(`event-card-${eventId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);

    setTimeout(() => {
      setHighlightedEventId(null);
    }, 4000);
  };

  const toggleEventExpanded = (id: string) => {
    const next = new Set(expandedEventIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedEventIds(next);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const filteredEvents = evidenceEvents.filter((evt) => {
    const matchesSource = selectedSourceFilter === 'ALL' || evt.source === selectedSourceFilter;
    const matchesSearch =
      evt.title.toLowerCase().includes(timelineSearch.toLowerCase()) ||
      evt.summary.toLowerCase().includes(timelineSearch.toLowerCase()) ||
      evt.id.toLowerCase().includes(timelineSearch.toLowerCase());
    return matchesSource && matchesSearch;
  });

  const getSourceIcon = (source: EvidenceSource) => {
    switch (source) {
      case 'github':
        return <GitPullRequest className="h-4 w-4 text-purple-400" />;
      case 'sentry':
        return <AlertCircle className="h-4 w-4 text-rose-400" />;
      case 'logs':
        return <FileText className="h-4 w-4 text-amber-400" />;
      case 'metrics':
        return <Activity className="h-4 w-4 text-emerald-400" />;
      case 'deployment':
        return <Server className="h-4 w-4 text-blue-400" />;
      case 'network':
        return <Globe className="h-4 w-4 text-cyan-400" />;
      default:
        return <Layers className="h-4 w-4 text-zinc-400" />;
    }
  };

  const getSourceBadgeClass = (source: EvidenceSource) => {
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

  return (
    <div className="min-h-screen bg-[#090d16] text-zinc-100 pb-20">
      {/* Workspace Sub-header */}
      <div className="border-b border-zinc-800/80 bg-zinc-950/70 px-4 py-4 sm:px-6 backdrop-blur">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white transition-colors cursor-pointer"
                title="Back to incident vault"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold uppercase text-zinc-500">
                    {incident.id}
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded border px-2 py-0.2 text-[10px] font-mono font-bold ${
                      incident.severity === 'P0'
                        ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                        : 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                    }`}
                  >
                    {incident.severity}
                  </span>
                  <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.2 text-[10px] font-mono font-bold uppercase text-emerald-400">
                    Status: {incident.status}
                  </span>
                  <span className="rounded border border-zinc-800 bg-zinc-900 px-2 py-0.2 text-[11px] font-mono text-zinc-300">
                    Component: {incident.service}
                  </span>
                  <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.2 text-[10px] font-mono text-emerald-400">
                    Live Telemetry Ingested
                  </span>
                </div>

                <h1 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl font-sans">
                  {incident.title}
                </h1>

                {/* Sources Used Checklist */}
                <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] font-mono text-zinc-400">
                  <span className="text-zinc-500 uppercase tracking-wider text-[10px]">Sources Ingested:</span>
                  {(() => {
                    const sources = new Set(evidenceEvents.map(e => e.source));
                    return [
                      { key: 'github', label: 'GitHub', icon: <GitPullRequest className="h-3 w-3 text-purple-400" /> },
                      { key: 'sentry', label: 'Sentry', icon: <AlertCircle className="h-3 w-3 text-rose-400" /> },
                      { key: 'logs', label: 'Logs', icon: <FileText className="h-3 w-3 text-amber-400" /> },
                      { key: 'metrics', label: 'Metrics', icon: <Activity className="h-3 w-3 text-emerald-400" /> },
                    ].map(s => {
                      const hasSource = sources.has(s.key as EvidenceSource);
                      return (
                        <span
                          key={s.key}
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 border ${
                            hasSource
                              ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
                              : 'border-zinc-800 bg-zinc-900/40 text-zinc-500'
                          }`}
                        >
                          {s.icon}
                          <span>{s.label}</span>
                          <span className="font-bold">{hasSource ? '✓' : '✗'}</span>
                        </span>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
              <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-zinc-300">
                <Clock className="h-3.5 w-3.5 text-zinc-400" />
                <span>{new Date(incident.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC</span>
                <span className="text-zinc-600">•</span>
                <span className="text-emerald-400">
                  {incident.mitigated_at
                    ? `${Math.max(1, Math.round((new Date(incident.mitigated_at).getTime() - new Date(incident.started_at).getTime()) / 60000))}m`
                    : '45m'} window
                </span>
              </div>

              {onNavigateToReport && (
                <button
                  onClick={onNavigateToReport}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 font-bold text-white transition-colors cursor-pointer"
                  title="Open formatted post-mortem report"
                >
                  <FileText className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Final Report</span>
                </button>
              )}

              <button
                onClick={() => {
                  if (investigation?.primary_hypothesis) {
                    handleChallengeConclusion(investigation.primary_hypothesis);
                  }
                }}
                disabled={isInvestigating}
                className="flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-950/30 hover:bg-purple-900/40 px-3 py-1.5 font-bold text-purple-200 transition-colors cursor-pointer"
                title="Challenge root-cause hypothesis against contradictory evidence"
              >
                <ShieldAlert className="h-3.5 w-3.5 text-purple-400" />
                <span>Challenge</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-6 flex items-center gap-1 border-b border-zinc-800 overflow-x-auto text-xs font-mono">
            <button
              onClick={() => setActiveTab('investigation')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-medium transition-colors cursor-pointer shrink-0 ${
                activeTab === 'investigation'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Forensic Investigation</span>
              {investigation && (
                <span className="ml-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                  {investigation.confidence}% Confidence
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-medium transition-colors cursor-pointer shrink-0 ${
                activeTab === 'timeline'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Correlated Timeline ({evidenceEvents.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('graph')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-medium transition-colors cursor-pointer shrink-0 ${
                activeTab === 'graph'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Evidence Graph (React Flow)</span>
            </button>

            <button
              onClick={() => setActiveTab('evidence_panel')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-medium transition-colors cursor-pointer shrink-0 ${
                activeTab === 'evidence_panel'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Evidence Panel</span>
            </button>

            <button
              onClick={() => setActiveTab('blast_radius')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-medium transition-colors cursor-pointer shrink-0 ${
                activeTab === 'blast_radius'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              <span>Blast Radius & Topology</span>
            </button>

            <button
              onClick={() => setActiveTab('raw_json')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 font-medium transition-colors cursor-pointer shrink-0 ${
                activeTab === 'raw_json'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Raw Telemetry JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* TAB 1: CORRELATED TIMELINE & EVIDENCE */}
        {activeTab === 'timeline' && (
          <div className="space-y-6">
            {/* Timeline Filter and Search Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono uppercase text-zinc-400 mr-2">Filter Source:</span>
                {['ALL', 'github', 'sentry', 'logs', 'metrics', 'deployment', 'network'].map((src) => {
                  const count =
                    src === 'ALL'
                      ? evidenceEvents.length
                      : evidenceEvents.filter((e) => e.source === src).length;
                  if (count === 0 && src !== 'ALL') return null;

                  return (
                    <button
                      key={src}
                      onClick={() => setSelectedSourceFilter(src)}
                      className={`rounded px-2.5 py-1 text-xs font-mono uppercase transition-colors cursor-pointer ${
                        selectedSourceFilter === src
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                          : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 border border-transparent'
                      }`}
                    >
                      {src} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Acquisition Actions */}
                <div className="flex items-center gap-1.5 mr-1 border-r border-zinc-800 pr-3">
                  {onOpenGitHub && (
                    <button
                      onClick={onOpenGitHub}
                      className="px-2 py-1 rounded bg-zinc-800/90 hover:bg-zinc-700 text-[11px] font-mono text-zinc-300 border border-zinc-700/80 flex items-center gap-1"
                      title="Acquire commits and pull requests from GitHub"
                    >
                      <GitPullRequest className="h-3 w-3 text-purple-400" />
                      <span>+ GitHub</span>
                    </button>
                  )}
                  {onOpenSentry && (
                    <button
                      onClick={onOpenSentry}
                      className="px-2 py-1 rounded bg-zinc-800/90 hover:bg-zinc-700 text-[11px] font-mono text-zinc-300 border border-zinc-700/80 flex items-center gap-1"
                      title="Acquire unhandled exceptions and issues from Sentry"
                    >
                      <AlertCircle className="h-3 w-3 text-rose-400" />
                      <span>+ Sentry</span>
                    </button>
                  )}
                  {onOpenBundle && (
                    <button
                      onClick={onOpenBundle}
                      className="px-2 py-1 rounded bg-emerald-950/60 hover:bg-emerald-900/80 text-[11px] font-mono text-emerald-300 border border-emerald-800/80 flex items-center gap-1"
                      title="Upload or paste log bundle"
                    >
                      <FileText className="h-3 w-3 text-emerald-400" />
                      <span>+ Ingest Logs</span>
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="Filter events..."
                  value={timelineSearch}
                  onChange={(e) => setTimelineSearch(e.target.value)}
                  className="h-8 w-44 rounded border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none font-mono"
                />

                <button
                  onClick={() => {
                    if (expandedEventIds.size === evidenceEvents.length) {
                      setExpandedEventIds(new Set());
                    } else {
                      setExpandedEventIds(new Set(evidenceEvents.map((e) => e.id)));
                    }
                  }}
                  className="rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors font-mono cursor-pointer"
                >
                  {expandedEventIds.size === evidenceEvents.length ? 'Collapse All' : 'Expand All'}
                </button>
              </div>
            </div>

            {/* Event Cards Chronological Stream */}
            <div className="relative pl-6 before:absolute before:left-2.5 before:top-4 before:bottom-4 before:w-0.5 before:bg-zinc-800 space-y-6">
              {filteredEvents.map((evt, idx) => {
                const isExpanded = expandedEventIds.has(evt.id);

                return (
                  <div key={evt.id} className="relative group">
                    {/* Timeline Node Marker */}
                    <div
                      className={`absolute -left-6 top-4 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border-2 bg-zinc-950 transition-transform ${
                        evt.is_root_cause_candidate
                          ? 'border-amber-400 text-amber-400 ring-4 ring-amber-400/20'
                          : evt.severity === 'critical' || evt.severity === 'error'
                          ? 'border-rose-500 text-rose-500'
                          : 'border-zinc-700 text-zinc-400'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    </div>

                    {/* Event Container Card */}
                    <div
                      id={`event-card-${evt.id}`}
                      className={`rounded-xl border transition-all ${
                        highlightedEventId === evt.id
                          ? 'ring-2 ring-emerald-400 bg-emerald-950/30 border-emerald-500 shadow-xl'
                          : evt.is_root_cause_candidate
                          ? 'border-amber-500/50 bg-amber-950/10 shadow-lg shadow-amber-950/20'
                          : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                      }`}
                    >
                      {/* Event Header Strip */}
                      <div
                        onClick={() => toggleEventExpanded(evt.id)}
                        className="flex flex-wrap items-center justify-between gap-3 p-4 cursor-pointer select-none"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <button className="text-zinc-500 group-hover:text-zinc-300">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>

                          <span
                            className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-mono uppercase font-medium ${getSourceBadgeClass(
                              evt.source
                            )}`}
                          >
                            {getSourceIcon(evt.source)}
                            {evt.source}
                          </span>

                          {evt.is_root_cause_candidate && (
                            <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-xs font-mono font-bold text-amber-300 animate-pulse">
                              <Flame className="h-3.5 w-3.5" />
                              ROOT CAUSE CANDIDATE
                            </span>
                          )}

                          <h3 className="font-semibold text-white text-sm">
                            {evt.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 font-mono text-xs text-zinc-400">
                          <span>{new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} UTC</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectEvent(evt.id);
                            }}
                            className="rounded bg-zinc-800 hover:bg-zinc-700 px-2 py-0.5 text-zinc-300 border border-zinc-700 hover:border-emerald-500/50 transition-colors flex items-center gap-1 cursor-pointer"
                            title="Inspect full event details in modal"
                          >
                            <span>{evt.id}</span>
                            <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                          </button>
                        </div>
                      </div>

                      {/* Summary text */}
                      <div className="px-4 pb-4">
                        <p className="text-xs text-zinc-300 leading-relaxed pl-7">
                          {evt.summary}
                        </p>
                      </div>

                      {/* Expanded Rich Details */}
                      {isExpanded && (
                        <div className="border-t border-zinc-800/80 bg-zinc-950/70 p-4 pl-11 rounded-b-xl space-y-4">
                          {/* GitHub Diff Viewer */}
                          {evt.source === 'github' && evt.metadata?.diff_snippet && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-xs font-mono text-purple-300">
                                  <GitPullRequest className="h-3.5 w-3.5" />
                                  <span>Commit {evt.metadata.commit_hash} by @{evt.metadata.author} (PR #{evt.metadata.pr_number})</span>
                                </div>
                                <button
                                  onClick={() => copyToClipboard(evt.metadata.diff_snippet, `diff-${evt.id}`)}
                                  className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 hover:text-zinc-200"
                                >
                                  {copiedText === `diff-${evt.id}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                  <span>Copy Diff</span>
                                </button>
                              </div>
                              <pre className="rounded-lg border border-purple-900/40 bg-purple-950/20 p-3 text-xs font-mono text-purple-200 overflow-x-auto">
                                {evt.metadata.diff_snippet}
                              </pre>
                            </div>
                          )}

                          {/* Sentry Stack Trace Viewer */}
                          {evt.source === 'sentry' && evt.metadata?.stack_trace && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-xs font-mono text-rose-300">
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  <span>{evt.metadata.exception_type || evt.metadata.error_class}</span>
                                </div>
                                <button
                                  onClick={() => copyToClipboard(evt.metadata.stack_trace, `trace-${evt.id}`)}
                                  className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 hover:text-zinc-200"
                                >
                                  {copiedText === `trace-${evt.id}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                  <span>Copy Trace</span>
                                </button>
                              </div>
                              <pre className="rounded-lg border border-rose-900/40 bg-rose-950/20 p-3 text-xs font-mono text-rose-200 overflow-x-auto">
                                {evt.metadata.stack_trace}
                              </pre>
                            </div>
                          )}

                          {/* Raw Log Line Viewer */}
                          {evt.source === 'logs' && evt.metadata?.sample_log && (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-xs font-mono text-amber-300">
                                  <FileText className="h-3.5 w-3.5" />
                                  <span>Raw Ingress / System Log Entry</span>
                                </div>
                              </div>
                              <pre className="rounded-lg border border-zinc-800 bg-black/60 p-3 text-xs font-mono text-amber-200 overflow-x-auto whitespace-pre-wrap">
                                {evt.metadata.sample_log}
                              </pre>
                            </div>
                          )}

                          {/* Metric Anomaly Viewer */}
                          {evt.source === 'metrics' && (
                            <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/10 p-3">
                              <p className="text-xs font-mono text-emerald-300 font-semibold mb-2">
                                Telemetry Metric Anomaly Details:
                              </p>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                                <div>
                                  <span className="text-zinc-400">Metric: </span>
                                  <span className="text-white">{evt.metadata.metric_name || evt.metadata.metric}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400">Observed: </span>
                                  <span className="text-rose-400 font-bold">{evt.metadata.observed_value || evt.metadata.current_value}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400">Limit/Threshold: </span>
                                  <span className="text-zinc-300">{evt.metadata.threshold || evt.metadata.limit || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400">Target Host: </span>
                                  <span className="text-zinc-300">{evt.metadata.host || evt.metadata.cluster || 'Cluster'}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Correlated Event Links */}
                          {evt.correlated_event_ids.length > 0 && (
                            <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/60 text-xs font-mono">
                              <span className="text-zinc-400">Correlated Causality Links:</span>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {evt.correlated_event_ids.map((corrId) => (
                                  <span
                                    key={corrId}
                                    className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-zinc-300"
                                  >
                                    → {corrId}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: EVIDENCE GRAPH (React Flow Architecture) */}
        {activeTab === 'graph' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-xs font-mono text-zinc-300 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Share2 className="h-4 w-4 text-emerald-400" />
                <span className="font-bold uppercase tracking-wider text-white">
                  Section 4: Topological Causal Evidence Graph (React Flow)
                </span>
              </div>
              <div className="flex items-center gap-3 text-zinc-400 text-[11px]">
                <span>{evidenceEvents.length} Correlated Nodes</span>
                <span>•</span>
                <span>Tier 0: Changes → Tier 1: Anomalies → Tier 2: Errors → Tier 3: Impact</span>
              </div>
            </div>

            <ReactFlowEvidenceGraph
              events={evidenceEvents}
              selectedEventId={highlightedEventId}
              onSelectEvent={(eventId) => {
                handleSelectEvent(eventId);
              }}
              className="min-h-[660px]"
            />
          </div>
        )}

        {/* TAB 4: EVIDENCE PANEL (Section 5 Deep Inspector) */}
        {activeTab === 'evidence_panel' && (
          <EvidencePanelTab
            events={evidenceEvents}
            selectedEventId={highlightedEventId}
            onSelectEvent={handleSelectEvent}
            onViewInTimeline={handleViewInTimeline}
          />
        )}

        {/* TAB 3: BLAST RADIUS & TELEMETRY */}
        {activeTab === 'blast_radius' && (
          <div className="space-y-6">
            {/* Impact Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
                <p className="text-xs font-mono uppercase text-zinc-400">Users Impacted</p>
                <p className="text-2xl font-extrabold text-white font-mono mt-1">
                  {incident.blast_radius.users_affected_count.toLocaleString()}
                </p>
                <p className="text-xs text-zinc-500 mt-2">Active customer sessions impacted</p>
              </div>

              <div className="rounded-xl border border-rose-900/40 bg-rose-950/10 p-5">
                <p className="text-xs font-mono uppercase text-rose-400">Peak Error Rate</p>
                <p className="text-2xl font-extrabold text-rose-400 font-mono mt-1">
                  {incident.blast_radius.error_rate_peak_pct}%
                </p>
                <p className="text-xs text-zinc-500 mt-2">Baseline normal was &lt;0.05%</p>
              </div>

              <div className="rounded-xl border border-amber-900/40 bg-amber-950/10 p-5">
                <p className="text-xs font-mono uppercase text-amber-400">P99 Latency Surge</p>
                <p className="text-2xl font-extrabold text-amber-400 font-mono mt-1">
                  {(incident.blast_radius.p99_latency_ms / 1000).toFixed(1)}s
                </p>
                <p className="text-xs text-zinc-500 mt-2">Standard P99 SLA: 120ms</p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
                <p className="text-xs font-mono uppercase text-zinc-400">Impacted Regions</p>
                <p className="text-base font-bold text-white font-mono mt-2">
                  {incident.blast_radius.regions_affected.join(', ')}
                </p>
                <p className="text-xs text-zinc-500 mt-2">Target deployment zones</p>
              </div>
            </div>

            {/* Impacted Microservices Topology */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
              <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider mb-4">
                Impacted Service Topology
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {incident.blast_radius.services_impacted.map((svc) => (
                  <div
                    key={svc}
                    className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3"
                  >
                    <div className="h-3 w-3 rounded-full bg-rose-500 animate-pulse" />
                    <div>
                      <p className="text-xs font-mono font-semibold text-white">{svc}</p>
                      <p className="text-[10px] text-zinc-400 font-mono">Status: Degraded</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Anomalies Discovered */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
              <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider mb-4">
                Key Observability Anomalies
              </h3>
              <ul className="space-y-2.5">
                {incident.key_anomalies.map((anomaly, i) => (
                  <li key={i} className="flex items-start gap-3 text-xs text-zinc-300">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 font-mono text-[10px]">
                      {i + 1}
                    </span>
                    <span className="mt-0.5">{anomaly}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* TAB 0: FORENSIC INVESTIGATION (Stage 3 Core Engine) */}
        {activeTab === 'investigation' && (
          <InvestigationPanel
            investigation={investigation}
            events={evidenceEvents}
            isLoading={isInvestigating}
            onRefreshInvestigation={handleRefreshInvestigation}
            onChallengeConclusion={handleChallengeConclusion}
            onSelectEvent={handleSelectEvent}
            onViewInTimeline={handleViewInTimeline}
            onNavigateToReport={onNavigateToReport}
            selectedEventId={highlightedEventId}
          />
        )}

        {/* TAB 5: RAW JSON PAYLOAD */}
        {activeTab === 'raw_json' && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-mono uppercase text-zinc-400 tracking-wider">
                  Validated Pydantic IncidentDetail Payload
                </h3>
                <p className="text-xs text-zinc-500 mt-1">Conforms to backend/models.py IncidentDetail contract</p>
              </div>
              <button
                onClick={() => copyToClipboard(JSON.stringify(incident, null, 2), 'json-copied')}
                className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-200 hover:bg-zinc-700 transition-colors"
              >
                {copiedText === 'json-copied' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedText === 'json-copied' ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>

            <pre className="max-h-[600px] overflow-auto rounded-lg border border-zinc-800 bg-black/80 p-4 text-xs font-mono text-emerald-300">
              {JSON.stringify({ ...incident, evidence_events: evidenceEvents }, null, 2)}
            </pre>
          </div>
        )}

        {/* Data Sources & Pipeline Provenance */}
        <div className="mt-8 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5 space-y-3 font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 pb-3">
            <span className="font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-400" />
              <span>Telemetry Data Sources & Provenance Architecture</span>
            </span>
            <span className="text-[10px] text-zinc-500">BlackBox Pipeline v1.2</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-zinc-400">
            <div className="p-3 rounded-lg border border-zinc-800/60 bg-zinc-900/40">
              <p className="text-zinc-300 font-bold flex items-center gap-1.5">
                <GitPullRequest className="h-3.5 w-3.5 text-purple-400" />
                <span>GitHub VCS Connector</span>
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">
                Pulls PR merges, commit SHAs, git diff hunks, and author attribution for code revision causality.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-zinc-800/60 bg-zinc-900/40">
              <p className="text-zinc-300 font-bold flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                <span>Sentry Tracing Connector</span>
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">
                Normalizes stack traces, unhandled promise rejections, error spike timestamps, and crash reports.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-zinc-800/60 bg-zinc-900/40">
              <p className="text-zinc-300 font-bold flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-amber-400" />
                <span>Log Aggregator Stream</span>
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">
                Streams container stdout/stderr, Nginx gateway 504 timeouts, and worker pool panic telemetry.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-zinc-800/60 bg-zinc-900/40">
              <p className="text-zinc-300 font-bold flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-emerald-400" />
                <span>Deterministic Graph Engine</span>
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">
                Evaluates temporal windows, groups cascading anomalies, and computes causality before LLM synthesis.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Global Event Detail Citation Modal */}
      <EventDetailModal
        event={selectedModalEvent}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onNavigateToEvent={handleSelectEvent}
        onViewInTimeline={handleViewInTimeline}
      />
    </div>
  );
};
