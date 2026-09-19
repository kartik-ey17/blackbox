"""
File Evidence Provider & Log Ingestion Engine
Parses .log, .txt, .json, and .csv incident bundles.
Extracts timestamps, severity, message, and source heuristically.
Preserves unparseable lines rather than crashing.
"""

import io
import re
import csv
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from models import (
    EvidenceEvent,
    EvidenceSource,
    ConnectorStatus,
    AcquisitionResult,
)
from .base import EvidenceProvider


class FileProvider(EvidenceProvider):
    """
    Ingests and normalizes local log and telemetry bundles.
    Handles heterogeneous, noisy, and non-standard log formatting gracefully.
    """

    # Common timestamp patterns
    ISO_TIMESTAMP_RE = re.compile(
        r"(?P<ts>\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)"
    )
    SYSLOG_TIMESTAMP_RE = re.compile(
        r"(?P<ts>[A-Za-z]{3}\s+[0-3]?\d\s+\d{2}:\d{2}:\d{2})"
    )
    APACHE_TIMESTAMP_RE = re.compile(
        r"\[(?P<ts>[0-3]?\d/[A-Za-z]{3}/\d{4}:\d{2}:\d{2}:\d{2}(?:\s*[+-]\d{4})?)\]"
    )
    SLASH_TIMESTAMP_RE = re.compile(
        r"(?P<ts>\d{4}/\d{2}/\d{2}\s+\d{2}:\d{2}:\d{2})"
    )

    # Severity keywords pattern
    SEVERITY_RE = re.compile(
        r"\b(?P<lvl>FATAL|CRITICAL|ERROR|ERR|WARN|WARNING|NOTICE|INFO|DEBUG|TRACE)\b",
        re.IGNORECASE,
    )

    # Bracketed source pattern: [nginx], [db-pool], [payments-service]
    SOURCE_RE = re.compile(r"\[(?P<src>[a-zA-Z0-9_\-\.\/]{3,30})\]")

    @property
    def name(self) -> str:
        return "file"

    async def get_status(self) -> ConnectorStatus:
        return ConnectorStatus(
            connected=True,
            available=True,
            error=None,
            fallback_available=True,
            details={
                "supported_formats": [".log", ".txt", ".json", ".csv"],
                "resilience": "tolerates malformed lines and variable timestamps",
            },
        )

    async def collect_evidence(
        self,
        filename: str = "incident_bundle.log",
        content: str = "",
        format_hint: Optional[str] = "auto",
        **kwargs: Any,
    ) -> AcquisitionResult:
        """
        Parses text or structured files into normalized EvidenceEvent instances.
        """
        events: List[EvidenceEvent] = []
        warnings: List[str] = []

        if not content.strip():
            # Generate sample log events for demonstration
            events = self._generate_sample_parsed_events(filename)
            return AcquisitionResult(
                source="logs",
                events_count=len(events),
                sources_count=1,
                summary_message=f"Collected {len(events)} evidence events from 1 source (Logs Bundle: {filename}).",
                events=events,
                connector_status=await self.get_status(),
                warnings=["Empty payload provided; loaded preview parser fixtures."],
            )

        fmt = format_hint.lower() if format_hint else "auto"
        if fmt == "auto":
            if filename.endswith(".json") or content.lstrip().startswith(("{", "[")):
                fmt = "json"
            elif filename.endswith(".csv"):
                fmt = "csv"
            else:
                fmt = "log"

        try:
            if fmt == "json":
                events, warnings = self._parse_json(content, filename)
            elif fmt == "csv":
                events, warnings = self._parse_csv(content, filename)
            else:
                events, warnings = self._parse_logs(content, filename)
        except Exception as e:
            # Preservation guarantee: never crash on unexpected parser errors
            warnings.append(f"Global parser fallback triggered: {str(e)}")
            events = [
                EvidenceEvent(
                    id=f"evt-raw-{uuid.uuid4().hex[:6]}",
                    source=EvidenceSource.LOGS,
                    event_type="log_entry",
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    title=f"Unparsed File Artifact: {filename}",
                    message=content[:1000],
                    summary=f"Raw ingested file content from {filename} preserved without parsing failure.",
                    severity="warning",
                    metadata={"filename": filename, "raw_size_bytes": len(content)},
                    raw_reference=content[:500],
                )
            ]

        distinct_sources = len(set(e.source.value for e in events)) if events else 1

        return AcquisitionResult(
            source="logs",
            events_count=len(events),
            sources_count=distinct_sources,
            summary_message=f"Collected {len(events)} evidence events from {distinct_sources} sources (Ingested Bundle).",
            events=events,
            connector_status=await self.get_status(),
            warnings=warnings,
        )

    def _parse_json(self, content: str, filename: str) -> Tuple[List[EvidenceEvent], List[str]]:
        events: List[EvidenceEvent] = []
        warnings: List[str] = []

        # Attempt full JSON parse
        parsed_data = None
        try:
            parsed_data = json.loads(content)
        except Exception:
            # Could be Newline-Delimited JSON (NDJSON)
            lines = [l.strip() for l in content.splitlines() if l.strip()]
            parsed_data = []
            for i, line in enumerate(lines):
                try:
                    parsed_data.append(json.loads(line))
                except Exception:
                    # Malformed NDJSON line: preserve line
                    warnings.append(f"Malformed JSON at line {i+1}; preserved as raw event")
                    events.append(
                        EvidenceEvent(
                            id=f"evt-ndjson-err-{i+1}",
                            source=EvidenceSource.LOGS,
                            event_type="log_entry",
                            timestamp=datetime.now(timezone.utc).isoformat(),
                            title=f"Malformed NDJSON (Line {i+1})",
                            message=line,
                            summary=line[:120],
                            severity="warning",
                            metadata={"line_number": i + 1, "filename": filename},
                            raw_reference=line,
                        )
                    )

        raw_list = []
        if isinstance(parsed_data, list):
            raw_list = parsed_data
        elif isinstance(parsed_data, dict):
            # Check for common container keys
            for k in ["events", "logs", "records", "data", "items"]:
                if k in parsed_data and isinstance(parsed_data[k], list):
                    raw_list = parsed_data[k]
                    break
            if not raw_list:
                raw_list = [parsed_data]

        for idx, item in enumerate(raw_list):
            if not isinstance(item, dict):
                continue

            ts = self._extract_json_field(
                item, ["timestamp", "time", "@timestamp", "datetime", "date", "created_at", "ts"]
            )
            if not ts:
                ts = datetime.now(timezone.utc).isoformat()

            lvl = self._extract_json_field(item, ["level", "severity", "log_level", "type"]) or "info"
            msg = self._extract_json_field(item, ["message", "msg", "log", "summary", "text", "error"]) or str(item)
            src_val = self._extract_json_field(item, ["source", "service", "app", "logger", "pod", "host"]) or "logs"
            source_enum = self._map_source(src_val)

            severity_norm = self._normalize_severity(lvl)
            is_candidate = severity_norm in ["error", "critical"] and any(
                k in msg.lower() for k in ["timeout", "deadlock", "leak", "oom", "exhaust", "exception"]
            )

            events.append(
                EvidenceEvent(
                    id=f"evt-json-{idx+1}",
                    source=source_enum,
                    event_type="log_entry",
                    timestamp=str(ts),
                    title=f"[{src_val}] {msg[:60]}",
                    message=msg,
                    summary=f"JSON log record ({src_val}): {msg[:140]}",
                    severity=severity_norm,
                    metadata={"index": idx + 1, "raw_fields": item, "filename": filename},
                    related_identifiers=[src_val],
                    raw_reference=json.dumps(item)[:400],
                    is_root_cause_candidate=is_candidate,
                )
            )

        return events, warnings

    def _parse_csv(self, content: str, filename: str) -> Tuple[List[EvidenceEvent], List[str]]:
        events: List[EvidenceEvent] = []
        warnings: List[str] = []

        f = io.StringIO(content.strip())
        reader = csv.DictReader(f)

        if not reader.fieldnames:
            warnings.append("CSV has no header; falling back to line-by-line parsing.")
            return self._parse_logs(content, filename)

        # Normalize field names to lower-case
        field_map = {name.lower(): name for name in reader.fieldnames}

        ts_col = self._find_matching_column(field_map, ["timestamp", "time", "date", "datetime", "created_at"])
        lvl_col = self._find_matching_column(field_map, ["severity", "level", "log_level", "priority"])
        msg_col = self._find_matching_column(field_map, ["message", "msg", "summary", "description", "text"])
        src_col = self._find_matching_column(field_map, ["source", "service", "system", "app", "host"])

        for idx, row in enumerate(reader):
            raw_ts = row.get(ts_col) if ts_col else None
            ts = raw_ts or datetime.now(timezone.utc).isoformat()
            raw_lvl = row.get(lvl_col) if lvl_col else "info"
            msg = row.get(msg_col) if msg_col else str(row)
            src_val = row.get(src_col) if src_col else "logs"

            source_enum = self._map_source(src_val)
            severity_norm = self._normalize_severity(raw_lvl)

            events.append(
                EvidenceEvent(
                    id=f"evt-csv-{idx+1}",
                    source=source_enum,
                    event_type="log_entry",
                    timestamp=str(ts),
                    title=f"CSV Event [{src_val}]: {msg[:60]}",
                    message=msg,
                    summary=f"CSV record from {filename}: {msg[:140]}",
                    severity=severity_norm,
                    metadata={"csv_row": idx + 1, "filename": filename, "data": row},
                    related_identifiers=[src_val],
                    raw_reference=str(row),
                )
            )

        return events, warnings

    def _parse_logs(self, content: str, filename: str) -> Tuple[List[EvidenceEvent], List[str]]:
        events: List[EvidenceEvent] = []
        warnings: List[str] = []
        lines = content.splitlines()

        last_known_timestamp = datetime.now(timezone.utc).isoformat()

        for idx, line in enumerate(lines):
            line_str = line.strip()
            if not line_str:
                continue

            # 1. Extract timestamp
            ts_match = (
                self.ISO_TIMESTAMP_RE.search(line_str)
                or self.APACHE_TIMESTAMP_RE.search(line_str)
                or self.SYSLOG_TIMESTAMP_RE.search(line_str)
                or self.SLASH_TIMESTAMP_RE.search(line_str)
            )

            if ts_match:
                ts = ts_match.group("ts")
                last_known_timestamp = ts
            else:
                ts = last_known_timestamp

            # 2. Extract severity
            lvl_match = self.SEVERITY_RE.search(line_str)
            severity_norm = self._normalize_severity(lvl_match.group("lvl")) if lvl_match else "info"

            # 3. Extract source if identifiable
            src_match = self.SOURCE_RE.search(line_str)
            src_str = src_match.group("src") if src_match else "logs"
            source_enum = self._map_source(src_str)

            # 4. Message cleaning
            message = line_str
            is_candidate = severity_norm in ["error", "critical"] and any(
                k in line_str.lower() for k in ["timeout", "exhaust", "oom", "leak", "fatal", "pool saturated", "504"]
            )

            title = f"[{src_str}] {line_str[:55]}"

            events.append(
                EvidenceEvent(
                    id=f"evt-log-{idx+1}",
                    source=source_enum,
                    event_type="log_entry",
                    timestamp=ts,
                    title=title,
                    message=message,
                    summary=line_str[:160],
                    severity=severity_norm,
                    metadata={"line_number": idx + 1, "filename": filename, "matched_source": src_str},
                    related_identifiers=[src_str],
                    raw_reference=line_str,
                    is_root_cause_candidate=is_candidate,
                )
            )

        return events, warnings

    def _extract_json_field(self, data: Dict[str, Any], candidates: List[str]) -> Optional[Any]:
        for c in candidates:
            if c in data and data[c] is not None:
                return data[c]
        return None

    def _find_matching_column(self, field_map: Dict[str, str], candidates: List[str]) -> Optional[str]:
        for c in candidates:
            if c in field_map:
                return field_map[c]
        return None

    def _normalize_severity(self, raw_val: Optional[str]) -> str:
        if not raw_val:
            return "info"
        val = str(raw_val).strip().lower()
        if val in ["fatal", "critical", "crit", "emerg", "panic"]:
            return "critical"
        if val in ["error", "err", "fail", "failed"]:
            return "error"
        if val in ["warn", "warning", "notice"]:
            return "warning"
        return "info"

    def _map_source(self, src: Optional[str]) -> EvidenceSource:
        if not src:
            return EvidenceSource.LOGS
        s = str(src).lower()
        if "github" in s or "git" in s:
            return EvidenceSource.GITHUB
        if "sentry" in s:
            return EvidenceSource.SENTRY
        if "metric" in s or "cloudwatch" in s or "datadog" in s or "prometheus" in s:
            return EvidenceSource.METRICS
        if "deploy" in s or "k8s" in s or "argocd" in s:
            return EvidenceSource.DEPLOYMENT
        if "nginx" in s or "network" in s or "ingress" in s or "dns" in s:
            return EvidenceSource.NETWORK
        return EvidenceSource.LOGS

    def _generate_sample_parsed_events(self, filename: str) -> List[EvidenceEvent]:
        return [
            EvidenceEvent(
                id="evt-bundle-1",
                source=EvidenceSource.NETWORK,
                event_type="log_entry",
                timestamp="2026-09-18T08:14:30Z",
                title="[nginx-ingress] 504 Gateway Timeout on /v1/invoices/sync",
                message="10.244.2.1 - [18/Sep/2026:08:14:30 +0000] 'POST /v1/invoices/sync' 504 182 upstream_connect_time=0.001 upstream_response_time=30.002",
                summary="Ingress proxy reported 504 upstream timeout communicating with billing backend.",
                severity="error",
                metadata={"status": 504, "route": "/v1/invoices/sync", "filename": filename},
                related_identifiers=["nginx-ingress", "504"],
                raw_reference="upstream_response_time=30.002",
                is_root_cause_candidate=False,
            ),
            EvidenceEvent(
                id="evt-bundle-2",
                source=EvidenceSource.LOGS,
                event_type="log_entry",
                timestamp="2026-09-18T08:14:35Z",
                title="[payments-api] Connection pool exhausted: 100/100 connections in use",
                message="2026-09-18 08:14:35.412 [ERROR] [payments-api] DB pool exhausted: acquire timeout after 10000ms. Active=100 Waiting=342",
                summary="PostgreSQL connection pool exhausted. Active connections saturated at capacity.",
                severity="critical",
                metadata={"active_connections": 100, "waiting_threads": 342, "filename": filename},
                related_identifiers=["payments-api", "rds-postgres"],
                raw_reference="DB pool exhausted: acquire timeout after 10000ms",
                is_root_cause_candidate=True,
            ),
        ]
