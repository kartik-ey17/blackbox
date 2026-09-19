import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clipboard,
  Sparkles,
  Search,
  FileCode,
} from 'lucide-react';
import { AcquisitionResult, FileAcquisitionRequest } from '../types/incident';
import { acquireFileEvidence } from '../services/api';

interface IngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDemoMode: () => void;
  onImportEvidence?: (result: AcquisitionResult) => void;
}

const SAMPLE_LOG_PRESET = `2026-09-18 08:12:05.120 [INFO] [ingress-lb] Health check OK on payments-service pods (3/3)
2026-09-18 08:14:15.302 [WARN] [payments-api] Latency degradation detected: p99 > 850ms on /v1/charges
2026-09-18 08:14:28.401 [ERROR] [payments-api] DB pool exhausted: active=100/100, waiting_threads=42
2026-09-18 08:14:32.115 [CRITICAL] [postgres-primary] FATAL: remaining connection slots are reserved for non-replication superuser connections
2026-09-18 08:14:40.900 [ERROR] [ingress-lb] 504 Gateway Timeout downstream from payments-service (upstream_connect_time=30.001s)
2026-09-18 08:15:02.100 [WARN] [circuit-breaker] Tripped circuit breaker for payment-gateway-us-east`;

const SAMPLE_JSON_PRESET = `[
  {"timestamp": "2026-09-18T08:14:10Z", "level": "WARN", "service": "billing-worker", "message": "Queue depth exceeded threshold: 4,821 messages pending"},
  {"timestamp": "2026-09-18T08:14:30Z", "level": "ERROR", "service": "billing-worker", "message": "SocketTimeoutException: failed to acquire DB connection after 10000ms"},
  {"timestamp": "2026-09-18T08:14:45Z", "level": "FATAL", "service": "billing-worker", "message": "Worker thread pool crashed: unhandled DeadlockDetectedException in processBatch()"}
]`;

const SAMPLE_CSV_PRESET = `timestamp,level,source,message
2026-09-18T08:10:00Z,INFO,metrics-collector,System CPU 14% Memory 42%
2026-09-18T08:14:00Z,WARN,db-monitor,HikariCP pool usage reached 98%
2026-09-18T08:14:35Z,CRITICAL,db-monitor,HikariPool-1 - Connection is not available request timed out after 30000ms
2026-09-18T08:15:00Z,ERROR,api-gateway,502 Bad Gateway rate surged to 34%`;

