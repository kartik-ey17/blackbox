import React from 'react';
import { X, GitPullRequest, AlertCircle, Layers, CheckCircle2, Lock, ExternalLink } from 'lucide-react';

interface IntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDemoMode: () => void;
  onOpenGitHub?: () => void;
  onOpenSentry?: () => void;
}

export const IntegrationsModal: React.FC<IntegrationsModalProps> = ({
  isOpen,
  onClose,
  onSelectDemoMode,
  onOpenGitHub,
  onOpenSentry,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-2xl border border-zinc-800 bg-[#0c101c] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-blue-400">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Engineering Data Connectors</h2>
              <p className="text-xs text-zinc-400 font-mono">Stage 2 Provider Abstraction Layer</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Informational banner */}
        <div className="mt-4 rounded-xl border border-blue-500/30 bg-blue-950/20 p-4">
          <p className="text-xs text-blue-200 leading-relaxed">
            <span className="font-semibold">Stage 2 Active:</span> Real-time acquisition providers are now available for GitHub and Sentry via token authentication or mock presets. All evidence sources normalize directly to the common <code className="text-emerald-400 font-mono">EvidenceEvent</code> representation.
          </p>
        </div>

        {/* Connectors List */}
        <div className="mt-5 space-y-3">
          {/* GitHub Connector Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400">
                <GitPullRequest className="h-4.5 w-4.5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">GitHub Integration</h4>
                <p className="text-xs text-zinc-400">Pulls PR diffs, commit authors, & deployments</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onOpenGitHub ? (
                <button
                  onClick={() => {
                    onClose();
                    onOpenGitHub();
                  }}
                  className="rounded bg-purple-600 hover:bg-purple-500 px-2.5 py-1 text-xs font-mono font-semibold text-white transition-colors cursor-pointer"
                >
                  Configure & Pull
                </button>
              ) : (
                <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
                  Ready
                </span>
              )}
            </div>
          </div>

          {/* Sentry Connector Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400">
                <AlertCircle className="h-4.5 w-4.5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Sentry Integration</h4>
                <p className="text-xs text-zinc-400">Streams unhandled exceptions & stack traces</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onOpenSentry ? (
                <button
                  onClick={() => {
                    onClose();
                    onOpenSentry();
                  }}
                  className="rounded bg-rose-600 hover:bg-rose-500 px-2.5 py-1 text-xs font-mono font-semibold text-white transition-colors cursor-pointer"
                >
                  Configure & Pull
                </button>
              ) : (
                <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
                  Ready
                </span>
              )}
            </div>
          </div>

          {/* Datadog / Observability Connector Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
                <Layers className="h-4.5 w-4.5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Datadog & CloudWatch APM</h4>
                <p className="text-xs text-zinc-400">Monitors latency percentiles & queue saturation</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
                Stage 3
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-4">
          <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Demo Mode is active
          </span>

          <button
            onClick={() => {
              onClose();
              onSelectDemoMode();
            }}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-mono font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors cursor-pointer"
          >
            Launch Demo Incident Vault
          </button>
        </div>
      </div>
    </div>
  );
};
