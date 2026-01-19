import type { ArtifactRecord, StepRecord } from '../contracts/zod.ts';
import policyFixture from './agentOutputs/compliance.policy_grounded.json';
import procurementFixture from './agentOutputs/compliance.procurement_screen.json';
import memoFixture from './agentOutputs/document.compliance_memo.json';
import diversityFixture from './agentOutputs/biodiversity.species_diversity_score.json';

const pickSample = (fixture: any, index: number): StepRecord => fixture.samples[index];

const withRun = (step: StepRecord, runId: string, scopeId: string): StepRecord => ({
  ...step,
  run_id: runId,
  scope_id: scopeId
});

export type DemoRun = {
  id: string;
  scopeId: string;
  title: string;
  status: string;
  createdAt: string;
  steps: StepRecord[];
  artifacts: ArtifactRecord[];
};

export const demoRuns: DemoRun[] = [
  {
    id: 'b1d6e0c1-6de6-4f24-8c7e-9e3a9f2a3b01',
    scopeId: 'scope-demo-001',
    title: 'Downtown Corridor Compliance',
    status: 'complete',
    createdAt: '2026-01-19T10:00:00Z',
    steps: [
      withRun(pickSample(policyFixture, 0), 'b1d6e0c1-6de6-4f24-8c7e-9e3a9f2a3b01', 'scope-demo-001'),
      withRun(pickSample(procurementFixture, 0), 'b1d6e0c1-6de6-4f24-8c7e-9e3a9f2a3b01', 'scope-demo-001'),
      withRun(pickSample(memoFixture, 0), 'b1d6e0c1-6de6-4f24-8c7e-9e3a9f2a3b01', 'scope-demo-001')
    ],
    artifacts: [
      {
        schema_version: '1.0.0',
        id: 'f0a9e11b-9930-4d08-9d05-0f0a9d7b32c9',
        run_id: 'b1d6e0c1-6de6-4f24-8c7e-9e3a9f2a3b01',
        scope_id: 'scope-demo-001',
        type: 'compliance.memo.v1',
        title: 'Compliance Memo Draft',
        version: 1,
        status: 'final',
        supersedes: null,
        derived_from_steps: [
          '2f6e2fa5-1a05-4b38-93ad-c9f1e57066f1',
          '28a7866b-66fd-4e21-8a42-80a1dfac7f76'
        ],
        content: {
          format: 'markdown',
          body: '## Compliance Memo\n\nSummary of policy alignment and procurement screening.'
        },
        evidence: [],
        assumptions: [],
        created_at: '2026-01-19T10:08:00Z'
      }
    ]
  },
  {
    id: 'b7931f9a-6f2d-4e17-9f61-6f2f9ab1a802',
    scopeId: 'scope-demo-006',
    title: 'Species Mix Diversity Review',
    status: 'partial',
    createdAt: '2026-01-19T10:28:00Z',
    steps: [
      withRun(pickSample(diversityFixture, 0), 'b7931f9a-6f2d-4e17-9f61-6f2f9ab1a802', 'scope-demo-006'),
      withRun(pickSample(diversityFixture, 1), 'b7931f9a-6f2d-4e17-9f61-6f2f9ab1a802', 'scope-demo-006')
    ],
    artifacts: []
  }
];
