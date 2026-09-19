"""
Unit tests for BlackBox Evidence Acquisition Layer (Stage 2).
Uses standard Python unittest.
"""

import unittest
import asyncio
from providers.demo import DemoProvider
from providers.github import GitHubProvider
from providers.sentry import SentryProvider
from providers.file_parser import FileProvider
from providers.service import AcquisitionService
from models import GitHubAcquisitionRequest, SentryAcquisitionRequest, FileAcquisitionRequest


class TestEvidenceAcquisitionLayer(unittest.TestCase):

    def setUp(self):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)

    def tearDown(self):
        self.loop.close()

    def test_demo_provider_status_and_collection(self):
        provider = DemoProvider()
        status = self.loop.run_until_complete(provider.get_status())
        self.assertTrue(status.connected)
        self.assertTrue(status.available)
        self.assertTrue(status.fallback_available)

        res = self.loop.run_until_complete(provider.collect_evidence())
        self.assertGreater(res.events_count, 0)
        self.assertEqual(res.source, "demo")
        self.assertTrue("Collected" in res.summary_message)
        # Verify normalized event fields
        first_event = res.events[0]
        self.assertTrue(hasattr(first_event, "event_type"))
        self.assertTrue(hasattr(first_event, "related_identifiers"))
        self.assertTrue(hasattr(first_event, "raw_reference"))

    def test_github_provider_fallback_when_unauthenticated(self):
        # Without token, must gracefully fall back to authentic demo git events
        provider = GitHubProvider(token=None)
        status = self.loop.run_until_complete(provider.get_status())
        self.assertFalse(status.connected)
        self.assertTrue(status.available)
        self.assertTrue(status.fallback_available)

        res = self.loop.run_until_complete(
            provider.collect_evidence(repository="acme/service", branch="main")
        )
        self.assertGreater(res.events_count, 0)
        self.assertEqual(res.source, "github")
        self.assertTrue(res.events[0].metadata.get("is_fallback"))

    def test_sentry_provider_fallback_when_unauthenticated(self):
        provider = SentryProvider(token=None)
        status = self.loop.run_until_complete(provider.get_status())
        self.assertFalse(status.connected)
        self.assertTrue(status.available)
        self.assertTrue(status.fallback_available)

        res = self.loop.run_until_complete(
            provider.collect_evidence(organization="test-org", project="test-proj")
        )
        self.assertGreater(res.events_count, 0)
        self.assertEqual(res.source, "sentry")
        self.assertTrue(res.events[0].metadata.get("is_fallback"))

    def test_file_provider_log_parsing(self):
        provider = FileProvider()
        raw_logs = (
            "2026-09-18T08:14:22Z [nginx] 200 OK GET /health\n"
            "2026-09-18T08:14:35Z [payments-service] ERROR Connection pool exhausted: 100/100 connections\n"
            "Sep 18 08:14:40 app-worker CRITICAL Fatal out of memory killer triggered on pod worker-2\n"
            "Just an unstructured message without a timestamp at all!\n"
        )
        res = self.loop.run_until_complete(
            provider.collect_evidence(filename="test.log", content=raw_logs)
        )
        self.assertEqual(res.events_count, 4)
        # Check that error severity was recognized
        error_ev = [e for e in res.events if e.severity in ["error", "critical"]]
        self.assertGreaterEqual(len(error_ev), 2)
        # Check that unparseable line was preserved
        last_ev = res.events[-1]
        self.assertIn("unstructured message", last_ev.message)

    def test_file_provider_json_parsing(self):
        provider = FileProvider()
        json_content = """[
            {"timestamp": "2026-09-18T08:15:00Z", "level": "error", "message": "DB deadlock", "service": "db-pool"},
            {"timestamp": "2026-09-18T08:15:05Z", "level": "info", "message": "Health check ok", "service": "healthcheck"}
        ]"""
        res = self.loop.run_until_complete(
            provider.collect_evidence(filename="logs.json", content=json_content, format_hint="json")
        )
        self.assertEqual(res.events_count, 2)
        self.assertEqual(res.events[0].severity, "error")

    def test_file_provider_csv_parsing(self):
        provider = FileProvider()
        csv_content = (
            "timestamp,severity,source,message\n"
            "2026-09-18T08:14:00Z,warning,ingress,High latency 450ms\n"
            "2026-09-18T08:14:10Z,critical,database,Connection timeout\n"
        )
        res = self.loop.run_until_complete(
            provider.collect_evidence(filename="metrics.csv", content=csv_content, format_hint="csv")
        )
        self.assertEqual(res.events_count, 2)
        self.assertEqual(res.events[1].severity, "critical")

    def test_acquisition_service_all_statuses(self):
        svc = AcquisitionService()
        statuses = self.loop.run_until_complete(svc.get_all_connector_statuses())
        self.assertTrue(statuses.demo.connected)
        self.assertTrue(statuses.file.connected)
        self.assertTrue(statuses.github.available)
        self.assertTrue(statuses.sentry.available)
        self.assertTrue(hasattr(statuses, "summary"))


if __name__ == "__main__":
    unittest.main()
