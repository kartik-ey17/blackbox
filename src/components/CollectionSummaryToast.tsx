import React from 'react';
import { CheckCircle2, X, ArrowRight, Layers } from 'lucide-react';
import { AcquisitionResult } from '../types/incident';

interface CollectionSummaryToastProps {
  result: AcquisitionResult | null;
  onDismiss: () => void;
  onViewTimeline?: () => void;
}

export function CollectionSummaryToast({
  result,
  onDismiss,
  onViewTimeline,
}: CollectionSummaryToastProps) {
  if (!result) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-[#0b101d] border border-emerald-500/60 rounded-xl p-4 shadow-2xl shadow-emerald-950/40 text-xs font-mono">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="p-1 rounded bg-emerald-500/20 text-emerald-400 mt-0.5">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">
                Collected {result.events_count} evidence events from {result.sources_count} sources.
              </p>
              <p className="text-zinc-400 text-xs mt-1">
                {result.summary_message}
              </p>

              {result.warnings && result.warnings.length > 0 && (
                <p className="text-amber-400 text-[11px] mt-1">
                  Notice: {result.warnings[0]}
                </p>
              )}

              <div className="mt-2.5 flex items-center gap-3">
                {onViewTimeline && (
                  <button
                    onClick={onViewTimeline}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 hover:underline"
                  >
                    <span>Inspect Timeline</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400 text-[11px]">Normalized to EvidenceEvent schema</span>
              </div>
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="text-zinc-500 hover:text-zinc-300 p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
