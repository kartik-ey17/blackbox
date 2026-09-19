"""
BlackBox Incident Repository Interface and In-Memory Implementation.
Abstracted interface enabling seamless transition from in-memory hackathon fixtures
to PostgreSQL (e.g. asyncpg/SQLAlchemy/Drizzle) without modifying controllers or domain services.
"""

import json
from abc import ABC, abstractmethod
from pathlib import Path
from typing import List, Optional, Dict
from models import Incident, IncidentDetail, EvidenceEvent


class IncidentRepository(ABC):
    """Abstract base repository defining the contract for incident storage and retrieval."""

    @abstractmethod
    async def list_incidents(self) -> List[Incident]:
        """Retrieve high-level summaries of all available incidents."""
        pass

    @abstractmethod
    async def get_incident_by_id(self, incident_id: str) -> Optional[IncidentDetail]:
        """Retrieve complete incident details including evidence events and blast radius."""
        pass

    @abstractmethod
    async def get_timeline(self, incident_id: str) -> List[EvidenceEvent]:
        """Retrieve sorted chronological evidence events for an incident."""
        pass

    @abstractmethod
    async def count(self) -> int:
        """Return the count of available incidents."""
        pass


class InMemoryIncidentRepository(IncidentRepository):
    """
    In-memory incident repository populated from realistic structured JSON fixtures.
    Thread-safe read access with zero external database dependencies.
    """

    def __init__(self, fixtures_dir: Optional[Path] = None):
        self._incidents: Dict[str, IncidentDetail] = {}
        self._fixtures_dir = fixtures_dir or (Path(__file__).parent / "fixtures")
        self._load_fixtures()

    def _load_fixtures(self) -> None:
        if not self._fixtures_dir.exists():
            return

        for json_path in self._fixtures_dir.glob("*.json"):
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)
                    incident_detail = IncidentDetail.model_validate(raw_data)
                    self._incidents[incident_detail.id] = incident_detail
            except Exception as e:
                print(f"[WARN] Failed to load fixture {json_path}: {e}")

    async def list_incidents(self) -> List[Incident]:
        """Return list of incidents stripped of heavy sub-event arrays for fast listing."""
        result: List[Incident] = []
        for inc in self._incidents.values():
            # Construct base Incident model
            base_model = Incident(
                id=inc.id,
                title=inc.title,
                summary=inc.summary,
                severity=inc.severity,
                status=inc.status,
                service=inc.service,
                environment=inc.environment,
                started_at=inc.started_at,
                detected_at=inc.detected_at,
                mitigated_at=inc.mitigated_at,
                sources_connected=inc.sources_connected,
                blast_radius=inc.blast_radius,
                evidence_count=len(inc.evidence_events) if inc.evidence_events else inc.evidence_count,
                primary_hypothesis=inc.primary_hypothesis,
            )
            result.append(base_model)
        # Sort by detected_at descending
        return sorted(result, key=lambda x: x.detected_at, reverse=True)

    async def get_incident_by_id(self, incident_id: str) -> Optional[IncidentDetail]:
        return self._incidents.get(incident_id)

    async def get_timeline(self, incident_id: str) -> List[EvidenceEvent]:
        incident = self._incidents.get(incident_id)
        if not incident:
            return []
        # Return events sorted chronologically
        return sorted(incident.evidence_events, key=lambda e: e.timestamp)

    async def count(self) -> int:
        return len(self._incidents)


# Global repository singleton instance
repo: IncidentRepository = InMemoryIncidentRepository()


def get_incident_repository() -> IncidentRepository:
    """Dependency provider for FastAPI route injection."""
    return repo
