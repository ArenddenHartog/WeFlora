/**
 * Vault Review Service
 * 
 * Handles review queue operations using dedicated RPCs.
 */

import { supabase } from './supabaseClient';
import { recordRpcCall } from '../utils/safeAction';
import { VAULT_STATUS, type VaultStatus } from '../utils/vaultStatus';

/**
 * Queue item returned from vault_review_queue RPC
 */
export interface VaultReviewQueueItem {
  id: string;
  ownerUserId: string;
  filename: string;
  title: string | null;
  description: string | null;
  recordType: string | null;
  mimeType: string;
  sizeBytes: number;
  confidence: number | null;
  relevance: number | null;
  status: VaultStatus;
  storageBucket: string;
  storagePath: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  issues: string[];
}

/**
 * Detail item returned from vault_get_for_review RPC
 */
export interface VaultReviewDetail extends VaultReviewQueueItem {
  sha256: string | null;
}

/**
 * Map raw database row to VaultReviewQueueItem
 */
function mapRowToQueueItem(row: any): VaultReviewQueueItem {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    filename: row.filename,
    title: row.title ?? null,
    description: row.description ?? null,
    recordType: row.record_type ?? null,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes ?? 0,
    confidence: row.confidence ?? null,
    relevance: row.relevance ?? null,
    status: (row.status ?? 'pending') as VaultStatus,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    issues: row.issues ?? [],
  };
}

/**
 * Fetch the review queue
 */
export async function fetchReviewQueue(limit = 50): Promise<VaultReviewQueueItem[]> {
  const startTime = Date.now();
  
  const { data, error, status } = await supabase.rpc('vault_review_queue', {
    p_limit: limit,
  });

  recordRpcCall({
    name: 'vault_review_queue',
    status,
    latencyMs: Date.now() - startTime,
    hasAuthHeader: true, // Supabase client includes this
    hasApiKey: true,
  });

  if (error) {
    console.error('[vault-review] queue fetch error', {
      statusCode: error.code,
      message: error.message,
      details: error.details,
    });
    throw new Error(`Failed to fetch review queue: ${error.message}`);
  }

  return (data ?? []).map(mapRowToQueueItem);
}

/**
 * Claim the next item for review
 */
export async function claimNextReview(): Promise<VaultReviewQueueItem | null> {
  const startTime = Date.now();

  const { data, error, status } = await supabase.rpc('vault_claim_next_review');

  recordRpcCall({
    name: 'vault_claim_next_review',
    status,
    latencyMs: Date.now() - startTime,
    hasAuthHeader: true,
    hasApiKey: true,
  });

  if (error) {
    console.error('[vault-review] claim error', {
      statusCode: error.code,
      message: error.message,
      details: error.details,
    });
    throw new Error(`Failed to claim review: ${error.message}`);
  }

  // RPC returns array, get first item
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  if (rows.length === 0) {
    return null;
  }

  return mapRowToQueueItem(rows[0]);
}

/**
 * Get a vault object for review by ID
 */
export async function getVaultForReview(id: string): Promise<VaultReviewDetail | null> {
  const startTime = Date.now();

  const { data, error, status } = await supabase.rpc('vault_get_for_review', {
    p_id: id,
  });

  recordRpcCall({
    name: 'vault_get_for_review',
    status,
    latencyMs: Date.now() - startTime,
    hasAuthHeader: true,
    hasApiKey: true,
  });

  if (error) {
    console.error('[vault-review] get error', {
      statusCode: error.code,
      message: error.message,
      details: error.details,
    });
    throw new Error(`Failed to get vault object: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    ...mapRowToQueueItem(row),
    sha256: row.sha256 ?? null,
  };
}

/**
 * Update review form data
 */
export interface UpdateReviewInput {
  id: string;
  recordType?: string;
  title?: string;
  description?: string;
  tags?: string[];
  confidence?: number;
  relevance?: number;
  status?: 'accepted' | 'blocked' | 'needs_review' | 'draft';
}

export async function updateReview(input: UpdateReviewInput): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now();

  const { data, error, status } = await supabase.rpc('vault_update_review', {
    p_id: input.id,
    p_record_type: input.recordType ?? null,
    p_title: input.title ?? null,
    p_description: input.description ?? null,
    p_tags: input.tags ?? null,
    p_confidence: input.confidence ?? null,
    p_relevance: input.relevance ?? null,
    p_status: input.status ?? null,
  });

  recordRpcCall({
    name: 'vault_update_review',
    status,
    latencyMs: Date.now() - startTime,
    hasAuthHeader: true,
    hasApiKey: true,
  });

  if (error) {
    console.error('[vault-review] update error', {
      statusCode: error.code,
      message: error.message,
      details: error.details,
    });
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get file URL for preview
 */
export async function getReviewFileUrl(item: VaultReviewQueueItem): Promise<string> {
  const { data, error } = await supabase.storage
    .from(item.storageBucket)
    .createSignedUrl(item.storagePath, 60 * 10);

  if (error || !data?.signedUrl) {
    throw new Error('Unable to generate file URL.');
  }

  return data.signedUrl;
}
