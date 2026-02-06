/**
 * Vault Review Service
 * 
 * Handles review queue operations.
 * 
 * Design principles:
 * - Direct table reads for fetches (fast, deterministic, no schema cache issues)
 * - RPC only for state mutations (claim, update) wrapped with rpcSafe
 */

import { supabase } from './supabaseClient';
import { recordRpcCall, rpcSafe } from '../utils/safeAction';
import { type VaultStatus } from '../utils/vaultStatus';

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
 * Compute issues for a vault object
 */
function computeIssues(row: any): string[] {
  const issues: string[] = [];
  if (!row.record_type) issues.push('Missing record type');
  if (!row.title) issues.push('Missing title');
  if (!row.description) issues.push('Missing description');
  if (!row.tags || row.tags.length === 0) issues.push('No tags');
  if (row.confidence === null || row.confidence === undefined) issues.push('No confidence score');
  return issues;
}

/**
 * Fetch the review queue using direct table read
 * 
 * Returns items with status 'pending' or 'needs_review' that are not currently in_review
 */
export async function fetchReviewQueue(limit = 50): Promise<VaultReviewQueueItem[]> {
  const startTime = Date.now();
  
  // Direct table query - faster and more reliable than RPC
  const { data, error, status } = await supabase
    .from('vault_objects')
    .select('*')
    .in('status', ['pending', 'needs_review'])
    .order('created_at', { ascending: true })
    .limit(limit);

  recordRpcCall({
    name: 'vault_objects.select (review queue)',
    status,
    latencyMs: Date.now() - startTime,
    hasAuthHeader: true,
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

  // Map rows and compute issues client-side
  return (data ?? []).map((row) => ({
    ...mapRowToQueueItem(row),
    issues: computeIssues(row),
  }));
}

/**
 * Claim the next item for review (mutation - uses RPC)
 * 
 * This is a state mutation that:
 * - Finds the next pending/needs_review item
 * - Atomically updates status to in_review
 * - Uses FOR UPDATE SKIP LOCKED for concurrency
 */
export async function claimNextReview(): Promise<VaultReviewQueueItem | null> {
  // Use rpcSafe for mutations - provides clear error if RPC is missing
  const { data, error } = await rpcSafe(supabase, 'vault_claim_next_review', {});

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

  const row = rows[0] as Record<string, unknown>;
  return {
    ...mapRowToQueueItem(row),
    issues: computeIssues(row),
  };
}

/**
 * Get a vault object for review by ID using direct table read
 * 
 * Direct query is faster and more reliable than RPC for simple reads
 */
export async function getVaultForReview(id: string): Promise<VaultReviewDetail | null> {
  const startTime = Date.now();

  // Direct table query - never breaks if table exists
  const { data, error, status } = await supabase
    .from('vault_objects')
    .select('*')
    .eq('id', id)
    .single();

  recordRpcCall({
    name: 'vault_objects.select (single)',
    status,
    latencyMs: Date.now() - startTime,
    hasAuthHeader: true,
    hasApiKey: true,
  });

  if (error) {
    // PGRST116 = no rows found - this is expected for missing records
    if (error.code === 'PGRST116') {
      return null;
    }
    
    console.error('[vault-review] get error', {
      statusCode: error.code,
      message: error.message,
      details: error.details,
    });
    throw new Error(`Failed to get vault object: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    ...mapRowToQueueItem(data),
    issues: computeIssues(data),
    sha256: data.sha256 ?? null,
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

/**
 * Update review form data (mutation - uses RPC)
 * 
 * This is a state mutation that atomically updates review fields
 * and can transition status based on validation rules.
 */
export async function updateReview(input: UpdateReviewInput): Promise<{ success: boolean; error?: string }> {
  // Use rpcSafe for mutations - provides clear error if RPC is missing
  const { error } = await rpcSafe(supabase, 'vault_update_review', {
    p_id: input.id,
    p_record_type: input.recordType ?? null,
    p_title: input.title ?? null,
    p_description: input.description ?? null,
    p_tags: input.tags ?? null,
    p_confidence: input.confidence ?? null,
    p_relevance: input.relevance ?? null,
    p_status: input.status ?? null,
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
