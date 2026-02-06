import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  DatabaseIcon,
  FileTextIcon,
  RefreshIcon,
  SparklesIcon,
  XIcon
} from '../icons';
import { useUI } from '../../contexts/UIContext';
import { safeAction, generateTraceId, formatErrorWithTrace } from '../../utils/safeAction';
import { STATUS_META, getStatusBadgeClasses, type VaultStatus } from '../../utils/vaultStatus';
import {
  fetchReviewQueue,
  claimNextReview,
  getVaultForReview,
  updateReview,
  getReviewFileUrl,
  type VaultReviewQueueItem,
  type VaultReviewDetail
} from '../../services/vaultReviewService';

const RECORD_TYPES = ['Policy', 'SpeciesList', 'Site', 'Vision', 'Climate', 'Other'] as const;

/**
 * Priority badge component
 */
const PriorityBadge: React.FC<{ issues: string[] }> = ({ issues }) => {
  const priority = issues.length >= 3 ? 'High' : issues.length >= 1 ? 'Medium' : 'Low';
  const colorClass = priority === 'High' 
    ? 'text-rose-600 bg-rose-50' 
    : priority === 'Medium' 
      ? 'text-amber-600 bg-amber-50' 
      : 'text-emerald-600 bg-emerald-50';
  
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colorClass}`}>
      {priority}
    </span>
  );
};

/**
 * Status badge component using canonical taxonomy
 */
const StatusBadge: React.FC<{ status: VaultStatus }> = ({ status }) => {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getStatusBadgeClasses(status)}`}>
      <span>{meta.icon}</span>
      {meta.label}
    </span>
  );
};

/**
 * Empty state component with diagnostic info
 */
const EmptyState: React.FC<{
  hasAuthError?: boolean;
  onRefresh: () => void;
  onCopyDebug: () => void;
}> = ({ hasAuthError, onRefresh, onCopyDebug }) => (
  <div className="px-4 py-10 text-center">
    <SparklesIcon className="mx-auto mb-3 h-8 w-8 text-weflora-teal/40" />
    <p className="text-sm font-semibold text-slate-700">No records awaiting review</p>
    <p className="mt-1 text-xs text-slate-500">
      All items have been reviewed or there are no pending uploads.
    </p>
    {hasAuthError && (
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-700">
        <p className="font-semibold">Possible auth issue detected</p>
        <p className="mt-1">vault_review_queue() returned 0 items. This could mean:</p>
        <ul className="mt-2 list-disc pl-4 space-y-1">
          <li>No items need review (expected)</li>
          <li>RLS policy is filtering your items</li>
          <li>auth.uid() is returning null</li>
        </ul>
      </div>
    )}
    <div className="mt-4 flex justify-center gap-2">
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
      >
        <RefreshIcon className="h-3.5 w-3.5" />
        Refresh
      </button>
      <button
        type="button"
        onClick={onCopyDebug}
        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50"
      >
        Copy debug info
      </button>
    </div>
  </div>
);

/**
 * Review detail form component
 */
