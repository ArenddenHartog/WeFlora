import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { EvidenceEdge, EvidenceGraph, EvidenceNode } from '../../types';
import { computeConfidenceGraph } from '../../evidence/confidence';
import { computeEffectiveImpact } from '../../evidence/impact';
import { simulateScenario, type ScenarioPatch } from '../../evidence/simulate';
import EvidenceMapControls from './EvidenceMapControls';
import NodeDetailsPanel from './NodeDetailsPanel';

type EvidenceMapView = 'decision' | 'constraint' | 'source';

const typeOrder: EvidenceNode['type'][] = ['source', 'claim', 'constraint', 'skill', 'artifact', 'decision'];
const clusterableTypes = new Set<EvidenceNode['type']>(['source', 'claim']);

const viewLabels: Record<EvidenceMapView, string> = {
  decision: 'Decision-centric',
  constraint: 'Constraint-centric',
  source: 'Source-centric'
};

const buildClusterLabel = (type: EvidenceNode['type'], count: number) => {
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  return `${label} (${count})`;
};

const clusterGraph = (graph: EvidenceGraph, limit = 7) => {
  const nodesByType = typeOrder.reduce<Record<string, EvidenceNode[]>>((acc, type) => {
    acc[type] = graph.nodes.filter((node) => node.type === type);
    return acc;
  }, {});
  const clusterMap = new Map<string, string>();
  const clusteredNodes: EvidenceNode[] = [];
  typeOrder.forEach((type) => {
    const nodes = nodesByType[type] ?? [];
    if (!clusterableTypes.has(type) || nodes.length <= limit) {
      nodes.forEach((node) => clusteredNodes.push(node));
      return;
    }
    const clusterId = `cluster:${type}`;
    nodes.forEach((node) => clusterMap.set(node.id, clusterId));
    clusteredNodes.push({
      id: clusterId,
      type,
      label: buildClusterLabel(type, nodes.length),
      description: `Grouped ${type} evidence items`,
      metadata: { clusterNodeIds: nodes.map((node) => node.id) }
    });
  });

  const edgeMap = new Map<string, EvidenceEdge>();
  graph.edges.forEach((edge) => {
    const from = clusterMap.get(edge.from) ?? edge.from;
    const to = clusterMap.get(edge.to) ?? edge.to;
    if (from === to) return;
    const key = `${from}-${to}-${edge.type}`;
    if (!edgeMap.has(key)) {
      edgeMap.set(key, { ...edge, from, to });
    }
  });

  return { nodes: clusteredNodes, edges: [...edgeMap.values()] };
};

const getConnectedNodeIds = (edges: EvidenceEdge[], nodeId: string) => {
  const connected = new Set<string>();
  edges.forEach((edge) => {
    if (edge.from === nodeId) connected.add(edge.to);
    if (edge.to === nodeId) connected.add(edge.from);
  });
  return connected;
};

const buildLayout = (nodes: EvidenceNode[]) => {
  const columnWidth = 220;
  const rowHeight = 120;
  const padding = 80;
  const grouped = typeOrder.reduce<Record<string, EvidenceNode[]>>((acc, type) => {
    acc[type] = nodes.filter((node) => node.type === type);
    return acc;
  }, {});
  const positions = new Map<string, { x: number; y: number }>();
  typeOrder.forEach((type, columnIndex) => {
    const columnNodes = grouped[type] ?? [];
    columnNodes.forEach((node, rowIndex) => {
      positions.set(node.id, {
        x: padding + columnIndex * columnWidth,
        y: padding + rowIndex * rowHeight
      });
    });
  });
  return positions;
};

const formatConfidence = (value?: number) => (typeof value === 'number' ? `${Math.round(value * 100)}%` : '--');

export interface EvidenceMapProps {
  graph?: EvidenceGraph;
  isOpen: boolean;
  focusNodeId?: string | null;
  onClose: () => void;
  onJumpToTimelineEntry?: (entryId: string) => void;
}

