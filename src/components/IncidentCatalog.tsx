import React, { useState } from 'react';
import { Incident } from '../types/incident';
import {
  AlertTriangle,
  Flame,
  Clock,
  Users,
  TrendingUp,
  Activity,
  Layers,
  ArrowRight,
  Search,
  Filter,
  GitBranch,
  ShieldAlert,
  Server,
} from 'lucide-react';

interface IncidentCatalogProps {
  incidents: Incident[];
  onSelectIncident: (id: string) => void;
  isLoading: boolean;
}

export const IncidentCatalog: React.FC<IncidentCatalogProps> = ({
  incidents,
  onSelectIncident,
  isLoading,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'P0' | 'P1'>('ALL');

  const filteredIncidents = incidents.filter((incident) => {
    const matchesSearch =
      incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeverity =
      severityFilter === 'ALL' || incident.severity === severityFilter;

    return matchesSearch && matchesSeverity;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'P0':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 text-xs font-mono font-semibold text-rose-400">
            <Flame className="h-3 w-3" /> P0 CRITICAL
          </span>
        );
      case 'P1':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-xs font-mono font-semibold text-amber-400">
            <AlertTriangle className="h-3 w-3" /> P1 HIGH
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 text-xs font-mono font-semibold text-blue-400">
            {severity}
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'mitigated':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Mitigated
          </span>
        );
      case 'investigating':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
            Investigating
          </span>
        );
      case 'identified':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-400">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            Identified
          </span>
        );
      default:
        return <span className="text-[11px] font-mono text-zinc-400">{status}</span>;
    }
  };

  return (
    <section id="incidents-catalog" className="py-12 px-4 sm:px-6 max-w-7xl mx-auto">
      {/* Header with Title and Search/Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-widest text-emerald-400">
              Demo Incident Vault
            </span>
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
              {filteredIncidents.length} of {incidents.length} scenarios
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl mt-1">
            Select an Incident to Investigate
          </h2>
          <p className="text-sm text-zinc-400 mt-1 max-w-xl">
            Choose from authentic production scenarios with real commit diffs, stack traces, and saturation telemetry.
          </p>
        </div>

        {/* Filter & Search Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search service, error, PR..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-60 rounded-md border border-zinc-800 bg-zinc-900/90 pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center rounded-md border border-zinc-800 bg-zinc-900/60 p-0.5 text-xs">
            <button
              onClick={() => setSeverityFilter('ALL')}
              className={`rounded px-2.5 py-1 transition-colors ${
                severityFilter === 'ALL'
                  ? 'bg-zinc-800 text-white font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSeverityFilter('P0')}
              className={`rounded px-2.5 py-1 transition-colors ${
                severityFilter === 'P0'
                  ? 'bg-rose-500/20 text-rose-300 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              P0 Only
            </button>
            <button
              onClick={() => setSeverityFilter('P1')}
              className={`rounded px-2.5 py-1 transition-colors ${
                severityFilter === 'P1'
                  ? 'bg-amber-500/20 text-amber-300 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              P1 Only
            </button>
          </div>
        </div>
      </div>

      {/* Incidents Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="mt-4 text-xs font-mono text-zinc-400">Loading incident vault from API...</p>
        </div>
      ) : filteredIncidents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-zinc-800 rounded-xl mt-6">
          <AlertTriangle className="h-8 w-8 text-zinc-600 mb-2" />
          <p className="text-sm font-medium text-zinc-300">No incidents match your filter</p>
          <p className="text-xs text-zinc-500 mt-1">Try resetting the search query or severity toggle.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 mt-8">
          {filteredIncidents.map((incident) => (
            <div
              key={incident.id}
              className="group relative flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm backdrop-blur transition-all hover:border-zinc-700 hover:bg-zinc-900/80"
            >
              <div>
                {/* Header Row: Severity, Service Tag, Status, ID */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {getSeverityBadge(incident.severity)}
                    <span className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs font-mono text-zinc-300">
                      {incident.service}
                    </span>
                    <span className="text-xs text-zinc-500 font-mono">
                      {incident.environment}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {getStatusBadge(incident.status)}
                    <span className="text-xs font-mono text-zinc-500">
                      {incident.id}
                    </span>
                  </div>
                </div>

                {/* Title & Summary */}
                <h3 className="text-lg font-bold text-white mt-3 group-hover:text-emerald-300 transition-colors">
                  {incident.title}
                </h3>
                <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                  {incident.summary}
                </p>

                {/* Blast Radius Metrics Strip */}
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-zinc-500" />
                    <div>
                      <p className="text-[10px] uppercase font-mono text-zinc-400">Users Impacted</p>
                      <p className="text-xs font-semibold text-zinc-200 font-mono">
                        {incident.blast_radius.users_affected_count.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-rose-400" />
                    <div>
                      <p className="text-[10px] uppercase font-mono text-zinc-400">Peak Error Rate</p>
                      <p className="text-xs font-semibold text-rose-300 font-mono">
                        {incident.blast_radius.error_rate_peak_pct}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-amber-400" />
                    <div>
                      <p className="text-[10px] uppercase font-mono text-zinc-400">P99 Latency</p>
                      <p className="text-xs font-semibold text-amber-300 font-mono">
                        {(incident.blast_radius.p99_latency_ms / 1000).toFixed(1)}s
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-emerald-400" />
                    <div>
                      <p className="text-[10px] uppercase font-mono text-zinc-400">Evidence Count</p>
                      <p className="text-xs font-semibold text-emerald-300 font-mono">
                        {incident.evidence_count} Correlated Events
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Footer: Sources Badges & CTA */}
              <div className="mt-5 pt-4 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 font-mono">Sources:</span>
                  <div className="flex items-center gap-1.5">
                    {incident.sources_connected.map((source) => (
                      <span
                        key={source}
                        className="rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] font-mono text-zinc-300 uppercase"
                      >
                        {source}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => onSelectIncident(incident.id)}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/40 px-3.5 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500 hover:text-zinc-950 transition-all cursor-pointer"
                >
                  <span>Open Investigation Workspace</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
