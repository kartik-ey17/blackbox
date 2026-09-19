# BlackBox Evidence Providers Package
from .base import EvidenceProvider
from .demo import DemoProvider
from .github import GitHubProvider
from .sentry import SentryProvider
from .file_parser import FileProvider
from .service import AcquisitionService, get_acquisition_service

__all__ = [
    "EvidenceProvider",
    "DemoProvider",
    "GitHubProvider",
    "SentryProvider",
    "FileProvider",
    "AcquisitionService",
    "get_acquisition_service",
]
