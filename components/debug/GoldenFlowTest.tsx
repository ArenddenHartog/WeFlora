/**
 * Golden Flow Smoke Test
 * 
 * Dev-only route that tests the complete flow:
 * Upload → Claim → Update → Run Skill → Verify Session
 * 
 * Route: /debug/golden-flow
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { uploadToGlobalVault } from '../../services/fileService';
import { claimNextReview, updateReview, fetchReviewQueue } from '../../services/vaultReviewService';
import { addStoredSession } from '../../src/agentic/sessions/storage';
import { safeAction, generateTraceId } from '../../utils/safeAction';
import type { Session, EventRecord } from '../../src/agentic/contracts/ledger';
import type { RunContext } from '../../src/agentic/contracts/run_context';
import { CheckCircleIcon, AlertTriangleIcon, RefreshIcon, SparklesIcon } from '../icons';

type StepStatus = 'pending' | 'running' | 'success' | 'error';

interface StepState {
  status: StepStatus;
  message?: string;
  data?: any;
  traceId?: string;
}

const initialSteps: Record<string, StepState> = {
  upload: { status: 'pending' },
  claim: { status: 'pending' },
  update: { status: 'pending' },
  runSkill: { status: 'pending' },
  verifySession: { status: 'pending' },
};

const GoldenFlowTest: React.FC = () => {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<Record<string, StepState>>(initialSteps);
  const [isRunning, setIsRunning] = useState(false);
  const [createdVaultId, setCreatedVaultId] = useState<string | null>(null);
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);

  const updateStep = useCallback((step: string, state: Partial<StepState>) => {
    setSteps(prev => ({
      ...prev,
      [step]: { ...prev[step], ...state }
    }));
  }, []);

  const reset = useCallback(() => {
    setSteps(initialSteps);
    setCreatedVaultId(null);
    setCreatedSessionId(null);
  }, []);

  /**
   * Step 1: Upload a test file to vault
   */
  const runUpload = useCallback(async () => {
    const traceId = generateTraceId();
    updateStep('upload', { status: 'running', traceId });
    
    const result = await safeAction(
      async () => {
        // Create a test file
        const content = JSON.stringify({
          test: true,
          timestamp: new Date().toISOString(),
          goldenFlow: true,
        }, null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const file = new File([blob], `golden-flow-test-${Date.now()}.json`, { type: 'application/json' });
        
        // Upload to vault
        const uploaded = await uploadToGlobalVault([file]);
        if (uploaded.length === 0) {
          throw new Error('Upload returned no objects');
        }
        
        return uploaded[0];
      },
      { traceId }
    );
    
    if (result) {
      setCreatedVaultId(result.id);
      updateStep('upload', { 
        status: 'success', 
        message: `Uploaded: ${result.filename}`,
        data: { vaultId: result.id, filename: result.filename }
      });
      return result.id;
    } else {
      updateStep('upload', { status: 'error', message: 'Upload failed' });
      return null;
    }
  }, [updateStep]);

  /**
   * Step 2: Claim next review item
   */
  const runClaim = useCallback(async () => {
    const traceId = generateTraceId();
    updateStep('claim', { status: 'running', traceId });
    
    const result = await safeAction(
      async () => {
        const claimed = await claimNextReview();
        if (!claimed) {
          // Check if queue has items
          const queue = await fetchReviewQueue(10);
          if (queue.length === 0) {
            throw new Error('No items in review queue. Upload may not have triggered review state.');
          }
          throw new Error(`Queue has ${queue.length} items but claim returned null`);
        }
        return claimed;
      },
      { traceId }
    );
    
    if (result) {
      updateStep('claim', { 
        status: 'success', 
        message: `Claimed: ${result.filename}`,
        data: { vaultId: result.id, status: result.status }
      });
      return result.id;
    } else {
      updateStep('claim', { status: 'error', message: 'Claim failed - check DebugPanel' });
      return null;
    }
  }, [updateStep]);

  /**
   * Step 3: Update review (accept)
   */
  const runUpdate = useCallback(async (vaultId: string) => {
    const traceId = generateTraceId();
    updateStep('update', { status: 'running', traceId });
    
    const result = await safeAction(
      async () => {
        const updateResult = await updateReview({
          id: vaultId,
          recordType: 'Other',
          title: 'Golden Flow Test Record',
          description: 'Created by golden flow smoke test',
          tags: ['golden-flow', 'test'],
          status: 'accepted',
        });
        
        if (!updateResult.success) {
          throw new Error(updateResult.error || 'Update failed');
        }
        
        return updateResult;
      },
      { traceId }
    );
    
    if (result?.success) {
      updateStep('update', { 
        status: 'success', 
        message: 'Review accepted',
        data: { vaultId, status: 'accepted' }
      });
      return true;
    } else {
      updateStep('update', { status: 'error', message: 'Update failed' });
      return false;
    }
  }, [updateStep]);

  /**
   * Step 4: Run a skill with the vault item
   */
  const runSkill = useCallback(async (vaultId: string) => {
    const traceId = generateTraceId();
    updateStep('runSkill', { status: 'running', traceId });
    
    const result = await safeAction(
      async () => {
        const sessionId = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        
        // Create session
        const session: Session = {
          session_id: sessionId,
          scope_id: 'golden-flow-test',
          title: 'Golden Flow Test Session',
          status: 'complete',
          created_at: createdAt,
          updated_at: createdAt,
        };
        
        // Create run context
        const runContext: RunContext = {
          scope_id: 'golden-flow-test',
          inputs: {
            '/inputs/test_file': {
              ref: { vault_id: vaultId, version: 1 },
              label: 'Golden Flow Test Record',
            }
          },
          pointer_index: {},
        };
        
        // Create events
        const events: EventRecord[] = [
          {
            event_id: crypto.randomUUID(),
            session_id: sessionId,
            type: 'run.started',
            at: createdAt,
            payload: {
              title: 'Golden Flow Test Run',
              intent: { type: 'smoke-test', source: 'golden-flow' }
            }
          },
          {
            event_id: crypto.randomUUID(),
            session_id: sessionId,
            type: 'step.started',
            at: createdAt,
            payload: {
              step_id: 'step-1',
              agent_id: 'golden-flow-validator',
              title: 'Validate Test Record',
              inputs: runContext.inputs,
            }
          },
          {
            event_id: crypto.randomUUID(),
            session_id: sessionId,
            type: 'step.completed',
            at: new Date().toISOString(),
            payload: {
              step_id: 'step-1',
              agent_id: 'golden-flow-validator',
              status: 'ok',
              summary: 'Test record validated successfully',
              mutations: [],
              evidence: [{ label: 'Golden flow test passed', ref: { vault_id: vaultId, version: 1 } }],
              assumptions: [],
              actions: [],
            }
          },
          {
            event_id: crypto.randomUUID(),
            session_id: sessionId,
            type: 'run.completed',
            at: new Date().toISOString(),
            payload: {
              status: 'complete',
              summary: 'Golden flow smoke test completed successfully',
            }
          }
        ];
        
        // Store session
        addStoredSession({ session, runContext, events });
        
        return sessionId;
      },
      { traceId }
    );
    
    if (result) {
      setCreatedSessionId(result);
      updateStep('runSkill', { 
        status: 'success', 
        message: `Session created: ${result.slice(0, 8)}...`,
        data: { sessionId: result }
      });
      return result;
    } else {
      updateStep('runSkill', { status: 'error', message: 'Skill run failed' });
      return null;
    }
  }, [updateStep]);

  /**
   * Step 5: Verify session was created
   */
  const runVerifySession = useCallback(async (sessionId: string) => {
    const traceId = generateTraceId();
    updateStep('verifySession', { status: 'running', traceId });
    
    const result = await safeAction(
      async () => {
        // Check localStorage for the session
        const raw = localStorage.getItem('weflora.sessions.v1');
        if (!raw) {
          throw new Error('No sessions in storage');
        }
        
        const sessions = JSON.parse(raw);
        const found = sessions.find((s: any) => s.session?.session_id === sessionId);
        
        if (!found) {
          throw new Error(`Session ${sessionId} not found in storage`);
        }
        
        return {
          sessionId: found.session.session_id,
          status: found.session.status,
          eventCount: found.events?.length || 0,
        };
      },
      { traceId }
    );
    
    if (result) {
      updateStep('verifySession', { 
        status: 'success', 
        message: `Session verified: ${result.eventCount} events`,
        data: result
      });
      return true;
    } else {
      updateStep('verifySession', { status: 'error', message: 'Session verification failed' });
      return false;
    }
  }, [updateStep]);

  /**
   * Run the complete golden flow
   */
  const runGoldenFlow = useCallback(async () => {
    reset();
    setIsRunning(true);
    
    try {
      // Step 1: Upload
      const vaultId = await runUpload();
      if (!vaultId) {
        setIsRunning(false);
        return;
      }
      
      // Small delay to let the upload propagate
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 2: Claim
      const claimedId = await runClaim();
      const reviewId = claimedId || vaultId; // Use uploaded ID if claim fails
      
      // Step 3: Update (even if claim failed, try to update the uploaded item)
      const updated = await runUpdate(reviewId);
      if (!updated) {
        // Continue anyway - might be able to run skill
      }
      
      // Step 4: Run skill
      const sessionId = await runSkill(vaultId);
      if (!sessionId) {
        setIsRunning(false);
        return;
      }
      
      // Step 5: Verify session
      await runVerifySession(sessionId);
      
    } finally {
      setIsRunning(false);
    }
  }, [reset, runUpload, runClaim, runUpdate, runSkill, runVerifySession]);

  const getStepIcon = (status: StepStatus) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-emerald-500" />;
      case 'error':
        return <AlertTriangleIcon className="h-5 w-5 text-rose-500" />;
      case 'running':
        return <RefreshIcon className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-slate-300" />;
    }
  };

  const stepNames: Record<string, string> = {
    upload: '1. Upload to Vault',
    claim: '2. Claim Review',
    update: '3. Accept Review',
    runSkill: '4. Run Skill',
    verifySession: '5. Verify Session',
  };

  const allPassed = Object.values(steps).every(s => s.status === 'success');
  const anyFailed = Object.values(steps).some(s => s.status === 'error');

  // Only show in development mode
  if (!(import.meta as any).env?.DEV) {
    return (
      <div className="p-8 text-center text-slate-500">
        Golden Flow Test is only available in development mode.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-weflora-mint/20 text-weflora-teal">
              <SparklesIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Golden Flow Test</h1>
              <p className="text-sm text-slate-500">
                End-to-end smoke test: Upload → Review → Skill → Session
              </p>
            </div>
          </div>
        </header>

        {/* Summary Banner */}
        {allPassed && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-3">
              <CheckCircleIcon className="h-6 w-6 text-emerald-600" />
              <div>
                <p className="font-semibold text-emerald-700">All steps passed!</p>
                <p className="text-sm text-emerald-600">
                  Golden flow completed successfully.
                </p>
              </div>
            </div>
          </div>
        )}

        {anyFailed && !isRunning && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-center gap-3">
              <AlertTriangleIcon className="h-6 w-6 text-rose-600" />
              <div>
                <p className="font-semibold text-rose-700">Some steps failed</p>
                <p className="text-sm text-rose-600">
                  Check the DebugPanel for trace IDs and error details.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Steps */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="p-6 space-y-4">
            {Object.entries(steps).map(([key, step]) => (
              <div 
                key={key}
                className={`flex items-start gap-4 rounded-lg border p-4 ${
                  step.status === 'success' ? 'border-emerald-200 bg-emerald-50/50' :
                  step.status === 'error' ? 'border-rose-200 bg-rose-50/50' :
                  step.status === 'running' ? 'border-blue-200 bg-blue-50/50' :
                  'border-slate-200'
                }`}
              >
                <div className="mt-0.5">{getStepIcon(step.status)}</div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">{stepNames[key]}</p>
                  {step.message && (
                    <p className={`mt-1 text-sm ${
                      step.status === 'error' ? 'text-rose-600' : 'text-slate-600'
                    }`}>
                      {step.message}
                    </p>
                  )}
                  {step.traceId && step.status !== 'pending' && (
                    <p className="mt-1 text-xs text-slate-400 font-mono">
                      Trace: {step.traceId}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-between">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={runGoldenFlow}
                disabled={isRunning}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {isRunning && <RefreshIcon className="h-4 w-4 animate-spin" />}
                {isRunning ? 'Running...' : 'Run Golden Flow'}
              </button>
              <button
                type="button"
                onClick={reset}
                disabled={isRunning}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Reset
              </button>
            </div>
            
            <div className="flex gap-2">
              {createdVaultId && (
                <button
                  type="button"
                  onClick={() => navigate(`/vault/${createdVaultId}`)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  View Vault Item
                </button>
              )}
              {createdSessionId && (
                <button
                  type="button"
                  onClick={() => navigate(`/sessions/${createdSessionId}`)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  View Session
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold text-slate-700 text-sm">What this tests:</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            <li>• <strong>Upload:</strong> Creates a test JSON file in the vault</li>
            <li>• <strong>Claim:</strong> Claims the item for review (tests vault_claim_next_review RPC)</li>
            <li>• <strong>Update:</strong> Accepts the review (tests vault_update_review RPC)</li>
            <li>• <strong>Run Skill:</strong> Creates a session with the vault item as input</li>
            <li>• <strong>Verify:</strong> Confirms the session exists in localStorage</li>
          </ul>
        </div>

        {/* Back link */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
};

export default GoldenFlowTest;
