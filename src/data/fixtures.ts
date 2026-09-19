import { IncidentDetail } from '../types/incident';

export const SAMPLE_INCIDENTS: IncidentDetail[] = [
  {
    id: 'inc-db-pool-exhaustion',
    title: 'PostgreSQL Connection Pool Exhaustion on Payments Service',
    summary: 'Sudden saturation of primary database connection pool following bulk invoice sync rollout, resulting in cascading 504 Gateway Timeouts across checkout flows.',
    severity: 'P0',
    status: 'mitigated',
    service: 'payments-api',
    environment: 'production',
    started_at: '2026-09-18T14:08:12Z',
    detected_at: '2026-09-18T14:12:45Z',
    mitigated_at: '2026-09-18T14:48:00Z',
    sources_connected: ['github', 'sentry', 'logs', 'metrics', 'deployment'],
    blast_radius: {
      services_impacted: ['payments-api', 'checkout-web', 'subscription-worker', 'analytics-sync'],
      users_affected_count: 8420,
      error_rate_peak_pct: 46.2,
      p99_latency_ms: 32500,
      regions_affected: ['us-east-1', 'us-east-2']
    },
    evidence_count: 6,
    primary_hypothesis: 'PR #412 introduced un-scoped database transactions during bulk invoice queries, omitting connection pool release in error handlers.',
    timeline_summary: 'At 14:08 UTC, automated deployment v2.14.2 rolled out commit b91c4a0. By 14:12, RDS Postgres active pool connections jumped from normal baseline of 22 to max limit 100. Sentry started capturing DBConnectionTimeout errors at 14:13, triggering automated P0 pager. Traffic was mitigated at 14:48 by reverting commit and restarting pods.',
    key_anomalies: [
      'Database pool queue depth spiked from 0 to 1,480 within 90 seconds',
      'P99 latency surged from 42ms to 32.5s',
      'Missing connection.release() found in bulk_sync_invoices worker routine'
    ],
    suggested_action_items: [
      'Revert PR #412 and patch connection context manager with explicit finally block',
      'Increase HikariCP/AsyncPG pool max lifetime timeout alarm threshold',
      'Add integration test verifying connection release under simulated downstream timeout'
    ],
    evidence_events: [
      {
        id: 'evt-gh-412',
        source: 'github',
        timestamp: '2026-09-18T14:02:19Z',
        title: "PR #412 Merged: 'refactor(billing): add bulk invoice synchronization'",
        summary: 'Merged by @alex-dev into main. 12 files changed, +384 -92 lines. Introduces batch query for quarterly invoices.',
        severity: 'info',
        is_root_cause_candidate: true,
        metadata: {
          commit_hash: 'b91c4a0f8',
          author: 'alex-dev',
          pr_number: 412,
          repo: 'acme-corp/payments-service',
          diff_snippet: '+ async with db.transaction():\n+   results = await db.fetch_all(query)\n+   # NOTE: missing finally block for connection lease'
        },
        correlated_event_ids: ['evt-dep-2142', 'evt-met-conn-spike']
      },
      {
        id: 'evt-dep-2142',
        source: 'deployment',
        timestamp: '2026-09-18T14:08:12Z',
        title: 'Canary & Full Rollout: payments-api v2.14.2',
        summary: 'Kubernetes deployment rollout succeeded on cluster prod-useast1-k8s across 24 replica pods.',
        severity: 'info',
        is_root_cause_candidate: false,
        metadata: {
          release: 'v2.14.2',
          cluster: 'prod-useast1-k8s',
          replicas: 24,
          strategy: 'RollingUpdate'
        },
        correlated_event_ids: ['evt-gh-412', 'evt-met-conn-spike']
      },
      {
        id: 'evt-met-conn-spike',
        source: 'metrics',
        timestamp: '2026-09-18T14:12:05Z',
        title: 'CloudWatch Metric Alert: RDS Connection Pool Saturated (100%)',
        summary: 'Postgres Primary pool exhausted. Active connections 100/100. Wait queue exceeded 1,200 requests.',
        severity: 'critical',
        is_root_cause_candidate: false,
        metadata: {
          metric_name: 'DatabaseConnections',
          threshold: 90,
          observed_value: 100,
          host: 'aurora-pg-primary.internal'
        },
        correlated_event_ids: ['evt-dep-2142', 'evt-sen-timeout', 'evt-log-504']
      },
      {
        id: 'evt-sen-timeout',
        source: 'sentry',
        timestamp: '2026-09-18T14:13:30Z',
        title: 'Sentry Issue #8921: DBConnectionTimeoutException',
        summary: "PoolAcquisitionTimeout: Timed out waiting 30000ms for connection from pool 'aurora-primary-rw'. 4,210 events in 10 minutes.",
        severity: 'error',
        is_root_cause_candidate: false,
        metadata: {
          issue_id: 'PAYMENTS-8921',
          exception_type: 'asyncpg.exceptions.PoolTimeoutError',
          culprit: 'services/billing/invoicing.py in bulk_sync_invoices at line 148',
          stack_trace: "File 'services/billing/invoicing.py', line 148, in bulk_sync_invoices\n    conn = await pool.acquire(timeout=30.0)\nFile 'asyncpg/pool.py', line 542, in acquire\n    raise asyncio.TimeoutError('Connection pool exhausted')"
        },
        correlated_event_ids: ['evt-met-conn-spike', 'evt-log-504']
      },
      {
        id: 'evt-log-504',
        source: 'logs',
        timestamp: '2026-09-18T14:14:10Z',
        title: 'Nginx Ingress Error Spike: 504 Gateway Timeout',
        summary: 'Ingress upstream request timeout for endpoint POST /v1/checkout/charge. Upstream server unresponsive for 60s.',
        severity: 'error',
        is_root_cause_candidate: false,
        metadata: {
          status_code: 504,
          endpoint: '/v1/checkout/charge',
          rate_per_sec: 380,
          sample_log: "2026-09-18T14:14:10.892Z [error] 14#14: *120485 upstream timed out (110: Connection timed out) while reading response header from upstream, client: 198.51.100.44, server: api.acme.com, request: 'POST /v1/checkout/charge HTTP/2.0'"
        },
        correlated_event_ids: ['evt-sen-timeout']
      },
      {
        id: 'evt-gh-revert',
        source: 'github',
        timestamp: '2026-09-18T14:42:00Z',
        title: "PR #415 Merged: 'Revert PR #412 and patch pool lifecycle'",
        summary: 'Emergency hotfix PR merged by on-call lead. Rolled back v2.14.2 to v2.14.1 on prod.',
        severity: 'info',
        is_root_cause_candidate: false,
        metadata: {
          pr_number: 415,
          author: 'sre-oncall',
          status: 'deployed'
        },
        correlated_event_ids: ['evt-gh-412']
      }
    ]
  },
  {
    id: 'inc-mem-leak-k8s',
    title: 'Kubernetes OOMKilled Pod Cascades in Search & Recommender',
    summary: 'Gradual unevicted vector embedding cache expansion leading to repetitive node memory pressure, cgroup OOMKills, and 502 Bad Gateway cascading outages.',
    severity: 'P1',
    status: 'investigating',
    service: 'recommendation-engine',
    environment: 'production',
    started_at: '2026-09-18T09:15:00Z',
    detected_at: '2026-09-18T11:42:18Z',
    mitigated_at: null,
    sources_connected: ['github', 'sentry', 'logs', 'metrics', 'deployment'],
    blast_radius: {
      services_impacted: ['recommendation-engine', 'search-gateway', 'home-feed-bff'],
      users_affected_count: 14200,
      error_rate_peak_pct: 28.4,
      p99_latency_ms: 14800,
      regions_affected: ['eu-central-1']
    },
    evidence_count: 5,
    primary_hypothesis: 'Commit 4a8e291 initialized an unbounded Python in-memory LRU dict for semantic embeddings without maxsize limit or TTL eviction policy.',
    timeline_summary: 'At 09:15 UTC, release v3.8.0 was deployed to cluster prod-eucentral-k8s. Over the next 2.5 hours, pod resident memory climbed from 512MB to 4.0GB cgroup limit. At 11:41, Linux kernel sent SIGKILL (exit code 137). Restarting pods caused cold-cache thrashing and degraded response times.',
    key_anomalies: [
      'Process RSS memory growth rate was perfectly linear (+22MB/minute)',
      '7 out of 8 pods were terminated by Kubelet OOMKilled simultaneously',
      'Garbage collector spend reached 68% of CPU cycles prior to termination'
    ],
    suggested_action_items: [
      'Hotfix cache configuration to enforce maxsize=10000 with redis offload',
      'Temporarily increase pod memory limits from 4Gi to 8Gi to prevent flapping',
      'Configure Prometheus cgroup memory slope alerting (alert on >10% growth/hr)'
    ],
    evidence_events: [
      {
        id: 'evt-gh-mem-pr',
        source: 'github',
        timestamp: '2026-09-18T09:02:11Z',
        title: "PR #889 Merged: 'feat(search): in-memory cache for user vector embeddings'",
        summary: 'Merged by @ml-eng. Added local dictionary cache to bypass vector DB latency for frequent shoppers.',
        severity: 'info',
        is_root_cause_candidate: true,
        metadata: {
          commit_hash: '4a8e291f0',
          author: 'ml-eng',
          pr_number: 889,
          repo: 'acme-corp/recommendation-engine',
          diff_snippet: '+ _EMBEDDING_CACHE = {} # Global cache without TTL\n+ def get_cached_vector(user_id):\n+   if user_id not in _EMBEDDING_CACHE:\n+     _EMBEDDING_CACHE[user_id] = model.encode(user_id)'
        },
        correlated_event_ids: ['evt-dep-mem', 'evt-met-rss-ramp']
      },
      {
        id: 'evt-dep-mem',
        source: 'deployment',
        timestamp: '2026-09-18T09:15:00Z',
        title: 'Deployment rollout: recommendation-engine v3.8.0',
        summary: "ArgoCD synced deployment recommendation-engine to tag v3.8.0 in namespace 'ml-serving'.",
        severity: 'info',
        is_root_cause_candidate: false,
        metadata: {
          tag: 'v3.8.0',
          tool: 'ArgoCD',
          namespace: 'ml-serving'
        },
        correlated_event_ids: ['evt-gh-mem-pr', 'evt-met-rss-ramp']
      },
      {
        id: 'evt-met-rss-ramp',
        source: 'metrics',
        timestamp: '2026-09-18T10:45:00Z',
        title: 'Prometheus Anomaly: container_memory_working_set_bytes Breach',
        summary: 'Memory consumption exceeded 85% warning watermark on 8 out of 8 replica pods.',
        severity: 'warning',
        is_root_cause_candidate: false,
        metadata: {
          metric: 'container_memory_working_set_bytes',
          current_value: '3.62GiB',
          limit: '4.00GiB',
          rate_of_change: '+1.3GB/hr'
        },
        correlated_event_ids: ['evt-dep-mem', 'evt-log-oomkill']
      },
      {
        id: 'evt-log-oomkill',
        source: 'logs',
        timestamp: '2026-09-18T11:41:22Z',
        title: 'Kubernetes Kubelet Event: Pod OOMKilled (Exit Code 137)',
        summary: 'Kernel invocation: cgroup out of memory: Killed process 38194 (gunicorn worker) total-vm:4289100kB, anon-rss:3992140kB.',
        severity: 'critical',
        is_root_cause_candidate: false,
        metadata: {
          pod_name: 'recommendation-engine-67d9bc46f-8k9pl',
          exit_code: 137,
          reason: 'OOMKilled',
          raw_event: 'Memory cgroup out of memory: Kill process 38194 (python3) score 982 or sacrifice child'
        },
        correlated_event_ids: ['evt-met-rss-ramp', 'evt-sen-sigkill']
      },
      {
        id: 'evt-sen-sigkill',
        source: 'sentry',
        timestamp: '2026-09-18T11:42:18Z',
        title: 'Sentry Issue #9402: WorkerLostRemoteError',
        summary: 'Process terminated abnormally while handling batch inference request. 1,840 user requests dropped.',
        severity: 'error',
        is_root_cause_candidate: false,
        metadata: {
          issue_id: 'REC-9402',
          culprit: 'gunicorn.arbiter in handle_child_termination',
          error_class: 'WorkerLostRemoteError',
          handled: false
        },
        correlated_event_ids: ['evt-log-oomkill']
      }
    ]
  },
  {
    id: 'inc-third-party-api-outage',
    title: 'Third-Party Payment Gateway Webhook Delivery Failure & Order Stalling',
    summary: 'Upstream payment provider Cloudflare edge challenge triggered silent 403 Forbidden drops on incoming asynchronous webhook callbacks, causing pending order processing queues to backup.',
    severity: 'P1',
    status: 'identified',
    service: 'billing-gateway',
    environment: 'production',
    started_at: '2026-09-18T06:30:00Z',
    detected_at: '2026-09-18T07:15:10Z',
    mitigated_at: null,
    sources_connected: ['sentry', 'logs', 'metrics', 'network'],
    blast_radius: {
      services_impacted: ['billing-gateway', 'order-fulfillment', 'customer-notifications'],
      users_affected_count: 5600,
      error_rate_peak_pct: 34.2,
      p99_latency_ms: 1200,
      regions_affected: ['global-edge']
    },
    evidence_count: 5,
    primary_hypothesis: 'External payment provider updated their egress IP ranges and bot protection rules, triggering WAF block (HTTP 403) on incoming signature headers.',
    timeline_summary: 'Beginning at 06:30 UTC, completed payment webhooks failed to acknowledge. At 07:15 UTC, the unprocessed order backlog triggered a P1 escalation. Sentry captured InvalidSignature and BadGateway exceptions, while edge access logs revealed Cloudflare Ray ID 403 responses.',
    key_anomalies: [
      '100% of webhook events from IP CIDR 198.51.100.0/24 returned HTTP 403 with WAF block signature',
      'Order fulfillment queue latency increased from 4 seconds to 45 minutes',
      'No internal application code deployment occurred in the preceding 72 hours'
    ],
    suggested_action_items: [
      'Add upstream webhook gateway IP ranges to AWS WAF / Cloudflare allowlist bypass',
      'Enable manual fallback poll queue worker to reconcile unacknowledged charges',
      'Subscribe to vendor status page webhooks for automated egress IP rotation alerts'
    ],
    evidence_events: [
      {
        id: 'evt-net-waf-block',
        source: 'network',
        timestamp: '2026-09-18T06:30:14Z',
        title: 'Cloudflare WAF Block: Rule 100012_BOT_CHALLENGE Triggered',
        summary: 'External IP range 198.51.100.x flagged by managed challenge on endpoint /api/v1/webhooks/stripe.',
        severity: 'critical',
        is_root_cause_candidate: true,
        metadata: {
          rule_id: '100012_BOT_CHALLENGE',
          action: 'block_403',
          client_ip: '198.51.100.82',
          user_agent: 'Stripe/1.0 (+https://stripe.com/docs/webhooks)'
        },
        correlated_event_ids: ['evt-log-nginx-403', 'evt-met-queue-backlog']
      },
      {
        id: 'evt-log-nginx-403',
        source: 'logs',
        timestamp: '2026-09-18T06:32:00Z',
        title: 'Edge Gateway Logs: Repeated 403 on POST /webhooks/stripe',
        summary: '3,400 consecutive 403 Forbidden responses logged across edge proxies. No payload forwarded to backend service.',
        severity: 'error',
        is_root_cause_candidate: false,
        metadata: {
          status: 403,
          bytes_sent: 142,
          sample_header: 'cf-mitigated: challenge, cf-ray: 8c34f9a01'
        },
        correlated_event_ids: ['evt-net-waf-block', 'evt-sen-signature']
      },
      {
        id: 'evt-sen-signature',
        source: 'sentry',
        timestamp: '2026-09-18T07:12:00Z',
        title: 'Sentry Issue #7219: WebhookReconciliationMismatch',
        summary: 'Cron worker detecting 1,420 pending orders missing payment intent confirmations after 30-minute timeout.',
        severity: 'warning',
        is_root_cause_candidate: false,
        metadata: {
          issue_id: 'BILLING-7219',
          pending_orders: 1420,
          service: 'order-fulfillment'
        },
        correlated_event_ids: ['evt-log-nginx-403', 'evt-met-queue-backlog']
      },
      {
        id: 'evt-met-queue-backlog',
        source: 'metrics',
        timestamp: '2026-09-18T07:15:10Z',
        title: 'SQS Queue Metric Alert: OrdersPendingWebhook Backlog > 5,000',
        summary: 'Queue depth reached critical threshold. AgeOfOldestMessage breached 45 minutes.',
        severity: 'critical',
        is_root_cause_candidate: false,
        metadata: {
          queue_name: 'prod-orders-pending-webhook',
          visible_messages: 5420,
          oldest_message_age_seconds: 2700
        },
        correlated_event_ids: ['evt-sen-signature']
      },
      {
        id: 'evt-log-upstream-status',
        source: 'logs',
        timestamp: '2026-09-18T07:22:00Z',
        title: "Vendor Status Page RSS: 'Stripe webhook IP rotation in progress'",
        summary: 'Upstream vendor published notice of newly assigned egress IP blocks in regional zones.',
        severity: 'info',
        is_root_cause_candidate: false,
        metadata: {
          vendor: 'Stripe',
          status_url: 'https://status.stripe.com/incidents/98214'
        },
        correlated_event_ids: ['evt-net-waf-block']
      }
    ]
  }
];
