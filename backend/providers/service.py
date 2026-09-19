"""
Acquisition Service
High-level domain service orchestrating evidence providers with strict source abstraction.
FastAPI controllers interact solely through this service.
"""

from typing import Any, Dict, List, Optional
from models import (
    EvidenceEvent,
    ConnectorsHealthResponse,
    ConnectorStatus,
    AcquisitionResult,
    GitHubAcquisitionRequest,
    SentryAcquisitionRequest,
    FileAcquisitionRequest,
)
from .base import EvidenceProvider
from .demo import DemoProvider
from .github import GitHubProvider
from .sentry import SentryProvider
from .file_parser import FileProvider


class AcquisitionService:
    """
    Coordinates evidence acquisition across all four supported modes:
    1. Demo Mode
    2. Local / File Incident Bundle Ingestion
    3. GitHub Integration
    4. Sentry Integration
    """

    def __init__(self):
        self.demo_provider = DemoProvider()
        self.github_provider = GitHubProvider()
        self.sentry_provider = SentryProvider()
        self.file_provider = FileProvider()

    async def get_all_connector_statuses(self) -> ConnectorsHealthResponse:
        """
        Gathers live connectivity health across all connectors.
        Guaranteed non-blocking and secret-safe (no tokens returned).
        """
        gh_status = await self.github_provider.get_status()
        sentry_status = await self.sentry_provider.get_status()
        file_status = await self.file_provider.get_status()
        demo_status = await self.demo_provider.get_status()

        active_count = sum(1 for s in [gh_status, sentry_status, file_status, demo_status] if s.connected)

        return ConnectorsHealthResponse(
            github=gh_status,
            sentry=sentry_status,
            file=file_status,
            demo=demo_status,
            summary=f"{active_count} of 4 evidence connectors live. Universal fallback ready.",
        )

    async def acquire_from_github(self, req: GitHubAcquisitionRequest) -> AcquisitionResult:
        return await self.github_provider.collect_evidence(
            repository=req.repository,
            branch=req.branch,
            incident_start_time=req.incident_start_time,
            incident_end_time=req.incident_end_time,
            personal_access_token=req.personal_access_token,
            include_pull_requests=req.include_pull_requests,
            include_deployments=req.include_deployments,
        )

    async def acquire_from_sentry(self, req: SentryAcquisitionRequest) -> AcquisitionResult:
        return await self.sentry_provider.collect_evidence(
            organization=req.organization,
            project=req.project,
            incident_start_time=req.incident_start_time,
            incident_end_time=req.incident_end_time,
            query=req.query,
            auth_token=req.auth_token,
        )

    async def acquire_from_file(self, req: FileAcquisitionRequest) -> AcquisitionResult:
        return await self.file_provider.collect_evidence(
            filename=req.filename,
            content=req.content,
            format_hint=req.format_hint,
        )

    async def acquire_from_demo(
        self, incident_id: str = "inc-db-pool-exhaustion", filter_source: Optional[str] = None
    ) -> AcquisitionResult:
        return await self.demo_provider.collect_evidence(
            incident_id=incident_id,
            filter_source=filter_source,
        )


_service_instance: Optional[AcquisitionService] = None


def get_acquisition_service() -> AcquisitionService:
    global _service_instance
    if _service_instance is None:
        _service_instance = AcquisitionService()
    return _service_instance
