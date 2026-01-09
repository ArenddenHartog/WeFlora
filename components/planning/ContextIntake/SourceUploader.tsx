import React, { useState } from 'react';

export interface SourceUploaderProps {
  locationHint: string;
  sources: Array<{ title: string }>;
  onLocationHintChange: (value: string) => void;
  onAddFiles: (files: FileList) => void;
  onContinue: () => void;
  isBusy?: boolean;
}

const SourceUploader: React.FC<SourceUploaderProps> = ({
  locationHint,
  sources,
  onLocationHintChange,
  onAddFiles,
  onContinue,
  isBusy
}) => {
  const [dragActive, setDragActive] = useState(false);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Add context</h2>
        <p className="text-sm text-slate-500">
          Upload planning documents or drop a location hint to jump-start extraction.
        </p>
      </div>

      <label
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 text-sm text-slate-500 transition ${
          dragActive ? 'border-weflora-teal bg-weflora-mint/20' : 'border-slate-200 bg-white'
        }`}
        onDragEnter={() => setDragActive(true)}
        onDragLeave={() => setDragActive(false)}
      >
        <input
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.docx,.csv,.xlsx,.geojson,.zip"
          onChange={(event) => {
            if (event.target.files) {
              onAddFiles(event.target.files);
              event.target.value = '';
            }
          }}
        />
        <span className="font-semibold">Upload context files</span>
        <span className="text-xs text-slate-400">PDF, DOCX, CSV, XLSX, GeoJSON, or zipped shapefile</span>
      </label>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">Location hint</label>
        <input
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="e.g., 3rd Ave corridor near civic plaza"
          value={locationHint}
          onChange={(event) => onLocationHintChange(event.target.value)}
        />
      </div>

      {sources.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sources ready</p>
          <ul className="space-y-2 text-sm text-slate-600">
            {sources.map((source) => (
              <li key={source.title} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-weflora-teal" />
                {source.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          disabled={isBusy}
          className="text-sm font-semibold px-4 py-2 rounded-lg bg-weflora-teal text-white hover:bg-weflora-dark disabled:opacity-60"
        >
          {isBusy ? 'Extracting…' : 'Extract claims'}
        </button>
      </div>
    </div>
  );
};

export default SourceUploader;
