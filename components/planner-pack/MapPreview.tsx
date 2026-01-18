import React from 'react';

interface MapPreviewProps {
  geojsonText: string;
  kind: 'polygon' | 'corridor';
  corridorWidthM?: number;
}

const safeParse = (text: string) => {
  try {
    return { value: JSON.parse(text), error: null } as { value: any; error: string | null };
  } catch (error) {
    return { value: null, error: 'Invalid geometry' };
  }
};

const extractCoordinates = (geojson: any): number[][][] => {
  if (!geojson) return [];
  if (geojson.type === 'Feature') {
    return geojson.geometry?.coordinates ?? [];
  }
  if (geojson.type === 'FeatureCollection') {
    const geometry = geojson.features?.[0]?.geometry;
    return geometry?.coordinates ?? [];
  }
  return geojson.geometry?.coordinates ?? geojson.coordinates ?? [];
};

const flattenCoords = (coords: any): number[][] => {
  if (!Array.isArray(coords)) return [];
  if (typeof coords[0]?.[0] === 'number') return coords as number[][];
  return coords.flatMap((item: any) => flattenCoords(item));
};

const MapPreview: React.FC<MapPreviewProps> = ({ geojsonText, kind, corridorWidthM }) => {
  if (!geojsonText.trim()) {
    return <div className="text-xs text-slate-400">No geometry yet.</div>;
  }

  const parsed = safeParse(geojsonText);
  if (!parsed.value) {
    return <div className="text-xs text-red-600">Invalid geometry</div>;
  }

  const coords = flattenCoords(extractCoordinates(parsed.value));
  if (coords.length === 0) {
    return <div className="text-xs text-red-600">Invalid geometry</div>;
  }

  const xs = coords.map((c) => c[0]);
  const ys = coords.map((c) => c[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX || 1;
  const height = maxY - minY || 1;

  const scale = 160 / Math.max(width, height);
  const toPoint = (coord: number[]) => {
    const x = (coord[0] - minX) * scale + 10;
    const y = (maxY - coord[1]) * scale + 10;
    return `${x},${y}`;
  };

  const points = coords.map(toPoint).join(' ');

  return (
    <div className="border border-slate-200 rounded-lg p-2 bg-white">
      <div className="text-[10px] text-slate-400 mb-2">Map preview</div>
      <svg width={200} height={200} className="bg-slate-50 rounded">
        <rect x={0} y={0} width={200} height={200} fill="#f8fafc" stroke="#e2e8f0" />
        {kind === 'polygon' ? (
          <polygon points={points} fill="rgba(14, 116, 144, 0.12)" stroke="#0f766e" strokeWidth={2} />
        ) : (
          <polyline points={points} fill="none" stroke="#0f766e" strokeWidth={2} />
        )}
      </svg>
      {kind === 'corridor' && corridorWidthM ? (
        <div className="text-[10px] text-slate-500 mt-2">Buffered width: {corridorWidthM} m</div>
      ) : null}
    </div>
  );
};

export default MapPreview;
