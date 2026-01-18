import React, { useMemo, useState, Suspense } from 'react';
const MapPreview = React.lazy(() => import('./MapPreview'));

interface GeometryStepProps {
  kind: 'polygon' | 'corridor';
  geojsonText: string;
  corridorWidthM: number;
  metrics: { areaM2?: number | null; lengthM?: number | null };
  metricsNote?: string | null;
  error?: string | null;
  onKindChange: (value: 'polygon' | 'corridor') => void;
  onGeojsonChange: (value: string) => void;
  onCorridorWidthChange: (value: number) => void;
  onCompute: () => void;
  municipality?: string | null;
  title?: string | null;
}

const GeometryStep: React.FC<GeometryStepProps> = ({
  kind,
  geojsonText,
  corridorWidthM,
  metrics,
  metricsNote,
  error,
  onKindChange,
  onGeojsonChange,
  onCorridorWidthChange,
  onCompute,
  municipality,
  title
}) => {
  const [inputMode, setInputMode] = useState<'paste' | 'upload' | 'draw'>('paste');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const parsedGeojson = useMemo(() => {
    if (!geojsonText.trim()) return null;
    try {
      return JSON.parse(geojsonText);
    } catch (err) {
      return null;
    }
  }, [geojsonText]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    onGeojsonChange(text);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Geometry</h3>
          <p className="text-[11px] text-slate-500">Follow the steps to confirm geometry and metrics.</p>
        </div>
        <button
          onClick={() => setAdvancedOpen((prev) => !prev)}
          className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
        >
          {advancedOpen ? 'Hide advanced' : 'Advanced'}
        </button>
      </div>

      <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-3">
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
          <span className="bg-slate-100 px-2 py-1 rounded-full">Step 1</span>
          <span>Select geometry type</span>
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
            <div className="mt-1 text-[10px] text-slate-400">
              Corridor = line buffered by width to evaluate greening impact.
            </div>
          </label>
        )}
      </div>

      <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-3">
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
          <span className="bg-slate-100 px-2 py-1 rounded-full">Step 2</span>
          <span>Provide geometry</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setInputMode('paste')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              inputMode === 'paste'
                ? 'bg-weflora-mint/30 border-weflora-teal text-weflora-dark'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            Paste
          </button>
          <button
            onClick={() => setInputMode('upload')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              inputMode === 'upload'
                ? 'bg-weflora-mint/30 border-weflora-teal text-weflora-dark'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            Upload GeoJSON
          </button>
          <button
            onClick={() => setInputMode('draw')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              inputMode === 'draw'
                ? 'bg-slate-100 border-slate-300 text-slate-400'
                : 'bg-white border-slate-200 text-slate-400'
            }`}
            disabled
          >
            Draw (read-only map)
          </button>
        </div>
        {inputMode === 'paste' && (
          <label className="text-xs text-slate-600">
            Paste GeoJSON
            <textarea
              value={geojsonText}
              onChange={(event) => onGeojsonChange(event.target.value)}
              rows={5}
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
              placeholder='{"type":"Feature","geometry":{"type":"Polygon","coordinates":[...]}}'
            />
          </label>
        )}
        {inputMode === 'upload' && (
          <label className="text-xs text-slate-600">
            Upload a GeoJSON file
            <input
              type="file"
              accept=".geojson,application/geo+json,application/json"
              onChange={handleUpload}
              className="mt-2 block w-full text-xs text-slate-500"
            />
          </label>
        )}
        {inputMode === 'draw' && (
          <div className="text-xs text-slate-500">
            Drawing tools are not enabled in v1.1. Use paste or upload to continue.
          </div>
        )}

        {advancedOpen && (
          <div className="border-t border-slate-200 pt-3">
            <label className="text-xs text-slate-600">
              Raw GeoJSON (advanced)
              <textarea
                value={geojsonText}
                onChange={(event) => onGeojsonChange(event.target.value)}
                rows={6}
                className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
              />
            </label>
          </div>
        )}
      </div>

      <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-3">
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
          <span className="bg-slate-100 px-2 py-1 rounded-full">Step 3</span>
          <span>Preview & metrics</span>
        </div>
        {error && <div className="text-xs text-red-600">{error}</div>}
        {metricsNote && <div className="text-[11px] text-amber-600">{metricsNote}</div>}
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
              {metrics.lengthM ? `${Math.round(metrics.lengthM)} m` : metricsNote ? 'placeholder' : '—'}
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-2">
            <div className="text-slate-500">Area</div>
            <div className="font-semibold text-slate-800">
              {metrics.areaM2 ? `${Math.round(metrics.areaM2)} m²` : metricsNote ? 'placeholder' : '—'}
            </div>
          </div>
        </div>

        <Suspense fallback={<div className="text-xs text-slate-400">Loading map preview…</div>}>
          <MapPreview
            geojson={parsedGeojson}
            kind={kind}
            corridorWidthM={corridorWidthM}
            municipality={municipality}
            title={title}
          />
        </Suspense>
      </div>
    </section>
  );
};

export default GeometryStep;
