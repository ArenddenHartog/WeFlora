import React from 'react';
import FilePicker from '../../FilePicker';
import { FILE_VALIDATION, VaultObject, VaultLink } from '../../../services/fileService';
import { FileSheetIcon, FilePdfIcon, FileCodeIcon } from '../../icons';

export type VaultUploadItem = {
  vaultObject: VaultObject;
  projectLink?: VaultLink | null;
};

interface StepVaultProps {
  vaultItems: VaultUploadItem[];
  isUploading: boolean;
  saveToProject: boolean;
  selectedProjectId: string;
  projectOptions: Array<{ id: string; name: string }>;
  onToggleSaveToProject: (value: boolean) => void;
  onProjectChange: (value: string) => void;
  onUpload: (files: File[]) => void;
}

const getFileIcon = (mimeType: string, filename: string) => {
  if (mimeType.includes('pdf') || filename.endsWith('.pdf')) return FilePdfIcon;
  if (mimeType.includes('spreadsheet') || filename.endsWith('.xlsx') || filename.endsWith('.csv')) return FileSheetIcon;
  return FileCodeIcon;
};

const StepVault: React.FC<StepVaultProps> = ({
  vaultItems,
  isUploading,
  saveToProject,
  selectedProjectId,
  projectOptions,
  onToggleSaveToProject,
  onProjectChange,
  onUpload
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Upload inputs</h2>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilePicker accept={FILE_VALIDATION.ACCEPTED_FILE_TYPES} multiple onPick={onUpload}>
          {({ open }) => (
            <button
              type="button"
              onClick={open}
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              {isUploading ? 'Uploading…' : 'Upload files'}
            </button>
          )}
        </FilePicker>
        <label className="inline-flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={saveToProject}
            onChange={(event) => onToggleSaveToProject(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-weflora-teal focus:ring-weflora-teal"
          />
          Also link to selected project
        </label>
        {saveToProject ? (
          <select
            value={selectedProjectId}
            onChange={(event) => onProjectChange(event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700"
          >
            <option value="">Select project…</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="text-base font-semibold text-slate-900">Uploaded items</h3>
        {vaultItems.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No uploads yet.</p>
        ) : (
          <div className="mt-4 divide-y divide-slate-200 border border-slate-200">
            {vaultItems.map((item) => {
              const Icon = getFileIcon(item.vaultObject.mimeType, item.vaultObject.filename);
              return (
                <div key={item.vaultObject.id} className="flex items-center justify-between gap-4 py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-weflora-mint/15 text-weflora-teal flex items-center justify-center">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.vaultObject.filename}</p>
                      <p className="text-xs text-slate-500">{(item.vaultObject.sizeBytes / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  {item.projectLink ? (
                    <span className="text-xs text-slate-500">Linked to project</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StepVault;