export const IngestionModal: React.FC<IngestionModalProps> = ({
  isOpen,
  onClose,
  onSelectDemoMode,
  onImportEvidence,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [filename, setFilename] = useState<string>('incident_bundle.log');
  const [rawText, setRawText] = useState<string>('');
  const [formatHint, setFormatHint] = useState<'auto' | 'log' | 'json' | 'csv'>('auto');

  const [isParsing, setIsParsing] = useState(false);
  const [acquisitionResult, setAcquisitionResult] = useState<AcquisitionResult | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      loadFile(e.target.files[0]);
    }
  };

  const loadFile = (file: File) => {
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      setRawText(content);
    };
    reader.readAsText(file);
  };

  const handleParseAndAcquire = async () => {
    setIsParsing(true);
    setErrorNotice(null);

    const payload: FileAcquisitionRequest = {
      filename,
      content: rawText,
      format_hint: formatHint,
    };

    try {
      const result = await acquireFileEvidence(payload);
      setAcquisitionResult(result);
    } catch (err: any) {
      setErrorNotice(err.message || 'Parsing failed');
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = () => {
    if (acquisitionResult && onImportEvidence) {
      onImportEvidence(acquisitionResult);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-zinc-800 bg-[#0c101c] p-6 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-sky-400">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Incident Bundle Ingestion</h2>
              <p className="text-xs text-zinc-400 font-mono">
                Error-tolerant parser for .log, .txt, .json, and .csv files
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="mt-4 flex items-center gap-2 border-b border-zinc-800/80 pb-3">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <UploadCloud className="h-3.5 w-3.5" />
            Upload File
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'paste'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Clipboard className="h-3.5 w-3.5" />
            Paste Raw Logs
          </button>

          <div className="ml-auto flex items-center gap-2 text-xs font-mono text-zinc-400">
            <span>Format:</span>
            <select
              value={formatHint}
              onChange={(e) => setFormatHint(e.target.value as any)}
              className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none"
            >
              <option value="auto">Auto-Detect</option>
              <option value="log">Standard Logs (.log/.txt)</option>
              <option value="json">JSON / NDJSON (.json)</option>
              <option value="csv">CSV Records (.csv)</option>
            </select>
          </div>
        </div>

        {/* Quick Sample Chips */}
        <div className="mt-3 flex items-center gap-2 text-xs font-mono">
          <span className="text-zinc-500">Quick Test:</span>
          <button
            onClick={() => {
              setFilename('db-pool-exhaustion.log');
              setRawText(SAMPLE_LOG_PRESET);
              setFormatHint('log');
            }}
            className="px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-[11px]"
          >
            DB Pool Logs (.log)
          </button>
          <button
            onClick={() => {
              setFilename('worker-crash.json');
              setRawText(SAMPLE_JSON_PRESET);
              setFormatHint('json');
            }}
            className="px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-[11px]"
          >
            Worker Telemetry (.json)
          </button>
          <button
            onClick={() => {
              setFilename('gateway-502.csv');
              setRawText(SAMPLE_CSV_PRESET);
              setFormatHint('csv');
            }}
            className="px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-[11px]"
          >
            Gateway CSV (.csv)
          </button>
        </div>

        {/* Upload or Paste Area */}
        <div className="mt-4">
          {activeTab === 'upload' ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".log,.txt,.json,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-emerald-500 bg-emerald-950/20'
                    : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-sky-400 mb-2">
                  <FileText className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-white">
                  {rawText ? `Selected: ${filename}` : 'Click to browse or drop file here'}
                </p>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Extracts timestamps, severity, service sources, and preserves unparsed lines
                </p>
              </div>
            </div>
          ) : (
            <div>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste logs, JSON, or CSV records here..."
                rows={6}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-200 focus:outline-none focus:border-sky-500"
              />
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-[11px] text-zinc-400 font-mono">
            {rawText ? `${rawText.split('\n').length} lines ready for extraction` : 'No payload loaded'}
          </div>
          <button
            onClick={handleParseAndAcquire}
            disabled={isParsing}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg text-xs font-mono font-semibold flex items-center gap-2 transition-colors shadow"
          >
            {isParsing ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            <span>Parse & Normalize Evidence</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorNotice && (
          <div className="mt-4 p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-xs font-mono text-rose-300">
            {errorNotice}
          </div>
        )}

        {/* Ingestion Results Preview */}
        {acquisitionResult && (
          <div className="mt-5 border-t border-zinc-800 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-mono font-bold text-zinc-200">
                  {acquisitionResult.summary_message}
                </h3>
                {acquisitionResult.warnings && acquisitionResult.warnings.length > 0 && (
                  <p className="text-[11px] font-mono text-amber-400 mt-0.5 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {acquisitionResult.warnings[0]}
                  </p>
                )}
              </div>
              {onImportEvidence && (
                <button
                  onClick={handleImport}
                  className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-black font-mono font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Import {acquisitionResult.events_count} Events
                </button>
              )}
            </div>

            <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
              {acquisitionResult.events.map((ev) => (
                <div
                  key={ev.id}
                  className="p-2 rounded-lg bg-zinc-900/90 border border-zinc-800/80 text-xs font-mono flex items-start justify-between gap-2"
                >
                  <div className="flex items-start gap-2">
                    <FileCode className="h-3.5 w-3.5 text-sky-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-200">{ev.title}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold border ${
                            ev.severity === 'critical'
                              ? 'bg-rose-950 text-rose-300 border-rose-800'
                              : ev.severity === 'error'
                              ? 'bg-amber-950 text-amber-300 border-amber-800'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          }`}
                        >
                          {ev.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">{ev.message}</p>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-1">
                        <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                        <span>•</span>
                        <span>Source: {ev.source}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-3">
          <button
            onClick={() => {
              onClose();
              onSelectDemoMode();
            }}
            className="text-xs font-mono text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span>Or switch to zero-config Demo Mode →</span>
          </button>

          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-1.5 text-xs font-mono text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
