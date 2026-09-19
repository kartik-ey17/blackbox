import { EvidenceEvent, ConnectorStatus, AcquisitionResult } from '../../types/incident';
import { SAMPLE_INCIDENTS } from '../../data/fixtures';
import { EvidenceProvider } from './base';

export class DemoProvider implements EvidenceProvider {
  name = 'demo';

  async getStatus(): Promise<ConnectorStatus> {
    return {
      connected: true,
      available: true,
      error: null,
      fallback_available: true,
      details: {
        provider: 'Demo Incident Fixtures',
        ready: true,
        offline_first: true,
        incidents_available: SAMPLE_INCIDENTS.length,
      },
    };
  }

  async collectEvidence(params?: { incident_id?: string; filter_source?: string }): Promise<AcquisitionResult> {
    const incidentId = params?.incident_id || 'inc-db-pool-exhaustion';
    const incident = SAMPLE_INCIDENTS.find((i) => i.id === incidentId) || SAMPLE_INCIDENTS[0];

    let events: EvidenceEvent[] = [];
    if (incident) {
      if (params?.filter_source && params.filter_source.toLowerCase() !== 'all') {
        events = incident.evidence_events.filter(
          (e) => e.source.toLowerCase() === params.filter_source!.toLowerCase()
        );
      } else {
        events = [...incident.evidence_events];
      }
    }

    const distinctSources = new Set(events.map((e) => e.source)).size || 1;

    return {
      source: params?.filter_source || 'demo',
      events_count: events.length,
      sources_count: distinctSources,
      summary_message: `Collected ${events.length} evidence events from ${distinctSources} sources (Demo Mode).`,
      events,
      connector_status: await this.getStatus(),
      warnings: [],
    };
  }
}