const EvidenceMap: React.FC<EvidenceMapProps> = ({ graph, isOpen, focusNodeId, onClose, onJumpToTimelineEntry }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 1200, height: 720 });
  const [viewMode, setViewMode] = useState<EvidenceMapView>('decision');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const [whatIfOpen, setWhatIfOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConstraintId, setSelectedConstraintId] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState<string | number | boolean | null>(null);
  const [assumeConfidence, setAssumeConfidence] = useState(0.95);
  const [overrideEvidence, setOverrideEvidence] = useState(false);
  const [scenarioPatches, setScenarioPatches] = useState<ScenarioPatch[]>([]);

  const baselineGraph = useMemo(() => computeConfidenceGraph(graph ?? { nodes: [], edges: [] }), [graph]);
  const constraintNodes = useMemo(
    () => baselineGraph.nodes.filter((node) => node.type === 'constraint'),
    [baselineGraph.nodes]
  );
  const selectedConstraint = constraintNodes.find((node) => node.id === selectedConstraintId) ?? null;

  useEffect(() => {
    if (!constraintNodes.length) return;
    if (selectedConstraintId && constraintNodes.some((node) => node.id === selectedConstraintId)) return;
    setSelectedConstraintId(constraintNodes[0]?.id ?? null);
  }, [constraintNodes, selectedConstraintId]);

  useEffect(() => {
    if (!selectedConstraint) return;
    const nextValue =
      selectedConstraint.value ??
      selectedConstraint.metadata?.value ??
      selectedConstraint.metadata?.summary ??
      '';
    setDraftValue(nextValue as string | number | boolean);
    const nextConfidence =
      typeof selectedConstraint.confidence === 'number' ? selectedConstraint.confidence : 0.95;
    setAssumeConfidence(Math.min(0.98, Math.max(0.5, nextConfidence)));
  }, [selectedConstraint]);

  useEffect(() => {
    if (!whatIfOpen) {
      setScenarioPatches([]);
      return;
    }
    if (!selectedConstraintId) return;
    const timer = window.setTimeout(() => {
      const patch: ScenarioPatch = {
        nodeId: selectedConstraintId,
        mode: overrideEvidence ? 'overrideEvidence' : 'adjust',
        patch: {
          value: draftValue,
          confidence: assumeConfidence,
          confidenceSource: 'user'
        }
      };
      setScenarioPatches((prev) => [...prev.filter((entry) => entry.nodeId !== patch.nodeId), patch]);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [whatIfOpen, selectedConstraintId, draftValue, assumeConfidence, overrideEvidence]);

  const scenario = useMemo(
    () => ({ id: 'what-if', name: 'What-if', patches: scenarioPatches }),
    [scenarioPatches]
  );

  const simulation = useMemo(() => {
    if (!whatIfOpen) return null;
    return simulateScenario(baselineGraph, scenario);
  }, [baselineGraph, scenario, whatIfOpen]);

  const displayGraph = simulation?.graphOverlay ?? baselineGraph;

  const { nodes, edges } = useMemo(() => clusterGraph(displayGraph), [displayGraph]);
  const positions = useMemo(() => buildLayout(nodes), [nodes]);
  const connectedNodeIds = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();
    return getConnectedNodeIds(edges, hoveredNodeId);
  }, [edges, hoveredNodeId]);

  const nodesById = useMemo(() => new Map(displayGraph.nodes.map((node) => [node.id, node])), [displayGraph.nodes]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setViewport({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setViewMode('decision');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!nodes.length) return;
    const targetNodeId =
      focusNodeId ??
      nodes.find((node) => node.type === (viewMode === 'decision' ? 'decision' : viewMode))?.id ??
      nodes[0]?.id;
    if (!targetNodeId) return;
    const position = positions.get(targetNodeId);
    if (!position) return;
    setSelectedNodeId(targetNodeId ?? null);
    setScale(1);
    setOffset({
      x: viewport.width / 2 - position.x,
      y: viewport.height / 2 - position.y
    });
  }, [focusNodeId, isOpen, nodes, positions, viewMode, viewport.width, viewport.height]);

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    const delta = -event.deltaY * 0.001;
    setScale((prev) => Math.min(1.8, Math.max(0.6, prev + delta)));
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    dragState.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y
    };
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!dragState.current) return;
    const deltaX = event.clientX - dragState.current.startX;
    const deltaY = event.clientY - dragState.current.startY;
    setOffset({
      x: dragState.current.originX + deltaX,
      y: dragState.current.originY + deltaY
    });
  };

  const handlePointerUp = () => {
    dragState.current = null;
  };

  const renderNode = (node: EvidenceNode) => {
    const position = positions.get(node.id);
    if (!position) return null;
    const isConnected = hoveredNodeId && (node.id === hoveredNodeId || connectedNodeIds.has(node.id));
    const isDimmed = hoveredNodeId && !isConnected;
    const nodeConfidence = node.confidence ?? node.confidenceBase ?? 0.6;
    const opacity = isDimmed ? 0.2 : 0.5 + nodeConfidence * 0.5;
    const isSelected = node.id === selectedNodeId;
    return (
      <g
        key={node.id}
        transform={`translate(${position.x}, ${position.y})`}
        onMouseEnter={() => setHoveredNodeId(node.id)}
        onMouseLeave={() => setHoveredNodeId(null)}
        onClick={() => setSelectedNodeId(node.id)}
        style={{ cursor: 'pointer', opacity }}
      >
        <circle
          r="26"
          className={isSelected ? 'fill-weflora-mint/40 stroke-weflora-teal' : 'fill-white stroke-slate-300'}
          strokeWidth="2"
        />
        <text x="0" y="2" textAnchor="middle" className="text-[10px] fill-slate-700">
          {node.label.length > 18 ? `${node.label.slice(0, 18)}…` : node.label}
        </text>
        <text x="0" y="16" textAnchor="middle" className="text-[9px] fill-slate-400">
          {formatConfidence(node.confidence)}
        </text>
      </g>
    );
  };

  const renderEdge = (edge: EvidenceEdge) => {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) return null;
    const isConnected = hoveredNodeId && (edge.from === hoveredNodeId || edge.to === hoveredNodeId);
    const isDimmed = hoveredNodeId && !isConnected;
    const sourceNode = nodesById.get(edge.from);
    const constraintConfidence = sourceNode?.confidence ?? 0.6;
    const impact = Math.abs(computeEffectiveImpact(edge, constraintConfidence));
    const baseWeight = ['influences', 'filters', 'scores'].includes(edge.type)
      ? impact
      : edge.confidence ?? edge.weight ?? 0.4;
    const strokeWidth = 1 + Math.min(3, baseWeight * 3);
    return (
      <line
        key={`${edge.from}-${edge.to}-${edge.type}`}
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        className={isConnected ? 'stroke-weflora-teal' : 'stroke-slate-300'}
        strokeWidth={isConnected ? strokeWidth + 1 : strokeWidth}
        opacity={isDimmed ? 0.15 : 0.65}
        strokeDasharray={edge.polarity === 'negative' ? '4 3' : undefined}
      />
    );
  };

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const linkedNodes = selectedNode
    ? edges
        .filter((edge) => edge.from === selectedNode.id || edge.to === selectedNode.id)
        .map((edge) => (edge.from === selectedNode.id ? edge.to : edge.from))
        .map((id) => nodes.find((node) => node.id === id))
        .filter((node): node is EvidenceNode => Boolean(node))
    : [];

  const selectedTensions = selectedNode
    ? simulation?.diff.evidenceTensions.find((entry) => entry.nodeId === selectedNode.id)?.conflictingSourceIds
    : undefined;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/70">
      <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Evidence map</h2>
          <p className="text-xs text-slate-500">Explore how evidence, constraints, and decisions connect.</p>
        </div>
        <div className="flex items-center gap-2">
          {(Object.keys(viewLabels) as EvidenceMapView[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                viewMode === mode
                  ? 'border-weflora-teal text-weflora-teal bg-weflora-mint/20'
                  : 'border-slate-200 text-slate-500'
              }`}
            >
              {viewLabels[mode]}
            </button>
          ))}
          <button
            onClick={() => setWhatIfOpen((prev) => !prev)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
              whatIfOpen
                ? 'border-weflora-teal text-weflora-teal bg-weflora-mint/20'
                : 'border-slate-200 text-slate-600'
            }`}
          >
            What-if
          </button>
          <button
            onClick={onClose}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>

      <div className="flex-1 relative bg-slate-50">
        <EvidenceMapControls
          isOpen={whatIfOpen}
          constraints={constraintNodes}
          selectedConstraint={selectedConstraint}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          onSelectConstraint={setSelectedConstraintId}
          value={draftValue}
          onValueChange={setDraftValue}
          confidence={assumeConfidence}
          onConfidenceChange={setAssumeConfidence}
          overrideEvidence={overrideEvidence}
          onOverrideEvidenceChange={setOverrideEvidence}
          diff={simulation?.diff}
        />

        <div
          ref={containerRef}
          className="absolute inset-0"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {nodes.length === 0 ? (
            <div className="h-full w-full flex items-center justify-center text-sm text-slate-400">
              No evidence graph available yet.
            </div>
          ) : (
            <svg className="h-full w-full">
              <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
                {edges.map(renderEdge)}
                {nodes.map(renderNode)}
              </g>
            </svg>
          )}
        </div>

        {selectedNode && (
          <NodeDetailsPanel
            node={selectedNode}
            linkedNodes={linkedNodes}
            onJumpToTimelineEntry={onJumpToTimelineEntry}
            conflictingSources={selectedTensions}
          />
        )}
      </div>
    </div>
  );
};

export default EvidenceMap;
