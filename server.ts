import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { SAMPLE_INCIDENTS } from './src/data/fixtures';
import { getAcquisitionService } from './src/services/providers';
import { investigateIncident, challengeIncidentHypothesis } from './src/services/investigator';
import { preprocessIncident } from './src/services/preprocessor';
import { IncidentInvestigation, ChallengeResult } from './src/types/investigation';

async function startServer() {
  const app = express();
  const PORT = 3000;
  const acquisitionService = getAcquisitionService();

  // In-memory cache for investigations and challenge histories
  const investigationCache = new Map<string, IncidentInvestigation>();
  const challengeCache = new Map<string, ChallengeResult[]>();

  app.use(express.json({ limit: '15mb' }));

  // CORS middleware for client-server decoupling
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check endpoints (GET /health and GET /api/health)
  const healthHandler = (req: express.Request, res: express.Response) => {
    res.json({
      status: 'ok',
      service: 'blackbox-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      sample_incidents_loaded: SAMPLE_INCIDENTS.length,
      environment: process.env.NODE_ENV || 'development',
      runtime: 'fullstack-bridge',
    });
  };

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  // Connectivity test probe
  app.post('/api/integrations/test', (req, res) => {
    const clientTimestamp = req.body?.client_timestamp || new Date().toISOString();
    res.json({
      status: 'connected',
      client_received: req.body?.client_id || 'unknown',
      latency_probe_echo: 'pong',
      server_time: new Date().toISOString(),
      active_mode: 'demo_in_memory',
    });
  });

  // -------------------------------------------------------------------------
  // Evidence Acquisition & Connectors (Stage 2)
  // -------------------------------------------------------------------------

  // Get live status across all 4 connectors
  app.get('/api/connectors/status', async (req, res) => {
    try {
      const statuses = await acquisitionService.getAllConnectorStatuses();
      res.json(statuses);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to query connector statuses' });
    }
  });

  // Acquire evidence from GitHub
  app.post('/api/connectors/github/collect', async (req, res) => {
    try {
      const result = await acquisitionService.acquireFromGitHub(req.body || {});
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'GitHub acquisition failed' });
    }
  });

  // Acquire evidence from Sentry
  app.post('/api/connectors/sentry/collect', async (req, res) => {
    try {
      const result = await acquisitionService.acquireFromSentry(req.body || {});
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Sentry acquisition failed' });
    }
  });

  // Ingest / parse file bundle (.log, .txt, .json, .csv)
  app.post('/api/connectors/file/collect', async (req, res) => {
    try {
      const result = await acquisitionService.acquireFromFile(req.body || {});
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'File ingestion failed' });
    }
  });

  // Collect from demo fixtures
  app.post('/api/connectors/demo/collect', async (req, res) => {
    try {
      const result = await acquisitionService.acquireFromDemo(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Demo acquisition failed' });
    }
  });

  // Backward compatible file upload endpoint
  app.post('/api/ingest/file', async (req, res) => {
    try {
      const filename = req.body?.filename || 'sample_logs.json';
      const content = req.body?.content || '';
      const result = await acquisitionService.acquireFromFile({
        filename,
        content,
        format_hint: 'auto',
      });
      res.json({
        status: 'parsed',
        filename,
        events_parsed: result.events_count,
        message: result.summary_message,
        events: result.events,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Ingest failed' });
    }
  });

  // List all demo incidents
  app.get('/api/incidents', (req, res) => {
    const list = SAMPLE_INCIDENTS.map(({ evidence_events, timeline_summary, key_anomalies, suggested_action_items, ...base }) => ({
      ...base,
      evidence_count: evidence_events.length,
    }));
    res.json(list);
  });

  // Get incident detail by ID
  app.get('/api/incidents/:id', (req, res) => {
    const incident = SAMPLE_INCIDENTS.find((i) => i.id === req.params.id);
    if (!incident) {
      return res.status(404).json({ error: `Incident ${req.params.id} not found` });
    }
    res.json(incident);
  });

  // Get chronological timeline events for an incident
  app.get('/api/incidents/:id/timeline', (req, res) => {
    const incident = SAMPLE_INCIDENTS.find((i) => i.id === req.params.id);
    if (!incident) {
      return res.status(404).json({ error: `Incident ${req.params.id} not found` });
    }
    const sorted = [...incident.evidence_events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    res.json(sorted);
  });

  // -------------------------------------------------------------------------
  // Stage 3 Core Investigation Engine Endpoints
  // -------------------------------------------------------------------------

  // Preprocess incident evidence deterministically
  const preprocessHandler = async (req: express.Request, res: express.Response) => {
    try {
      let events = req.body?.evidence_events;
      const incidentId = req.params?.id || req.body?.incident_id;

      if ((!events || events.length === 0) && incidentId) {
        const found = SAMPLE_INCIDENTS.find((i) => i.id === incidentId);
        if (found) events = found.evidence_events;
      }

      if (!events || events.length === 0) {
        return res.status(400).json({ error: 'No evidence_events provided for preprocessing' });
      }

      const preprocessed = preprocessIncident(events);
      res.json(preprocessed);
    } catch (err: any) {
      console.error('[Server Preprocess Error]:', err);
      res.status(500).json({ error: err.message || 'Preprocessing failed' });
    }
  };

  app.post('/api/preprocess', preprocessHandler);
  app.post('/preprocess', preprocessHandler);
  app.post('/api/incidents/:id/preprocess', preprocessHandler);

  // Core Investigation Endpoint (POST /api/investigate and POST /investigate)
  const investigateHandler = async (req: express.Request, res: express.Response) => {
    try {
      let events = req.body?.evidence_events;
      const incidentId = req.body?.incident_id || req.params?.id;
      const title = req.body?.incident_title || (incidentId ? `Incident ${incidentId}` : 'Target Incident');
      const forceRefresh = Boolean(req.body?.force_refresh);

      if ((!events || events.length === 0) && incidentId) {
        const found = SAMPLE_INCIDENTS.find((i) => i.id === incidentId);
        if (found) {
          events = found.evidence_events;
        }
      }

      if (!events || events.length === 0) {
        return res.status(400).json({ error: 'No evidence events provided for investigation' });
      }

      // Check cache if incidentId is provided and not forcing refresh
      if (incidentId && !forceRefresh && investigationCache.has(incidentId)) {
        const cached = investigationCache.get(incidentId)!;
        return res.json(cached);
      }

      const investigation = await investigateIncident(events, title);
      if (incidentId) {
        investigation.incident_id = incidentId;
        investigation.challenge_history = challengeCache.get(incidentId) || [];
        investigationCache.set(incidentId, investigation);
      }

      res.json(investigation);
    } catch (err: any) {
      console.error('[Server Investigation Error]:', err);
      res.status(500).json({ error: err.message || 'Investigation execution failed' });
    }
  };

  app.post('/api/investigate', investigateHandler);
  app.post('/investigate', investigateHandler);

  // Get existing or auto-run investigation for an incident ID (GET /api/incidents/:id/investigation)
  const getInvestigationHandler = async (req: express.Request, res: express.Response) => {
    try {
      const incidentId = req.params.id;
      if (investigationCache.has(incidentId)) {
        return res.json(investigationCache.get(incidentId)!);
      }

      const found = SAMPLE_INCIDENTS.find((i) => i.id === incidentId);
      if (!found) {
        return res.status(404).json({ error: `Incident ${incidentId} not found` });
      }

      const investigation = await investigateIncident(found.evidence_events, found.title);
      investigation.incident_id = incidentId;
      investigation.challenge_history = challengeCache.get(incidentId) || [];
      investigationCache.set(incidentId, investigation);

      res.json(investigation);
    } catch (err: any) {
      console.error('[Server Get Investigation Error]:', err);
      res.status(500).json({ error: err.message || 'Failed to retrieve investigation' });
    }
  };

  app.get('/api/incidents/:id/investigation', getInvestigationHandler);
  app.get('/incidents/:id/investigation', getInvestigationHandler);

  // Challenge Conclusion Endpoint (POST /api/incidents/:id/challenge and POST /api/challenge)
  const challengeHandler = async (req: express.Request, res: express.Response) => {
    try {
      const incidentId = req.params?.id || req.body?.incident_id;
      let events = req.body?.evidence_events;
      let hypothesis = req.body?.primary_hypothesis;

      if ((!events || events.length === 0) && incidentId) {
        const found = SAMPLE_INCIDENTS.find((i) => i.id === incidentId);
        if (found) events = found.evidence_events;
      }

      if (!hypothesis && incidentId && investigationCache.has(incidentId)) {
        hypothesis = investigationCache.get(incidentId)!.primary_hypothesis;
      }

      if (!hypothesis) {
        hypothesis = 'Unspecified primary root cause hypothesis under review.';
      }

      if (!events || events.length === 0) {
        return res.status(400).json({ error: 'No evidence events provided to challenge hypothesis.' });
      }

      const result = await challengeIncidentHypothesis(hypothesis, events, incidentId);

      // Record in challenge cache and update cached investigation
      if (incidentId) {
        const list = challengeCache.get(incidentId) || [];
        list.unshift(result);
        challengeCache.set(incidentId, list);

        if (investigationCache.has(incidentId)) {
          const inv = investigationCache.get(incidentId)!;
          inv.challenge_history = list;
          inv.investigation_status = 'challenged';
          // Update confidence if revised
          inv.confidence = result.revised_confidence;
          investigationCache.set(incidentId, inv);
        }
      }

      res.json(result);
    } catch (err: any) {
      console.error('[Server Challenge Error]:', err);
      res.status(500).json({ error: err.message || 'Challenge conclusion execution failed' });
    }
  };

  app.post('/api/incidents/:id/challenge', challengeHandler);
  app.post('/incidents/:id/challenge', challengeHandler);
  app.post('/api/challenge', challengeHandler);
  app.post('/challenge', challengeHandler);

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BlackBox server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
