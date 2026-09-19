import React from 'react';
import {
  X,
  ExternalLink,
  GitPullRequest,
  AlertCircle,
  FileText,
  Activity,
  Server,
  Globe,
  Layers,
  Copy,
  Check,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { EvidenceEvent, EvidenceSource } from '../types/incident';

interface EventDetailModalProps {
  event: EvidenceEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToEvent?: (eventId: string) => void;
  onViewInTimeline?: (eventId: string) => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  isOpen,
  onClose,
  onNavigateToEvent,
  onViewInTimeline,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !event) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(event, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getSourceIcon = (source: EvidenceSource | string) => {
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

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'error':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'warning':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-[#0d121f] text-zinc-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900">
              {getSourceIcon(event.source)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                  {event.source} Evidence Citation
                </span>
                <span className="font-mono text-[10px] rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300 border border-zinc-700">
                  {event.id}
                </span>
                {event.is_root_cause_candidate && (
                  <span className="flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/40 px-2 py-0.5 text-[10px] font-mono text-amber-300 font-bold">
                    <ShieldAlert className="h-3 w-3" />
                    Root Cause Candidate
                  </span>
                )}
              </div>
              <p className="text-[11px] font-mono text-zinc-400 flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3" />
                {event.timestamp}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopy}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
              title="Copy event payload"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto font-mono text-xs">
          {/* Title & Severity */}
          <div className="rounded-lg border border-zinc-800/90 bg-zinc-900/50 p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-white leading-snug">{event.title}</h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase shrink-0 ${getSeverityBadge(event.severity)}`}>
                {event.severity}
              </span>
            </div>
            <p className="mt-2.5 text-xs text-zinc-300 leading-relaxed font-sans">{event.summary}</p>
          </div>

          {/* Diff or Stack Trace if present */}
          {event.metadata?.diff_snippet && (
            <div className="rounded-lg border border-purple-900/40 bg-purple-950/20 p-3">
              <span className="text-[10px] uppercase font-bold text-purple-300 tracking-wider">
                Git Diff Snippet:
              </span>
              <pre className="mt-2 text-[11px] font-mono text-purple-200 overflow-x-auto whitespace-pre-wrap bg-black/40 p-2.5 rounded border border-purple-900/30">
                {event.metadata.diff_snippet}
              </pre>
            </div>
          )}

          {event.metadata?.stack_trace && (
            <div className="rounded-lg border border-rose-900/40 bg-rose-950/20 p-3">
              <span className="text-[10px] uppercase font-bold text-rose-300 tracking-wider">
                Exception Stack Trace:
              </span>
              <pre className="mt-2 text-[11px] font-mono text-rose-200 overflow-x-auto whitespace-pre-wrap bg-black/40 p-2.5 rounded border border-rose-900/30 max-h-44">
                {event.metadata.stack_trace}
              </pre>
            </div>
          )}

          {event.metadata?.sample_log && (
            <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-3">
              <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider">
                Raw Log Entry:
              </span>
              <pre className="mt-2 text-[11px] font-mono text-amber-200 overflow-x-auto whitespace-pre-wrap bg-black/40 p-2.5 rounded border border-amber-900/30">
                {event.metadata.sample_log}
              </pre>
            </div>
          )}

          {/* Metadata Table */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
              Telemetry Attributes & Metadata:
            </span>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(event.metadata || {}).map(([key, value]) => {
                if (key === 'diff_snippet' || key === 'stack_trace' || key === 'sample_log') return null;
                return (
                  <div key={key} className="flex items-center justify-between gap-2 rounded bg-zinc-900/80 px-2.5 py-1.5 border border-zinc-850">
                    <span className="text-[11px] text-zinc-400">{key}:</span>
                    <span className="text-[11px] text-zinc-200 font-semibold truncate max-w-[180px]" title={String(value)}>
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Correlated Event Links */}
          {event.correlated_event_ids && event.correlated_event_ids.length > 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                Correlated Evidence Links:
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {event.correlated_event_ids.map((id) => (
                  <button
                    key={id}
                    onClick={() => onNavigateToEvent && onNavigateToEvent(id)}
                    className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] font-mono text-zinc-200 hover:border-emerald-500/50 hover:text-emerald-300 transition-colors"
                  >
                    <span>{id}</span>
                    <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 px-5 py-3 bg-zinc-950/80">
          <span className="text-[11px] text-zinc-500 font-mono">ID: {event.id}</span>
          <div className="flex items-center gap-2">
            {onViewInTimeline && (
              <button
                onClick={() => {
                  onViewInTimeline(event.id);
                  onClose();
                }}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-1.5 text-xs font-mono font-medium text-white transition-colors"
              >
                Inspect in Correlated Timeline
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-3.5 py-1.5 text-xs font-mono text-zinc-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
