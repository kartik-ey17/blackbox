import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  MarkerType,
  Position,
  Handle,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  GitCommit,
  Sliders,
  AlertCircle,
  Activity,
  Flame,
  ExternalLink,
  ShieldAlert,
  Server,
  FileText,
  Globe,
  Layers,
} from 'lucide-react';
import { EvidenceGraph, EvidenceGraphNode } from '../types/investigation';
import { EvidenceEvent } from '../types/incident';
import { categorizeEvents, buildEvidenceGraph } from '../services/preprocessor';

export type NodeCategoryType = 'DEPLOYMENT' | 'CONFIG_CHANGE' | 'ANOMALY' | 'ERROR' | 'IMPACT';

interface CustomNodeData {
  eventId: string;
  label: string;
  category: NodeCategoryType;
  source: string;
  timestamp: string;
  details: string;
  severity?: string;
  isRootCause?: boolean;
  onSelect: (eventId: string) => void;
}

// Custom Node for React Flow
const EvidenceNodeComponent: React.FC<{ data: CustomNodeData }> = ({ data }) => {
  const getCategoryTheme = (cat: NodeCategoryType) => {
    switch (cat) {
      case 'DEPLOYMENT':
        return {
          bg: 'bg-purple-950/70',
          border: 'border-purple-500/60',
          badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
          icon: <GitCommit className="h-3.5 w-3.5 text-purple-400" />,
          title: 'DEPLOYMENT',
        };
      case 'CONFIG_CHANGE':
        return {
          bg: 'bg-cyan-950/70',
          border: 'border-cyan-500/60',
          badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
          icon: <Sliders className="h-3.5 w-3.5 text-cyan-400" />,
          title: 'CONFIG CHANGE',
        };
      case 'ANOMALY':
        return {
          bg: 'bg-amber-950/70',
          border: 'border-amber-500/60',
          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          icon: <Activity className="h-3.5 w-3.5 text-amber-400" />,
          title: 'ANOMALY',
        };
      case 'IMPACT':
        return {
          bg: 'bg-rose-950/80',
          border: 'border-rose-500/70',
          badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          icon: <Flame className="h-3.5 w-3.5 text-rose-400" />,
          title: 'IMPACT',
        };
      case 'ERROR':
      default:
        return {
          bg: 'bg-red-950/70',
          border: 'border-red-500/60',
          badgeBg: 'bg-red-500/20 text-red-300 border-red-500/40',
          icon: <AlertCircle className="h-3.5 w-3.5 text-red-400" />,
          title: 'ERROR',
        };
    }
  };

  const theme = getCategoryTheme(data.category);

  return (
    <div
      onClick={() => data.onSelect(data.eventId)}
      className={`group relative w-64 rounded-xl border p-3.5 text-left transition-all hover:scale-[1.02] cursor-pointer shadow-lg shadow-black/40 backdrop-blur-md ${
        data.isRootCause
          ? 'border-amber-400 ring-2 ring-amber-400/40 bg-zinc-900/95 shadow-amber-950/50'
          : `${theme.border} ${theme.bg}`
      }`}
    >
      {/* Target input handle on left */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !bg-zinc-500 !border-2 !border-zinc-900"
      />

      {/* Root Cause Banner */}
      {data.isRootCause && (
        <div className="mb-2 flex items-center gap-1 rounded bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-300">
          <ShieldAlert className="h-3 w-3" />
          <span>ROOT CAUSE CANDIDATE</span>
        </div>
      )}

      {/* Header with Category and Source */}
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-mono font-bold tracking-wider ${theme.badgeBg}`}
        >
          {theme.icon}
          {theme.title}
        </span>
        <span className="text-[10px] font-mono text-zinc-400 uppercase">
          {data.source}
        </span>
      </div>

      {/* Title */}
      <h4 className="text-xs font-semibold text-white line-clamp-2 leading-snug group-hover:text-emerald-300 transition-colors">
        {data.label}
      </h4>

      {/* Details summary */}
      <p className="mt-1 text-[11px] text-zinc-300 line-clamp-2 leading-relaxed font-sans">
        {data.details}
      </p>

      {/* Footer Info: Time & Event ID */}
      <div className="mt-2.5 flex items-center justify-between border-t border-zinc-800/80 pt-2 text-[10px] font-mono text-zinc-400">
        <span>{new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC</span>
        <span className="flex items-center gap-1 text-emerald-400/80 group-hover:text-emerald-300">
          <span>{data.eventId}</span>
          <ExternalLink className="h-2.5 w-2.5" />
        </span>
      </div>

      {/* Source output handle on right */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !bg-emerald-500 !border-2 !border-zinc-900"
      />
    </div>
  );
};

const nodeTypes = {
  evidenceNode: EvidenceNodeComponent,
};

export interface ReactFlowEvidenceGraphProps {
  graph?: EvidenceGraph;
  events: EvidenceEvent[];
  selectedEventId?: string | null;
  onSelectEvent: (eventId: string) => void;
  className?: string;
}

export const ReactFlowEvidenceGraph: React.FC<ReactFlowEvidenceGraphProps> = ({
  graph: explicitGraph,
  events,
  selectedEventId,
  onSelectEvent,
  className = '',
}) => {
  // Derive graph deterministically if not explicitly provided
  const graph = useMemo(() => {
    if (explicitGraph && explicitGraph.nodes && explicitGraph.nodes.length > 0) {
      return explicitGraph;
    }
    const categories = categorizeEvents(events);
    return buildEvidenceGraph(events, categories);
  }, [explicitGraph, events]);

  // Helper to categorize accurately
  const categorizeEvent = (evt: EvidenceEvent, rawCat?: string): NodeCategoryType => {
    const text = `${evt.title} ${evt.summary}`.toLowerCase();
    if (
      evt.source === 'deployment' ||
      text.includes('deploy') ||
      text.includes('release') ||
      text.includes('commit')
    ) {
      return 'DEPLOYMENT';
    }
    if (
      text.includes('config') ||
      text.includes('pool size') ||
      text.includes('env') ||
      text.includes('parameter') ||
      text.includes('flag')
    ) {
      return 'CONFIG_CHANGE';
    }
    if (
      text.includes('saturated') ||
      text.includes('exhausted') ||
      text.includes('memory spike') ||
      text.includes('latency') ||
      text.includes('metric')
    ) {
      return 'ANOMALY';
    }
    if (
      text.includes('504') ||
      text.includes('gateway timeout') ||
      text.includes('affected users') ||
      text.includes('outage') ||
      text.includes('degradation')
    ) {
      return 'IMPACT';
    }
    return 'ERROR';
  };

  // Build nodes with multi-tier causal layout
  const { nodes, edges } = useMemo(() => {
    const eventMap = new Map(events.map((e) => [e.id, e]));

    // Group nodes by causal stage for clean left-to-right topological layout
    const stageColumns: Record<NodeCategoryType, EvidenceGraphNode[]> = {
      DEPLOYMENT: [],
      CONFIG_CHANGE: [],
      ANOMALY: [],
      ERROR: [],
      IMPACT: [],
    };

    const nodeCatMap = new Map<string, NodeCategoryType>();

    graph.nodes.forEach((n) => {
      const evt = eventMap.get(n.event_id) || {
        id: n.event_id,
        title: n.label,
        summary: n.details,
        source: n.source,
        timestamp: n.timestamp,
        severity: n.severity || 'medium',
      } as EvidenceEvent;

      const cat = categorizeEvent(evt, n.category);
      nodeCatMap.set(n.id, cat);
      stageColumns[cat].push(n);
    });

    const flowNodes: Node[] = [];
    const colXPositions: Record<NodeCategoryType, number> = {
      DEPLOYMENT: 40,
      CONFIG_CHANGE: 320,
      ANOMALY: 600,
      ERROR: 880,
      IMPACT: 1160,
    };

    // Calculate positions per stage
    Object.entries(stageColumns).forEach(([catKey, colNodes]) => {
      const cat = catKey as NodeCategoryType;
      const x = colXPositions[cat];
      colNodes.forEach((node, idx) => {
        const evt = eventMap.get(node.event_id);
        const y = 60 + idx * 160;

        flowNodes.push({
          id: node.id,
          type: 'evidenceNode',
          position: { x, y },
          data: {
            eventId: node.event_id,
            label: node.label,
            category: cat,
            source: node.source,
            timestamp: node.timestamp,
            details: node.details,
            severity: node.severity,
            isRootCause: node.is_root_cause_candidate || evt?.is_root_cause_candidate,
            onSelect: onSelectEvent,
          },
        });
      });
    });

    // Build flow edges with labels and arrows
    const flowEdges: Edge[] = graph.edges.map((edge) => {
      const isRootCausalEdge =
        edge.relationship_type === 'triggered' ||
        edge.reason.toLowerCase().includes('triggered') ||
        edge.reason.toLowerCase().includes('caused');

      return {
        id: edge.id,
        source: edge.source_node_id,
        target: edge.target_node_id,
        animated: isRootCausalEdge,
        label: edge.reason,
        labelStyle: {
          fill: '#a1a1aa',
          fontSize: 10,
          fontFamily: 'monospace',
        },
        labelBgStyle: {
          fill: '#18181b',
          fillOpacity: 0.9,
          rx: 4,
          ry: 4,
        },
        labelBgPadding: [6, 4] as [number, number],
        style: {
          stroke: isRootCausalEdge ? '#10b981' : '#52525b',
          strokeWidth: isRootCausalEdge ? 2 : 1.5,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: isRootCausalEdge ? '#10b981' : '#71717a',
        },
      };
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [graph, events, onSelectEvent]);

  return (
    <div className={`relative w-full h-[540px] rounded-xl border border-zinc-800 bg-zinc-950/80 overflow-hidden shadow-inner ${className}`}>
      {/* Legend & Controls Overlay */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800/90 bg-zinc-900/90 p-2 backdrop-blur-md text-[11px] font-mono shadow-md">
        <span className="text-zinc-400 font-bold uppercase tracking-wider text-[10px] mr-1">
          Causality Flow:
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 text-purple-300">
          <GitCommit className="h-3 w-3" /> Deployment
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 text-cyan-300">
          <Sliders className="h-3 w-3" /> Config Change
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-amber-300">
          <Activity className="h-3 w-3" /> Anomaly
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-red-500/10 border border-red-500/30 px-2 py-0.5 text-red-300">
          <AlertCircle className="h-3 w-3" /> Error
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 text-rose-300">
          <Flame className="h-3 w-3" /> Impact
        </span>
      </div>

      <div className="absolute top-3 right-3 z-10 rounded-md border border-zinc-800 bg-zinc-900/90 px-2.5 py-1 text-[11px] font-mono text-zinc-400 shadow-sm">
        Click node to inspect event details
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        attributionPosition="bottom-left"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#27272a" />
        <Controls
          className="!border-zinc-800 !bg-zinc-900 !rounded-lg overflow-hidden !shadow-md [&>button]:!border-zinc-800 [&>button]:!bg-zinc-900 [&>button]:!text-zinc-300 hover:[&>button]:!bg-zinc-800"
          showInteractive={false}
        />
        <MiniMap
          nodeColor={(n) => {
            const data = (n.data as unknown) as CustomNodeData;
            switch (data?.category) {
              case 'DEPLOYMENT':
                return '#a855f7';
              case 'CONFIG_CHANGE':
                return '#06b6d4';
              case 'ANOMALY':
                return '#f59e0b';
              case 'IMPACT':
                return '#f43f5e';
              default:
                return '#ef4444';
            }
          }}
          className="!border-zinc-800 !bg-zinc-900/90 !rounded-lg"
          maskColor="rgba(9, 13, 22, 0.7)"
        />
      </ReactFlow>
    </div>
  );
};
