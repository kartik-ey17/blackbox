import {
  EvidenceEvent,
  EvidenceSource,
  ConnectorStatus,
  AcquisitionResult,
  FileAcquisitionRequest,
} from '../../types/incident';
import { EvidenceProvider } from './base';

export class FileProvider implements EvidenceProvider {
  name = 'file';

  // Regular expressions for common timestamps
  private isoTimestampRe = /(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/;
  private syslogTimestampRe = /([A-Za-z]{3}\s+[0-3]?\d\s+\d{2}:\d{2}:\d{2})/;
  private apacheTimestampRe = /\[([0-3]?\d\/[A-Za-z]{3}\/\d{4}:\d{2}:\d{2}:\d{2}(?:\s*[+-]\d{4})?)\]/;
  private slashTimestampRe = /(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})/;

  // Severity keywords
  private severityRe = /\b(FATAL|CRITICAL|ERROR|ERR|WARN|WARNING|NOTICE|INFO|DEBUG|TRACE)\b/i;

  // Bracketed sources e.g. [nginx], [db-pool]
  private sourceRe = /\[([a-zA-Z0-9_\-\.\/]{3,30})\]/;

  async getStatus(): Promise<ConnectorStatus> {
    return {
      connected: true,
      available: true,
      error: null,
      fallback_available: true,
      details: {
        supported_formats: ['.log', '.txt', '.json', '.csv'],
        resilience: 'tolerates malformed lines and variable timestamps',
      },
    };
  }

  async collectEvidence(params: FileAcquisitionRequest): Promise<AcquisitionResult> {
    const filename = params.filename || 'incident_bundle.log';
    const content = params.content || '';
    const warnings: string[] = [];
    let events: EvidenceEvent[] = [];

    if (!content.trim()) {
      events = this.generateSampleParsedEvents(filename);
      return {
        source: 'logs',
        events_count: events.length,
        sources_count: 1,
        summary_message: `Collected ${events.length} evidence events from 1 source (Logs Bundle: ${filename}).`,
        events,
        connector_status: await this.getStatus(),
        warnings: ['Empty payload provided; loaded preview parser fixtures.'],
      };
    }

    let fmt = (params.format_hint || 'auto').toLowerCase();
    if (fmt === 'auto') {
      if (filename.endsWith('.json') || content.trim().startsWith('{') || content.trim().startsWith('[')) {
        fmt = 'json';
      } else if (filename.endsWith('.csv')) {
        fmt = 'csv';
      } else {
        fmt = 'log';
      }
    }

    try {
      if (fmt === 'json') {
        const res = this.parseJson(content, filename);
        events = res.events;
        warnings.push(...res.warnings);
      } else if (fmt === 'csv') {
        const res = this.parseCsv(content, filename);
        events = res.events;
        warnings.push(...res.warnings);
      } else {
        const res = this.parseLogs(content, filename);
        events = res.events;
        warnings.push(...res.warnings);
      }
    } catch (err: any) {
      // Preservation guarantee: never crash on unexpected parser errors
      warnings.push(`Global parser fallback triggered: ${err.message || String(err)}`);
      events = [
        {
          id: `evt-raw-${Date.now().toString(36)}`,
          source: 'logs',
          event_type: 'log_entry',
          timestamp: new Date().toISOString(),
          title: `Unparsed File Artifact: ${filename}`,
          message: content.slice(0, 1000),
          summary: `Raw ingested file content from ${filename} preserved without parsing failure.`,
          severity: 'warning',
          metadata: { filename, raw_size_bytes: content.length },
          raw_reference: content.slice(0, 500),
          correlated_event_ids: [],
          is_root_cause_candidate: false,
        },
      ];
    }

    const distinctSources = new Set(events.map((e) => e.source)).size || 1;

    return {
      source: 'logs',
      events_count: events.length,
      sources_count: distinctSources,
      summary_message: `Collected ${events.length} evidence events from ${distinctSources} sources (Ingested Bundle).`,
      events,
      connector_status: await this.getStatus(),
      warnings,
    };
  }

