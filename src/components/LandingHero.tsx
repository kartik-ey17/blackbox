import React from 'react';
import { Play, Sparkles, Database, Server, GitPullRequest, AlertCircle, FileText, CheckCircle2, ArrowRight } from 'lucide-react';

interface LandingHeroProps {
  onScrollToIncidents: () => void;
  onOpenConnectors: () => void;
  onOpenIngest: () => void;
  sampleIncidentCount: number;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  onScrollToIncidents,
  onOpenConnectors,
  onOpenIngest,
  sampleIncidentCount,
}) => {
  return (
    <div className="relative overflow-hidden border-b border-zinc-800/80 bg-gradient-to-b from-zinc-950 via-[#0a0e1a] to-[#090d16] py-14 sm:py-20">
      {/* Background radial glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-10 h-[300px] w-[500px] rounded-full bg-blue-500/5 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        {/* Top pill badge */}
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3.5 py-1 text-xs text-emerald-300 backdrop-blur">
            <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono font-medium">Hackathon Vertical Slice • Demo Mode Ready</span>
          </div>
        </div>

        {/* Hero title & tagline */}
        <div className="mt-6 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Autonomous Incident Investigation <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Backboned by Hard Engineering Evidence
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-zinc-400 sm:text-lg">
            BlackBox aggregates pull requests, Sentry stack traces, and system logs into a correlated timeline, calculates the blast radius, and prepares evidence-backed root-cause investigations.
          </p>

          {/* Primary Action Button */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <button
              onClick={onScrollToIncidents}
              className="group flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-all cursor-pointer"
            >
              <Play className="h-4 w-4 fill-zinc-950" />
              <span>Investigate an Incident</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>

            <button
              onClick={onOpenConnectors}
              className="flex items-center gap-2 rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-4 py-3 text-sm font-medium text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800 transition-all cursor-pointer"
            >
              <GitPullRequest className="h-4 w-4 text-zinc-400" />
              <span>Configure Connectors</span>
            </button>

            <button
              onClick={onOpenIngest}
              className="flex items-center gap-2 rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-4 py-3 text-sm font-medium text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800 transition-all cursor-pointer"
            >
              <FileText className="h-4 w-4 text-zinc-400" />
              <span>Ingest Raw Logs</span>
            </button>
          </div>
        </div>

        {/* 3 Architecture Acquisition Modes */}
        <div className="mt-14">
          <div className="text-center mb-6">
            <p className="text-xs font-mono uppercase tracking-widest text-zinc-400">
              Three Supported Evidence Ingestion Channels
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Mode 1: Demo Mode (Active) */}
            <div className="relative flex flex-col justify-between rounded-xl border border-emerald-500/40 bg-zinc-900/70 p-5 shadow-sm backdrop-blur transition-all hover:border-emerald-500/60">
              <div className="absolute -top-2.5 right-4 rounded-full border border-emerald-500/50 bg-emerald-950 px-2.5 py-0.5 text-[10px] font-mono font-medium text-emerald-300">
                ACTIVE & LOADED
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                    <Database className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">1. Demo Mode</h3>
                    <p className="text-xs text-zinc-400 font-mono">{sampleIncidentCount} Production Scenarios</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                  Pre-compiled realistic incidents with genuine commit diffs, Sentry stack traces, and database saturation metrics. Operates instantly without credentials.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Zero-auth sandbox ready
                </span>
                <button
                  onClick={onScrollToIncidents}
                  className="text-xs font-medium text-zinc-300 hover:text-white flex items-center gap-1"
                >
                  Browse <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Mode 2: Live Integrations */}
            <div className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 backdrop-blur transition-all hover:border-zinc-700">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-800/60 text-blue-400">
                    <Server className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">2. Live Integrations</h3>
                    <p className="text-xs text-zinc-400 font-mono">GitHub • Sentry • Datadog</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                  Stream PR merges, commit authors, webhook anomalies, and unhandled exception clusters directly into the causality engine via authenticated webhooks.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                <span className="text-[11px] text-zinc-400 font-mono">Connectors staged</span>
                <button
                  onClick={onOpenConnectors}
                  className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  Configure <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Mode 3: File Ingestion */}
            <div className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 backdrop-blur transition-all hover:border-zinc-700">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-800/60 text-amber-400">
                    <FileText className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">3. File Ingestion</h3>
                    <p className="text-xs text-zinc-400 font-mono">Logs • JSON • CSV Bundles</p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                  Upload server logs, post-mortem JSON artifacts, or exported incident bundles. The parsing engine extracts timestamps, status codes, and error traces.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                <span className="text-[11px] text-zinc-400 font-mono">Dropzone ready</span>
                <button
                  onClick={onOpenIngest}
                  className="text-xs font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  Upload <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
