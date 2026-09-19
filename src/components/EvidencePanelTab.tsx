import React, { useState } from 'react';
import { EvidenceEvent, EvidenceSource } from '../types/incident';
import {
  GitPullRequest,
  AlertCircle,
  FileText,
  Activity,
  Server,
  Globe,
  Layers,
  Copy,
  Check,
  ExternalLink,
  Search,
  Flame,
  ArrowRight,
  Database,
  Code,
  Tag,
} from 'lucide-react';

interface EvidencePanelTabProps {
  events: EvidenceEvent[];
  selectedEventId?: string | null;
  onSelectEvent: (eventId: string) => void;
  onViewInTimeline: (eventId: string) => void;
}

export const EvidencePanelTab: React.FC<EvidencePanelTabProps> = ({
  events,
  selectedEventId,
  onSelectEvent,
  onViewInTimeline,
}) => {
  const [activeEventId, setActiveEventId] = useState<string>(
    selectedEventId || events.find((e) => e.is_root_cause_candidate)?.id || events[0]?.id || ''
  );
  const [copied, setCopied] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  const activeEvent = events.find((e) => e.id === activeEventId) || events[0];

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
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

  const filteredEvents = events.filter((e) => {
    const matchesSource = filterSource === 'ALL' || e.source === filterSource;
    const q = search.toLowerCase();
    const matchesSearch =
      e.title.toLowerCase().includes(q) ||
      e.summary.toLowerCase().includes(q) ||
      e.id.toLowerCase().includes(q);
    return matchesSource && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <span>Section 5: Evidence Inspector Panel</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5 font-mono">
            Inspect raw event parameters, cryptographic commit hashes, stack traces, and causality references.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-400">Total Ingested:</span>
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-mono font-bold text-white">
            {events.length} Events
          </span>
        </div>
      </div>

      {/* Two-Column Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
        {/* Left Column: Event List (4 cols) */}
        <div className="lg:col-span-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 flex flex-col gap-3">
          {/* Filter & Search */}
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Search evidence..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 font-mono focus:border-emerald-500/60 focus:outline-none"
            />
            <div className="flex flex-wrap gap-1 text-[11px] font-mono">
              {['ALL', 'github', 'sentry', 'logs', 'metrics'].map((src) => (
                <button
                  key={src}
                  onClick={() => setFilterSource(src)}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                    filterSource === src
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                      : 'text-zinc-400 hover:text-zinc-200 bg-zinc-800/60'
                  }`}
                >
                  {src.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto space-y-2 max-h-[550px] pr-1">
            {filteredEvents.map((evt) => {
              const isSelected = evt.id === activeEventId;
              return (
                <div
                  key={evt.id}
                  onClick={() => setActiveEventId(evt.id)}
                  className={`rounded-lg border p-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-emerald-500/80 bg-emerald-950/20 shadow-sm'
                      : evt.is_root_cause_candidate
                      ? 'border-amber-500/50 bg-zinc-950/80 hover:border-amber-400'
                      : 'border-zinc-800/80 bg-zinc-950/50 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-[10px] mb-1">
                    <span className="flex items-center gap-1 text-zinc-300 font-bold">
                      {getSourceIcon(evt.source)}
                      <span>{evt.id}</span>
                    </span>
                    <span className="text-zinc-400">
                      {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>

                  <h4 className="text-xs font-semibold text-white line-clamp-1">
                    {evt.title}
                  </h4>

                  <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5">
                    {evt.summary}
                  </p>

                  {evt.is_root_cause_candidate && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] font-mono text-amber-400">
                      <Flame className="h-3 w-3" />
                      <span>Root Cause Candidate</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Detailed Event Inspector (8 cols) */}
        <div className="lg:col-span-8 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-6 flex flex-col justify-between">
          {activeEvent ? (
            <div className="space-y-6">
              {/* Event Top Metadata */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-zinc-800 border border-zinc-700 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-300">
                      {activeEvent.id}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-300 uppercase">
                      {getSourceIcon(activeEvent.source)}
                      <span>{activeEvent.source}</span>
                    </span>
                    <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-400">
                      Severity: {activeEvent.severity?.toUpperCase() || 'INFO'}
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-white font-sans mt-2">
                    {activeEvent.title}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onViewInTimeline(activeEvent.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <span>View in Timeline</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleCopy(JSON.stringify(activeEvent, null, 2), 'raw-event')}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-mono text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  >
                    {copied === 'raw-event' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copied === 'raw-event' ? 'Copied' : 'Copy Event'}</span>
                  </button>
                </div>
              </div>

              {/* Timestamp & Message */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3">
                  <span className="text-zinc-500 uppercase text-[10px] block">Timestamp (UTC)</span>
                  <span className="text-zinc-200 font-bold mt-0.5 block">
                    {new Date(activeEvent.timestamp).toUTCString()}
                  </span>
                  <span className="text-zinc-500 text-[10px] mt-0.5 block">
                    ISO: {activeEvent.timestamp}
                  </span>
                </div>

                <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3">
                  <span className="text-zinc-500 uppercase text-[10px] block">Causal Reference Links</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
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
                      <span className="text-zinc-500">Root / Independent observation</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Message Summary */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-mono uppercase text-zinc-400 font-bold">
                  Observation Message / Description
                </h4>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5 text-xs text-zinc-300 leading-relaxed font-sans">
                  {activeEvent.summary}
                </div>
              </div>

              {/* Specific Source Metadata: Diff, Stack Trace, or Logs */}
              {activeEvent.metadata?.diff_snippet && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-mono uppercase text-purple-400 font-bold flex items-center gap-1.5">
                    <Code className="h-3.5 w-3.5" />
                    <span>Git Diff Revision Snippet</span>
                  </h4>
                  <pre className="rounded-lg border border-purple-900/40 bg-black/80 p-3.5 text-xs font-mono text-purple-300 overflow-x-auto max-h-48">
                    {activeEvent.metadata.diff_snippet}
                  </pre>
                </div>
              )}

              {activeEvent.metadata?.stack_trace && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-mono uppercase text-rose-400 font-bold flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>Runtime Exception Stack Trace</span>
                  </h4>
                  <pre className="rounded-lg border border-rose-900/40 bg-black/80 p-3.5 text-xs font-mono text-rose-300 overflow-x-auto max-h-48">
                    {activeEvent.metadata.stack_trace}
                  </pre>
                </div>
              )}

              {/* Structured Metadata JSON */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-mono uppercase text-zinc-400 font-bold flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-zinc-500" />
                  <span>Structured Metadata & Tags</span>
                </h4>
                <pre className="rounded-lg border border-zinc-800 bg-black/80 p-3.5 text-xs font-mono text-emerald-300 overflow-x-auto max-h-48">
                  {JSON.stringify(activeEvent.metadata, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-zinc-500 font-mono text-xs">
              Select an evidence event from the left column to inspect telemetry.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
