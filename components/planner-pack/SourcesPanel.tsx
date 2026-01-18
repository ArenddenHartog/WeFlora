import React from 'react';
import FilePicker from '../FilePicker';

export interface PlannerSourceItem {
  id: string;
  title: string;
  parseStatus: 'pending' | 'parsed' | 'partial' | 'failed';
  mimeType?: string | null;
}

interface SourcesPanelProps {
  sources: PlannerSourceItem[];
  isUploading: boolean;
  onUpload: (files: File[]) => void;
}

const SourcesPanel: React.FC<SourcesPanelProps> = ({ sources, isUploading, onUpload }) => {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Sources</h3>
        <span className="text-xs text-slate-500">Uploads only</span>
      </div>

      <FilePicker accept=".csv,text/csv" multiple={false} disabled={isUploading} onPick={onUpload}>
        {({ open }) => (
          <button
            onClick={open}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:border-weflora-teal"
          >
            {isUploading ? 'Uploading…' : 'Upload tree inventory (CSV)'}
          </button>
        )}
      </FilePicker>

      <div className="space-y-2">
        {sources.length === 0 ? (
          <div className="text-xs text-slate-400">
            Not connected yet — upload a file or connect later. WeFlora will flag assumptions.
          </div>
        ) : (
          sources.map((source) => (
            <div key={source.id} className="border border-slate-200 rounded-lg p-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">{source.title}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    source.parseStatus === 'parsed'
                      ? 'bg-green-100 text-green-700'
                      : source.parseStatus === 'partial'
                      ? 'bg-yellow-100 text-yellow-700'
                      : source.parseStatus === 'failed'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {source.parseStatus}
                </span>
              </div>
              <div className="text-[10px] text-slate-400">{source.mimeType ?? 'uploaded file'}</div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default SourcesPanel;
