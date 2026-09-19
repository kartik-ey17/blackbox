"""
GitHub Evidence Provider
Retrieves commits, pull requests, and deployment telemetry from GitHub REST API.
Provides graceful demo fallback if credentials are absent or if rate-limited.
"""

import os
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from models import (
    EvidenceEvent,
    EvidenceSource,
    ConnectorStatus,
    AcquisitionResult,
    GitHubAcquisitionRequest,
)
from .base import EvidenceProvider
from .demo import DemoProvider


class GitHubProvider(EvidenceProvider):
    """
    Acquires version control and deployment evidence from GitHub.
    Isolated service with strict timeout handling and fallback guarantee.
    """

    GITHUB_API_BASE = "https://api.github.com"
    TIMEOUT_SECONDS = 7

    def __init__(self, token: Optional[str] = None):
        self._explicit_token = token

    @property
    def name(self) -> str:
        return "github"

    def _get_token(self, request_token: Optional[str] = None) -> Optional[str]:
        return request_token or self._explicit_token or os.getenv("GITHUB_TOKEN")

    async def get_status(self, token_override: Optional[str] = None) -> ConnectorStatus:
        token = self._get_token(token_override)
        if not token:
            return ConnectorStatus(
                connected=False,
                available=True,
                error="GITHUB_TOKEN not configured in environment or request",
                fallback_available=True,
                details={"auth_method": "none", "hint": "Provide a PAT to query private or live public repositories"},
            )

        # Quick probe to GitHub API rate limit endpoint
        try:
            req = urllib.request.Request(
                f"{self.GITHUB_API_BASE}/rate_limit",
                headers={
                    "Authorization": f"Bearer {token}",
                    "User-Agent": "BlackBox-Incident-Investigator/1.0",
                    "Accept": "application/vnd.github+json",
                },
            )
            with urllib.request.urlopen(req, timeout=self.TIMEOUT_SECONDS) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    remaining = data.get("rate", {}).get("remaining", 0)
                    return ConnectorStatus(
                        connected=True,
                        available=True,
                        error=None,
                        fallback_available=True,
                        details={"rate_limit_remaining": remaining, "authenticated": True},
                    )
        except urllib.error.HTTPError as e:
            return ConnectorStatus(
                connected=False,
                available=True,
                error=f"GitHub API returned HTTP {e.code}: {e.reason}",
                fallback_available=True,
                details={"http_code": e.code},
            )
        except Exception as e:
            return ConnectorStatus(
                connected=False,
                available=True,
                error=f"GitHub connectivity check failed: {str(e)}",
                fallback_available=True,
            )

        return ConnectorStatus(connected=False, available=True, fallback_available=True)

    async def collect_evidence(
        self,
        repository: str = "payments-team/payments-api",
        branch: Optional[str] = "main",
        incident_start_time: Optional[str] = None,
        incident_end_time: Optional[str] = None,
        personal_access_token: Optional[str] = None,
        include_pull_requests: bool = True,
        include_deployments: bool = True,
        **kwargs: Any,
    ) -> AcquisitionResult:
        """
        Queries GitHub for commits, PRs, and deployments in the incident window.
        Gracefully falls back to demo data if credentials are missing or API fails.
        """
        token = self._get_token(personal_access_token)
        events: List[EvidenceEvent] = []
        warnings: List[str] = []
        used_fallback = False
        error_message: Optional[str] = None

        if not token:
            used_fallback = True
            error_message = "No GITHUB_TOKEN provided; loaded authentic demo Git evidence."
            events = await self._generate_fallback_events(repository, branch)
        else:
            try:
                # 1. Fetch recent commits
                commits = self._fetch_commits(repository, branch, incident_start_time, token)
                for c in commits:
                    ev = self._normalize_commit(c, repository)
                    if ev:
                        events.append(ev)

                # 2. Optionally fetch closed PRs
                if include_pull_requests:
                    try:
                        prs = self._fetch_pull_requests(repository, token)
                        for pr in prs:
                            ev = self._normalize_pull_request(pr, repository)
                            if ev:
                                events.append(ev)
                    except Exception as e:
                        warnings.append(f"Pull request retrieval notice: {str(e)}")

                # 3. Optionally fetch deployments
                if include_deployments:
                    try:
                        deps = self._fetch_deployments(repository, token)
                        for dep in deps:
                            ev = self._normalize_deployment(dep, repository)
                            if ev:
                                events.append(ev)
                    except Exception as e:
                        warnings.append(f"Deployment info retrieval notice: {str(e)}")

                if not events:
                    warnings.append(f"No commits or PRs found for {repository} in timeframe. Loading baseline demo commits.")
                    events = await self._generate_fallback_events(repository, branch)
                    used_fallback = True

            except urllib.error.HTTPError as e:
                used_fallback = True
                error_message = f"GitHub API error HTTP {e.code} ({e.reason}). Activated fallback demo evidence."
                events = await self._generate_fallback_events(repository, branch)
            except Exception as e:
                used_fallback = True
                error_message = f"GitHub connection error: {str(e)}. Activated fallback demo evidence."
                events = await self._generate_fallback_events(repository, branch)

        status = ConnectorStatus(
            connected=not used_fallback,
            available=True,
            error=error_message,
            fallback_available=True,
            details={"repository": repository, "fallback_used": used_fallback},
        )

        return AcquisitionResult(
            source="github",
            events_count=len(events),
            sources_count=1,
            summary_message=f"Collected {len(events)} evidence events from 1 source (GitHub).",
            events=events,
            connector_status=status,
            warnings=warnings,
        )

    def _fetch_commits(
        self, repo: str, branch: Optional[str], since: Optional[str], token: str
    ) -> List[Dict[str, Any]]:
        url = f"{self.GITHUB_API_BASE}/repos/{repo}/commits?per_page=15"
        if branch:
            url += f"&sha={branch}"
        if since:
            url += f"&since={since}"

        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "User-Agent": "BlackBox-Incident-Investigator/1.0",
                "Accept": "application/vnd.github+json",
            },
        )
        with urllib.request.urlopen(req, timeout=self.TIMEOUT_SECONDS) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def _fetch_pull_requests(self, repo: str, token: str) -> List[Dict[str, Any]]:
        url = f"{self.GITHUB_API_BASE}/repos/{repo}/pulls?state=closed&sort=updated&per_page=5"
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "User-Agent": "BlackBox-Incident-Investigator/1.0",
                "Accept": "application/vnd.github+json",
            },
        )
        with urllib.request.urlopen(req, timeout=self.TIMEOUT_SECONDS) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def _fetch_deployments(self, repo: str, token: str) -> List[Dict[str, Any]]:
        url = f"{self.GITHUB_API_BASE}/repos/{repo}/deployments?per_page=5"
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "User-Agent": "BlackBox-Incident-Investigator/1.0",
                "Accept": "application/vnd.github+json",
            },
        )
        with urllib.request.urlopen(req, timeout=self.TIMEOUT_SECONDS) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def _normalize_commit(self, raw: Dict[str, Any], repo: str) -> Optional[EvidenceEvent]:
        sha = raw.get("sha", "")
        commit = raw.get("commit", {})
        message = commit.get("message", "Commit")
        headline = message.split("\n")[0]
        author = commit.get("author", {}).get("name") or raw.get("author", {}).get("login", "Unknown")
        timestamp = commit.get("author", {}).get("date") or datetime.now(timezone.utc).isoformat()
        html_url = raw.get("html_url")

        # Heuristic severity check for suspicious changes
        is_suspicious = any(
            k in headline.lower()
            for k in ["pool", "leak", "revert", "hotfix", "timeout", "perf", "cache", "concurrency", "urgent"]
        )
        severity = "warning" if is_suspicious else "info"

        return EvidenceEvent(
            id=f"evt-gh-{sha[:7]}",
            source=EvidenceSource.GITHUB,
            event_type="commit",
            timestamp=timestamp,
            title=f"Commit [{sha[:7]}]: {headline}",
            message=message,
            summary=f"Git commit to {repo} by {author}: '{headline}'",
            severity=severity,
            metadata={
                "sha": sha,
                "author": author,
                "repository": repo,
                "commit_url": html_url,
                "files_changed_count": len(raw.get("files", [])),
            },
            related_identifiers=[sha[:7], author, repo],
            raw_reference=html_url,
            is_root_cause_candidate=is_suspicious,
        )

    def _normalize_pull_request(self, raw: Dict[str, Any], repo: str) -> Optional[EvidenceEvent]:
        pr_number = raw.get("number")
        title = raw.get("title", "")
        body = raw.get("body") or "No description provided."
        merged_at = raw.get("merged_at")
        if not merged_at:
            return None

        author = raw.get("user", {}).get("login", "unknown")
        html_url = raw.get("html_url")

        is_suspicious = any(
            k in title.lower() for k in ["sync", "pool", "refactor", "bulk", "migration", "concurrency", "worker"]
        )

        return EvidenceEvent(
            id=f"evt-gh-pr-{pr_number}",
            source=EvidenceSource.GITHUB,
            event_type="pull_request",
            timestamp=merged_at,
            title=f"PR #{pr_number} Merged: '{title}'",
            message=body,
            summary=f"Pull Request #{pr_number} by @{author} merged into main for {repo}.",
            severity="warning" if is_suspicious else "info",
            metadata={
                "pr_number": pr_number,
                "author": author,
                "merged_at": merged_at,
                "repository": repo,
                "pr_url": html_url,
            },
            related_identifiers=[f"PR#{pr_number}", f"@{author}", repo],
            raw_reference=html_url,
            is_root_cause_candidate=is_suspicious,
        )

    def _normalize_deployment(self, raw: Dict[str, Any], repo: str) -> Optional[EvidenceEvent]:
        dep_id = raw.get("id")
        created_at = raw.get("created_at") or datetime.now(timezone.utc).isoformat()
        env = raw.get("environment", "production")
        ref = raw.get("ref", "main")
        creator = raw.get("creator", {}).get("login", "ci-bot")

        return EvidenceEvent(
            id=f"evt-gh-deploy-{dep_id}",
            source=EvidenceSource.DEPLOYMENT,
            event_type="deployment",
            timestamp=created_at,
            title=f"GitHub Deployment to {env} ({ref})",
            message=f"Automated deployment triggered by {creator} for ref {ref}.",
            summary=f"Deployment {dep_id} promoted to {env} for repository {repo}.",
            severity="info",
            metadata={
                "deployment_id": dep_id,
                "environment": env,
                "ref": ref,
                "creator": creator,
                "repository": repo,
            },
            related_identifiers=[str(dep_id), env, ref],
            raw_reference=raw.get("url"),
            is_root_cause_candidate=False,
        )

    async def _generate_fallback_events(self, repo: str, branch: Optional[str]) -> List[EvidenceEvent]:
        """Loads realistic demo Git events matching the requested repo context."""
        demo_provider = DemoProvider()
        res = await demo_provider.collect_evidence(incident_id="inc-db-pool-exhaustion", filter_source="github")
        events = res.events
        # Add metadata indicating demo fallback
        for e in events:
            e.metadata["is_fallback"] = True
            e.metadata["fallback_repository"] = repo
        return events
