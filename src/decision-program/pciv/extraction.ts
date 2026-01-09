import { CONSTRAINT_REGISTRY_MAP } from '../../domain/constraints/constraintRegistry.ts';
import type { Claim, ClaimDomain, ClaimType, EvidenceItem, Source } from './types.ts';

const now = () => new Date().toISOString();

const normalizeText = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

const detectEnumMatch = (text: string, options: string[]) =>
  options.find((option) => text.includes(option.toLowerCase()));

const domainFromKey = (key: string): ClaimDomain => {
  if (key.startsWith('regulatory.')) return 'regulatory';
  if (key.startsWith('site.')) return 'biophysical';
  if (key.startsWith('stress.')) return 'biophysical';
  if (key.startsWith('species.')) return 'other';
  if (key.startsWith('supply.')) return 'supply';
  return 'other';
};

const inferClaimType = (key: string): ClaimType => {
  if (key.includes('required') || key.includes('known')) return 'requirement';
  if (key.includes('setting')) return 'classification';
  return 'fact';
};

const buildClaim = (args: {
  key: string;
  value: unknown;
  evidenceId: string;
  quote?: string;
  strength?: 'direct' | 'supporting' | 'weak';
  rationale?: string;
}): Claim => {
  const entry = CONSTRAINT_REGISTRY_MAP.get(args.key);
  const statement = `${entry?.label ?? args.key}: ${String(args.value)}`;
  return {
    claimId: `claim-${crypto.randomUUID()}`,
    contextVersionId: '',
    domain: domainFromKey(args.key),
    claimType: inferClaimType(args.key),
    statement,
    normalized: {
      key: args.key,
      value: args.value,
      unit: entry?.unit,
      datatype: entry?.datatype ?? 'string'
    },
    confidence: 0,
    confidenceRationale: args.rationale ?? 'heuristic match',
    status: 'proposed',
    review: {},
    evidenceRefs: [
      {
        evidenceId: args.evidenceId,
        quote: args.quote,
        strength: args.strength ?? 'supporting'
      }
    ],
    createdAt: now()
  };
};

const parseCsv = (text: string) => {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [] as Record<string, string>[];
  const headers = lines[0].split(',').map((cell) => cell.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((cell) => cell.trim());
    return headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[header] = cells[index] ?? '';
      return acc;
    }, {});
  });
};

const extractClaimsFromText = (evidence: EvidenceItem, text: string) => {
  const claims: Claim[] = [];
  const normalized = normalizeText(text);
  const regulatoryMap: Array<[string, string]> = [
    ['provincial road', 'regulatory.setting'],
    ['municipal street', 'regulatory.setting'],
    ['private development', 'regulatory.setting'],
    ['nature area', 'regulatory.setting']
  ];
  regulatoryMap.forEach(([token, key]) => {
    if (!normalized.includes(token)) return;
    const registry = CONSTRAINT_REGISTRY_MAP.get(key);
    if (!registry) return;
    const value = registry.allowedValues?.find((entry) => entry.toLowerCase().includes(token.split(' ')[0])) ??
      registry.allowedValues?.[0] ?? token;
    claims.push(
      buildClaim({
        key,
        value,
        evidenceId: evidence.evidenceId,
        quote: token,
        strength: 'direct',
        rationale: 'direct quote'
      })
    );
  });

  const soilTypes = ['sand', 'loam', 'clay', 'peat', 'structural soil', 'mixed'];
  const soilMatch = soilTypes.find((type) => normalized.includes(type));
  if (soilMatch) {
    const value = soilMatch.replace('structural soil', 'structuralSoil');
    claims.push(
      buildClaim({
        key: 'site.soil.type',
        value,
        evidenceId: evidence.evidenceId,
        quote: soilMatch,
        strength: 'direct',
        rationale: 'direct quote'
      })
    );
  }

  const moistureMatch = detectEnumMatch(normalized, ['dry', 'moist', 'wet', 'waterlogged']);
  if (moistureMatch) {
    const value = moistureMatch === 'waterlogged' ? 'waterloggedRisk' : moistureMatch;
    claims.push(
      buildClaim({
        key: 'site.soil.moisture',
        value,
        evidenceId: evidence.evidenceId,
        quote: moistureMatch,
        strength: 'supporting',
        rationale: 'keyword match'
      })
    );
  }

  const compactionMatch = detectEnumMatch(normalized, ['low', 'medium', 'high']);
  if (normalized.includes('compaction') && compactionMatch) {
    claims.push(
      buildClaim({
        key: 'site.soil.compaction',
        value: compactionMatch,
        evidenceId: evidence.evidenceId,
        quote: `compaction ${compactionMatch}`,
        strength: 'supporting',
        rationale: 'keyword match'
      })
    );
  }

  const lightMap: Array<[string, string]> = [
    ['full sun', 'fullSun'],
    ['partial shade', 'partialShade'],
    ['shade', 'shade']
  ];
  lightMap.forEach(([token, value]) => {
    if (!normalized.includes(token)) return;
    claims.push(
      buildClaim({
        key: 'site.lightExposure',
        value,
        evidenceId: evidence.evidenceId,
        quote: token,
        strength: 'supporting',
        rationale: 'keyword match'
      })
    );
  });

  return claims;
};

