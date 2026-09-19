import React from 'react';
import { ConnectorsHealthResponse } from '../types/incident';
import {
  Github,
  AlertTriangle,
  CheckCircle2,
  FileCode,
  Sparkles,
  RefreshCw,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface SourceStatusBannerProps {
  status: ConnectorsHealthResponse | null;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenDemo: () => void;
  onOpenGitHub: () => void;
  onOpenSentry: () => void;
  onOpenBundle: () => void;
}

export function SourceStatusBanner({
  status,
  isLoading,
  onRefresh,
  onOpenDemo,
  onOpenGitHub,
  onOpenSentry,
  onOpenBundle,
}: SourceStatusBannerProps) {
  const ghConnected = status?.github?.connected ?? false;
  const sentryConnected = status?.sentry?.connected ?? false;

  return (
    <div className="bg-[#0e1424] border-b border-zinc-800/80 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Provider Health Indicators */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 mr-1">
            <Layers className="h-4 w-4 text-emerald-400" />
            <span className="font-semibold text-zinc-200">EVIDENCE CONNECTORS</span>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh connector connectivity status"
              className="p-1 hover:text-zinc-100 text-zinc-500 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* GitHub Status Pill */}
          <div
            onClick={onOpenGitHub}
            className={`cursor-pointer inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-mono border transition-all ${
              ghConnected
                ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300 hover:bg-emerald-900/50'
                : 'bg-amber-950/30 border-amber-800/60 text-amber-300 hover:bg-amber-900/40'
            }`}
          >
            <Github className="h-3.5 w-3.5" />
            <span className="font-medium">GitHub:</span>
            {ghConnected ? (
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-300">
                <AlertTriangle className="h-3 w-3" /> Unavailable — Demo data available
              </span>
            )}
          </div>

          {/* Sentry Status Pill */}
          <div
            onClick={onOpenSentry}
            className={`cursor-pointer inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-mono border transition-all ${
              sentryConnected
                ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300 hover:bg-emerald-900/50'
                : 'bg-amber-950/30 border-amber-800/60 text-amber-300 hover:bg-amber-900/40'
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="font-medium">Sentry:</span>
            {sentryConnected ? (
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-300">
                <AlertTriangle className="h-3 w-3" /> Unavailable — Demo data available
              </span>
            )}
          </div>

          {/* File Ingestion Pill */}
          <div
            onClick={onOpenBundle}
            className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border bg-sky-950/30 border-sky-800/60 text-sky-300 hover:bg-sky-900/40 transition-all"
          >
            <FileCode className="h-3.5 w-3.5 text-sky-400" />
            <span>File Ingestion:</span>
            <span className="text-sky-300 font-semibold">.log, .txt, .json, .csv</span>
          </div>

          {/* Demo Fallback Pill */}
          <div
            onClick={onOpenDemo}
            className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border bg-purple-950/30 border-purple-800/60 text-purple-300 hover:bg-purple-900/40 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span>Demo Mode:</span>
            <span className="text-purple-300 font-semibold">Zero-Config Ready</span>
          </div>
        </div>

        {/* Right: Quick Ingestion Actions */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <button
            onClick={onOpenDemo}
            className="px-3 py-1.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span>Demo Incident</span>
          </button>

          <button
            onClick={onOpenGitHub}
            className="px-3 py-1.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors flex items-center gap-1.5"
          >
            <Github className="h-3.5 w-3.5 text-zinc-300" />
            <span>Connect GitHub</span>
          </button>

          <button
            onClick={onOpenSentry}
            className="px-3 py-1.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors flex items-center gap-1.5"
          >
            <span className="text-amber-400 font-bold">S</span>
            <span>Connect Sentry</span>
          </button>

          <button
            onClick={onOpenBundle}
            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors flex items-center gap-1.5 shadow-sm shadow-emerald-950"
          >
            <FileCode className="h-3.5 w-3.5" />
            <span>Upload Incident Bundle</span>
            <ArrowRight className="h-3 w-3 ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
