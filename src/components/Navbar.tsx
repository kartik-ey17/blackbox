import React from 'react';
import {
  Terminal,
  Activity,
  ArrowLeft,
  RefreshCw,
  Layers,
  UploadCloud,
  ChevronRight,
  Shield,
  FileText,
  Sparkles,
  PlusCircle,
  LayoutDashboard,
} from 'lucide-react';
import { HealthCheckResult } from '../services/api';

export type NavView = 'dashboard' | 'new_investigation' | 'evidence_collection' | 'workspace' | 'report';

interface NavbarProps {
  currentView: NavView;
  onChangeView: (view: NavView) => void;
  activeIncidentId: string | null;
  onOpenConnectors: () => void;
  onOpenIngest: () => void;
  onOpenDiagnostics: () => void;
  healthResult: HealthCheckResult | null;
  isCheckingHealth: boolean;
  onRecheckHealth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onChangeView,
  activeIncidentId,
  onOpenConnectors,
  onOpenIngest,
  onOpenDiagnostics,
  healthResult,
  isCheckingHealth,
  onRecheckHealth,
}) => {
  const navItems: { id: NavView; label: string; icon: React.ReactNode; requiresIncident?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-3 w-3" /> },
    { id: 'new_investigation', label: 'New Investigation', icon: <PlusCircle className="h-3 w-3" /> },
    { id: 'evidence_collection', label: 'Evidence Collection', icon: <Layers className="h-3 w-3" />, requiresIncident: true },
    { id: 'workspace', label: 'Investigation Workspace', icon: <Sparkles className="h-3 w-3" />, requiresIncident: true },
    { id: 'report', label: 'Final Report', icon: <FileText className="h-3 w-3" />, requiresIncident: true },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-[#090d16]/95 backdrop-blur-md">
      {/* Upper Main Bar */}
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Left: Logo & Brand */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => onChangeView('dashboard')}
            className="group flex items-center gap-2.5 text-left focus:outline-none cursor-pointer"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/90 text-emerald-400 shadow-inner transition-colors group-hover:border-emerald-500/50">
              <Terminal className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-white font-mono text-sm">BLACKBOX</span>
                <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.2 text-[9px] font-medium tracking-wide text-emerald-400 font-mono">
                  STAGE 4
                </span>
              </div>
              <p className="text-[10px] text-zinc-400">Incident Root-Cause Investigator</p>
            </div>
          </button>

          {/* Active Incident Identifier Pill */}
          {activeIncidentId && (
            <div className="hidden lg:flex items-center gap-2 border-l border-zinc-800 pl-4">
              <span className="text-[11px] font-mono text-zinc-400">Incident:</span>
              <span className="rounded bg-zinc-800/90 border border-zinc-700/80 px-2 py-0.5 text-xs font-mono text-emerald-300 font-bold">
                {activeIncidentId}
              </span>
            </div>
          )}
        </div>

        {/* Right: Quick Triggers & API Health Indicator */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onOpenConnectors}
            className="hidden items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800 transition-colors sm:flex cursor-pointer"
            title="Configure GitHub & Sentry connectors"
          >
            <Layers className="h-3 w-3 text-zinc-400" />
            <span>Connectors</span>
          </button>

          <button
            onClick={onOpenIngest}
            className="hidden items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800 transition-colors sm:flex cursor-pointer"
            title="Upload logs or incident bundle"
          >
            <UploadCloud className="h-3 w-3 text-zinc-400" />
            <span>Ingest</span>
          </button>

          {/* API Connectivity Status Pill */}
          <div className="flex items-center gap-1">
            <button
              onClick={onOpenDiagnostics}
              className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-xs hover:border-zinc-700 transition-all font-mono cursor-pointer"
              title="Click to open API Health & Connectivity Diagnostics"
            >
              <span className="relative flex h-2 w-2">
                {healthResult?.ok ? (
                  <>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                  </>
                ) : isCheckingHealth ? (
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                ) : (
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500"></span>
                )}
              </span>

              <span className="text-zinc-300 text-[11px]">
                {isCheckingHealth ? (
                  'Testing API...'
                ) : healthResult?.ok ? (
                  `API Online (${healthResult.latencyMs}ms)`
                ) : (
                  'API Offline'
                )}
              </span>

              <Activity className="h-3 w-3 text-zinc-500" />
            </button>

            <button
              onClick={onRecheckHealth}
              disabled={isCheckingHealth}
              className="p-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition-colors cursor-pointer"
              title="Refresh backend connectivity check"
            >
              <RefreshCw className={`h-3 w-3 ${isCheckingHealth ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* CORE NAVIGATION STEPPER: Dashboard -> New Investigation -> Evidence Collection -> Workspace -> Final Report */}
      <nav className="border-t border-zinc-800/80 bg-zinc-950/70 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex items-center gap-1 overflow-x-auto py-1 text-xs font-mono">
          {navItems.map((item, index) => {
            const isActive = currentView === item.id;
            const isDisabled = item.requiresIncident && !activeIncidentId;

            return (
              <React.Fragment key={item.id}>
                {index > 0 && (
                  <ChevronRight className="h-3 w-3 text-zinc-400 shrink-0 mx-0.5" />
                )}
                <button
                  onClick={() => !isDisabled && onChangeView(item.id)}
                  disabled={isDisabled}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                      : isDisabled
                      ? 'text-zinc-400 opacity-50 cursor-not-allowed'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                  }`}
                  title={isDisabled ? 'Select or launch an incident first' : undefined}
                >
                  <span className={isActive ? 'text-emerald-400' : 'text-zinc-400'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </nav>
    </header>
  );
};
