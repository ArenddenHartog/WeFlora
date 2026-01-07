import type { DecisionProgram } from '../types.ts';
import { STREET_TREE_SHORTLIST_REQUIRED_POINTERS } from './canonicalPointers.ts';

export const buildProgram = (): DecisionProgram => ({
  id: 'street-tree-decision-program',
  title: 'Street Tree Planning Program',
  description: 'Multi-phase planning program for street tree shortlists.',
  version: 'v0.1',
  steps: [
    {
      id: 'site:derive-site-constraints',
      title: 'Derive site constraints',
      kind: 'agent',
      phase: 'site',
      agentRef: 'derive-site-constraints',
      requiredPointers: [],
      producesPointers: ['/context/site/constraints']
    },
    {
      id: 'species:generate-candidates',
      title: 'Generate candidate species',
      kind: 'agent',
      phase: 'species',
      agentRef: 'generate-candidates',
      requiredPointers: STREET_TREE_SHORTLIST_REQUIRED_POINTERS,
      producesPointers: ['/draftMatrix']
    },
    {
      id: 'species:score-candidates',
      title: 'Score candidate species',
      kind: 'agent',
      phase: 'species',
      agentRef: 'score-candidates',
      requiredPointers: ['/draftMatrix'],
      producesPointers: ['/draftMatrix']
    },
    {
      id: 'species:diversity-check',
      title: 'Run diversity check',
      kind: 'agent',
      phase: 'species',
      agentRef: 'diversity-check',
      requiredPointers: ['/draftMatrix'],
      producesPointers: ['/context/species/diversityCheck', '/draftMatrix']
    },
    {
      id: 'supply:availability-reconcile',
      title: 'Reconcile supply availability',
      kind: 'agent',
      phase: 'supply',
      agentRef: 'availability-reconcile',
      requiredPointers: ['/context/supply/availabilityRequired', '/draftMatrix'],
      producesPointers: ['/context/supply/availabilityStatus', '/draftMatrix']
    }
  ]
});
