import React, { useState } from 'react';
import {
  Github,
  X,
  CheckCircle2,
  AlertTriangle,
  GitCommit,
  GitPullRequest,
  Box,
  ExternalLink,
  Search,
} from 'lucide-react';
import {
  EvidenceEvent,
  AcquisitionResult,
  GitHubAcquisitionRequest,
} from '../types/incident';
import { acquireGitHubEvidence } from '../services/api';

interface GitHubConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportEvidence: (result: AcquisitionResult) => void;
}

export function GitHubConnectModal({
  isOpen,
  onClose,
  onImportEvidence,
}: GitHubConnectModalProps) {
  const [repository, setRepository] = useState('payments-team/payments-api');
  const [branch, setBranch] = useState('main');
  const [startTime, setStartTime] = useState('2026-09-18T08:00');
  const [endTime, setEndTime] = useState('2026-09-18T09:00');
  const [patToken, setPatToken] = useState('');
  const [includePRs, setIncludePRs] = useState(true);
  const [includeDeployments, setIncludeDeployments] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [acquisitionResult, setAcquisitionResult] = useState<AcquisitionResult | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAcquire = async () => {
    setIsLoading(true);
    setErrorNotice(null);

    const payload: GitHubAcquisitionRequest = {
      repository: repository.trim(),
      branch: branch.trim() || 'main',
      incident_start_time: startTime ? new Date(startTime).toISOString() : undefined,
      incident_end_time: endTime ? new Date(endTime).toISOString() : undefined,
      personal_access_token: patToken.trim() || undefined,
      include_pull_requests: includePRs,
      include_deployments: includeDeployments,
    };

    try {
      const result = await acquireGitHubEvidence(payload);
      setAcquisitionResult(result);
    } catch (err: any) {
      setErrorNotice(err.message || 'GitHub acquisition failed');
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
            <div className="p-2 rounded-lg bg-zinc-800/80 border border-zinc-700 text-zinc-100">
              <Github className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">GitHub Evidence Connector</h2>
              <p className="text-xs text-zinc-400 font-mono">
                Acquire commits, pull requests, and deployment events within the incident window
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-mono text-zinc-300 mb-1">
                Repository (owner/repo)
              </label>
              <input
                type="text"
                value={repository}
                onChange={(e) => setRepository(e.target.value)}
                placeholder="e.g. payments-team/payments-api"
                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-300 mb-1">Branch</label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-mono text-zinc-300 mb-1">Incident Start</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-zinc-300 mb-1">Incident End</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-mono text-zinc-300">
                Personal Access Token (PAT)
              </label>
              <span className="text-[10px] text-zinc-400 font-mono">
                Optional: Uses GITHUB_TOKEN or Demo Fallback
              </span>
            </div>
            <input
              type="password"
              value={patToken}
              onChange={(e) => setPatToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-6 text-xs font-mono text-zinc-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includePRs}
                onChange={(e) => setIncludePRs(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0"
              />
              <span>Include Merged Pull Requests</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeDeployments}
                onChange={(e) => setIncludeDeployments(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0"
              />
              <span>Include Deployments</span>
            </label>
          </div>

          {/* Action Button */}
          <div className="pt-2 flex items-center justify-between">
            <div className="text-xs text-zinc-400 font-mono">
              Universal Source Abstraction: outputs normalized <code className="text-emerald-400">EvidenceEvent</code>
            </div>
            <button
              onClick={handleAcquire}
              disabled={isLoading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-mono font-semibold flex items-center gap-2 transition-colors shadow"
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span>Acquire GitHub Evidence</span>
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
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
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
                    {ev.event_type === 'pull_request' ? (
                      <GitPullRequest className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                    ) : ev.event_type === 'deployment' ? (
                      <Box className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
                    ) : (
                      <GitCommit className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-200">{ev.title}</span>
                        {ev.is_root_cause_candidate && (
                          <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-400 text-[10px] border border-rose-800 font-bold">
                            Root Cause Candidate
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">{ev.summary}</p>
                      <div className="flex items-center gap-3 text-[10px] text-zinc-400 mt-1">
                        <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                        <span>•</span>
                        <span>Type: {ev.event_type}</span>
                        {ev.related_identifiers && ev.related_identifiers.length > 0 && (
                          <>
                            <span>•</span>
                            <span>Ref: {ev.related_identifiers.join(', ')}</span>
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
                      title="View external reference"
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
