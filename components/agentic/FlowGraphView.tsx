import React, { useMemo } from 'react';
import { agentProfilesContract } from '../../src/agentic/registry/agents';

export interface FlowGraphStep {
  id: string;
  title: string;
  skills: string[];
}

export interface FlowGraphViewProps {
  steps: FlowGraphStep[];
  /** Highlight the active/running step index */
  activeStepIndex?: number;
  /** Compact layout */
  compact?: boolean;
  className?: string;
}

const NODE_WIDTH = 160;
const NODE_HEIGHT = 72;
const GAP = 48;

const FlowGraphView: React.FC<FlowGraphViewProps> = ({
  steps,
  activeStepIndex = -1,
  compact = false,
  className = ''
}) => {
  const positions = useMemo(() => {
    const width = compact ? 120 : NODE_WIDTH;
    const height = compact ? 56 : NODE_HEIGHT;
    const gap = compact ? 32 : GAP;
    const len = steps.length;
    return Array.from({ length: len }, (_, i) => ({
      x: 24 + i * (width + gap),
      y: 24,
      width,
      height
    }));
  }, [steps.length, compact]);

  const totalWidth = useMemo(() => {
    if (steps.length === 0) return 200;
    const last = positions[steps.length - 1];
    return last.x + last.width + GAP + 24;
  }, [positions, steps.length]);

  const totalHeight = useMemo(() => {
    const h = compact ? 56 : NODE_HEIGHT;
    return h + 48;
  }, [compact]);

  return (
    <div className={`rounded-xl border border-slate-100 bg-slate-50/30 overflow-auto ${className}`}>
      <svg
        width={totalWidth}
        height={totalHeight}
        className="min-w-full"
      >
        {/* Connector arrows between nodes */}
        {steps.length > 1 && positions.slice(0, -1).map((pos, i) => {
          const next = positions[i + 1];
          const fromX = pos.x + pos.width;
          const fromY = pos.y + pos.height / 2;
          const toX = next.x;
          const toY = next.y + next.height / 2;
          const ctrlX = (fromX + toX) / 2;
          return (
            <g key={`arrow-${i}`}>
              <path
                d={`M ${fromX} ${fromY} C ${ctrlX} ${fromY}, ${ctrlX} ${toY}, ${toX} ${toY}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                className="text-weflora-teal/50"
              />
              <polygon
                points={`${toX - 8},${toY - 4} ${toX - 8},${toY + 4} ${toX},${toY}`}
                className="fill-weflora-teal/60"
              />
            </g>
          );
        })}

        {/* Nodes */}
        {steps.map((step, index) => {
          const pos = positions[index];
          const isActive = index === activeStepIndex;
          const skillProfiles = step.skills
            .map((id) => agentProfilesContract.find((p) => p.id === id))
            .filter(Boolean);
          const labels = skillProfiles.map((p) => (p as { title: string }).title);

          return (
            <g key={step.id} transform={`translate(${pos.x}, ${pos.y})`}>
              <rect
                width={pos.width}
                height={pos.height}
                rx={8}
                ry={8}
                fill={isActive ? '#159F9A' : '#f8fafc'}
                stroke={isActive ? '#159F9A' : 'rgba(21, 159, 154, 0.15)'}
                strokeWidth={1}
                className="cursor-default"
              />
              <text
                x={pos.width / 2}
                y={compact ? 20 : 24}
                textAnchor="middle"
                className={`text-[11px] font-semibold ${isActive ? 'fill-white' : 'fill-slate-700'}`}
              >
                {step.title}
              </text>
              <text
                x={pos.width / 2}
                y={compact ? 36 : 44}
                textAnchor="middle"
                className={`text-[9px] ${isActive ? 'fill-white/90' : 'fill-slate-500'}`}
              >
                {labels[0] ?? step.skills[0] ?? '—'}
                {labels.length > 1 ? ` +${labels.length - 1}` : ''}
              </text>
            </g>
          );
        })}

        {/* End node */}
        {steps.length > 0 && (
          <g transform={`translate(${positions[steps.length - 1].x + positions[steps.length - 1].width + GAP}, 24)`}>
            <rect
              width={compact ? 80 : 100}
              height={compact ? 56 : NODE_HEIGHT}
              rx={8}
              ry={8}
              className="fill-weflora-teal/10 stroke-weflora-teal/40 stroke-2"
            />
            <text
              x={(compact ? 80 : 100) / 2}
              y={(compact ? 56 : NODE_HEIGHT) / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs font-bold fill-weflora-teal"
            >
              End
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

export default FlowGraphView;
