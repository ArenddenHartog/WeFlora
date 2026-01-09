import type { DerivedConstraints, DerivedInput, EvidenceGraph, EvidenceItem, EvidenceSource } from '../types.ts';
import type { Claim, Constraint, EvidenceItem as PcivEvidenceItem, EvidenceGraphSnapshot } from './types.ts';
import { CONSTRAINT_REGISTRY_MAP } from '../../domain/constraints/constraintRegistry.ts';

const CONSTRAINT_POINTER_MAP: Record<string, string> = {
  'site.locationType': '/context/site/locationType',
  'site.locationHint': '/context/site/geo/locationHint',
  'site.soil.type': '/context/site/soil/type',
  'site.soil.moisture': '/context/site/soil/moisture',
  'site.soil.compaction': '/context/site/soil/compaction',
  'site.lightExposure': '/context/site/light',
  'site.rootingVolumeClass': '/context/site/space/rootingVolumeClass',
  'site.crownClearanceClass': '/context/site/space/crownClearanceClass',
  'stress.heat': '/context/site/stressors/heat',
  'stress.drought': '/context/site/stressors/drought',
  'regulatory.setting': '/context/regulatory/setting',
  'regulatory.utilitiesConflicts': '/context/regulatory/constraints/utilityConflicts',
  'regulatory.setbacksKnown': '/context/regulatory/constraints/setbacksKnown',
  'species.primaryGoal': '/context/species/goals/primaryGoal',
  'species.allergiesOrToxicityConcern': '/context/species/constraints/allergiesOrToxicityConcern',
  'supply.availabilityRequired': '/context/supply/availabilityRequired'
};

export const buildContextPatchesFromConstraints = (constraints: Constraint[]) =>
  constraints
    .map((constraint) => {
      const pointer = CONSTRAINT_POINTER_MAP[constraint.key];
      if (!pointer) return null;
      return { pointer, value: constraint.value };
    })
    .filter(Boolean) as Array<{ pointer: string; value: unknown }>;

const claimEvidenceLookup = (claims: Claim[]) => {
  const map = new Map<string, string[]>();
  claims.forEach((claim) => {
    const pointer = CONSTRAINT_POINTER_MAP[claim.normalized.key];
    if (!pointer) return;
    map.set(pointer, claim.evidenceRefs.map((ref) => ref.evidenceId));
  });
  return map;
};

export const buildDerivedConstraintsFromPciv = (constraints: Constraint[]): DerivedConstraints => {
  const getValue = (key: string) => constraints.find((entry) => entry.key === key)?.value ?? null;
  const confidenceByField: Record<string, number> = {};
  constraints.forEach((constraint) => {
    const registry = CONSTRAINT_REGISTRY_MAP.get(constraint.key);
    if (!registry) return;
    confidenceByField[constraint.key] = constraint.confidence;
  });
  return {
    regulatory: {
      setting: getValue('regulatory.setting') as string | null,
      saltToleranceRequired: null,
      protectedZone: null,
      permitNeeded: null,
      maxHeightClass: null,
      notes: null
    },
    site: {
      lightExposure: getValue('site.lightExposure') as string | null,
      soilType: getValue('site.soil.type') as string | null,
      moisture: getValue('site.soil.moisture') as string | null,
      compactionRisk: getValue('site.soil.compaction') as string | null,
      rootingVolumeClass: getValue('site.rootingVolumeClass') as string | null,
      crownClearanceClass: getValue('site.crownClearanceClass') as string | null,
      utilitiesPresent: getValue('regulatory.utilitiesConflicts') as boolean | null,
      setbacksKnown: getValue('regulatory.setbacksKnown') as boolean | null
    },
    equity: {
      priorityZones: null,
      heatVulnerability: null,
      asthmaBurden: null,
      underservedFlag: null
    },
    biophysical: {
      canopyCover: null,
      lstClass: null,
      distanceToPaved: null,
      floodRisk: null
    },
    meta: {
      derivedFrom: [],
      confidenceByField
    }
  };
};

export const buildDerivedInputsFromPciv = (
  constraints: Constraint[],
  claims: Claim[],
  timelineEntryId?: string,
  status: DerivedInput['status'] = 'proposed'
): Record<string, DerivedInput> => {
  const evidenceByPointer = claimEvidenceLookup(claims);
  return constraints.reduce<Record<string, DerivedInput>>((acc, constraint) => {
    const pointer = CONSTRAINT_POINTER_MAP[constraint.key];
    if (!pointer) return acc;
    acc[pointer] = {
      pointer,
      value: constraint.value,
      confidence: constraint.confidence,
      evidenceItemIds: evidenceByPointer.get(pointer),
      timelineEntryId,
      status
    };
    return acc;
  }, {});
};

export const buildEvidenceSourcesFromPciv = (sources: Array<{ sourceId: string; title: string }>): EvidenceSource[] =>
  sources.map((source) => ({
    id: source.sourceId,
    title: source.title,
    retrievedAt: new Date().toISOString()
  }));

export const buildEvidenceItemsFromPciv = (
  claims: Claim[],
  evidenceItems: PcivEvidenceItem[]
): EvidenceItem[] => {
  const evidenceMap = new Map(evidenceItems.map((item) => [item.evidenceId, item]));
  const claimByEvidence = new Map<string, Claim>();
  claims.forEach((claim) => {
    claim.evidenceRefs.forEach((ref) => {
      if (!claimByEvidence.has(ref.evidenceId)) {
        claimByEvidence.set(ref.evidenceId, claim);
      }
    });
  });
  const referencedEvidenceIds = new Set(claimByEvidence.keys());
  return evidenceItems
    .filter((item) => referencedEvidenceIds.has(item.evidenceId))
    .map((item) => {
      const claim = claimByEvidence.get(item.evidenceId);
      const citations = [
        {
          sourceId: item.sourceId,
          locator: { page: item.locator.page, section: item.locator.section, row: item.locator.row?.toString() }
        }
      ];
      const kind = claim?.domain === 'regulatory' ? 'regulatory' : claim?.domain === 'equity' ? 'equity' : 'biophysical';
    return {
      id: item.evidenceId,
      kind,
      claim: claim?.statement ?? item.text ?? 'Evidence excerpt',
      citations
    };
  });
};

export const buildEvidenceGraphFromPciv = (snapshot: EvidenceGraphSnapshot): EvidenceGraph => {
  const nodes = snapshot.nodes.map((node) => ({
    id: node.nodeId,
    type: node.nodeType,
    label: node.label,
    confidence: node.confidence ?? undefined,
    metadata: node.payload
  }));
  const edges = snapshot.edges.map((edge) => {
    let type: 'supports' | 'derived_from' | 'influences' | 'produced_by' | 'produces' | 'filters' | 'scores' | 'conflicts_with';
    switch (edge.edgeType) {
      case 'cites':
        type = 'produces';
        break;
      case 'supports':
        type = 'supports';
        break;
      case 'derives':
        type = 'derived_from';
        break;
      case 'influences':
        type = 'influences';
        break;
      case 'conflicts':
        type = 'conflicts_with';
        break;
      default:
        type = 'produced_by';
    }
    return {
      from: edge.fromNodeId,
      to: edge.toNodeId,
      type,
      weight: edge.weight,
      polarity: edge.polarity === 'negative' ? 'negative' : 'positive'
    };
  });
  return { nodes, edges };
};
