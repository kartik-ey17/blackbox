import React, { useState } from 'react';
import {
  X,
  Activity,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Server,
  Zap,
  Copy,
  Check,
  Globe,
  Radio,
} from 'lucide-react';
import {
  HealthCheckResult,
  checkBackendHealth,
  testConnectivityProbe,
  getActiveApiUrl,
  setActiveApiUrl,
  resetApiUrl,
} from '../services/api';

interface ApiDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentHealth: HealthCheckResult | null;
  onHealthUpdated: (res: HealthCheckResult) => void;
}

export const ApiDiagnosticsModal: React.FC<ApiDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  currentHealth,
  onHealthUpdated,
}) => {
  const [customUrl, setCustomUrl] = useState(getActiveApiUrl());
  const [isRunningCheck, setIsRunningCheck] = useState(false);
  const [probeResult, setProbeResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleRunHealthCheck = async (target?: string) => {
    setIsRunningCheck(true);
    const result = await checkBackendHealth(target !== undefined ? target : customUrl);
    onHealthUpdated(result);
    setIsRunningCheck(false);
  };

  const handleRunProbe = async () => {
    setIsRunningCheck(true);
    const result = await testConnectivityProbe(customUrl);
    setProbeResult(result);
    setIsRunningCheck(false);
  };

  const handleSaveAndApplyUrl = () => {
    setActiveApiUrl(customUrl);
    handleRunHealthCheck(customUrl);
  };

  const handleReset = () => {
    resetApiUrl();
    setCustomUrl('');
    handleRunHealthCheck('');
  };

  const copyPayload = (payload: any) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl border border-zinc-800 bg-[#0c101c] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">API Connectivity & Health Diagnostic</h2>
              <p className="text-xs text-zinc-400 font-mono">Backend contract & latency probe</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="mt-5 space-y-5">
          {/* Target Base URL Config */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <label className="block text-xs font-mono uppercase text-zinc-400 mb-1.5">
              Backend API Base URL (Environment Configured)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="Leave empty for local relative /api or enter http://localhost:8000"
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
              />
              <button
                onClick={handleSaveAndApplyUrl}
                className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-mono font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors"
              >
                Apply & Test
              </button>
              <button
                onClick={handleReset}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-mono text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Reset
              </button>
            </div>
            <p className="mt-2 text-[11px] text-zinc-400">
              Configured via <code className="text-zinc-300">VITE_API_URL</code> or <code className="text-zinc-300">NEXT_PUBLIC_API_URL</code>.
            </p>
          </div>

          {/* Test Status Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Status 1: GET /health */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-zinc-400">Endpoint: GET /health</span>
                <span
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-mono font-semibold ${
                    currentHealth?.ok
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {currentHealth?.ok ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" /> 200 OK
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-3 w-3" /> Unreachable
                    </>
                  )}
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between font-mono text-xs">
                <span className="text-zinc-400">Round-trip Latency:</span>
                <span className="text-white font-bold">{currentHealth ? `${currentHealth.latencyMs} ms` : '—'}</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between font-mono text-xs">
                <span className="text-zinc-400">Demo Incidents Loaded:</span>
                <span className="text-emerald-400 font-bold">
                  {currentHealth?.data?.sample_incidents_loaded ?? '3'}
                </span>
              </div>
            </div>

            {/* Status 2: POST /api/integrations/test */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-zinc-400">Probe: POST /api/integrations/test</span>
                <button
                  onClick={handleRunProbe}
                  disabled={isRunningCheck}
                  className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] font-mono text-zinc-300 hover:bg-zinc-700"
                >
                  Send Probe
                </button>
              </div>

              <div className="mt-3 flex items-baseline justify-between font-mono text-xs">
                <span className="text-zinc-400">Probe Status:</span>
                <span className="text-zinc-200 font-semibold">{probeResult?.data?.status || 'Ready to probe'}</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between font-mono text-xs">
                <span className="text-zinc-400">Echo Roundtrip:</span>
                <span className="text-emerald-400 font-bold">
                  {probeResult?.latencyMs !== undefined ? `${probeResult.latencyMs} ms` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Response Payload */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono uppercase text-zinc-400">
                Server Health Payload (<code className="text-zinc-300">HealthResponse</code>)
              </span>
              {currentHealth?.data && (
                <button
                  onClick={() => copyPayload(currentHealth.data)}
                  className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 hover:text-white"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>

            <pre className="max-h-40 overflow-auto rounded border border-zinc-800/80 bg-black/60 p-3 text-xs font-mono text-emerald-300">
              {currentHealth?.data
                ? JSON.stringify(currentHealth.data, null, 2)
                : currentHealth?.error
                ? `Error: ${currentHealth.error}\nTarget: ${currentHealth.urlTested}`
                : '// Press "Run Connectivity Test" to ping backend'}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-4">
          <span className="text-xs font-mono text-zinc-400">
            Target: <code className="text-zinc-300">{currentHealth?.urlTested || 'current host /api'}</code>
          </span>

          <div className="flex gap-2">
            <button
              onClick={() => handleRunHealthCheck()}
              disabled={isRunningCheck}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-mono font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRunningCheck ? 'animate-spin' : ''}`} />
              <span>Ping Backend Again</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-mono text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
