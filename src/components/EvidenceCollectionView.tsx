import React, { useState } from 'react';
import { EvidenceEvent, EvidenceSource, ConnectorsHealthResponse } from '../types/incident';
import {
  GitPullRequest,
  AlertCircle,
  FileText,
  Activity,
  Server,
  Globe,
  Layers,
  Search,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  Sparkles,
  Database,
  Terminal,
  Filter,
} from 'lucide-react';

interface EvidenceCollectionViewProps {
  events: EvidenceEvent[];
  incidentTitle: string;
  onSelectEvent: (eventId: string) => void;
  onNavigateToWorkspace: () => void;
  connectorsStatus: ConnectorsHealthResponse | null;
}

export const EvidenceCollectionView: React.FC<EvidenceCollectionViewProps> = ({
  events,
  incidentTitle,
  onSelectEvent,
  onNavigateToWorkspace,
  connectorsStatus,
}) => {
  const [selectedSource, setSelectedSource] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

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
    const matchesSource = selectedSource === 'ALL' || e.source.toLowerCase() === selectedSource.toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      e.title.toLowerCase().includes(q) ||
      e.summary.toLowerCase().includes(q) ||
      e.id.toLowerCase().includes(q);
    return matchesSource && matchesSearch;
  });

  // Source distribution
  const sourceCounts: Record<string, number> = {};
  events.forEach((e) => {
    sourceCounts[e.source] = (sourceCounts[e.source] || 0) + 1;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
            <Layers className="h-3.5 w-3.5" />
            <span>COLLECTED TELEMETRY STREAM</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono mt-1">
            Evidence Collection
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Normalized evidence events from active incident:{' '}
            <span className="text-zinc-200 font-mono font-bold">{incidentTitle}</span>
          </p>
        </div>

        <button
          onClick={onNavigateToWorkspace}
          className="flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-5 py-2.5 text-xs font-mono font-bold text-zinc-950 transition-all shadow-md active:scale-95 cursor-pointer self-start md:self-auto"
        >
          <Sparkles className="h-4 w-4 fill-zinc-950" />
          <span>Launch Investigation Workspace</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Source Streams Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { key: 'github', label: 'GitHub VCS', icon: <GitPullRequest className="h-4 w-4 text-purple-400" /> },
          { key: 'sentry', label: 'Sentry Issues', icon: <AlertCircle className="h-4 w-4 text-rose-400" /> },
          { key: 'logs', label: 'Runtime Logs', icon: <FileText className="h-4 w-4 text-amber-400" /> },
          { key: 'metrics', label: 'Infra Metrics', icon: <Activity className="h-4 w-4 text-emerald-400" /> },
          { key: 'deployment', label: 'Deployments', icon: <Server className="h-4 w-4 text-blue-400" /> },
          { key: 'network', label: 'Ingress Mesh', icon: <Globe className="h-4 w-4 text-cyan-400" /> },
        ].map((src) => {
          const count = sourceCounts[src.key] || 0;
          return (
            <button
              key={src.key}
              onClick={() => setSelectedSource(selectedSource === src.key ? 'ALL' : src.key)}
              className={`rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                selectedSource === src.key
                  ? 'border-emerald-500 bg-emerald-950/20 ring-1 ring-emerald-500/50'
                  : 'border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/70 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                {src.icon}
                <span className="text-xs font-mono font-bold text-zinc-200">{count}</span>
              </div>
              <div className="text-xs font-mono font-medium text-white">{src.label}</div>
              <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                {count > 0 ? `${count} events captured` : 'Stream idle'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by event title, summary, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/90 pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-400 focus:border-emerald-500/60 focus:outline-none font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-400">Showing:</span>
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-mono text-zinc-200">
            {filteredEvents.length} of {events.length} Events
          </span>
          {selectedSource !== 'ALL' && (
            <button
              onClick={() => setSelectedSource('ALL')}
              className="text-xs font-mono text-emerald-400 hover:underline ml-2"
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>

      {/* Evidence Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] text-zinc-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Event ID</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Title & Description</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {filteredEvents.map((evt) => (
                <tr
                  key={evt.id}
                  onClick={() => onSelectEvent(evt.id)}
                  className="hover:bg-zinc-800/40 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 text-zinc-400 whitespace-nowrap font-bold">
                    {evt.id}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 rounded bg-zinc-800/80 border border-zinc-700/80 px-2 py-0.5 text-[11px] uppercase">
                      {getSourceIcon(evt.source)}
                      <span>{evt.source}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-zinc-400 text-[11px]">
                    {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-sans font-semibold text-white">
                      {evt.title}
                    </div>
                    <div className="text-[11px] text-zinc-400 line-clamp-1 font-sans mt-0.5">
                      {evt.summary}
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                        evt.severity === 'critical'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          : evt.severity === 'error'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          : evt.severity === 'warning'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {evt.severity?.toUpperCase() || 'INFO'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(evt.id);
                      }}
                      className="inline-flex items-center gap-1 rounded bg-zinc-800 hover:bg-zinc-700 px-2 py-1 text-[11px] text-zinc-300 transition-colors"
                    >
                      <span>Inspect</span>
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Small Data Sources Section */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5 space-y-3">
        <h4 className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-emerald-400" />
          <span>About Telemetry Data Sources</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-zinc-400 font-sans leading-relaxed">
          <div className="space-y-1">
            <span className="font-mono text-zinc-300 font-semibold block">GitHub VCS Stream:</span>
            <span>Commits, PR merges, code diffs, and deploy tags parsed for config modifications or resource sizing changes.</span>
          </div>
          <div className="space-y-1">
            <span className="font-mono text-zinc-300 font-semibold block">Sentry Runtime Stream:</span>
            <span>Uncaught exception clusters, stack frames, HTTP error rates, and breadcrumbs captured from production nodes.</span>
          </div>
          <div className="space-y-1">
            <span className="font-mono text-zinc-300 font-semibold block">APM & Infrastructure:</span>
            <span>Database active connection counts, pool exhaustion events, container restarts, and edge 504 gateway logs.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
