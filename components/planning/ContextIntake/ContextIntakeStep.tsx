import React, { useEffect, useMemo, useState } from 'react';
import type { Claim, Constraint, EvidenceItem, Source } from '../../../src/decision-program/pciv/types.ts';
import SourceUploader from './SourceUploader';
import ClaimsReviewPanel from './ClaimsReviewPanel';
import ConstraintsConfirmPanel from './ConstraintsConfirmPanel';
import {
  createPlanningContext,
  fetchConstraints,
  fetchGraph,
  lockConstraints,
  registerSource,
  reviewClaim,
  runExtraction
} from '../../../services/pcivService.ts';

export interface ContextIntakeResult {
  contextVersionId: string;
  constraints: Constraint[];
  claims: Claim[];
  evidenceItems: EvidenceItem[];
  sources: Source[];
  graph: Awaited<ReturnType<typeof fetchGraph>>;
}

export interface ContextIntakeStepProps {
  onComplete: (result: ContextIntakeResult) => void;
  onCancel?: () => void;
}

type Stage = 'add' | 'review' | 'confirm';

const ContextIntakeStep: React.FC<ContextIntakeStepProps> = ({ onComplete, onCancel }) => {
  const [stage, setStage] = useState<Stage>('add');
  const [contextVersionId, setContextVersionId] = useState<string>('');
  const [locationHint, setLocationHint] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [constraints, setConstraints] = useState<Constraint[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [locationSourceAdded, setLocationSourceAdded] = useState(false);

  useEffect(() => {
    const init = async () => {
      const created = await createPlanningContext();
      setContextVersionId(created.graph.contextVersionId);
    };
    init();
  }, []);

  const handleAddFiles = async (files: FileList) => {
    if (!contextVersionId) return;
    const added: Source[] = [];
    for (const file of Array.from(files)) {
      const content = await file.text();
      const source = await registerSource(contextVersionId, {
        type: 'file',
        title: file.name,
        mimeType: file.type,
        metadata: { content, size: file.size, uploadedBy: 'user' }
      });
      added.push(source);
    }
    setSources((prev) => [...prev, ...added]);
  };

  const handleExtract = async () => {
    if (!contextVersionId) return;
    setIsExtracting(true);
    if (locationHint && !locationSourceAdded) {
      const locationSource = await registerSource(contextVersionId, {
        type: 'location_hint',
        title: `Location hint: ${locationHint}`,
        metadata: { content: locationHint }
      });
      setSources((prev) => [...prev, locationSource]);
      setLocationSourceAdded(true);
    }
    const extracted = await runExtraction(contextVersionId);
    setEvidenceItems(extracted.evidenceItems);
    setClaims(extracted.claims);
    setStage('review');
    setIsExtracting(false);
  };

  const handleUpdateClaim = async (claimId: string, update: { status: Claim['status']; correctedValue?: unknown }) => {
    if (!contextVersionId) return;
    await reviewClaim(contextVersionId, claimId, update);
    setClaims((prev) =>
      prev.map((claim) =>
        claim.claimId === claimId
          ? {
              ...claim,
              status: update.status,
              normalized: update.correctedValue !== undefined
                ? { ...claim.normalized, value: update.correctedValue }
                : claim.normalized,
              confidence: update.status === 'corrected' ? Math.max(0.75, claim.confidence) : claim.confidence
            }
          : claim
      )
    );
    const updatedConstraints = await fetchConstraints(contextVersionId);
    setConstraints(updatedConstraints);
  };

  const handleReviewConstraints = async () => {
    if (!contextVersionId) return;
    const updatedConstraints = await fetchConstraints(contextVersionId);
    setConstraints(updatedConstraints);
    setStage('confirm');
  };

  const handleConfirm = async () => {
    if (!contextVersionId) return;
    const confirmed = await lockConstraints(contextVersionId);
    const graph = await fetchGraph(contextVersionId);
    onComplete({
      contextVersionId,
      constraints: confirmed,
      claims,
      evidenceItems,
      sources,
      graph
    });
  };

  const stageLabel = useMemo(() => {
    switch (stage) {
      case 'add':
        return 'Stage A · Add context';
      case 'review':
        return 'Stage B · Review claims';
      case 'confirm':
        return 'Stage C · Confirm constraints';
      default:
        return '';
    }
  }, [stage]);

  return (
    <div className="h-full bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">Context intake</p>
          <h1 className="text-lg font-semibold text-slate-800">Planning Context Intake (PCIV)</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">{stageLabel}</span>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600"
            >
              Back to planning
            </button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {stage === 'add' && (
          <SourceUploader
            locationHint={locationHint}
            sources={sources}
            onLocationHintChange={setLocationHint}
            onAddFiles={handleAddFiles}
            onContinue={handleExtract}
            isBusy={isExtracting}
          />
        )}
        {stage === 'review' && (
          <ClaimsReviewPanel
            claims={claims}
            evidenceItems={evidenceItems}
            sources={sources}
            onUpdateClaim={handleUpdateClaim}
            onContinue={handleReviewConstraints}
          />
        )}
        {stage === 'confirm' && (
          <ConstraintsConfirmPanel
            constraints={constraints}
            claims={claims}
            evidenceItems={evidenceItems}
            sources={sources}
            onConfirm={handleConfirm}
          />
        )}
      </div>
    </div>
  );
};

export default ContextIntakeStep;
