import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, ScaleControl, useMap } from 'react-leaflet';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import L from 'leaflet';
import buffer from '@turf/buffer';
import { lineString } from '@turf/helpers';
import 'leaflet/dist/leaflet.css';

interface MapPreviewProps {
  geojson: Feature | FeatureCollection | null;
  kind: 'polygon' | 'corridor';
  corridorWidthM?: number;
  municipality?: string | null;
  title?: string | null;
}

const asFeature = (geojson: Feature | FeatureCollection | null): Feature | null => {
  if (!geojson) return null;
  if (geojson.type === 'Feature') return geojson;
  if (geojson.type === 'FeatureCollection') return (geojson.features?.[0] as Feature) ?? null;
  return null;
};

const FitBounds: React.FC<{ feature: Feature | null }> = ({ feature }) => {
  const map = useMap();

  useEffect(() => {
    if (!feature) return;
    const layer = L.geoJSON(feature as any);
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24] });
    }
  }, [feature, map]);

  return null;
};

const MapPreview: React.FC<MapPreviewProps> = ({ geojson, kind, corridorWidthM, municipality, title }) => {
  const feature = useMemo(() => asFeature(geojson), [geojson]);
  const bufferFeature = useMemo(() => {
    if (!feature || kind !== 'corridor' || !corridorWidthM) return null;
    if (feature.geometry?.type !== 'LineString') return null;
    const coords = (feature.geometry.coordinates ?? []) as number[][];
    if (coords.length < 2) return null;
    try {
      return buffer(lineString(coords), corridorWidthM / 2, { units: 'meters' }) as Feature<Geometry>;
    } catch (error) {
      return null;
    }
  }, [corridorWidthM, feature, kind]);

  if (!feature) {
    return <div className="text-xs text-slate-400">No geometry yet.</div>;
  }

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden relative">
      <div className="absolute top-2 left-2 z-[400] bg-white/90 border border-slate-200 rounded-full px-2 py-1 text-[10px] text-slate-600">
        {municipality ?? 'Municipality'} · {title ?? 'Intervention'}
      </div>
      <MapContainer
        className="h-56 w-full"
        scrollWheelZoom={false}
        dragging={false}
        zoomControl={false}
        center={[0, 0]}
        zoom={13}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {feature && (
          <GeoJSON
            data={feature as any}
            style={{ color: '#0f766e', weight: 3, fillColor: '#14b8a6', fillOpacity: 0.2 }}
          />
        )}
        {bufferFeature && (
          <GeoJSON
            data={bufferFeature as any}
            style={{ color: '#0f766e', weight: 2, fillOpacity: 0, dashArray: '4 4' }}
          />
        )}
        <ScaleControl position="bottomleft" />
        <FitBounds feature={feature} />
      </MapContainer>
      {kind === 'corridor' && corridorWidthM ? (
        <div className="px-3 py-2 text-[10px] text-slate-500 border-t border-slate-200">
          Buffer visualization: {corridorWidthM} m corridor width
        </div>
      ) : null}
    </div>
  );
};

export default MapPreview;
