import {
  EvidenceEvent,
  ConnectorStatus,
  AcquisitionResult,
  SentryAcquisitionRequest,
} from '../../types/incident';
import { EvidenceProvider } from './base';
import { DemoProvider } from './demo';

export class SentryProvider implements EvidenceProvider {
  name = 'sentry';
  private apiBase = 'https://sentry.io/api/0';
  private timeoutMs = 7000;

  private getToken(requestToken?: string): string | undefined {
    return requestToken || (typeof process !== 'undefined' ? process.env?.SENTRY_AUTH_TOKEN : undefined);
  }

  private getOrg(requestOrg?: string): string | undefined {
    return requestOrg || (typeof process !== 'undefined' ? process.env?.SENTRY_ORG : undefined);
  }

  private getProject(requestProject?: string): string | undefined {
    return requestProject || (typeof process !== 'undefined' ? process.env?.SENTRY_PROJECT : undefined);
  }

  async getStatus(tokenOverride?: string, orgOverride?: string, projOverride?: string): Promise<ConnectorStatus> {
    const token = this.getToken(tokenOverride);
    const org = this.getOrg(orgOverride);
    const project = this.getProject(projOverride) || 'primary';

    if (!token) {
      return {
        connected: false,
        available: true,
        error: 'SENTRY_AUTH_TOKEN not configured in environment or request',
        fallback_available: true,
        details: {
          auth_method: 'none',
          hint: 'Configure SENTRY_AUTH_TOKEN or enter token in connection panel',
        },
      };
    }

    if (!org) {
      return {
        connected: false,
        available: true,
        error: 'SENTRY_ORG not configured (organization slug required)',
        fallback_available: true,
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      const resp = await fetch(`${this.apiBase}/projects/${org}/${project}/`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'BlackBox-Incident-Investigator/1.0',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (resp.ok) {
        return {
          connected: true,
          available: true,
          error: null,
          fallback_available: true,
          details: { organization: org, project, authenticated: true },
        };
      } else {
        return {
          connected: false,
          available: true,
          error: `Sentry API returned HTTP ${resp.status}: ${resp.statusText}`,
          fallback_available: true,
          details: { http_code: resp.status },
        };
      }
    } catch (err: any) {
      return {
        connected: false,
        available: true,
        error: `Sentry probe failed: ${err.message || String(err)}`,
        fallback_available: true,
      };
    }
  }

  async collectEvidence(params: SentryAcquisitionRequest): Promise<AcquisitionResult> {
    const token = this.getToken(params.auth_token);
    const org = this.getOrg(params.organization);
    const project = this.getProject(params.project) || 'payments-service';

    const events: EvidenceEvent[] = [];
    const warnings: string[] = [];
    let usedFallback = false;
    let errorMessage: string | null = null;

    if (!token || !org) {
      usedFallback = true;
      errorMessage = 'Missing Sentry credentials; loaded authentic demo exception telemetry.';
      const fallbackEvents = await this.generateFallbackEvents(project);
      events.push(...fallbackEvents);
    } else {
      try {
        const issues = await this.fetchIssues(org, project, params.query, token);
        for (const issue of issues) {
          const ev = this.normalizeSentryIssue(issue, org, project);
          if (ev) events.push(ev);
        }

        if (events.length === 0) {
          warnings.push(`No active Sentry issues returned for ${org}/${project}. Activated baseline fallback demo exceptions.`);
          usedFallback = true;
          const fallbackEvents = await this.generateFallbackEvents(project);
          events.push(...fallbackEvents);
        }
      } catch (err: any) {
        usedFallback = true;
        errorMessage = `Sentry connection failed (${err.message || String(err)}). Activated fallback demo evidence.`;
        const fallbackEvents = await this.generateFallbackEvents(project);
        events.push(...fallbackEvents);
      }
    }

    const status: ConnectorStatus = {
      connected: !usedFallback,
      available: true,
      error: errorMessage,
      fallback_available: true,
      details: { organization: org || 'demo-org', project, fallback_used: usedFallback },
    };

    return {
      source: 'sentry',
      events_count: events.length,
      sources_count: 1,
      summary_message: `Collected ${events.length} evidence events from 1 source (Sentry).`,
      events,
      connector_status: status,
      warnings,
    };
  }

  private async fetchIssues(org: string, project: string, query: string | undefined, token: string): Promise<any[]> {
    let url = `${this.apiBase}/projects/${org}/${project}/issues/?limit=15`;
    if (query) url += `&query=${encodeURIComponent(query)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'BlackBox-Incident-Investigator/1.0',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    return await resp.json();
  }

  private normalizeSentryIssue(raw: any, org: string, project: string): EvidenceEvent | null {
    const issueId = raw.id || '';
    const title = raw.title || 'Unhandled Exception';
    const culprit = raw.culprit || '';
    const count = raw.count || '1';
    const userCount = raw.userCount || 1;
    const level = (raw.level || 'error').toLowerCase();
    const permalink = raw.permalink;
    const lastSeen = raw.lastSeen || new Date().toISOString();
    const metadata = raw.metadata || {};

    const severity = level === 'fatal' || level === 'critical' ? 'critical' : 'error';
    const isCandidate = /timeout|exhaustion|connection|memory|deadlock|oom|crash/i.test(title);

    return {
      id: `evt-sentry-${issueId}`,
      source: 'sentry',
      event_type: 'error',
      timestamp: lastSeen,
      title: `Sentry Issue #${issueId}: ${title}`,
      message: culprit || metadata.value || title,
      summary: `Sentry reported ${level.toUpperCase()} exception (${count} occurrences across ${userCount} users): ${title}`,
      severity,
      metadata: {
        issue_id: issueId,
        culprit,
        occurrences: count,
        users_affected: userCount,
        level,
        organization: org,
        project,
        stack_trace: metadata.value || culprit || 'Stack trace captured by Sentry agent.',
      },
      related_identifiers: [`sentry-${issueId}`, culprit, project],
      raw_reference: permalink,
      correlated_event_ids: [],
      is_root_cause_candidate: isCandidate,
    };
  }

  private async generateFallbackEvents(project: string): Promise<EvidenceEvent[]> {
    const demo = new DemoProvider();
    const res = await demo.collectEvidence({ filter_source: 'sentry' });
    return res.events.map((e) => ({
      ...e,
      metadata: {
        ...e.metadata,
        is_fallback: true,
        fallback_project: project,
      },
    }));
  }
}
