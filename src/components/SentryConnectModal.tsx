import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ExternalLink,
  Search,
} from 'lucide-react';
import {
  EvidenceEvent,
  AcquisitionResult,
  SentryAcquisitionRequest,
} from '../types/incident';
import { acquireSentryEvidence } from '../services/api';

interface SentryConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportEvidence: (result: AcquisitionResult) => void;
}

export function SentryConnectModal({
  isOpen,
  onClose,
  onImportEvidence,
}: SentryConnectModalProps) {
  const [organization, setOrganization] = useState('acme-corp');
  const [project, setProject] = useState('payments-service');
  const [query, setQuery] = useState('is:unresolved level:error');
  const [startTime, setStartTime] = useState('2026-09-18T08:00');
  const [endTime, setEndTime] = useState('2026-09-18T09:00');
  const [authToken, setAuthToken] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [acquisitionResult, setAcquisitionResult] = useState<AcquisitionResult | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAcquire = async () => {
    setIsLoading(true);
    setErrorNotice(null);

    const payload: SentryAcquisitionRequest = {
      organization: organization.trim(),
      project: project.trim() || 'payments-service',
      incident_start_time: startTime ? new Date(startTime).toISOString() : undefined,
      incident_end_time: endTime ? new Date(endTime).toISOString() : undefined,
      query: query.trim() || undefined,
      auth_token: authToken.trim() || undefined,
    };

    try {
      const result = await acquireSentryEvidence(payload);
      setAcquisitionResult(result);
    } catch (err: any) {
      setErrorNotice(err.message || 'Sentry acquisition failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = () => {
    if (acquisitionResult) {
      onImportEvidence(acquisitionResult);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#0f1422] border border-zinc-800 rounded-xl shadow-2xl p-6 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-950/40 border border-amber-800/80 flex items-center justify-center text-amber-400 font-black text-base">
              S
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Sentry Error Connector</h2>
              <p className="text-xs text-zinc-400 font-mono">
                Acquire unhandled exceptions, issue groups, and stack traces within the incident window
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Configuration Form */}
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-zinc-300 mb-1">
                Organization Slug
              </label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="e.g. acme-corp"
                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-300 mb-1">
                Project Slug
              </label>
              <input
                type="text"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                placeholder="e.g. payments-service"
                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-300 mb-1">
              Issue Search Query / Tags
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="is:unresolved level:error"
              className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-zinc-300 mb-1">Incident Start</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-300 mb-1">Incident End</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-mono text-zinc-300">
                Sentry Auth Token
              </label>
              <span className="text-[10px] text-zinc-400 font-mono">
                Optional: Uses SENTRY_AUTH_TOKEN or Demo Fallback
              </span>
            </div>
            <input
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="sntrys_xxxxxxxxxxxxxxxxxxxx"
              className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Action Button */}
          <div className="pt-2 flex items-center justify-between">
            <div className="text-xs text-zinc-400 font-mono">
              Universal Source Abstraction: outputs normalized <code className="text-amber-400">EvidenceEvent</code>
            </div>
            <button
              onClick={handleAcquire}
              disabled={isLoading}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-black rounded-lg text-xs font-mono font-bold flex items-center gap-2 transition-colors shadow"
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span>Acquire Sentry Errors</span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {errorNotice && (
          <div className="mt-4 p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-xs font-mono text-rose-300">
            {errorNotice}
          </div>
        )}

        {/* Acquisition Result Preview */}
        {acquisitionResult && (
          <div className="mt-5 border-t border-zinc-800 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-mono font-bold text-zinc-200">
                  {acquisitionResult.summary_message}
                </h3>
                {acquisitionResult.connector_status.error && (
                  <p className="text-[11px] font-mono text-amber-400 mt-0.5 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {acquisitionResult.connector_status.error}
                  </p>
                )}
              </div>
              <button
                onClick={handleImport}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-mono font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Import {acquisitionResult.events_count} Events
              </button>
            </div>

            {/* Event List Preview */}
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {acquisitionResult.events.map((ev) => (
                <div
                  key={ev.id}
                  className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800/80 text-xs font-mono flex items-start justify-between gap-2"
                >
                  <div className="flex items-start gap-2.5">
                    <AlertOctagon className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-200">{ev.title}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold border ${
                            ev.severity === 'critical'
                              ? 'bg-rose-950 text-rose-300 border-rose-800'
                              : 'bg-amber-950 text-amber-300 border-amber-800'
                          }`}
                        >
                          {ev.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">{ev.summary}</p>
                      <div className="flex items-center gap-3 text-[10px] text-zinc-400 mt-1">
                        <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                        <span>•</span>
                        <span>Culprit: {ev.metadata.culprit || 'Unknown'}</span>
                        {ev.metadata.users_affected && (
                          <>
                            <span>•</span>
                            <span>Users: {ev.metadata.users_affected}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {ev.raw_reference && (
                    <a
                      href={ev.raw_reference}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-500 hover:text-zinc-300 p-1 shrink-0"
                      title="View in Sentry"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
