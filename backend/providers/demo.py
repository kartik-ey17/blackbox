"""
Demo Evidence Provider
Provides authentic, zero-credential incident evidence and serves as the universal fallback.
"""

from typing import Any, Dict, List, Optional
from models import EvidenceEvent, EvidenceSource, ConnectorStatus, AcquisitionResult
from repository import get_incident_repository
from .base import EvidenceProvider


class DemoProvider(EvidenceProvider):
    """
    Demo evidence provider that operates with zero API keys or external services.
    Always available, offline-first.
    """

    @property
    def name(self) -> str:
        return "demo"

    async def get_status(self) -> ConnectorStatus:
        repo = get_incident_repository()
        count = await repo.count()
        return ConnectorStatus(
            connected=True,
            available=True,
            error=None,
            fallback_available=True,
            details={
                "provider": "Demo Incident Fixtures",
                "ready": True,
                "offline_first": True,
                "incidents_available": count,
            },
        )

    async def collect_evidence(
        self,
        incident_id: Optional[str] = "inc-db-pool-exhaustion",
        filter_source: Optional[str] = None,
        **kwargs: Any,
    ) -> AcquisitionResult:
        repo = get_incident_repository()
        incident = await repo.get_incident_by_id(incident_id or "inc-db-pool-exhaustion")

        if not incident:
            # Fallback to first available incident
            incidents = await repo.list_incidents()
            if incidents:
                incident = await repo.get_incident_by_id(incidents[0].id)

        events: List[EvidenceEvent] = []
        if incident:
            if filter_source and filter_source.lower() != "all":
                events = [e for e in incident.evidence_events if e.source.value.lower() == filter_source.lower()]
            else:
                events = list(incident.evidence_events)

        distinct_sources = len(set(e.source.value for e in events)) if events else 1

        return AcquisitionResult(
            source=filter_source or "demo",
            events_count=len(events),
            sources_count=distinct_sources,
            summary_message=f"Collected {len(events)} evidence events from {distinct_sources} sources (Demo Mode).",
            events=events,
            connector_status=await self.get_status(),
            warnings=[],
        )
