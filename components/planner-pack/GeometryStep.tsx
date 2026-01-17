import React from 'react';

interface GeometryStepProps {
  kind: 'polygon' | 'corridor';
  geojsonText: string;
  corridorWidthM: number;
  metrics: { areaM2?: number | null; lengthM?: number | null };
  error?: string | null;
  onKindChange: (value: 'polygon' | 'corridor') => void;
  onGeojsonChange: (value: string) => void;
  onCorridorWidthChange: (value: number) => void;
  onCompute: () => void;
}

const GeometryStep: React.FC<GeometryStepProps> = ({
  kind,
  geojsonText,
  corridorWidthM,
  metrics,
  error,
  onKindChange,
  onGeojsonChange,
  onCorridorWidthChange,
  onCompute
}) => {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Geometry</h3>
        <span className="text-xs text-slate-500">Polygon or corridor line</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onKindChange('polygon')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
            kind === 'polygon'
              ? 'bg-weflora-mint/30 border-weflora-teal text-weflora-dark'
              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
          }`}
        >
          Polygon
        </button>
        <button
          onClick={() => onKindChange('corridor')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
            kind === 'corridor'
              ? 'bg-weflora-mint/30 border-weflora-teal text-weflora-dark'
              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
          }`}
        >
          Corridor
        </button>
      </div>

      {kind === 'corridor' && (
        <label className="text-xs text-slate-600">
          Corridor width (m)
          <input
            type="number"
            min={1}
            value={corridorWidthM}
            onChange={(event) => onCorridorWidthChange(Number(event.target.value))}
            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
          />
        </label>
      )}

      <label className="text-xs text-slate-600">
        GeoJSON
        <textarea
          value={geojsonText}
          onChange={(event) => onGeojsonChange(event.target.value)}
          rows={6}
          className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
          placeholder='{"type":"Feature","geometry":{"type":"Polygon","coordinates":[...]}}'
        />
      </label>

      {error && <div className="text-xs text-red-600">{error}</div>}

      <button
        onClick={onCompute}
        className="w-full px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800"
      >
        Compute metrics
      </button>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-slate-500">Length</div>
          <div className="font-semibold text-slate-800">
            {metrics.lengthM ? `${Math.round(metrics.lengthM)} m` : '—'}
          </div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-slate-500">Area</div>
          <div className="font-semibold text-slate-800">
            {metrics.areaM2 ? `${Math.round(metrics.areaM2)} m²` : '—'}
          </div>
        </div>
      </div>
    </section>
  );
};

export default GeometryStep;