const ReviewDetailForm: React.FC<{
  item: VaultReviewDetail;
  onSave: (input: Parameters<typeof updateReview>[0]) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
}> = ({ item, onSave, onClose, isSaving }) => {
  const [recordType, setRecordType] = useState(item.recordType ?? '');
  const [title, setTitle] = useState(item.title ?? item.filename);
  const [description, setDescription] = useState(item.description ?? '');
  const [tags, setTags] = useState((item.tags ?? []).join(', '));
  const [confidence, setConfidence] = useState(item.confidence?.toString() ?? '');
  const [relevance, setRelevance] = useState(item.relevance?.toString() ?? '');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { showNotification } = useUI();

  // Load preview URL
  useEffect(() => {
    getReviewFileUrl(item)
      .then(setPreviewUrl)
      .catch(() => setPreviewUrl(null));
  }, [item]);

  const handleSubmit = async (status: 'accepted' | 'blocked' | 'needs_review') => {
    const tagsArray = tags.split(',').map(t => t.trim()).filter(Boolean);
    await onSave({
      id: item.id,
      recordType: recordType || undefined,
      title: title || undefined,
      description: description || undefined,
      tags: tagsArray.length > 0 ? tagsArray : undefined,
      confidence: confidence ? parseFloat(confidence) : undefined,
      relevance: relevance ? parseFloat(relevance) : undefined,
      status,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <StatusBadge status={item.status} />
            <PriorityBadge issues={item.issues} />
          </div>
          <h2 className="mt-2 text-lg font-bold text-slate-900">{title || item.filename}</h2>
          <p className="mt-1 text-xs text-slate-500 font-mono">ID: {item.id}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Issues */}
      {item.issues.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-700 mb-2">Issues to address:</p>
          <ul className="space-y-1">
            {item.issues.map((issue) => (
              <li key={issue} className="flex items-center gap-2 text-xs text-amber-600">
                <AlertTriangleIcon className="h-3.5 w-3.5 flex-shrink-0" />
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Form fields */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Record Type <span className="text-rose-500">*</span>
          </label>
          <select
            value={recordType}
            onChange={(e) => setRecordType(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
          >
            <option value="">Select type...</option>
            {RECORD_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            placeholder="Enter title..."
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            placeholder="Enter description..."
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Tags <span className="text-slate-400">(comma-separated)</span>
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
            placeholder="climate, policy, species..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Confidence (0-1)</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
              placeholder="0.8"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Relevance (0-1)</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={relevance}
              onChange={(e) => setRelevance(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
              placeholder="0.9"
            />
          </div>
        </div>
      </div>

      {/* File info */}
      <div className="rounded-lg border border-slate-200 p-3 text-sm">
        <p className="text-xs font-semibold text-slate-700 mb-2">Source file</p>
        <div className="space-y-1 text-xs text-slate-600">
          <p><span className="text-slate-500">Filename:</span> {item.filename}</p>
          <p><span className="text-slate-500">Type:</span> {item.mimeType}</p>
          <p><span className="text-slate-500">Size:</span> {(item.sizeBytes / 1024).toFixed(1)} KB</p>
        </div>
        {previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Preview file
          </a>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => handleSubmit('accepted')}
          disabled={isSaving || !recordType || !title}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {isSaving ? <RefreshIcon className="h-4 w-4 animate-spin" /> : <CheckCircleIcon className="h-4 w-4" />}
          Accept
        </button>
        <button
          type="button"
          onClick={() => handleSubmit('needs_review')}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
        >
          Needs more review
        </button>
        <button
          type="button"
          onClick={() => handleSubmit('blocked')}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
        >
          Block
        </button>
      </div>
    </div>
  );
};

/**
 * Main Review Queue View component
 */
const VaultReviewQueueView: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showNotification } = useUI();
  
  const [queueItems, setQueueItems] = useState<VaultReviewQueueItem[]>([]);
  const [reviewDetail, setReviewDetail] = useState<VaultReviewDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Load queue
  const loadQueue = useCallback(async () => {
    setIsLoading(true);
    setLastError(null);
    
    const result = await safeAction(
      () => fetchReviewQueue(50),
      {
        onError: (error, traceId) => {
          showNotification(formatErrorWithTrace('Failed to load review queue', error.message, traceId), 'error');
          setLastError(error.message);
        }
      }
    );
    
    if (result) {
      setQueueItems(result);
    }
    setIsLoading(false);
  }, [showNotification]);

  // Load detail when ID changes
  const loadDetail = useCallback(async (reviewId: string) => {
    setIsLoading(true);
    const result = await safeAction(
      () => getVaultForReview(reviewId),
      {
        onError: (error, traceId) => {
          showNotification(formatErrorWithTrace('Failed to load review', error.message, traceId), 'error');
        }
      }
    );
    
    if (result) {
      setReviewDetail(result);
    } else {
      // Record not found, go back to queue
      navigate('/vault/review');
    }
    setIsLoading(false);
  }, [navigate, showNotification]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (id) {
      loadDetail(id);
    } else {
      setReviewDetail(null);
    }
  }, [id, loadDetail]);

  // Start review (claim next)
  const handleStartReview = async () => {
    setIsClaiming(true);
    
    const result = await safeAction(
      () => claimNextReview(),
      {
        onError: (error, traceId) => {
          showNotification(formatErrorWithTrace('Failed to claim review', error.message, traceId), 'error');
        }
      }
    );
    
    setIsClaiming(false);
    
    if (result) {
      showNotification('Review claimed successfully', 'success');
      navigate(`/vault/review/${result.id}`);
    } else {
      showNotification('No items available to review', 'error');
    }
  };

  // Handle row click
  const handleRowClick = (item: VaultReviewQueueItem) => {
    navigate(`/vault/review/${item.id}`);
  };

  // Handle save review
  const handleSaveReview = async (input: Parameters<typeof updateReview>[0]) => {
    setIsSaving(true);
    
    const result = await safeAction(
      () => updateReview(input),
      {
        onError: (error, traceId) => {
          showNotification(formatErrorWithTrace('Failed to save review', error.message, traceId), 'error');
        },
        onSuccess: (res, traceId) => {
          if (res.success) {
            showNotification('Review saved successfully', 'success');
            // Reload queue and go back
            loadQueue();
            navigate('/vault/review');
          } else if (res.error) {
            showNotification(formatErrorWithTrace('Save failed', res.error, traceId), 'error');
          }
        }
      }
    );
    
    setIsSaving(false);
  };

  // Copy debug info
  const handleCopyDebug = async () => {
    const debugInfo = {
      traceId: generateTraceId(),
      route: window.location.href,
      queueCount: queueItems.length,
      lastError,
      timestamp: new Date().toISOString()
    };
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
      showNotification('Debug info copied to clipboard', 'success');
    } catch {
      showNotification('Failed to copy debug info', 'error');
    }
  };

  return (
    <div className="w-full bg-white p-4 md:p-8" data-layout-root>
      {/* Header */}
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-weflora-mint/15 text-weflora-teal">
            <DatabaseIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Review queue</h1>
            <p className="mt-1 text-sm text-slate-600">
              Validate and complete incoming context records.
            </p>
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
            onClick={handleStartReview}
            disabled={isClaiming || isLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {isClaiming && <RefreshIcon className="h-4 w-4 animate-spin" />}
            Start review
          </button>
        </div>
      </header>

      {/* Layout: Queue list + Detail panel */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_480px]">
        {/* Queue list */}
        <div className="rounded-2xl border border-slate-200 bg-white">
          {/* Queue header row */}
          <div className="grid grid-cols-[120px_1.5fr_120px_100px_1fr_140px] gap-3 border-b border-slate-200 px-4 py-3 text-xs font-semibold text-slate-500">
            <span>Type</span>
            <span>Title</span>
            <span>Status</span>
            <span>Priority</span>
            <span>Issues</span>
            <span>Created</span>
          </div>

          {/* Queue items */}
          <div className="divide-y divide-slate-200">
            {isLoading && queueItems.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">
                <RefreshIcon className="mx-auto h-6 w-6 animate-spin text-weflora-teal mb-2" />
                Loading review queue…
              </div>
            ) : queueItems.length === 0 ? (
              <EmptyState
                hasAuthError={Boolean(lastError)}
                onRefresh={loadQueue}
                onCopyDebug={handleCopyDebug}
              />
            ) : (
              queueItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleRowClick(item)}
                  className={`grid w-full grid-cols-[120px_1.5fr_120px_100px_1fr_140px] items-center gap-3 px-4 py-4 text-left text-sm text-slate-700 hover:bg-slate-50 ${
                    id === item.id ? 'bg-weflora-mint/10 border-l-2 border-weflora-teal' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-weflora-mint/20 text-weflora-teal">
                      <FileTextIcon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-semibold text-slate-600">
                      {item.recordType ?? 'Unset'}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 line-clamp-1">
                      {item.title ?? item.filename}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                  <PriorityBadge issues={item.issues} />
                  <div className="flex flex-wrap gap-1">
                    {item.issues.slice(0, 2).map((issue) => (
                      <span
                        key={issue}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500"
                      >
                        {issue}
                      </span>
                    ))}
                    {item.issues.length > 2 && (
                      <span className="text-[10px] text-slate-400">
                        +{item.issues.length - 2} more
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Queue footer */}
          <div className="border-t border-slate-200 px-4 py-3 flex justify-between items-center">
            <span className="text-xs text-slate-500">
              {queueItems.length} item{queueItems.length !== 1 ? 's' : ''} in queue
            </span>
            <button
              type="button"
              onClick={loadQueue}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshIcon className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Detail panel */}
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 sticky top-4">
          {id && reviewDetail ? (
            <ReviewDetailForm
              item={reviewDetail}
              onSave={handleSaveReview}
              onClose={() => navigate('/vault/review')}
              isSaving={isSaving}
            />
          ) : id && isLoading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-slate-500 py-10">
              <RefreshIcon className="h-8 w-8 animate-spin text-weflora-teal" />
              Loading review…
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-slate-500 py-10">
              <SparklesIcon className="h-8 w-8 text-weflora-teal/40" />
              <p>Select a record from the queue to review,</p>
              <p>or click "Start review" to claim the next one.</p>
              <button
                type="button"
                onClick={handleStartReview}
                disabled={isClaiming}
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-weflora-teal px-4 py-2 text-xs font-semibold text-white hover:bg-weflora-dark disabled:opacity-50"
              >
                {isClaiming && <RefreshIcon className="h-4 w-4 animate-spin" />}
                Claim next
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default VaultReviewQueueView;
