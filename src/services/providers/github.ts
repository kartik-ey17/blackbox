import {
  EvidenceEvent,
  ConnectorStatus,
  AcquisitionResult,
  GitHubAcquisitionRequest,
} from '../../types/incident';
import { EvidenceProvider } from './base';
import { DemoProvider } from './demo';

export class GitHubProvider implements EvidenceProvider {
  name = 'github';
  private apiBase = 'https://api.github.com';
  private timeoutMs = 7000;

  private getToken(requestToken?: string): string | undefined {
    return requestToken || (typeof process !== 'undefined' ? process.env?.GITHUB_TOKEN : undefined);
  }

  async getStatus(tokenOverride?: string): Promise<ConnectorStatus> {
    const token = this.getToken(tokenOverride);
    if (!token) {
      return {
        connected: false,
        available: true,
        error: 'GITHUB_TOKEN not configured in environment or request',
        fallback_available: true,
        details: {
          auth_method: 'none',
          hint: 'Provide a PAT to query private or live public repositories',
        },
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      const resp = await fetch(`${this.apiBase}/rate_limit`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'BlackBox-Incident-Investigator/1.0',
          Accept: 'application/vnd.github+json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (resp.ok) {
        const data = await resp.json();
        const remaining = data?.rate?.remaining ?? 0;
        return {
          connected: true,
          available: true,
          error: null,
          fallback_available: true,
          details: { rate_limit_remaining: remaining, authenticated: true },
        };
      } else {
        return {
          connected: false,
          available: true,
          error: `GitHub API returned HTTP ${resp.status}: ${resp.statusText}`,
          fallback_available: true,
          details: { http_code: resp.status },
        };
      }
    } catch (err: any) {
      return {
        connected: false,
        available: true,
        error: `GitHub probe failed: ${err.message || String(err)}`,
        fallback_available: true,
      };
    }
  }

  async collectEvidence(params: GitHubAcquisitionRequest): Promise<AcquisitionResult> {
    const repo = params.repository || 'payments-team/payments-api';
    const branch = params.branch || 'main';
    const token = this.getToken(params.personal_access_token);

    const events: EvidenceEvent[] = [];
    const warnings: string[] = [];
    let usedFallback = false;
    let errorMessage: string | null = null;

    if (!token) {
      usedFallback = true;
      errorMessage = 'No GITHUB_TOKEN configured; loaded authentic demo Git evidence.';
      const fallbackEvents = await this.generateFallbackEvents(repo);
      events.push(...fallbackEvents);
    } else {
      try {
        // 1. Fetch commits
        const commits = await this.fetchCommits(repo, branch, params.incident_start_time, token);
        for (const c of commits) {
          const ev = this.normalizeCommit(c, repo);
          if (ev) events.push(ev);
        }

        // 2. Fetch PRs if requested
        if (params.include_pull_requests !== false) {
          try {
            const prs = await this.fetchPullRequests(repo, token);
            for (const pr of prs) {
              const ev = this.normalizePullRequest(pr, repo);
              if (ev) events.push(ev);
            }
          } catch (e: any) {
            warnings.push(`Pull request retrieval notice: ${e.message || String(e)}`);
          }
        }

        // 3. Fetch deployments if requested
        if (params.include_deployments !== false) {
          try {
            const deps = await this.fetchDeployments(repo, token);
            for (const dep of deps) {
              const ev = this.normalizeDeployment(dep, repo);
              if (ev) events.push(ev);
            }
          } catch (e: any) {
            warnings.push(`Deployment retrieval notice: ${e.message || String(e)}`);
          }
        }

        if (events.length === 0) {
          warnings.push(`No commits or PRs found for ${repo}. Activated baseline fallback demo commits.`);
          usedFallback = true;
          const fallbackEvents = await this.generateFallbackEvents(repo);
          events.push(...fallbackEvents);
        }
      } catch (err: any) {
        usedFallback = true;
        errorMessage = `GitHub API request failed (${err.message || String(err)}). Activated fallback demo evidence.`;
        const fallbackEvents = await this.generateFallbackEvents(repo);
        events.push(...fallbackEvents);
      }
    }

    const status: ConnectorStatus = {
      connected: !usedFallback,
      available: true,
      error: errorMessage,
      fallback_available: true,
      details: { repository: repo, fallback_used: usedFallback },
    };

    return {
      source: 'github',
      events_count: events.length,
      sources_count: 1,
      summary_message: `Collected ${events.length} evidence events from 1 source (GitHub).`,
      events,
      connector_status: status,
      warnings,
    };
  }

  private async fetchCommits(repo: string, branch: string, since: string | undefined, token: string): Promise<any[]> {
    let url = `${this.apiBase}/repos/${repo}/commits?per_page=15&sha=${encodeURIComponent(branch)}`;
    if (since) url += `&since=${encodeURIComponent(since)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'BlackBox-Incident-Investigator/1.0',
        Accept: 'application/vnd.github+json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }
    return await resp.json();
  }

  private async fetchPullRequests(repo: string, token: string): Promise<any[]> {
    const url = `${this.apiBase}/repos/${repo}/pulls?state=closed&sort=updated&per_page=5`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'BlackBox-Incident-Investigator/1.0',
        Accept: 'application/vnd.github+json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) return [];
    return await resp.json();
  }

  private async fetchDeployments(repo: string, token: string): Promise<any[]> {
    const url = `${this.apiBase}/repos/${repo}/deployments?per_page=5`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'BlackBox-Incident-Investigator/1.0',
        Accept: 'application/vnd.github+json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) return [];
    return await resp.json();
  }

  private normalizeCommit(raw: any, repo: string): EvidenceEvent | null {
    const sha = raw.sha || '';
    const commit = raw.commit || {};
    const message = commit.message || 'Commit';
    const headline = message.split('\n')[0];
    const author = commit.author?.name || raw.author?.login || 'Unknown';
    const timestamp = commit.author?.date || new Date().toISOString();
    const htmlUrl = raw.html_url;

    const isSuspicious = /pool|leak|revert|hotfix|timeout|perf|cache|concurrency|urgent/i.test(headline);

    return {
      id: `evt-gh-${sha.slice(0, 7)}`,
      source: 'github',
      event_type: 'commit',
      timestamp,
      title: `Commit [${sha.slice(0, 7)}]: ${headline}`,
      message,
      summary: `Git commit to ${repo} by ${author}: '${headline}'`,
      severity: isSuspicious ? 'warning' : 'info',
      metadata: {
        sha,
        author,
        repository: repo,
        commit_url: htmlUrl,
      },
      related_identifiers: [sha.slice(0, 7), author, repo],
      raw_reference: htmlUrl,
      correlated_event_ids: [],
      is_root_cause_candidate: isSuspicious,
    };
  }

  private normalizePullRequest(raw: any, repo: string): EvidenceEvent | null {
    const prNumber = raw.number;
    const title = raw.title || '';
    const body = raw.body || 'No description';
    const mergedAt = raw.merged_at;
    if (!mergedAt) return null;

    const author = raw.user?.login || 'unknown';
    const htmlUrl = raw.html_url;
    const isSuspicious = /sync|pool|refactor|bulk|migration|concurrency|worker/i.test(title);

    return {
      id: `evt-gh-pr-${prNumber}`,
      source: 'github',
      event_type: 'pull_request',
      timestamp: mergedAt,
      title: `PR #${prNumber} Merged: '${title}'`,
      message: body,
      summary: `Pull Request #${prNumber} by @${author} merged into main for ${repo}.`,
      severity: isSuspicious ? 'warning' : 'info',
      metadata: {
        pr_number: prNumber,
        author,
        merged_at: mergedAt,
        repository: repo,
        pr_url: htmlUrl,
      },
      related_identifiers: [`PR#${prNumber}`, `@${author}`, repo],
      raw_reference: htmlUrl,
      correlated_event_ids: [],
      is_root_cause_candidate: isSuspicious,
    };
  }