  private parseJson(content: string, filename: string): { events: EvidenceEvent[]; warnings: string[] } {
    const events: EvidenceEvent[] = [];
    const warnings: string[] = [];

    let parsedData: any = null;
    try {
      parsedData = JSON.parse(content);
    } catch {
      // Could be Newline-Delimited JSON (NDJSON)
      const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
      parsedData = [];
      lines.forEach((line, i) => {
        try {
          parsedData.push(JSON.parse(line));
        } catch {
          warnings.push(`Malformed NDJSON at line ${i + 1}; preserved as raw event`);
          events.push({
            id: `evt-ndjson-err-${i + 1}`,
            source: 'logs',
            event_type: 'log_entry',
            timestamp: new Date().toISOString(),
            title: `Malformed NDJSON (Line ${i + 1})`,
            message: line,
            summary: line.slice(0, 120),
            severity: 'warning',
            metadata: { line_number: i + 1, filename },
            raw_reference: line,
            correlated_event_ids: [],
            is_root_cause_candidate: false,
          });
        }
      });
    }

    let rawList: any[] = [];
    if (Array.isArray(parsedData)) {
      rawList = parsedData;
    } else if (parsedData && typeof parsedData === 'object') {
      for (const k of ['events', 'logs', 'records', 'data', 'items']) {
        if (Array.isArray(parsedData[k])) {
          rawList = parsedData[k];
          break;
        }
      }
      if (rawList.length === 0) {
        rawList = [parsedData];
      }
    }

    rawList.forEach((item, idx) => {
      if (!item || typeof item !== 'object') return;

      const ts =
        this.extractField(item, ['timestamp', 'time', '@timestamp', 'datetime', 'date', 'created_at', 'ts']) ||
        new Date().toISOString();

      const lvl = this.extractField(item, ['level', 'severity', 'log_level', 'type']) || 'info';
      const msg = this.extractField(item, ['message', 'msg', 'log', 'summary', 'text', 'error']) || JSON.stringify(item);
      const srcVal = this.extractField(item, ['source', 'service', 'app', 'logger', 'pod', 'host']) || 'logs';

      const sourceEnum = this.mapSource(srcVal);
      const severityNorm = this.normalizeSeverity(lvl);
      const isCandidate =
        (severityNorm === 'error' || severityNorm === 'critical') &&
        /timeout|deadlock|leak|oom|exhaust|exception/i.test(String(msg));

      events.push({
        id: `evt-json-${idx + 1}`,
        source: sourceEnum,
        event_type: 'log_entry',
        timestamp: String(ts),
        title: `[${srcVal}] ${String(msg).slice(0, 60)}`,
        message: String(msg),
        summary: `JSON log record (${srcVal}): ${String(msg).slice(0, 140)}`,
        severity: severityNorm,
        metadata: { index: idx + 1, raw_fields: item, filename },
        related_identifiers: [String(srcVal)],
        raw_reference: JSON.stringify(item).slice(0, 400),
        correlated_event_ids: [],
        is_root_cause_candidate: isCandidate,
      });
    });

    return { events, warnings };
  }

  private parseCsv(content: string, filename: string): { events: EvidenceEvent[]; warnings: string[] } {
    const events: EvidenceEvent[] = [];
    const warnings: string[] = [];
    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);

    if (lines.length < 2) {
      warnings.push('CSV has fewer than 2 lines; fallback to standard logs.');
      return this.parseLogs(content, filename);
    }

    const header = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
    const headerLower = header.map((h) => h.toLowerCase());

