import React, { useState } from 'react';
import { ConnectorsHealthResponse, AcquisitionResult } from '../types/incident';
import {
  Zap,
  GitBranch,
  AlertCircle,
  UploadCloud,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
  FileCode,
  Shield,
  Layers,
  Activity,
  Server,
  RefreshCw,
} from 'lucide-react';

interface NewInvestigationViewProps {
  connectorsStatus: ConnectorsHealthResponse | null;
  onLaunchDemo: () => void;
  onOpenGitHubModal: () => void;
  onOpenSentryModal: () => void;
  onOpenUploadModal: () => void;
  onDirectImport: (result: AcquisitionResult) => void;
}

export const NewInvestigationView: React.FC<NewInvestigationViewProps> = ({
  connectorsStatus,
  onLaunchDemo,
  onOpenGitHubModal,
  onOpenSentryModal,
  onOpenUploadModal,
  onDirectImport,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setUploadError(null);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const events = Array.isArray(parsed) ? parsed : parsed.events || parsed.evidence_events;
        if (!events || !Array.isArray(events)) {
          throw new Error('JSON bundle must contain an array of events or an "events" property.');
        }

        onDirectImport({
          source: 'bundle_upload',
          events_count: events.length,
          sources_count: 1,
          summary_message: `Successfully loaded bundle with ${events.length} telemetry records.`,
          events,
          connector_status: {
            connected: true,
            available: true,
            fallback_available: true,
          },
          warnings: [],
        });
      } catch (err: any) {
        setUploadError(err.message || 'Invalid JSON file format');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-8">
      {/* Page Header */}
      <div className="border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
          <Layers className="h-3.5 w-3.5" />
          <span>INCIDENT TELEMETRY INGESTION</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white font-mono mt-1">
          Start New Investigation
        </h1>
        <p className="text-xs text-zinc-400 mt-1 max-w-2xl font-sans">
          Ingest signals across source code revisions, runtime exception traces, and infrastructure logs to reconstruct the causal sequence of any production degradation.
        </p>
      </div>

      {/* Grid of 4 Ingestion Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* OPTION 1: DEMO INCIDENT (1-CLICK) */}
        <div className="group relative rounded-xl border-2 border-emerald-500/50 bg-gradient-to-b from-emerald-950/20 to-zinc-950 p-6 transition-all hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-950/30 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-300">
                <Zap className="h-3 w-3 fill-emerald-400" />
                RECOMMENDED FOR DEMO
              </span>
              <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Ready (1-Click)
              </span>
            </div>

            <h3 className="text-base font-bold text-white font-sans group-hover:text-emerald-300 transition-colors">
              Pre-loaded DB Pool Exhaustion Incident
            </h3>

            <p className="text-xs text-zinc-300 leading-relaxed font-sans">
              Instant end-to-end investigation with 12 correlated telemetry events: GitHub PR merge, Postgres connection saturation, Sentry timeout spikes, and rollback remediation.
            </p>

            <div className="rounded-lg bg-zinc-900/80 border border-zinc-800 p-2.5 font-mono text-[11px] text-zinc-400 space-y-1">
              <div className="text-zinc-300">Included Sources:</div>
              <div className="flex flex-wrap gap-2 text-zinc-400">
                <span>• GitHub PR #412</span>
                <span>• Sentry Issue #9821</span>
                <span>• Postgres Metrics</span>
                <span>• Ingress 504 Logs</span>
              </div>
            </div>
          </div>

          <button
            onClick={onLaunchDemo}
            className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 py-2.5 px-4 text-xs font-mono font-bold text-zinc-950 transition-all cursor-pointer shadow-md"
          >
            <span>Launch Demo Investigation</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* OPTION 2: GITHUB CONNECTOR */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 flex flex-col justify-between hover:border-zinc-700 transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 px-2.5 py-0.5 text-[10px] font-mono font-bold text-purple-300">
                <GitBranch className="h-3 w-3" />
                VCS CONNECTOR
              </span>
              <span className="flex items-center gap-1 text-[11px] font-mono text-zinc-400">
                {connectorsStatus?.github?.connected ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Live Token Active
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <Activity className="h-3.5 w-3.5" /> Demo Mode
                  </span>
                )}
              </span>
            </div>

            <h3 className="text-base font-bold text-white font-sans">
              GitHub Commits & Deployments
            </h3>

            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              Pull commit SHAs, pull request descriptions, diff summaries, and CI/CD deployment markers directly from GitHub repositories.
            </p>

            <div className="rounded-lg bg-zinc-950/60 border border-zinc-800/80 p-2.5 text-[11px] font-mono text-zinc-400">
              <div className="flex justify-between items-center">
                <span>Status:</span>
                <span className="text-zinc-200">
                  {connectorsStatus?.github?.connected ? 'Connected' : 'Demo Ready (Token Optional)'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onOpenGitHubModal}
            className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-purple-500/40 bg-purple-950/20 hover:bg-purple-900/30 py-2.5 px-4 text-xs font-mono font-bold text-purple-200 transition-all cursor-pointer"
          >
            <span>Query GitHub Telemetry</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* OPTION 3: SENTRY CONNECTOR */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 flex flex-col justify-between hover:border-zinc-700 transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 px-2.5 py-0.5 text-[10px] font-mono font-bold text-rose-300">
                <AlertCircle className="h-3 w-3" />
                EXCEPTION TRACKER
              </span>
              <span className="flex items-center gap-1 text-[11px] font-mono text-zinc-400">
                {connectorsStatus?.sentry?.connected ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Live Token Active
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <Activity className="h-3.5 w-3.5" /> Demo Mode
                  </span>
                )}
              </span>
            </div>

            <h3 className="text-base font-bold text-white font-sans">
              Sentry Runtime Traces & Issues
            </h3>

            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              Fetch exception clusters, stack frames, breadcrumbs, user impact counts, and tags directly from Sentry projects.
            </p>

            <div className="rounded-lg bg-zinc-950/60 border border-zinc-800/80 p-2.5 text-[11px] font-mono text-zinc-400">
              <div className="flex justify-between items-center">
                <span>Status:</span>
                <span className="text-zinc-200">
                  {connectorsStatus?.sentry?.connected ? 'Connected' : 'Demo Ready (Token Optional)'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onOpenSentryModal}
            className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-rose-500/40 bg-rose-950/20 hover:bg-rose-900/30 py-2.5 px-4 text-xs font-mono font-bold text-rose-200 transition-all cursor-pointer"
          >
            <span>Query Sentry Issues</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* OPTION 4: UPLOAD BUNDLE (DRAG & DROP) */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 flex flex-col justify-between hover:border-zinc-700 transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 px-2.5 py-0.5 text-[10px] font-mono font-bold text-blue-300">
                <UploadCloud className="h-3 w-3" />
                MANUAL BUNDLE
              </span>
              <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                JSON / ZIP
              </span>
            </div>

            <h3 className="text-base font-bold text-white font-sans">
              Upload Custom Incident Bundle
            </h3>

            {/* Drag & Drop target area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={onOpenUploadModal}
              className={`rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-zinc-700 bg-zinc-950/60 hover:border-zinc-600'
              }`}
            >
              <UploadCloud className="h-6 w-6 text-zinc-400 mx-auto mb-1" />
              <p className="text-xs text-zinc-300 font-mono">
                Drag & drop incident JSON here
              </p>
              <p className="text-[10px] text-zinc-400 mt-0.5 font-sans">
                or click to open the bundle importer
              </p>
            </div>

            {uploadError && (
              <p className="text-[11px] text-rose-400 font-mono">{uploadError}</p>
            )}
          </div>

          <button
            onClick={onOpenUploadModal}
            className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 py-2.5 px-4 text-xs font-mono font-bold text-zinc-200 transition-all cursor-pointer"
          >
            <span>Open Bundle Importer</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
