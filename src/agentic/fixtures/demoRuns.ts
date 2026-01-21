import type { EventRecord, Session } from '../contracts/ledger';
import type { RunContext } from '../contracts/run_context';
import type { VaultPointer } from '../contracts/vault';

export type DemoRun = {
  id: string;
  scopeId: string;
  title: string;
  status: Session['status'];
  createdAt: string;
  events: EventRecord[];
  session: Session;
  runContext: RunContext;
};

const makePointer = (vaultId: string, label: string): VaultPointer => ({
  ref: { vault_id: vaultId, version: 1 },
  label
});

const makeEventBase = (params: {
  eventId: string;
  sessionId: string;
  runId: string;
  scopeId: string;
  at: string;
  seq: number;
}) => ({
  event_id: params.eventId,
  session_id: params.sessionId,
  run_id: params.runId,
  scope_id: params.scopeId,
  at: params.at,
  by: { kind: 'system', reason: 'demo' } as const,
  seq: params.seq,
  event_version: '1.0.0' as const
});

export const demoRuns: DemoRun[] = [
  (() => {
    const sessionId = 'b1d6e0c1-6de6-4f24-8c7e-9e3a9f2a3b01';
    const runId = sessionId;
    const scopeId = 'scope-demo-001';
    const createdAt = '2026-01-19T10:00:00Z';
    const inputPointer = makePointer('vault-demo-001', 'Policy PDF');
    const outputPointer = makePointer('vault-demo-002', 'Compliance Output');

    const events: EventRecord[] = [
      {
        ...makeEventBase({ eventId: `${sessionId}-run-started`, sessionId, runId, scopeId, at: createdAt, seq: 1 }),
        type: 'run.started',
        payload: {
          title: 'Downtown Corridor Compliance',
          kind: 'skill',
          skill_id: 'compliance.policy_grounded',
          input_bindings: {
            '/inputs/policy_pdf': inputPointer
          }
        }
      },
      {
        ...makeEventBase({ eventId: `${sessionId}-step-started-1`, sessionId, runId, scopeId, at: '2026-01-19T10:03:00Z', seq: 2 }),
        type: 'step.started',
        payload: {
          step_id: 'step-demo-001',
          step_index: 1,
          agent_id: 'compliance.policy_grounded',
          title: 'Policy compliance scan',
          inputs: {
            '/inputs/policy_pdf': inputPointer
          }
        }
      },
      {
        ...makeEventBase({ eventId: `${sessionId}-step-completed-1`, sessionId, runId, scopeId, at: '2026-01-19T10:06:00Z', seq: 3 }),
        type: 'step.completed',
        payload: {
          step_id: 'step-demo-001',
          step_index: 1,
          agent_id: 'compliance.policy_grounded',
          status: 'ok',
          confidence: 'high',
          summary: 'Policy clauses were scanned and key compliance gaps were flagged.',
          output: {
            pointer: outputPointer,
            schema_id: 'weflora.agent_output.compliance.policy_grounded',
            schema_version: '1.0.0'
          },
          mutations: [
            {
              op: 'set',
              path: '/outputs/compliance_summary',
              value: outputPointer,
              reason: 'Primary compliance output'
            }
          ],
          evidence: [
            {
              kind: 'inline',
              label: 'Policy excerpt',
              inline_excerpt: 'Section 4.2 requires 30% native species coverage.'
            }
          ],
          assumptions: [
            {
              statement: 'Species list reflects current procurement plan.',
              validate_next: 'Confirm procurement inventory file.'
            }
          ],
          actions: [
            {
              action_id: 'export.report',
              label: 'Export compliance memo',
              payload: { format: 'pdf' }
            }
          ]
        }
      },
      {
        ...makeEventBase({ eventId: `${sessionId}-run-completed`, sessionId, runId, scopeId, at: '2026-01-19T10:08:00Z', seq: 4 }),
        type: 'run.completed',
        payload: {
          status: 'complete',
          summary: 'Compliance scan complete with export-ready memo.',
          output_pointers: {
            '/outputs/compliance_summary': outputPointer
          }
        }
      }
    ];

    const session: Session = {
      session_id: sessionId,
      scope_id: scopeId,
      run_id: runId,
      title: 'Downtown Corridor Compliance',
      status: 'complete',
      created_at: createdAt,
      created_by: { kind: 'system', reason: 'demo' },
      last_event_at: '2026-01-19T10:08:00Z',
      summary: 'Compliance scan complete with export-ready memo.'
    };

    const runContext: RunContext = {
      run_id: runId,
      scope_id: scopeId,
      kind: 'skill',
      title: 'Downtown Corridor Compliance',
      intent: 'Run compliance policy scan',
      skill_id: 'compliance.policy_grounded',
      created_at: createdAt,
      created_by: { kind: 'human', actor_id: 'demo-user' },
      runtime: { model: 'gpt-5' },
      input_bindings: {
        '/inputs/policy_pdf': inputPointer
      }
    };

    return {
      id: sessionId,
      scopeId,
      title: session.title,
      status: session.status,
      createdAt,
      events,
      session,
      runContext
    };
  })(),
  (() => {
    const sessionId = 'b7931f9a-6f2d-4e17-9f61-6f2f9ab1a802';
    const runId = sessionId;
    const scopeId = 'scope-demo-006';
    const createdAt = '2026-01-19T10:28:00Z';
    const inputPointer = makePointer('vault-demo-101', 'Species list CSV');

    const events: EventRecord[] = [
      {
        ...makeEventBase({ eventId: `${sessionId}-run-started`, sessionId, runId, scopeId, at: createdAt, seq: 1 }),
        type: 'run.started',
        payload: {
          title: 'Species Mix Diversity Review',
          kind: 'skill',
          skill_id: 'biodiversity.species_diversity_score',
          input_bindings: {
            '/inputs/species_list': inputPointer
          }
        }
      },
      {
        ...makeEventBase({ eventId: `${sessionId}-step-started-1`, sessionId, runId, scopeId, at: '2026-01-19T10:30:00Z', seq: 2 }),
        type: 'step.started',
        payload: {
          step_id: 'step-demo-101',
          step_index: 1,
          agent_id: 'biodiversity.species_diversity_score',
          title: 'Species diversity scoring',
          inputs: {
            '/inputs/species_list': inputPointer
          }
        }
      },
      {
        ...makeEventBase({ eventId: `${sessionId}-step-completed-1`, sessionId, runId, scopeId, at: '2026-01-19T10:33:00Z', seq: 3 }),
        type: 'step.completed',
        payload: {
          step_id: 'step-demo-101',
          step_index: 1,
          agent_id: 'biodiversity.species_diversity_score',
          status: 'insufficient_data',
          summary: 'Species list missing abundance counts for diversity scoring.',
          mutations: [],
          insufficient_data: {
            missing: [
              {
                path: '/inputs/species_counts',
                label: 'Species abundance counts',
                hint: 'Provide counts per species for diversity scoring.'
              }
            ],
            recommended_next: [
              {
                label: 'Upload abundance table',
                suggested_input: 'CSV with species_name,count',
                binds_to: '/inputs/species_counts'
              }
            ]
          }
        }
      },
      {
        ...makeEventBase({ eventId: `${sessionId}-run-completed`, sessionId, runId, scopeId, at: '2026-01-19T10:34:00Z', seq: 4 }),
        type: 'run.completed',
        payload: {
          status: 'partial',
          summary: 'Awaiting species abundance counts to complete diversity scoring.'
        }
      }
    ];

    const session: Session = {
      session_id: sessionId,
      scope_id: scopeId,
      run_id: runId,
      title: 'Species Mix Diversity Review',
      status: 'partial',
      created_at: createdAt,
      created_by: { kind: 'system', reason: 'demo' },
      last_event_at: '2026-01-19T10:34:00Z',
      summary: 'Awaiting species abundance counts to complete diversity scoring.'
    };

    const runContext: RunContext = {
      run_id: runId,
      scope_id: scopeId,
      kind: 'skill',
      title: 'Species Mix Diversity Review',
      intent: 'Score species diversity',
      skill_id: 'biodiversity.species_diversity_score',
      created_at: createdAt,
      created_by: { kind: 'human', actor_id: 'demo-user' },
      runtime: { model: 'gpt-5' },
      input_bindings: {
        '/inputs/species_list': inputPointer
      }
    };

    return {
      id: sessionId,
      scopeId,
      title: session.title,
      status: session.status,
      createdAt,
      events,
      session,
      runContext
    };
  })()
];