    const tsIdx = headerLower.findIndex((h) => /timestamp|time|date|created_at/i.test(h));
    const lvlIdx = headerLower.findIndex((h) => /severity|level|log_level|priority/i.test(h));
    const msgIdx = headerLower.findIndex((h) => /message|msg|summary|description|text/i.test(h));
    const srcIdx = headerLower.findIndex((h) => /source|service|system|app|host/i.test(h));

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map((cell) => cell.trim().replace(/^["']|["']$/g, ''));
      const rawTs = tsIdx >= 0 ? row[tsIdx] : undefined;
      const ts = rawTs || new Date().toISOString();
      const rawLvl = lvlIdx >= 0 ? row[lvlIdx] : 'info';
      const msg = msgIdx >= 0 ? row[msgIdx] : lines[i];
      const srcVal = srcIdx >= 0 ? row[srcIdx] : 'logs';

      const sourceEnum = this.mapSource(srcVal);
      const severityNorm = this.normalizeSeverity(rawLvl);

      events.push({
        id: `evt-csv-${i}`,
        source: sourceEnum,
        event_type: 'log_entry',
        timestamp: String(ts),
        title: `CSV Event [${srcVal}]: ${msg.slice(0, 60)}`,
        message: msg,
        summary: `CSV record from ${filename}: ${msg.slice(0, 140)}`,
        severity: severityNorm,
        metadata: { csv_row: i, filename },
        related_identifiers: [srcVal],
        raw_reference: lines[i],
        correlated_event_ids: [],
        is_root_cause_candidate: severityNorm === 'critical',
      });
    }

    return { events, warnings };
  }

  private parseLogs(content: string, filename: string): { events: EvidenceEvent[]; warnings: string[] } {
    const events: EvidenceEvent[] = [];
    const warnings: string[] = [];
    const lines = content.split('\n');

    let lastKnownTs = new Date().toISOString();

    lines.forEach((line, idx) => {
      const lineStr = line.trim();
      if (!lineStr) return;

      // 1. Extract timestamp
      const isoM = lineStr.match(this.isoTimestampRe);
      const apacheM = lineStr.match(this.apacheTimestampRe);
      const syslogM = lineStr.match(this.syslogTimestampRe);
      const slashM = lineStr.match(this.slashTimestampRe);

      let ts = lastKnownTs;
      if (isoM) {
        ts = isoM[1];
        lastKnownTs = ts;
      } else if (apacheM) {
        ts = apacheM[1];
        lastKnownTs = ts;
      } else if (syslogM) {
        ts = syslogM[1];
        lastKnownTs = ts;
      } else if (slashM) {
        ts = slashM[1];
        lastKnownTs = ts;
      }

      // 2. Extract severity
      const lvlM = lineStr.match(this.severityRe);
      const severityNorm = lvlM ? this.normalizeSeverity(lvlM[1]) : 'info';

      // 3. Extract source
      const srcM = lineStr.match(this.sourceRe);
      const srcStr = srcM ? srcM[1] : 'logs';
      const sourceEnum = this.mapSource(srcStr);

      const isCandidate =
        (severityNorm === 'error' || severityNorm === 'critical') &&
        /timeout|exhaust|oom|leak|fatal|pool saturated|504/i.test(lineStr);

      events.push({
        id: `evt-log-${idx + 1}`,
        source: sourceEnum,
        event_type: 'log_entry',
        timestamp: ts,
        title: `[${srcStr}] ${lineStr.slice(0, 55)}`,
        message: lineStr,
        summary: lineStr.slice(0, 160),
        severity: severityNorm,
        metadata: { line_number: idx + 1, filename, matched_source: srcStr },
        related_identifiers: [srcStr],
        raw_reference: lineStr,
        correlated_event_ids: [],
        is_root_cause_candidate: isCandidate,
      });
    });

    return { events, warnings };
  }

  private extractField(obj: Record<string, any>, candidates: string[]): any {
    for (const c of candidates) {
      if (obj[c] !== undefined && obj[c] !== null) return obj[c];
    }
    return undefined;
  }

  private normalizeSeverity(raw?: string): 'info' | 'warning' | 'error' | 'critical' {
    if (!raw) return 'info';
    const s = String(raw).toLowerCase().trim();
    if (['fatal', 'critical', 'crit', 'emerg', 'panic'].includes(s)) return 'critical';
    if (['error', 'err', 'fail', 'failed'].includes(s)) return 'error';
    if (['warn', 'warning', 'notice'].includes(s)) return 'warning';
    return 'info';
  }

  private mapSource(src?: string): EvidenceSource {
    if (!src) return 'logs';
    const s = String(src).toLowerCase();
    if (s.includes('github') || s.includes('git')) return 'github';
    if (s.includes('sentry')) return 'sentry';
    if (s.includes('metric') || s.includes('cloudwatch') || s.includes('datadog') || s.includes('prometheus')) return 'metrics';
    if (s.includes('deploy') || s.includes('k8s') || s.includes('argocd')) return 'deployment';
    if (s.includes('nginx') || s.includes('network') || s.includes('ingress') || s.includes('dns')) return 'network';
    return 'logs';
  }

  private generateSampleParsedEvents(filename: string): EvidenceEvent[] {
    return [
      {
        id: 'evt-bundle-1',
        source: 'network',
        event_type: 'log_entry',
        timestamp: '2026-09-18T08:14:30Z',
        title: '[nginx-ingress] 504 Gateway Timeout on /v1/invoices/sync',
        message: "10.244.2.1 - [18/Sep/2026:08:14:30 +0000] 'POST /v1/invoices/sync' 504 182 upstream_connect_time=0.001 upstream_response_time=30.002",
        summary: 'Ingress proxy reported 504 upstream timeout communicating with billing backend.',
        severity: 'error',
        metadata: { status: 504, route: '/v1/invoices/sync', filename },
        related_identifiers: ['nginx-ingress', '504'],
        raw_reference: 'upstream_response_time=30.002',
        correlated_event_ids: [],
        is_root_cause_candidate: false,
      },
      {
        id: 'evt-bundle-2',
        source: 'logs',
        event_type: 'log_entry',
        timestamp: '2026-09-18T08:14:35Z',
        title: '[payments-api] Connection pool exhausted: 100/100 connections in use',
        message: '2026-09-18 08:14:35.412 [ERROR] [payments-api] DB pool exhausted: acquire timeout after 10000ms. Active=100 Waiting=342',
        summary: 'PostgreSQL connection pool exhausted. Active connections saturated at capacity.',
        severity: 'critical',
        metadata: { active_connections: 100, waiting_threads: 342, filename },
        related_identifiers: ['payments-api', 'rds-postgres'],
        raw_reference: 'DB pool exhausted: acquire timeout after 10000ms',
        correlated_event_ids: [],
        is_root_cause_candidate: true,
      },
    ];
  }
}
