import type { DraftMatrix, DraftMatrixColumn, DraftMatrixRow } from '../types.ts';

export const minimalDraftColumns: DraftMatrixColumn[] = [
  {
    id: 'species',
    label: 'Species',
    kind: 'trait',
    datatype: 'string',
    why: 'Scientific species name for the shortlist.'
  },
  {
    id: 'genus',
    label: 'Genus',
    kind: 'trait',
    datatype: 'string',
    why: 'Genus used to diversify the planting palette.'
  },
  {
    id: 'commonName',
    label: 'Common Name',
    kind: 'trait',
    datatype: 'string',
    why: 'Common name for stakeholder review.'
  },
  {
    id: 'keyReason',
    label: 'Key Reason/Justification',
    kind: 'score',
    datatype: 'string',
    why: 'Why this species is a good fit for the site.'
  },
  {
    id: 'notes',
    label: 'Notes',
    kind: 'trait',
    datatype: 'string',
    why: 'Additional notes and caveats.'
  }
];

export const buildDraftMatrix = (rows: DraftMatrixRow[] = []): DraftMatrix => ({
  id: 'street-tree-shortlist',
  title: 'Street tree shortlist',
  columns: [...minimalDraftColumns],
  rows
});
