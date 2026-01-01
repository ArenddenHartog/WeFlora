type ExtractResult = { jsonText: string | null; reason?: string };

const tryParse = (candidate: string): boolean => {
  try {
    JSON.parse(candidate);
    return true;
  } catch {
    return false;
  }
};

const extractFromFence = (raw: string, fence: string): string | null => {
  const start = raw.indexOf(fence);
  if (start === -1) return null;
  const end = raw.indexOf('```', start + fence.length);
  if (end === -1) return null;
  return raw.slice(start + fence.length, end).trim();
};

const extractByBrackets = (raw: string): string | null => {
  const startIdx = raw.search(/[\{\[]/);
  if (startIdx === -1) return null;
  const openChar = raw[startIdx];
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  for (let i = startIdx; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === openChar) depth += 1;
    if (ch === closeChar) depth -= 1;
    if (depth === 0) {
      return raw.slice(startIdx, i + 1);
    }
  }
  return null;
};

const extractLastResort = (raw: string): string | null => {
  const objStart = raw.indexOf('{');
  const objEnd = raw.lastIndexOf('}');
  if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
    const candidate = raw.slice(objStart, objEnd + 1);
    if (tryParse(candidate)) return candidate;
  }
  const arrStart = raw.indexOf('[');
  const arrEnd = raw.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
    const candidate = raw.slice(arrStart, arrEnd + 1);
    if (tryParse(candidate)) return candidate;
  }
  return null;
};

export const extractFirstJson = (raw: string): ExtractResult => {
  const trimmed = raw.trim();
  if (!trimmed) return { jsonText: null, reason: 'empty' };

  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    if (tryParse(trimmed)) return { jsonText: trimmed };
  }

  const jsonFence = extractFromFence(trimmed, '```json');
  if (jsonFence && tryParse(jsonFence)) return { jsonText: jsonFence };

  const anyFence = extractFromFence(trimmed, '```');
  if (anyFence && tryParse(anyFence)) return { jsonText: anyFence };

  const bracketCandidate = extractByBrackets(trimmed);
  if (bracketCandidate && tryParse(bracketCandidate)) return { jsonText: bracketCandidate };

  const lastResort = extractLastResort(trimmed);
  if (lastResort) return { jsonText: lastResort };

  return { jsonText: null, reason: 'no-json-found' };
};
