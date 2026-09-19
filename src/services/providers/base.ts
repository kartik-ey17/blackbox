import { ConnectorStatus, AcquisitionResult } from '../../types/incident';

export interface EvidenceProvider {
  name: string;
  getStatus(): Promise<ConnectorStatus>;
  collectEvidence(params?: any): Promise<AcquisitionResult>;
}
