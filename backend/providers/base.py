"""
Evidence Provider Base Interface
Defines the contract for all normalized evidence acquisition connectors.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from models import EvidenceEvent, ConnectorStatus, AcquisitionResult


class EvidenceProvider(ABC):
    """
    Abstract base class for evidence acquisition.
    Ensures complete source abstraction: callers never depend directly
    on raw GitHub, Sentry, or third-party log payloads.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider identifier, e.g. 'github', 'sentry', 'file', 'demo'."""
        pass

    @abstractmethod
    async def get_status(self) -> ConnectorStatus:
        """Return structured connector health, availability, and fallback status."""
        pass

    @abstractmethod
    async def collect_evidence(self, **kwargs) -> AcquisitionResult:
        """
        Execute evidence acquisition and return normalized EvidenceEvent instances.
        Must never throw unhandled exceptions: on failure, return graceful fallback data
        with connector_status.error populated.
        """
        pass
