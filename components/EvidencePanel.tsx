import React from 'react';
import { XIcon, SparklesIcon, DatabaseIcon, InfoIcon, TagIcon, ClockIcon } from './icons';
import { useUI } from '../contexts/UIContext';
import { SKILL_TEMPLATES, SkillTemplateId } from '../services/skillTemplates';

const EvidencePanel: React.FC = () => {
  const { activeEvidence, closeEvidencePanel } = useUI();
  if (!activeEvidence) return null;

  const sources = activeEvidence.sources || [];
  
  // Extract extra metadata if available (from MatrixView double-click)
  // The 'provenance' object might be passed via activeEvidence.provenance if extended,
  // but currently MatrixView passes specific fields into label/sources/generatedAt.
  // Ideally, we'd refactor useUI to accept a richer object, but for now we can infer or 
  // rely on what was passed.
  // Wait, MatrixView passes: label, sources, generatedAt.
  // To support PR-S6 fully (Reasoning, Template Info, etc.), we need to update the UIContext type 
  // or overload 'label' / add new fields.
  // Let's assume UIContext was updated or we abuse the existing fields for now?
  // Actually, let's check UIContext. It has `EvidenceProvenance` type.
  // We should ideally extend `EvidenceProvenance` in `types.ts` or `contexts/UIContext.tsx`
  // but instructions said "Ensure this does not conflict...".
  // The user prompt said "Evidence panel content: DisplayValue, Reasoning...".
  // I will check `contexts/UIContext.tsx` again to see if I can add fields safely.
  
  // Checking UIContext... it defines EvidenceProvenance as { label, sources, generatedAt }.
  // I'll update UIContext locally in this file if I can't touch it, but better to update UIContext 
  // to support the richer data demanded by PR-S6.
  // Actually, I can just cast activeEvidence to `any` for now to access new fields if I update the caller 
  // to pass them, BUT `activeEvidence` is typed.
  // I will update UIContext types in a separate tool call if needed, but for now let's just 
  // assume `activeEvidence` can hold extra fields (TS might complain).
  //
  // Let's see if I can render what I have.
  // MatrixView passes:
  // openEvidencePanel({
  //    label: `Column evidence • ${col.title}`,
  //    sources: ...,
  //    generatedAt: ...
  //    // I need to pass reasoning, displayValue, templateId, etc. here.
  // })
  
  const extendedEvidence = activeEvidence as any;

  return (
    <aside className="absolute top-0 right-0 bottom-0 w-[400px] max-w-[85vw] bg-white border-l border-slate-200 shadow-xl z-40 flex flex-col animate-slideLeft">
      {/* Header */}
      <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 flex-none">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <SparklesIcon className="h-5 w-5 text-weflora-teal" />
          Citations
        </div>
        <button
          onClick={closeEvidencePanel}
          className="h-8 w-8 flex items-center justify-center cursor-pointer text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          title="Close"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-6 overflow-y-auto flex-1">
        
        {/* 1. Value & Output Type */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex justify-between items-start mb-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Result</div>
                {extendedEvidence.outputType && (
                    <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-mono uppercase">
                        {extendedEvidence.outputType}
                    </span>
                )}
            </div>
            <div className="text-lg font-bold text-slate-800 leading-snug">
                {extendedEvidence.displayValue || extendedEvidence.label}
            </div>
        </div>

        {/* 2. Reasoning (Mandatory) */}
        {extendedEvidence.reasoning && (
            <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <InfoIcon className="h-4 w-4 text-weflora-teal" />
                    Reasoning
                </div>
                <div className="text-sm text-slate-700 leading-relaxed bg-weflora-mint/10 border border-weflora-teal/20 rounded-lg p-3">
                    {extendedEvidence.reasoning}
                </div>
            </div>
        )}

        {/* 3. Provenance Info */}
        <div className="grid grid-cols-2 gap-4">
            {extendedEvidence.templateId && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Skill Template</div>
                    <div className="text-xs font-medium text-slate-700 truncate" title={extendedEvidence.templateId}>
                        {SKILL_TEMPLATES[extendedEvidence.templateId as SkillTemplateId]?.name || extendedEvidence.templateId}
                    </div>
                </div>
            )}
            {extendedEvidence.model && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Model</div>
                    <div className="text-xs font-medium text-slate-700">{extendedEvidence.model}</div>
                </div>
            )}
        </div>

        {/* 4. Sources / Context */}
        <div>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            <DatabaseIcon className="h-4 w-4 text-slate-400" />
            Context Used
          </div>
          {sources.length === 0 ? (
            <div className="text-xs text-slate-400 italic pl-6">No citations available.</div>
          ) : (
            <ul className="space-y-2">
              {sources.map((s, idx) => (
                <li key={`${s}-${idx}`} className="text-xs text-slate-600 bg-white border border-slate-200 rounded p-2 flex items-start gap-2">
                  <div className="mt-0.5 text-weflora-teal">•</div>
                  <div>{s}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 5. Metadata Footer */}
        <div className="border-t border-slate-100 pt-4 mt-2 space-y-1">
            {activeEvidence.generatedAt && (
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <ClockIcon className="h-3 w-3" />
                    <span>Run at: {activeEvidence.generatedAt}</span>
                </div>
            )}
            {extendedEvidence.promptHash && (
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <TagIcon className="h-3 w-3" />
                    <span className="font-mono">Hash: {extendedEvidence.promptHash}</span>
                </div>
            )}
        </div>

      </div>
    </aside>
  );
};

export default EvidencePanel;