const extractClaimsFromTable = (evidence: EvidenceItem, row: Record<string, string>) => {
  const claims: Claim[] = [];
  Object.entries(row).forEach(([header, value]) => {
    const normalizedHeader = normalizeText(header);
    const registryEntry = [...CONSTRAINT_REGISTRY_MAP.values()].find((entry) =>
      normalizeText(entry.label).includes(normalizedHeader) || normalizeText(entry.key).includes(normalizedHeader)
    );
    if (!registryEntry) return;
    let normalizedValue: unknown = value;
    if (registryEntry.datatype === 'boolean') {
      normalizedValue = /yes|true|present|required|known/i.test(value);
    } else if (registryEntry.datatype === 'enum' && registryEntry.allowedValues) {
      const match = registryEntry.allowedValues.find((option) => normalizeText(value).includes(option.toLowerCase()));
      if (match) normalizedValue = match;
    }
    claims.push(
      buildClaim({
        key: registryEntry.key,
        value: normalizedValue,
        evidenceId: evidence.evidenceId,
        quote: `${header}: ${value}`,
        strength: 'direct',
        rationale: 'table match'
      })
    );
  });
  return claims;
};

export const extractEvidenceAndClaims = (sources: Source[]) => {
  const evidenceItems: EvidenceItem[] = [];
  const claims: Claim[] = [];
  sources.forEach((source) => {
    const content = String(source.metadata?.content ?? '');
    if (!content) return;
    if (source.mimeType?.includes('csv') || source.title.endsWith('.csv')) {
      const rows = parseCsv(content);
      rows.forEach((row, index) => {
        const evidence: EvidenceItem = {
          evidenceId: `evidence-${crypto.randomUUID()}`,
          contextVersionId: source.contextVersionId,
          sourceId: source.sourceId,
          kind: 'table_row',
          locator: { row: index + 1 },
          text: Object.values(row).join(' | '),
          data: row,
          createdAt: now()
        };
        evidenceItems.push(evidence);
        extractClaimsFromTable(evidence, row).forEach((claim) => claims.push(claim));
      });
      return;
    }

    if (source.mimeType?.includes('geo+json') || source.title.endsWith('.geojson')) {
      try {
        const geojson = JSON.parse(content) as { features?: Array<{ id?: string; properties?: Record<string, unknown> }> };
        (geojson.features ?? []).forEach((feature, index) => {
          const evidence: EvidenceItem = {
            evidenceId: `evidence-${crypto.randomUUID()}`,
            contextVersionId: source.contextVersionId,
            sourceId: source.sourceId,
            kind: 'map_feature',
            locator: { featureId: feature.id ? String(feature.id) : String(index + 1) },
            data: feature.properties ?? {},
            createdAt: now()
          };
          evidenceItems.push(evidence);
        });
      } catch (error) {
        console.warn('pciv_geojson_parse_failed', { sourceId: source.sourceId, error });
      }
      return;
    }

    const evidence: EvidenceItem = {
      evidenceId: `evidence-${crypto.randomUUID()}`,
      contextVersionId: source.contextVersionId,
      sourceId: source.sourceId,
      kind: 'text_span',
      locator: {},
      text: content,
      createdAt: now()
    };
    evidenceItems.push(evidence);
    extractClaimsFromText(evidence, content).forEach((claim) => claims.push(claim));
  });

  return { evidenceItems, claims };
};
