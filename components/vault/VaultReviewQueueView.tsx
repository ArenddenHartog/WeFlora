import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DatabaseIcon, FileTextIcon, SparklesIcon } from '../icons';
import { useProject } from '../../contexts/ProjectContext';
import { useUI } from '../../contexts/UIContext';
import { supabase } from '../../services/supabaseClient';
import {
  deriveVaultInventoryRecords,
  fetchVaultInventorySources,
  type VaultInventoryRecord
} from '../../services/vaultInventoryService';

const VaultReviewQueueView: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { projects } = useProject();
  const { showNotification } = useUI();
  const [records, setRecords] = useState<VaultInventoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      const { vaultObjects, projectLinks } = await fetchVaultInventorySources();
      const derived = deriveVaultInventoryRecords(vaultObjects, projectLinks, projects);
      setRecords(derived);
    } catch (error) {
      console.error('[vault-review-queue] load error', error);
      showNotification('Failed to load review queue.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [projects, showNotification]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const startReview = useCallback(async () => {
    const { data, error } = await supabase.rpc('vault_claim_next_review');

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    if (!data?.id) {
      alert('No items to review');
      return;
    }

    navigate(`/vault/review/${data.id}`);
  }, [navigate]);

  const queueItems = useMemo(() => {
    return records
      .filter((record) => record.reviewState !== 'Auto-accepted')
      .map((record) => {
        const issues = [
          ...record.validations.errors,
          ...record.validations.warnings,
          ...(record.completeness.missingCount > 0 ? [`${record.completeness.missingCount} missing fields`] : [])
        ];
        const priority = record.validations.errors.length > 0 ? 'High' : record.completeness.missingCount > 0 ? 'Medium' : 'Low';
        return {
          id: record.recordId,
          type: record.type,
          title: record.title,
          status: record.reviewState === 'Blocked' ? 'Blocked' : 'Awaiting review',
          priority,
          issues: issues.length > 0 ? issues : ['No issues detected'],
          reviewer: 'Unassigned',
          receivedAt: record.updatedAt
        };
      });
  }, [records]);

  return (
    <div className="w-full bg-white p-4 md:p-8" data-layout-root>
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-weflora-mint/15 text-weflora-teal">
            <DatabaseIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Review queue</h1>
            <p className="mt-1 text-sm text-slate-600">Validate and complete incoming context records.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/vault')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Back to inventory
          </button>
          <button
            type="button"
            onClick={startReview}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Start review
          </button>
        </div>
      </header>

      {!id ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600">
          <span>Select a record from the queue or claim the next one to begin reviewing.</span>
          <div>
            <button
              type="button"
              onClick={startReview}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Claim next
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          Reviewing record: <span className="font-semibold text-slate-800">{id}</span>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white">
        <div className="grid grid-cols-[120px_1.6fr_160px_120px_1fr_140px_140px] gap-3 border-b border-slate-200 px-4 py-3 text-xs font-semibold text-slate-500">
          <span>Type</span>
          <span>Title</span>
          <span>Status</span>
          <span>Priority</span>
          <span>Issues</span>
          <span>Reviewer</span>
          <span>Received</span>
        </div>
        <div className="divide-y divide-slate-200">
          {isLoading ? (
            <div className="px-4 py-10 text-center text-sm text-slate-400">Loading review queue…</div>
          ) : null}
          {!isLoading && queueItems.map((item) => (
            <div key={item.id} className="grid grid-cols-[120px_1.6fr_160px_120px_1fr_140px_140px] items-center gap-3 px-4 py-4 text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-weflora-mint/20 text-weflora-teal">
                  <FileTextIcon className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold text-slate-600">{item.type}</span>
              </div>
              <div>
                <p className="font-semibold text-slate-900 line-clamp-1">{item.title}</p>
              </div>
              <span className="text-xs text-slate-500">{item.status}</span>
              <span
                className={`text-xs font-semibold ${
                  item.priority === 'High' ? 'text-rose-600' : item.priority === 'Medium' ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                {item.priority}
              </span>
              <div className="flex flex-wrap gap-1">
                {item.issues.map((issue) => (
                  <span key={issue} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                    {issue}
                  </span>
                ))}
              </div>
              <span className="text-xs text-slate-500">{item.reviewer}</span>
              <span className="text-xs text-slate-500">{new Date(item.receivedAt).toLocaleDateString()}</span>
            </div>
          ))}
          {!isLoading && queueItems.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-400">
              <SparklesIcon className="mx-auto mb-2 h-6 w-6 text-weflora-teal/40" />
              No records awaiting review.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default VaultReviewQueueView;
