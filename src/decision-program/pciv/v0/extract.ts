import type { PcivConstraint, PcivFieldProvenance, PcivSource } from './types';

const nowId = () => `pciv-${crypto.randomUUID()}`;

type FieldSuggestion = {
  value: string | number | boolean;
  provenance: PcivFieldProvenance;
  sourceId?: string;
  snippet?: string;
};

const extractSnippet = (text: string, regex: RegExp) => {
  const match = text.match(regex);
  if (!match) return undefined;
  return match[0].slice(0, 160);
};

const sourceTextBundle = (sources: PcivSource[]) =>
  sources
    .filter((source) => source.status === 'parsed' && source.content)
    .map((source) => ({ sourceId: source.id, text: source.content ?? '' }));

export const deriveFieldSuggestions = (sources: PcivSource[], locationHint?: string) => {
  const suggestions: Record<string, FieldSuggestion> = {};
  if (locationHint) {
    suggestions['/context/site/geo/locationHint'] = {
      value: locationHint,
      provenance: 'user-entered'
    };
  }

  const texts = sourceTextBundle(sources);
  texts.forEach(({ sourceId, text }) => {
    if (/utility|overhead|underground/i.test(text)) {
      suggestions['/context/regulatory/constraints/utilityConflicts'] = {
        value: true,
        provenance: 'source-backed',
        sourceId,
        snippet: extractSnippet(text, /utility|overhead|underground/i)
      };
    }
    if (/setback|right[- ]of[- ]way/i.test(text)) {
      suggestions['/context/regulatory/constraints/setbacksKnown'] = {
        value: true,
        provenance: 'source-backed',
        sourceId,
        snippet: extractSnippet(text, /setback|right[- ]of[- ]way/i)
      };
    }
    if (/compaction|compacted/i.test(text)) {
      suggestions['/context/site/soil/compaction'] = {
        value: 'high',
        provenance: 'source-backed',
        sourceId,
        snippet: extractSnippet(text, /compaction|compacted/i)
      };
    }
    if (/salt|deicing/i.test(text)) {
      suggestions['/context/regulatory/setting'] = {
        value: 'municipalStreet',
        provenance: 'source-backed',
        sourceId,
        snippet: extractSnippet(text, /salt|deicing/i)
      };
    }
  });

  return suggestions;
};

export const deriveConstraintsFromSources = (sources: PcivSource[]): PcivConstraint[] => {
  const constraints: PcivConstraint[] = [];
  sourceTextBundle(sources).forEach(({ sourceId, text }) => {
    if (/permit|required permit/i.test(text)) {
      constraints.push({
        id: nowId(),
        key: 'regulatory.permitNeeded',
        domain: 'regulatory',
        label: 'Permit needed',
        value: true,
        provenance: 'source-backed',
        sourceId,
        snippet: extractSnippet(text, /permit|required permit/i)
      });
    }
    if (/protected zone|conservation|heritage/i.test(text)) {
      constraints.push({
        id: nowId(),
        key: 'regulatory.protectedZone',
        domain: 'regulatory',
        label: 'Protected zone',
        value: true,
        provenance: 'source-backed',
        sourceId,
        snippet: extractSnippet(text, /protected zone|conservation|heritage/i)
      });
    }
    if (/salt|deicing/i.test(text)) {
      constraints.push({
        id: nowId(),
        key: 'regulatory.saltToleranceRequired',
        domain: 'regulatory',
        label: 'Salt tolerance required',
        value: true,
        provenance: 'source-backed',
        sourceId,
        snippet: extractSnippet(text, /salt|deicing/i)
      });
    }
    if (/utility|overhead|underground/i.test(text)) {
      constraints.push({
        id: nowId(),
        key: 'regulatory.utilitiesConflicts',
        domain: 'regulatory',
        label: 'Utility conflicts',
        value: true,
        provenance: 'source-backed',
        sourceId,
        snippet: extractSnippet(text, /utility|overhead|underground/i)
      });
    }
  });
  return constraints;
};
