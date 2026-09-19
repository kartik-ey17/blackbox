import React, { useState, useEffect, useRef } from 'react';
import {
  Incident,
  IncidentDetail,
  ConnectorsHealthResponse,
  AcquisitionResult,
} from './types/incident';
import { IncidentInvestigation } from './types/investigation';
import {
  fetchIncidents,
  fetchIncidentDetail,
  checkBackendHealth,
  fetchConnectorsStatus,
  HealthCheckResult,
} from './services/api';
import { Navbar, NavView } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { NewInvestigationView } from './components/NewInvestigationView';
import { EvidenceCollectionView } from './components/EvidenceCollectionView';
import { FinalReportView } from './components/FinalReportView';
import { IncidentWorkspace } from './components/IncidentWorkspace';
import { ApiDiagnosticsModal } from './components/ApiDiagnosticsModal';
import { IntegrationsModal } from './components/IntegrationsModal';
import { IngestionModal } from './components/IngestionModal';
import { SourceStatusBanner } from './components/SourceStatusBanner';
import { GitHubConnectModal } from './components/GitHubConnectModal';
import { SentryConnectModal } from './components/SentryConnectModal';
import { CollectionSummaryToast } from './components/CollectionSummaryToast';

export default function App() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<IncidentDetail | null>(null);
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
  const [activeInvestigation, setActiveInvestigation] = useState<IncidentInvestigation | null>(null);
  const [isLoadingIncidents, setIsLoadingIncidents] = useState<boolean>(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Core Navigation State (Stage 4)
  const [currentView, setCurrentView] = useState<NavView>('dashboard');

  // Health and Diagnostics State
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState<boolean>(false);
  const [showConnectorsModal, setShowConnectorsModal] = useState<boolean>(false);
  const [showIngestModal, setShowIngestModal] = useState<boolean>(false);
  const [showGitHubModal, setShowGitHubModal] = useState<boolean>(false);
  const [showSentryModal, setShowSentryModal] = useState<boolean>(false);

  // Evidence Connectors State (Stage 2)
  const [connectorsStatus, setConnectorsStatus] = useState<ConnectorsHealthResponse | null>(null);
  const [isLoadingConnectors, setIsLoadingConnectors] = useState<boolean>(false);
  const [collectionToast, setCollectionToast] = useState<AcquisitionResult | null>(null);

  // Initial load: check health, connectors status & fetch incidents from API
  useEffect(() => {
    runInitialLoad();
  }, []);

  const refreshConnectorsStatus = async () => {
    setIsLoadingConnectors(true);
    try {
      const status = await fetchConnectorsStatus();
      setConnectorsStatus(status);
    } catch (err) {
      console.warn('Connector probe status failed:', err);
    } finally {
      setIsLoadingConnectors(false);
    }
  };

  const runInitialLoad = async () => {
    setIsCheckingHealth(true);
    setIsLoadingIncidents(true);

    try {
      // 1. Health check probe
      const health = await checkBackendHealth();
      setHealthResult(health);
    } catch (err: any) {
      console.warn('Initial health check notice:', err);
    } finally {
      setIsCheckingHealth(false);
    }

    // 2. Connector status check
    await refreshConnectorsStatus();

    try {
      // 3. Fetch incidents from API
      const list = await fetchIncidents();
      setIncidents(list);
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to load incidents');
    } finally {
      setIsLoadingIncidents(false);
    }
  };

  const handleSelectIncident = async (id: string, targetView: NavView = 'workspace') => {
    setActiveIncidentId(id);
    setIsLoadingDetail(true);
    setErrorNotice(null);

    try {
      const detail = await fetchIncidentDetail(id);
      setSelectedIncident(detail);
      setCurrentView(targetView);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setErrorNotice(`Failed to open incident ${id}: ${err.message}`);
      setActiveIncidentId(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleLaunchDemo = async () => {
    const demoId = incidents[0]?.id || 'inc-db-pool-exhaustion';
    await handleSelectIncident(demoId, 'workspace');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScrollToIncidents = () => {
    setCurrentView('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleImportEvidence = async (result: AcquisitionResult) => {
    setCollectionToast(result);

    if (selectedIncident) {
      // Merge into active incident
      const existingIds = new Set(selectedIncident.evidence_events.map((e) => e.id));
      const newUniqueEvents = result.events.filter((e) => !existingIds.has(e.id));
      const combined = [...selectedIncident.evidence_events, ...newUniqueEvents].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      setSelectedIncident({
        ...selectedIncident,
        evidence_events: combined,
      });
      setCurrentView('workspace');
    } else {
      // Open default demo incident and attach acquired evidence
      try {
        const defaultIncidentId = incidents[0]?.id || 'inc-db-pool-exhaustion';
        const detail = await fetchIncidentDetail(defaultIncidentId);
        const existingIds = new Set(detail.evidence_events.map((e) => e.id));
        const newUniqueEvents = result.events.filter((e) => !existingIds.has(e.id));
        const combined = [...detail.evidence_events, ...newUniqueEvents].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        setSelectedIncident({
          ...detail,
          evidence_events: combined,
        });
        setActiveIncidentId(detail.id);
        setCurrentView('workspace');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e: any) {
        console.warn('Failed to load incident for import:', e);
      }
    }
  };

  // Safe navigation view changer that auto-loads demo incident if required
  const handleNavChangeView = async (view: NavView) => {
    if ((view === 'evidence_collection' || view === 'workspace' || view === 'report') && !selectedIncident) {
      const demoId = incidents[0]?.id || 'inc-db-pool-exhaustion';
      await handleSelectIncident(demoId, view);
    } else {
      setCurrentView(view);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-zinc-100 selection:bg-emerald-500/30 selection:text-emerald-200 flex flex-col justify-between">
      <div>
        {/* Top sticky Navigation Stepper with API Health status */}
        <Navbar
          currentView={currentView}
          onChangeView={handleNavChangeView}
          activeIncidentId={activeIncidentId}
          onOpenConnectors={() => setShowConnectorsModal(true)}
          onOpenIngest={() => setShowIngestModal(true)}
          onOpenDiagnostics={() => setShowDiagnosticsModal(true)}
          healthResult={healthResult}
          isCheckingHealth={isCheckingHealth}
          onRecheckHealth={async () => {
            setIsCheckingHealth(true);
            const res = await checkBackendHealth();
            setHealthResult(res);
            setIsCheckingHealth(false);
          }}
        />

        {/* Global Error Banner */}
        {errorNotice && (
          <div className="bg-rose-950/80 border-b border-rose-800/80 px-4 py-3 text-xs text-rose-300 flex items-center justify-between font-mono">
            <span>{errorNotice}</span>
            <button
              onClick={() => setErrorNotice(null)}
              className="text-rose-400 hover:text-white ml-4 font-mono font-bold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main View Router */}
        <main>
          {isLoadingDetail ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              <p className="text-xs font-mono text-zinc-400">Loading incident telemetry from API...</p>
            </div>
          ) : (
            <>
              {/* VIEW 1: DASHBOARD */}
              {currentView === 'dashboard' && (
                <DashboardView
                  incidents={incidents}
                  onSelectIncident={(id) => handleSelectIncident(id, 'workspace')}
                  onLaunchDemo={handleLaunchDemo}
                  onNavigateToNew={() => setCurrentView('new_investigation')}
                  isLoading={isLoadingIncidents}
                  errorNotice={errorNotice}
                  onRetry={runInitialLoad}
                  connectorsStatus={connectorsStatus}
                />
              )}

              {/* VIEW 2: NEW INVESTIGATION */}
              {currentView === 'new_investigation' && (
                <NewInvestigationView
                  connectorsStatus={connectorsStatus}
                  onLaunchDemo={handleLaunchDemo}
                  onOpenGitHubModal={() => setShowGitHubModal(true)}
                  onOpenSentryModal={() => setShowSentryModal(true)}
                  onOpenUploadModal={() => setShowIngestModal(true)}
                  onDirectImport={handleImportEvidence}
                />
              )}

              {/* VIEW 3: EVIDENCE COLLECTION STREAM */}
              {currentView === 'evidence_collection' && (
                selectedIncident ? (
                  <EvidenceCollectionView
                    events={selectedIncident.evidence_events}
                    incidentTitle={selectedIncident.title}
                    onSelectEvent={(eventId) => {
                      setCurrentView('workspace');
                    }}
                    onNavigateToWorkspace={() => setCurrentView('workspace')}
                    connectorsStatus={connectorsStatus}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-4">
                    <p className="text-sm font-mono text-zinc-400">No incident currently selected for evidence stream.</p>
                    <button
                      onClick={handleLaunchDemo}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-mono font-bold text-white transition-colors cursor-pointer"
                    >
                      Load Demo Incident Evidence
                    </button>
                  </div>
                )
              )}

              {/* VIEW 4: INVESTIGATION WORKSPACE */}
              {currentView === 'workspace' && (
                selectedIncident ? (
                  <IncidentWorkspace
                    incident={selectedIncident}
                    onBack={handleBackToDashboard}
                    onOpenGitHub={() => setShowGitHubModal(true)}
                    onOpenSentry={() => setShowSentryModal(true)}
                    onOpenBundle={() => setShowIngestModal(true)}
                    onNavigateToReport={() => setCurrentView('report')}
                    onNavigateToEvidence={() => setCurrentView('evidence_collection')}
                    onInvestigationChange={setActiveInvestigation}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-4">
                    <p className="text-sm font-mono text-zinc-400">No active incident loaded in workspace.</p>
                    <button
                      onClick={handleLaunchDemo}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-mono font-bold text-white transition-colors cursor-pointer"
                    >
                      Open Demo Investigation Workspace
                    </button>
                  </div>
                )
              )}

              {/* VIEW 5: FINAL REPORT */}
              {currentView === 'report' && (
                selectedIncident ? (
                  <FinalReportView
                    incident={selectedIncident}
                    investigation={activeInvestigation}
                    onBackToWorkspace={() => setCurrentView('workspace')}
                    onSelectEvent={(eventId) => {
                      setCurrentView('workspace');
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-4">
                    <p className="text-sm font-mono text-zinc-400">No incident selected for post-mortem generation.</p>
                    <button
                      onClick={handleLaunchDemo}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-mono font-bold text-white transition-colors cursor-pointer"
                    >
                      Generate Report for Demo Incident
                    </button>
                  </div>
                )
              )}
            </>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 bg-zinc-950/40 py-8 px-4 text-center text-xs font-mono text-zinc-400">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-300">BLACKBOX</span>
            <span>— AI Incident Investigator</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-zinc-400">
            <span>FastAPI Backend v0.1.0</span>
            <span>•</span>
            <button
              onClick={() => setShowDiagnosticsModal(true)}
              className="text-emerald-400 hover:underline"
            >
              Test API Connectivity
            </button>
            <span>•</span>
            <a
              href="#incidents-catalog"
              onClick={(e) => {
                e.preventDefault();
                handleScrollToIncidents();
              }}
              className="text-zinc-400 hover:text-zinc-200"
            >
              Demo Vault
            </a>
          </div>
        </div>
      </footer>

      {/* Modals & Acquisition Dialogs */}
      <ApiDiagnosticsModal
        isOpen={showDiagnosticsModal}
        onClose={() => setShowDiagnosticsModal(false)}
        currentHealth={healthResult}
        onHealthUpdated={(res) => setHealthResult(res)}
      />

      <IntegrationsModal
        isOpen={showConnectorsModal}
        onClose={() => setShowConnectorsModal(false)}
        onSelectDemoMode={handleScrollToIncidents}
        onOpenGitHub={() => {
          setShowConnectorsModal(false);
          setShowGitHubModal(true);
        }}
        onOpenSentry={() => {
          setShowConnectorsModal(false);
          setShowSentryModal(true);
        }}
      />

      <IngestionModal
        isOpen={showIngestModal}
        onClose={() => setShowIngestModal(false)}
        onSelectDemoMode={handleScrollToIncidents}
        onImportEvidence={handleImportEvidence}
      />

      <GitHubConnectModal
        isOpen={showGitHubModal}
        onClose={() => setShowGitHubModal(false)}
        onImportEvidence={(result: AcquisitionResult) => {
          handleImportEvidence(result);
          refreshConnectorsStatus();
        }}
      />

      <SentryConnectModal
        isOpen={showSentryModal}
        onClose={() => setShowSentryModal(false)}
        onImportEvidence={(result: AcquisitionResult) => {
          handleImportEvidence(result);
          refreshConnectorsStatus();
        }}
      />

      {/* Collection Feedback Toast */}
      <CollectionSummaryToast
        result={collectionToast}
        onDismiss={() => setCollectionToast(null)}
        onViewTimeline={() => {
          if (selectedIncident) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            handleScrollToIncidents();
          }
        }}
      />
    </div>
  );
}
