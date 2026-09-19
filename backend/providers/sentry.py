"""
Sentry Evidence Provider
Retrieves unhandled exceptions, issue groups, and stack traces from Sentry API.
Provides graceful demo fallback if Sentry credentials are absent or if rate-limited.
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
    SentryAcquisitionRequest,
)
from .base import EvidenceProvider
from .demo import DemoProvider


class SentryProvider(EvidenceProvider):
    """
    Acquires application runtime error and exception telemetry from Sentry.
    Isolated service with strict timeout handling and fallback guarantee.
    """

    SENTRY_API_BASE = "https://sentry.io/api/0"
    TIMEOUT_SECONDS = 7

    def __init__(self, token: Optional[str] = None):
        self._explicit_token = token

    @property
    def name(self) -> str:
        return "sentry"

    def _get_token(self, request_token: Optional[str] = None) -> Optional[str]:
        return request_token or self._explicit_token or os.getenv("SENTRY_AUTH_TOKEN")

    def _get_org(self, request_org: Optional[str] = None) -> Optional[str]:
        return request_org or os.getenv("SENTRY_ORG")

    def _get_project(self, request_project: Optional[str] = None) -> Optional[str]:
        return request_project or os.getenv("SENTRY_PROJECT")

    async def get_status(
        self,
        token_override: Optional[str] = None,
        org_override: Optional[str] = None,
        project_override: Optional[str] = None,
    ) -> ConnectorStatus:
        token = self._get_token(token_override)
        org = self._get_org(org_override)
        project = self._get_project(project_override)

        if not token:
            return ConnectorStatus(
                connected=False,
                available=True,
                error="SENTRY_AUTH_TOKEN not configured in environment or request",
                fallback_available=True,
                details={"auth_method": "none", "hint": "Configure SENTRY_AUTH_TOKEN or enter token in modal"},
            )

        if not org:
            return ConnectorStatus(
                connected=False,
                available=True,
                error="SENTRY_ORG not configured (organization slug required)",
                fallback_available=True,
            )

        # Probe Sentry project endpoint
        target_project = project or "primary"
        try:
            req = urllib.request.Request(
                f"{self.SENTRY_API_BASE}/projects/{org}/{target_project}/",
                headers={
                    "Authorization": f"Bearer {token}",
                    "User-Agent": "BlackBox-Incident-Investigator/1.0",
                },
            )
            with urllib.request.urlopen(req, timeout=self.TIMEOUT_SECONDS) as resp:
                if resp.status == 200:
                    return ConnectorStatus(
                        connected=True,
                        available=True,
                        error=None,
                        fallback_available=True,
                        details={"organization": org, "project": target_project, "authenticated": True},
                    )
        except urllib.error.HTTPError as e:
            return ConnectorStatus(
                connected=False,
                available=True,
                error=f"Sentry API returned HTTP {e.code}: {e.reason}",
                fallback_available=True,
                details={"http_code": e.code},
            )
        except Exception as e:
            return ConnectorStatus(
                connected=False,
                available=True,
                error=f"Sentry connectivity check failed: {str(e)}",
                fallback_available=True,
            )

        return ConnectorStatus(connected=False, available=True, fallback_available=True)

    async def collect_evidence(
        self,
        organization: Optional[str] = None,
        project: Optional[str] = None,
        incident_start_time: Optional[str] = None,
        incident_end_time: Optional[str] = None,
        query: Optional[str] = None,
        auth_token: Optional[str] = None,
        **kwargs: Any,
    ) -> AcquisitionResult:
        token = self._get_token(auth_token)
        org = self._get_org(organization)
        proj = self._get_project(project) or "payments-service"

        events: List[EvidenceEvent] = []
        warnings: List[str] = []
        used_fallback = False
        error_message: Optional[str] = None

        if not token or not org:
            used_fallback = True
            error_message = "Missing Sentry credentials; loaded authentic demo exception telemetry."
            events = await self._generate_fallback_events(proj)
        else:
            try:
                raw_issues = self._fetch_issues(org, proj, query, token)
                for issue in raw_issues:
                    ev = self._normalize_sentry_issue(issue, org, proj)
                    if ev:
                        events.append(ev)

                if not events:
                    warnings.append(f"No active Sentry issues returned for {org}/{proj}. Loading baseline demo exceptions.")
                    events = await self._generate_fallback_events(proj)
                    used_fallback = True

            except urllib.error.HTTPError as e:
                used_fallback = True
                error_message = f"Sentry API returned HTTP {e.code} ({e.reason}). Activated fallback demo evidence."
                events = await self._generate_fallback_events(proj)
            except Exception as e:
                used_fallback = True
                error_message = f"Sentry connection failed: {str(e)}. Activated fallback demo evidence."
                events = await self._generate_fallback_events(proj)

        status = ConnectorStatus(
            connected=not used_fallback,
            available=True,
            error=error_message,
            fallback_available=True,
            details={"organization": org or "demo-org", "project": proj, "fallback_used": used_fallback},
        )

        return AcquisitionResult(
            source="sentry",
            events_count=len(events),
            sources_count=1,
            summary_message=f"Collected {len(events)} evidence events from 1 source (Sentry).",
            events=events,
            connector_status=status,
            warnings=warnings,
        )

    def _fetch_issues(
        self, org: str, proj: str, query: Optional[str], token: str
    ) -> List[Dict[str, Any]]:
        url = f"{self.SENTRY_API_BASE}/projects/{org}/{proj}/issues/?limit=15"
        if query:
            url += f"&query={urllib.parse.quote(query)}"

        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "User-Agent": "BlackBox-Incident-Investigator/1.0",
                "Accept": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=self.TIMEOUT_SECONDS) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def _normalize_sentry_issue(self, raw: Dict[str, Any], org: str, proj: str) -> Optional[EvidenceEvent]:
        issue_id = raw.get("id", "")
        title = raw.get("title", "Unhandled Exception")
        culprit = raw.get("culprit", "")
        count = raw.get("count", "1")
        user_count = raw.get("userCount", 1)
        level = raw.get("level", "error")
        permalink = raw.get("permalink")
        last_seen = raw.get("lastSeen") or datetime.now(timezone.utc).isoformat()
        metadata = raw.get("metadata", {})

        severity = "critical" if level in ["fatal", "critical"] else "error"
        is_candidate = any(
            k in title.lower() for k in ["timeout", "exhaustion", "connection", "memory", "deadlock", "oom", "crash"]
        )

        return EvidenceEvent(
            id=f"evt-sentry-{issue_id}",
            source=EvidenceSource.SENTRY,
            event_type="error",
            timestamp=last_seen,
            title=f"Sentry Issue #{issue_id}: {title}",
            message=culprit or str(metadata.get("value", title)),
            summary=f"Sentry reported {level.upper()} exception ({count} occurrences across {user_count} users): {title}",
            severity=severity,
            metadata={
                "issue_id": issue_id,
                "culprit": culprit,
                "occurrences": count,
                "users_affected": user_count,
                "level": level,
                "organization": org,
                "project": proj,
                "stack_trace": metadata.get("value") or culprit or "Stack trace captured by Sentry agent.",
            },
            related_identifiers=[f"sentry-{issue_id}", culprit, proj],
            raw_reference=permalink,
            is_root_cause_candidate=is_candidate,
        )

    async def _generate_fallback_events(self, proj: str) -> List[EvidenceEvent]:
        demo_provider = DemoProvider()
        res = await demo_provider.collect_evidence(incident_id="inc-db-pool-exhaustion", filter_source="sentry")
        events = res.events
        for e in events:
            e.metadata["is_fallback"] = True
            e.metadata["fallback_project"] = proj
        return events
