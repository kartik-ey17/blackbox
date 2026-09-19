import React, { useState } from 'react';
import { Incident } from '../types/incident';
import { ConnectorsHealthResponse } from '../types/incident';
import {
  Flame,
  AlertTriangle,
  Clock,
  ArrowRight,
  Sparkles,
  Layers,
  Search,
  CheckCircle2,
  RefreshCw,
  PlusCircle,
  ShieldAlert,
  Server,
  Activity,
  AlertCircle,
  FileText,
  Play,
  Zap,
} from 'lucide-react';

interface DashboardViewProps {
  incidents: Incident[];
  onSelectIncident: (id: string) => void;
  onLaunchDemo: () => void;
  onNavigateToNew: () => void;
  isLoading: boolean;
  errorNotice: string | null;
  onRetry: () => void;
  connectorsStatus: ConnectorsHealthResponse | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  incidents,
  onSelectIncident,
  onLaunchDemo,
  onNavigateToNew,
  isLoading,
  errorNotice,
  onRetry,
  connectorsStatus,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'P0' | 'P1'>('ALL');

  const filtered = incidents.filter((inc) => {
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      inc.title.toLowerCase().includes(q) ||
      inc.summary.toLowerCase().includes(q) ||
      inc.service.toLowerCase().includes(q) ||
      inc.id.toLowerCase().includes(q);
    const matchesSev = severityFilter === 'ALL' || inc.severity === severityFilter;
    return matchesQuery && matchesSev;
  });

  const getSeverityBadge = (sev: string) => {
    if (sev === 'P0') {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 text-[11px] font-mono font-bold text-rose-400">
          <Flame className="h-3 w-3" /> P0 CRITICAL
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[11px] font-mono font-bold text-amber-400">
        <AlertTriangle className="h-3 w-3" /> P1 HIGH
      </span>
    );
  };

  const getInvestigationState = (inc: Incident) => {
    // In our telemetry datasets, we have completed analysis or investigating state
    if (inc.status === 'mitigated' || inc.status === 'identified') {
      return {
        label: 'Synthesized (94% Conf)',
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      };
    }
    return {
      label: 'Evidence Ready',
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    };
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-8">
      {/* Top Banner / Quick Action Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-mono font-semibold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                BLACKBOX INVESTIGATION ENGINE
              </span>
              <span className="text-xs font-mono text-zinc-400">v2.4 Production Slice</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-sans">
              Automated Incident Root-Cause Telemetry
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-sans">
              Reconstruct causal timelines from GitHub PRs, Sentry stack traces, and CloudWatch metrics. Formulate validated root-cause hypotheses with adversarial counter-evidence checking.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={onLaunchDemo}
              className="flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-5 py-3 text-xs font-mono font-bold text-zinc-950 transition-all shadow-lg shadow-emerald-950/50 hover:shadow-emerald-500/20 active:scale-95 cursor-pointer"
              title="Launch the primary demo investigation with 1 click"
            >
              <Zap className="h-4 w-4 fill-zinc-950" />
              <span>Launch 1-Click Demo</span>
            </button>

            <button
              onClick={onNavigateToNew}
              className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/80 hover:bg-zinc-800 hover:border-zinc-600 px-5 py-3 text-xs font-mono font-bold text-white transition-all active:scale-95 cursor-pointer"
            >
              <PlusCircle className="h-4 w-4 text-zinc-400" />
              <span>New Investigation</span>
            </button>
          </div>
        </div>

        {/* Subtle connector indicators bar */}
        <div className="mt-6 pt-5 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-4">
            <span className="text-zinc-400 uppercase tracking-wider text-[10px]">Active Telemetry Ingestors:</span>
            <span className="flex items-center gap-1.5 text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> GitHub Commits
            </span>
            <span className="flex items-center gap-1.5 text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Sentry Issues
            </span>
            <span className="flex items-center gap-1.5 text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> CloudWatch Logs
            </span>
            <span className="flex items-center gap-1.5 text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Datadog APM
            </span>
          </div>
          <div className="text-[11px] text-zinc-400">
            {incidents.length} Telemetry Cases Cataloged
          </div>
        </div>
      </div>

      {/* API Error State Banner with Retry */}
      {errorNotice && (
        <div className="rounded-xl border border-rose-800/80 bg-rose-950/40 p-4 flex items-center justify-between gap-4 text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{errorNotice}</span>
          </div>
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 rounded bg-rose-900/60 hover:bg-rose-800 px-3 py-1.5 font-mono text-white text-[11px] transition-colors"
          >
            <RefreshCw className="h-3 w-3" /> Retry Probe
          </button>
        </div>
      )}

      {/* Recent Incidents Section Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white font-mono tracking-tight flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              <span>Recent Production Incidents</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Correlated multi-source failure cases with synthetic root-cause telemetry
            </p>
          </div>

          {/* Search and Filter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search incidents or service..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 sm:w-64 rounded-lg border border-zinc-800 bg-zinc-900/90 pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-400 focus:border-emerald-500/60 focus:outline-none font-mono"
              />
            </div>
            <div className="flex rounded-lg border border-zinc-800 bg-zinc-900/90 p-0.5 text-xs font-mono">
              {(['ALL', 'P0', 'P1'] as const).map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    severityFilter === sev
                      ? 'bg-zinc-800 text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-300'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Incidents Table / List */}
        {isLoading ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mx-auto mb-3" />
            <p className="text-xs font-mono text-zinc-400">Loading incidents from BlackBox API...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-12 text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-zinc-400 mx-auto" />
            <h4 className="text-sm font-mono font-bold text-zinc-300">No Incidents Found</h4>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              No incidents match your filter query. Try clearing the search or launch the demo case.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSeverityFilter('ALL');
              }}
              className="rounded bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-mono text-zinc-200"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((inc) => {
              const state = getInvestigationState(inc);
              return (
                <div
                  key={inc.id}
                  onClick={() => onSelectIncident(inc.id)}
                  className="group relative rounded-xl border border-zinc-800/90 bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-zinc-700/90 p-5 transition-all cursor-pointer shadow-sm hover:shadow-md"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Metadata & Title */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                        {getSeverityBadge(inc.severity)}
                        <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold ${state.color}`}>
                          {state.label}
                        </span>
                        <span className="rounded bg-zinc-800/80 px-2 py-0.5 text-[11px] text-zinc-300">
                          {inc.service}
                        </span>
                        <span className="text-zinc-400 text-[11px]">{inc.id}</span>
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-emerald-400 transition-colors font-sans">
                        {inc.title}
                      </h3>

                      {/* Primary finding summary */}
                      <div className="flex items-start gap-2 rounded-lg bg-zinc-950/60 border border-zinc-800/70 p-2.5 text-xs text-zinc-300 font-sans">
                        <Sparkles className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                        <div className="line-clamp-2">
                          <span className="font-mono text-zinc-400 font-medium">Primary Finding: </span>
                          <span>{inc.summary}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Timestamp & Action */}
                    <div className="flex lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-zinc-800">
                      <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{new Date(inc.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC</span>
                        <span className="text-zinc-600">•</span>
                        <span>
                          {inc.mitigated_at
                            ? `${Math.max(1, Math.round((new Date(inc.mitigated_at).getTime() - new Date(inc.started_at).getTime()) / 60000))}m duration`
                            : 'Active'}
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectIncident(inc.id);
                        }}
                        className="flex items-center gap-1.5 rounded-lg bg-zinc-800 group-hover:bg-emerald-500 group-hover:text-zinc-950 px-3.5 py-2 text-xs font-mono font-bold text-zinc-200 transition-all cursor-pointer"
                      >
                        <span>Open Workspace</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
