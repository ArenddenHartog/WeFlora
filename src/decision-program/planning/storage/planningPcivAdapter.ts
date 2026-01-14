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
  listRunsForScope,
  getLatestArtifactByType,
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

// ============================================================================
// Public API
// ============================================================================

/**
 * Load the latest Planning run snapshot for a given scope.
 * Returns null if no run exists or if access is denied.
 *
 * Gracefully handles auth/RLS errors by returning null.
 */
export async function loadLatestPlanningRunForScope(
  supabase: SupabaseClient,
  scopeId: string
): Promise<PlanningRunSnapshot | null> {
  try {
    // Get all runs for scope (existing function doesn't have ordering/limit)
    const allRuns = await listRunsForScope(scopeId);
    if (allRuns.length === 0) {
      return null;
    }

    // Sort by updated_at descending and take the most recent
    const latestRun = allRuns.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];

    // Get Planning execution state artifact
    const artifact = await getLatestArtifactByType(latestRun.id, PLANNING_ARTIFACT_TYPE);
    if (!artifact) {
      return null;
    }

    // Parse artifact payload
    const payload = artifact.payload as any;

    return {
      runId: payload.runId || latestRun.id,
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
    // Rethrow unexpected errors
    throw error;
  }
}

/**
 * Save a Planning run snapshot to PCIV storage.
 * Creates a new draft run if needed, then upserts the execution state artifact.
 *
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
    // Check if we need to create a new PCIV run
    // For simplicity, we'll use the Planning runId as PCIV run ID if possible
    // Otherwise, create a draft run and store the Planning runId in the payload
    
    // Try to find existing run
    const runs = await listRunsForScope(scopeId);
    let pcivRunId = runs.find(r => r.id === run.runId)?.id;

    if (!pcivRunId) {
      // Create new draft run with ownership
      const newRun = await createDraftRun(scopeId, { ownership: 'owned' });
      pcivRunId = newRun.id;
    }

    // Upsert execution state artifact
    const artifactId = stableArtifactId(pcivRunId, PLANNING_ARTIFACT_TYPE);
    const now = new Date().toISOString();

    await upsertArtifacts(pcivRunId, [
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
    ]);
  } catch (error) {
    // Gracefully handle auth/RLS errors
    if (error instanceof PcivAuthRequiredError || error instanceof PcivRlsDeniedError) {
      console.warn('Planning: Cannot save run (auth/RLS):', error.message);
      return; // No-op
    }
    // Rethrow unexpected errors
    throw error;
  }
}
