/**
 * Planning Persistence Adapter (PCIV-backed)
 *
 * This module provides Planning-specific persistence using the PCIV v1 storage adapter.
 * It eliminates the need for a separate planning_runs table by storing execution state
 * as PCIV artifacts.
 *
 * Key concepts:
 * - scopeId: Derived from projectId (fallback: 'project')
 * - Planning execution state stored as artifact type 'planning.execution_state.v1'
 * - Uses PCIV run lifecycle (draft/committed) for Planning runs
 * - RLS-aware: degrades gracefully when user is not authenticated
 *
 * Contract rules:
 * - All DB access via src/decision-program/pciv/v1/storage/supabase.ts
 * - No direct Supabase queries
 * - No schema additions outside schemas.ts
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createDraftRun,
  upsertArtifacts,
  fetchRunById,
  getLatestCommittedRunForScope,
  fetchContextViewByRunId,
} from '../../pciv/v1/storage/supabase.ts';
import { PcivAuthRequiredError, PcivRlsDeniedError } from '../../pciv/v1/storage/rls-errors.ts';

// ============================================================================
// Types
// ============================================================================

export interface PlanningRunSnapshot {
  runId: string;
  programId: string;
  executionState: any;
  status: string;
  projectId: string | null;
  updatedAt: string;
}

// ============================================================================
// Constants
// ============================================================================

const PLANNING_ARTIFACT_TYPE = 'planning.execution_state.v1';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Derive scopeId from projectId with fallback to 'project'.
 */
export function deriveScopeId(projectId?: string | null): string {
  return projectId || 'project';
}

/**
 * Generate a stable artifact ID for Planning execution state.
 * Uses simple concatenation for determinism (allows overwrites).
 */
function stableArtifactId(runId: string, type: string): string {
  return `${runId}:${type}`;
}

/**
 * Timeout wrapper to prevent infinite spinners.
 * Throws if promise doesn't resolve within specified milliseconds.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms}ms`)),
        ms
      )
    ),
  ]);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Load the latest Planning run snapshot for a given scope.
 * Returns null if no run exists or if access is denied.
 *
 * Uses getLatestCommittedRunForScope to find the run, then fetches the full context view.
 * Includes 8-second timeout to prevent infinite spinners.
 */
export async function loadLatestPlanningRunForScope(
  supabase: SupabaseClient,
  scopeId: string
): Promise<PlanningRunSnapshot | null> {
  try {
    // Get the latest committed/partial_committed run for this scope
    const run = await withTimeout(
      getLatestCommittedRunForScope(scopeId),
      8000,
      'loadLatestPlanningRunForScope (get run)'
    );

    if (!run) {
      return null;
    }

    // Fetch full context view for this run (includes artifacts)
    const contextView = await withTimeout(
      fetchContextViewByRunId(run.id),
      8000,
      'loadLatestPlanningRunForScope (fetch context view)'
    );

    // Find the planning execution state artifact
    const artifacts = contextView.artifactsByType[PLANNING_ARTIFACT_TYPE] ?? [];
    const artifact = artifacts[0]; // Get first (should only be one)

    if (!artifact) {
      return null;
    }

    // Parse artifact payload
    const payload = artifact.payload as any;

    return {
      runId: payload.runId || artifact.runId,
      programId: payload.programId || '',
      executionState: payload.executionState || {},
      status: payload.status || 'unknown',
      projectId: payload.projectId || scopeId,
      updatedAt: artifact.updatedAt,
    };
  } catch (error) {
    // Gracefully handle auth/RLS errors
    if (error instanceof PcivAuthRequiredError || error instanceof PcivRlsDeniedError) {
      console.warn('Planning: Cannot load run (auth/RLS):', error.message);
      return null;
    }
    // Timeout or other errors - rethrow for UI to handle
    throw error;
  }
}

/**
 * Save a Planning run snapshot to PCIV storage.
 * Creates a new draft run if needed, then upserts the execution state artifact.
 *
 * Uses fetchRunById pattern (no listRunsForScope dependency).
 * Includes 8-second timeout to prevent infinite spinners.
 * Gracefully handles auth/RLS errors by no-op (logs warning).
 */
export async function savePlanningRunSnapshot(
  supabase: SupabaseClient,
  scopeId: string,
  run: {
    runId: string;
    programId: string;
    executionState: any;
    status: string;
    projectId?: string | null;
  }
): Promise<void> {
  try {
    // Try to fetch existing run directly (no run listing)
    let pcivRunId = run.runId;
    const existingRun = await withTimeout(
      fetchRunById(pcivRunId).catch(() => null),
      8000,
      'savePlanningRunSnapshot (fetch)'
    );

    if (!existingRun) {
      // Create new draft run with ownership
      const newRun = await withTimeout(
        createDraftRun(scopeId, { ownership: 'owned' }),
        8000,
        'savePlanningRunSnapshot (create)'
      );
      pcivRunId = newRun.id;
    }

    // Upsert execution state artifact
    const artifactId = stableArtifactId(pcivRunId, PLANNING_ARTIFACT_TYPE);
    const now = new Date().toISOString();

    await withTimeout(
      upsertArtifacts(pcivRunId, [
        {
          id: artifactId,
          runId: pcivRunId,
          type: PLANNING_ARTIFACT_TYPE,
          payload: {
            runId: run.runId,
            programId: run.programId,
            executionState: run.executionState,
            status: run.status,
            projectId: run.projectId || scopeId,
          },
          createdAt: now,
          updatedAt: now,
        },
      ]),
      8000,
      'savePlanningRunSnapshot (upsert)'
    );
  } catch (error) {
    // Gracefully handle auth/RLS errors
    if (error instanceof PcivAuthRequiredError || error instanceof PcivRlsDeniedError) {
      console.warn('Planning: Cannot save run (auth/RLS):', error.message);
      return; // No-op
    }
    // Timeout or other errors - rethrow for UI to handle
    throw error;
  }
}
