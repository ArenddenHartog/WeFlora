import React, { useEffect, useMemo, useState } from 'react';
import type { InputFieldSpec, JsonPointer } from '../../src/decision-program/contracts/types.ts';
import type { ProjectFile } from '../../types';
import FilePicker from '../FilePicker';

interface SessionOption {
  id: string;
  title: string;
}

interface DataIntakePanelProps {
  inputs: InputFieldSpec[];
  availableFiles?: ProjectFile[];
  availableSessions?: SessionOption[];
  runSignal?: number;
  onRun?: (result: { valid: boolean; missing: string[]; values: Record<string, unknown> }) => void;
}

const inferControl = (input: InputFieldSpec) => {
  if (input.ui?.control) return input.ui.control;
  if (Array.isArray(input.schema.type)) return 'text';
  switch (input.schema.type) {
    case 'boolean':
      return 'checkbox';
    case 'number':
    case 'integer':
      return 'number';
    case 'object':
      return 'json';
    case 'array':
      return 'json';
    default:
      return 'text';
  }
};

const toFileLabel = (file: ProjectFile) => file.name ?? file.id;

const DataIntakePanel: React.FC<DataIntakePanelProps> = ({
  inputs,
  availableFiles = [],
  availableSessions = [],
  runSignal,
  onRun
}) => {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [fileSelections, setFileSelections] = useState<Record<string, File | null>>({});
  const [fileRefs, setFileRefs] = useState<Record<string, string>>({});
  const [pointerOverrides, setPointerOverrides] = useState<Record<string, JsonPointer | ''>>({});
  const [sessionReuse, setSessionReuse] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const requiredKeys = useMemo(
    () => inputs.filter((input) => input.required).map((input) => input.key),
    [inputs]
  );

  useEffect(() => {
    if (runSignal === undefined) return;
    const missing: string[] = [];
    for (const input of inputs) {
      if (!input.required) continue;
      const value = values[input.key];
      const hasFile = Boolean(fileSelections[input.key] || fileRefs[input.key]);
      const pointerValue = pointerOverrides[input.key] || input.pointer;
      const hasValue = value !== undefined && value !== null && String(value).trim() !== '';
      if (input.source === 'file' && !hasFile) missing.push(input.label);
      if (input.source === 'pointer' && !pointerValue) missing.push(input.label);
      if (input.source === 'value' && !hasValue) missing.push(input.label);
    }
    setErrors(missing);
    onRun?.({ valid: missing.length === 0, missing, values });
  }, [fileRefs, fileSelections, inputs, onRun, pointerOverrides, runSignal, values]);

  const handleValueChange = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="border-t border-slate-200 pt-6 space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-700">Data intake</h2>
        <p className="mt-1 text-xs text-slate-500">
          Provide required inputs, attach files, map pointers, or reuse a prior session.
        </p>
      </div>

      {availableSessions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-600">Reuse from prior session</label>
          <select
            value={sessionReuse}
            onChange={(event) => setSessionReuse(event.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700"
          >
            <option value="">Select a prior session</option>
            {availableSessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-5">
        {inputs.map((input) => {
          const control = inferControl(input);
          const fileAccept = input.file?.accept?.join(',');
          return (
            <div key={input.key} className="border-b border-slate-100 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{input.label}</p>
                  {input.description ? <p className="mt-1 text-xs text-slate-500">{input.description}</p> : null}
                </div>
                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                  {input.required ? 'Required' : 'Optional'}
                </span>
              </div>

              <div className="mt-3 grid gap-3">
                {input.source === 'value' ? (
                  control === 'textarea' ? (
                    <textarea
                      value={String(values[input.key] ?? '')}
                      onChange={(event) => handleValueChange(input.key, event.target.value)}
                      placeholder={input.ui?.placeholder}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                      rows={4}
                    />
                  ) : control === 'checkbox' ? (
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(values[input.key])}
                        onChange={(event) => handleValueChange(input.key, event.target.checked)}
                      />
                      {input.ui?.placeholder ?? 'Toggle'}
                    </label>
                  ) : control === 'select' ? (
                    <select
                      value={String(values[input.key] ?? '')}
                      onChange={(event) => handleValueChange(input.key, event.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                    >
                      <option value="">Select</option>
                      {(input.ui?.options ?? []).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : control === 'json' ? (
                    <textarea
                      value={String(values[input.key] ?? '')}
                      onChange={(event) => handleValueChange(input.key, event.target.value)}
                      placeholder="Paste JSON"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-700"
                      rows={4}
                    />
                  ) : (
                    <input
                      type={control === 'number' ? 'number' : 'text'}
                      value={String(values[input.key] ?? '')}
                      onChange={(event) => handleValueChange(input.key, event.target.value)}
                      placeholder={input.ui?.placeholder}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                    />
                  )
                ) : null}

                {input.source === 'file' ? (
                  <div className="space-y-2">
                    <FilePicker accept={fileAccept} onPick={(files) => setFileSelections((prev) => ({ ...prev, [input.key]: files?.[0] ?? null }))}>
                      {({ open }) => (
                        <button
                          type="button"
                          onClick={open}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Attach file
                        </button>
                      )}
                    </FilePicker>
                    {fileSelections[input.key] ? (
                      <p className="text-xs text-slate-500">Attached: {fileSelections[input.key]?.name}</p>
                    ) : null}
                    <div>
                      <label className="text-xs font-semibold text-slate-600">Select from Files</label>
                      <select
                        value={fileRefs[input.key] ?? ''}
                        onChange={(event) => setFileRefs((prev) => ({ ...prev, [input.key]: event.target.value }))}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                      >
                        <option value="">Choose a file</option>
                        {availableFiles.map((file) => (
                          <option key={file.id} value={file.id}>
                            {toFileLabel(file)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : null}

                {input.source === 'pointer' ? (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600">Pointer mapping</label>
                    <input
                      value={pointerOverrides[input.key] ?? input.pointer ?? ''}
                      onChange={(event) =>
                        setPointerOverrides((prev) => ({ ...prev, [input.key]: event.target.value as JsonPointer }))
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono text-slate-700"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {errors.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          Missing required inputs: {errors.join(', ')}
        </div>
      ) : null}
    </div>
  );
};

export default DataIntakePanel;
