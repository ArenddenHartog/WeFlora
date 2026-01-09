import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { EvidenceEdge, EvidenceGraph, EvidenceNode } from '../../types';

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

  const { nodes, edges } = useMemo(() => clusterGraph(graph ?? { nodes: [], edges: [] }), [graph]);
  const positions = useMemo(() => buildLayout(nodes), [nodes]);
  const connectedNodeIds = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();
    return getConnectedNodeIds(edges, hoveredNodeId);
  }, [edges, hoveredNodeId]);

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
    const fill = node.id === selectedNodeId ? '#c4f0e4' : '#ffffff';
    const stroke = isConnected ? '#0f766e' : '#94a3b8';
    const opacity = isDimmed ? 0.25 : 1;
    return (
      <g
        key={node.id}
        transform={`translate(${position.x}, ${position.y})`}
        onMouseEnter={() => setHoveredNodeId(node.id)}
        onMouseLeave={() => setHoveredNodeId(null)}
        onClick={() => setSelectedNodeId(node.id)}
        style={{ cursor: 'pointer', opacity }}
      >
        <circle r="26" fill={fill} stroke={stroke} strokeWidth="2" />
        <text x="0" y="4" textAnchor="middle" className="text-[10px] fill-slate-700">
          {node.label.length > 18 ? `${node.label.slice(0, 18)}…` : node.label}
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
    return (
      <line
        key={`${edge.from}-${edge.to}-${edge.type}`}
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={isConnected ? '#0f766e' : '#cbd5f5'}
        strokeWidth={isConnected ? 2.5 : 1.2}
        opacity={isDimmed ? 0.2 : 0.8}
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
            onClick={onClose}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>

      <div className="flex-1 relative bg-slate-50">
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
          <div className="absolute top-0 right-0 h-full w-80 border-l border-slate-200 bg-white px-4 py-5 overflow-y-auto">
            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Node</p>
                <h3 className="text-sm font-semibold text-slate-800">{selectedNode.label}</h3>
                <span className="inline-flex mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-weflora-mint/40 text-weflora-teal">
                  {selectedNode.type}
                </span>
              </div>

              {selectedNode.description && <p className="text-xs text-slate-600">{selectedNode.description}</p>}

              {selectedNode.metadata && (
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Metadata</p>
                  <ul className="text-xs text-slate-600 space-y-1">
                    {Object.entries(selectedNode.metadata)
                      .filter(([key]) => key !== 'citations')
                      .map(([key, value]) => (
                        <li key={key} className="flex justify-between gap-2">
                          <span className="text-slate-500">{key}</span>
                          <span className="text-slate-700">{String(value)}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {selectedNode.metadata?.citations && (
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Citations</p>
                  <ul className="text-xs text-slate-600 space-y-1">
                    {selectedNode.metadata.citations.map((citation: { sourceId: string; locator?: { page?: number } }) => (
                      <li key={`${citation.sourceId}-${citation.locator?.page ?? ''}`}>
                        {citation.sourceId}
                        {citation.locator?.page ? ` · p. ${citation.locator.page}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {linkedNodes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Linked items</p>
                  <ul className="text-xs text-slate-600 space-y-1">
                    {linkedNodes.slice(0, 6).map((node) => (
                      <li key={node.id}>{node.label}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedNode.metadata?.timelineEntryId && (
                <button
                  type="button"
                  onClick={() => onJumpToTimelineEntry?.(selectedNode.metadata.timelineEntryId)}
                  className="text-xs font-semibold text-weflora-teal hover:text-weflora-dark"
                >
                  Jump to timeline entry
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EvidenceMap;
