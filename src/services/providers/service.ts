import {
  ConnectorsHealthResponse,
  AcquisitionResult,
  GitHubAcquisitionRequest,
  SentryAcquisitionRequest,
  FileAcquisitionRequest,
} from '../../types/incident';
import { DemoProvider } from './demo';
import { GitHubProvider } from './github';
import { SentryProvider } from './sentry';
import { FileProvider } from './file';

export class AcquisitionService {
  readonly demoProvider = new DemoProvider();
  readonly githubProvider = new GitHubProvider();
  readonly sentryProvider = new SentryProvider();
  readonly fileProvider = new FileProvider();

  async getAllConnectorStatuses(): Promise<ConnectorsHealthResponse> {
    const [ghStatus, sentryStatus, fileStatus, demoStatus] = await Promise.all([
      this.githubProvider.getStatus(),
      this.sentryProvider.getStatus(),
      this.fileProvider.getStatus(),
      this.demoProvider.getStatus(),
    ]);

    const activeCount = [ghStatus, sentryStatus, fileStatus, demoStatus].filter((s) => s.connected).length;

    return {
      github: ghStatus,
      sentry: sentryStatus,
      file: fileStatus,
      demo: demoStatus,
      summary: `${activeCount} of 4 evidence connectors live. Universal fallback ready.`,
    };
  }

  async acquireFromGitHub(req: GitHubAcquisitionRequest): Promise<AcquisitionResult> {
    return await this.githubProvider.collectEvidence(req);
  }

  async acquireFromSentry(req: SentryAcquisitionRequest): Promise<AcquisitionResult> {
    return await this.sentryProvider.collectEvidence(req);
  }

  async acquireFromFile(req: FileAcquisitionRequest): Promise<AcquisitionResult> {
    return await this.fileProvider.collectEvidence(req);
  }

  async acquireFromDemo(params?: { incident_id?: string; filter_source?: string }): Promise<AcquisitionResult> {
    return await this.demoProvider.collectEvidence(params);
  }
}

let serviceInstance: AcquisitionService | null = null;

export function getAcquisitionService(): AcquisitionService {
  if (!serviceInstance) {
    serviceInstance = new AcquisitionService();
  }
  return serviceInstance;
}