  private normalizeDeployment(raw: any, repo: string): EvidenceEvent | null {
    const depId = raw.id;
    const createdAt = raw.created_at || new Date().toISOString();
    const env = raw.environment || 'production';
    const ref = raw.ref || 'main';
    const creator = raw.creator?.login || 'ci-bot';

    return {
      id: `evt-gh-deploy-${depId}`,
      source: 'deployment',
      event_type: 'deployment',
      timestamp: createdAt,
      title: `GitHub Deployment to ${env} (${ref})`,
      message: `Automated deployment triggered by ${creator} for ref ${ref}.`,
      summary: `Deployment ${depId} promoted to ${env} for repository ${repo}.`,
      severity: 'info',
      metadata: {
        deployment_id: depId,
        environment: env,
        ref,
        creator,
        repository: repo,
      },
      related_identifiers: [String(depId), env, ref],
      raw_reference: raw.url,
      correlated_event_ids: [],
      is_root_cause_candidate: false,
    };
  }

  private async generateFallbackEvents(repo: string): Promise<EvidenceEvent[]> {
    const demo = new DemoProvider();
    const res = await demo.collectEvidence({ filter_source: 'github' });
    return res.events.map((e) => ({
      ...e,
      metadata: {
        ...e.metadata,
        is_fallback: true,
        fallback_repository: repo,
      },
    }));
  }
}
